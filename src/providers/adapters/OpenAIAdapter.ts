import { randomUUID } from 'crypto'

const PROVIDER_PARAM_POLICY = {
  deepseek: { maxTokens: { min: 1, max: 8192, default: 4096 } },
  'openai-compatible': { maxTokens: { min: 1, max: 16384, default: 4096 } },
  openrouter: { maxTokens: { min: 1, max: 16384, default: 4096 } },
  'azure-openai': { maxTokens: { min: 1, max: 16384, default: 4096 } },
  gemini: { maxTokens: { min: 1, max: 32768, default: 4096 } },
  groq: { maxTokens: { min: 1, max: 8192, default: 4096 } },
  ollama: { maxTokens: { min: 1, max: 4096, default: 2048 } },
  kimi: { maxTokens: { min: 1, max: 8192, default: 4096 } },
  minimax: { maxTokens: { min: 1, max: 8192, default: 4096 } },
  lmstudio: { maxTokens: { min: 1, max: 8192, default: 4096 } },
  localai: { maxTokens: { min: 1, max: 8192, default: 4096 } },
  zhipu: { maxTokens: { min: 1, max: 8192, default: 4096 } },
  dashscope: { maxTokens: { min: 1, max: 8192, default: 4096 } },
  doubao: { maxTokens: { min: 1, max: 8192, default: 4096 } },
} as const

const PROVIDER_API_KEY_ENV: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  'openai-compatible': 'OPENAI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  'azure-openai': 'AZURE_OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  kimi: 'KIMI_API_KEY',
  minimax: 'MINIMAX_API_KEY',
  localai: 'LOCALAI_API_KEY',
  zhipu: 'ZHIPU_API_KEY',
  dashscope: 'DASHSCOPE_API_KEY',
  doubao: 'DOUBAO_API_KEY',
}

function normalizeMaxTokens(provider: string | undefined, rawValue: any) {
  const policy = PROVIDER_PARAM_POLICY[provider as keyof typeof PROVIDER_PARAM_POLICY]
    || PROVIDER_PARAM_POLICY['openai-compatible']
  const { min, max, default: defaultValue } = policy.maxTokens

  const n = typeof rawValue === 'string' || typeof rawValue === 'number'
    ? Number(rawValue)
    : NaN

  if (!Number.isFinite(n)) return defaultValue

  const clamped = Math.min(max, Math.max(min, Math.floor(n)))
  if (clamped <= 0) return defaultValue
  return clamped
}

 type RequestToolMap = Map<string, string>

/**
 * An adapter that wraps an OpenAI-compatible API to masquerade as the Anthropic SDK.
 * This is crucial for Phase 2: Intercepting QueryEngine's tools logic and translating it for DeepSeek/Ollama/OpenAI etc.
 */
export class OpenAIAdapter {
  private settings: any
  private baseUrl: string
  private apiKey: string

  constructor(settings: any) {
    this.settings = settings
    this.baseUrl = this.resolveBaseUrl(settings)
    this.apiKey = this.resolveApiKey(settings)
  }

  private resolveBaseUrl(settings: any): string {
    if (settings.baseUrl) return settings.baseUrl
    switch (settings.provider) {
      case 'openrouter': return 'https://openrouter.ai/api/v1'
      case 'azure-openai': return 'https://your-resource.openai.azure.com'
      case 'gemini': return 'https://generativelanguage.googleapis.com/v1beta/openai'
      case 'groq': return 'https://api.groq.com/openai/v1'
      case 'ollama': return 'http://127.0.0.1:11434/v1'
      case 'deepseek': return 'https://api.deepseek.com/v1'
      case 'kimi': return 'https://api.moonshot.cn/v1'
      case 'minimax': return 'https://api.minimax.chat/v1'
      case 'lmstudio': return 'http://127.0.0.1:1234/v1'
      case 'localai': return 'http://127.0.0.1:8080/v1'
      case 'zhipu': return 'https://open.bigmodel.cn/api/paas/v4'
      case 'dashscope': return 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      case 'doubao': return 'https://ark.cn-beijing.volces.com/api/v3'
      default: return 'https://api.openai.com/v1'
    }
  }

  private resolveApiKey(settings: any): string {
    const envName = PROVIDER_API_KEY_ENV[settings.provider || 'openai-compatible']
    return settings.apiKey || (envName ? process.env[envName] : '') || process.env.OPENAI_API_KEY || ''
  }

  private buildRequestUrl(): string {
    if (this.settings.provider === 'azure-openai') {
      const providerOptions = this.settings.providerOptions?.['azure-openai'] || {}
      const deployment = typeof providerOptions.deployment === 'string' ? providerOptions.deployment : ''
      const apiVersion = typeof providerOptions.apiVersion === 'string' && providerOptions.apiVersion
        ? providerOptions.apiVersion
        : '2024-10-21'

      if (!deployment) {
        throw new Error('Azure OpenAI requires providerOptions["azure-openai"].deployment to be configured.')
      }

      return `${this.baseUrl.replace(/\/$/, '')}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`
    }

    return `${this.baseUrl.replace(/\/$/, '')}/chat/completions`
  }

  private buildRequestHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}),
      ...(this.settings.headers || {}),
    }

    const providerOptions = this.settings.providerOptions?.[this.settings.provider] || {}

    if (this.settings.provider === 'openrouter') {
      if (typeof providerOptions.siteUrl === 'string' && providerOptions.siteUrl) {
        headers['HTTP-Referer'] = providerOptions.siteUrl
      }
      if (typeof providerOptions.appName === 'string' && providerOptions.appName) {
        headers['X-Title'] = providerOptions.appName
      }
    }

    if (this.settings.provider === 'azure-openai') {
      delete headers.Authorization
      if (this.apiKey) {
        headers['api-key'] = this.apiKey
      }
    }

    return headers
  }

  private buildReasoningPayload() {
    const effort = this.settings.reasoningEffort
    if (!effort) return {}

    switch (this.settings.provider) {
      // OpenAI-style reasoning effort field
      case 'openai-compatible':
      case 'openrouter':
      case 'azure-openai':
      case 'groq':
        return { reasoning_effort: effort }

      // Gemini OpenAI bridge 更接近 budget/thinking 语义
      case 'gemini':
        return {
          extra_body: {
            reasoning_effort: effort,
            thinking: {
              effort,
            },
          },
        }

      // DeepSeek / 国内 provider：保留统一语义，尽量映射为显式 reasoning 配置
      case 'deepseek':
        return {
          extra_body: {
            reasoning: {
              effort,
            },
          },
        }

      case 'minimax':
      case 'zhipu':
      case 'dashscope':
      case 'doubao':
        return { reasoning: { effort } }

      default:
        return {}
    }
  }

  private buildRequestBody(
    resolvedModel: string,
    openaiMessages: any[],
    normalizedMaxTokens: number,
    isStreaming: boolean,
    openaiTools: any[],
    params: any,
  ) {
    const reasoningPayload = this.buildReasoningPayload()
    const extraBody =
      reasoningPayload && typeof reasoningPayload.extra_body === 'object'
        ? reasoningPayload.extra_body
        : undefined

    const body: Record<string, any> = {
      model: resolvedModel,
      messages: openaiMessages,
      max_tokens: normalizedMaxTokens,
      temperature: params.temperature ?? 0.4,
      stream: isStreaming,
      ...(openaiTools.length > 0 ? { tools: openaiTools } : {}),
      ...reasoningPayload,
      ...(extraBody ? extraBody : {}),
    }

    if (extraBody) {
      delete body.extra_body
    }

    if (this.settings.provider === 'azure-openai') {
      delete body.model
    }

    return body
  }

  // Double exposure for compatibility with various internal usages
  // SDK 上游会调用 `client.beta.messages.create(params, options).withResponse()`
  // 所以需要让 create / stream 方法返回的对象实现 withResponse()
  public beta = {
    messages: {
      create: (params: any, options?: any) => this.wrapWithResponse(this.create(params, options)),
      stream: (params: any, options?: any) => this.wrapWithResponse(this.create({ ...params, stream: true }, options)),
    }
  }

  public messages = {
    create: (params: any, options?: any) => this.wrapWithResponse(this.create(params, options)),
    stream: (params: any, options?: any) => this.wrapWithResponse(this.create({ ...params, stream: true }, options)),
  }

  // Anthropic SDK 的 Promise 是一个具备 .withResponse() 方法的自定义 Promise
  private wrapWithResponse(promise: Promise<any>): any {
    const wrapped: any = promise;
    wrapped.withResponse = () => promise.then(data => ({ data, response: {} as any }));
    return wrapped;
  }

  private async create(params: any, options?: any): Promise<any> {
    const requestToolMap: RequestToolMap = new Map()
    const isStreaming = params.stream === true
    const { openaiMessages, openaiTools } = this.translateToOpenAI(params, requestToolMap)

    // --- 强制收口：统一从 settings 中取 provider 和 model ---
    // Web 场景下，原生传递链可能混入原版的 fallback model 或 mainLoopModel。
    // 为防止发错 model，在此建立统一的拦截校验。
    const resolvedModel = this.settings.model || params.model
    const resolvedProvider = this.settings.provider || 'unknown'
    const normalizedMaxTokens = normalizeMaxTokens(resolvedProvider, params.max_tokens)
    
    // 如果是深求等特定供应商，但收到了类似 claude-* 的模型，通常是原生上游传错了
    if (resolvedProvider !== 'anthropic' && resolvedModel?.startsWith('claude-')) {
      console.warn(`[OpenAIAdapter] Intercepted invalid model propagation: provider=${resolvedProvider}, model=${resolvedModel}. Enforcing settings.model...`)
      throw new Error(`Model Selection Error: Attempted to send Anthropics model '${resolvedModel}' to provider '${resolvedProvider}'. This is an internal state propagation issue. Please ensure settings.json is the single source of truth.`)
    }

    console.error('[OpenAIAdapter debug]', {
      provider: resolvedProvider,
      model: resolvedModel,
      max_tokens: normalizedMaxTokens,
      stream: isStreaming,
    })

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: this.buildRequestHeaders(),
      body: JSON.stringify(
        this.buildRequestBody(
          resolvedModel,
          openaiMessages,
          normalizedMaxTokens,
          isStreaming,
          openaiTools,
          params,
        ),
      ),
      signal: options?.signal
    }

    const response = await fetch(this.buildRequestUrl(), fetchOptions)

    if (!response.ok) {
      let errorText = ''
      try { errorText = await response.text() } catch (e) {}
      throw new Error(`OpenAI-Compatible API Error (${response.status}): ${errorText}`)
    }

    if (!isStreaming) {
      return this.translateNonStreamingResponse(await response.json(), requestToolMap)
    }

    return this.translateStreamingResponse(response, requestToolMap)
  }

  private translateToOpenAI(params: any, requestToolMap: RequestToolMap) {
    const openaiMessages: any[] = []
    const systemText = this.buildSystemText(params.system, params.tools)

    if (systemText) {
      openaiMessages.push({ role: 'system', content: systemText })
    }

    const openaiTools = (params.tools || []).map((t: any) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description || '',
        parameters: t.input_schema || { type: 'object', properties: {} }
      }
    }))

    for (const msg of params.messages || []) {
      if (typeof msg.content === 'string') {
        openaiMessages.push({ role: msg.role, content: msg.content })
        continue
      }

      if (!Array.isArray(msg.content)) {
        continue
      }

      if (msg.role === 'assistant') {
        openaiMessages.push(this.translateAssistantMessage(msg.content, requestToolMap))
        continue
      }

      if (msg.role === 'user') {
        const { userMessage, toolResults } = this.translateUserMessage(msg.content, requestToolMap)
        if (userMessage) {
          openaiMessages.push(userMessage)
        }
        if (toolResults.length > 0) {
          openaiMessages.push(...toolResults)
        }
        continue
      }

      const fallbackText = this.flattenContentBlocksToText(msg.content)
      if (fallbackText) {
        openaiMessages.push({ role: msg.role, content: fallbackText })
      }
    }

    return { openaiMessages, openaiTools }
  }

  private buildSystemText(system: any, tools: any[] | undefined): string {
    let systemText = ''

    if (typeof system === 'string') {
      systemText = system
    } else if (Array.isArray(system)) {
      systemText = system.map((block: any) => block?.text || '').join('\n')
    }

    const hasXmlToolBlock = /<(functions|tools)\b[\s\S]*?<\/(functions|tools)>/i.test(systemText)
    if (!hasXmlToolBlock) {
      return systemText
    }

    if (!tools || tools.length === 0) {
      console.warn('[OpenAIAdapter] System prompt contains XML tool definitions, but params.tools is empty. Preserving XML as supplemental instructions only.')
    } else {
      console.warn('[OpenAIAdapter] System prompt contains XML tool definitions. params.tools remains the source of truth; XML is preserved as supplemental instructions.')
    }

    return `${systemText}\n\nIMPORTANT: Any <functions> or <tools> XML blocks above are supplemental instructions only. Use params.tools as the source of truth for tool definitions, while still following the XML formatting and behavioral constraints.`
  }

  private translateAssistantMessage(contentBlocks: any[], requestToolMap: RequestToolMap) {
    let textContent = ''
    const toolCalls: any[] = []

    for (const block of contentBlocks) {
      if (block?.type === 'text') {
        textContent += block.text || ''
        continue
      }

      if (block?.type !== 'tool_use') {
        continue
      }

      const toolCallId = typeof block.id === 'string' && block.id ? block.id : `call_${randomUUID()}`
      const toolName = typeof block.name === 'string' && block.name ? block.name : 'unknown_tool'
      requestToolMap.set(toolCallId, toolName)

      let argsString = typeof block.input === 'string' ? block.input : JSON.stringify(block.input || {})
      
      // JSON syntax validation hook for tools payload.
      // We perform a test parse. If it fails, instead of pushing a valid tool_call,
      // we'll still pass it to OpenAI. But the reverse flow (Stream or Non-Stream response)
      // is where we actually need to protect the QueryEngine. The protection will be added
      // in the translateNonStreamingResponse and translateStreamingResponse parsing phase.

      toolCalls.push({
        id: toolCallId,
        type: 'function',
        function: {
          name: toolName,
          arguments: argsString
        }
      })
    }

    const mappedMsg: any = { role: 'assistant', content: textContent || null }
    if (toolCalls.length > 0) {
      mappedMsg.tool_calls = toolCalls
    }

    return mappedMsg
  }

  private translateUserMessage(contentBlocks: any[], requestToolMap: RequestToolMap) {
    const userContentParts: any[] = []
    const textSegments: string[] = []
    const toolResults: any[] = []

    for (const block of contentBlocks) {
      if (block?.type === 'text') {
        const text = block.text || ''
        if (text) {
          textSegments.push(text)
          userContentParts.push({ type: 'text', text })
        }
        continue
      }

      if (block?.type === 'image') {
        const translatedImagePart = this.translateImageBlock(block)
        if (translatedImagePart.type === 'image_url') {
          userContentParts.push(translatedImagePart)
        } else {
          textSegments.push(translatedImagePart.text)
          userContentParts.push(translatedImagePart)
        }
        continue
      }

      if (block?.type === 'tool_result') {
        toolResults.push(this.translateToolResultBlock(block, requestToolMap))
        continue
      }

      const placeholder = `[Unsupported content block \"${block?.type || 'unknown'}\" was filtered.]`
      textSegments.push(placeholder)
      userContentParts.push({ type: 'text', text: placeholder })
    }

    let userMessage: any = null
    if (userContentParts.length > 0) {
      const hasRichContent = userContentParts.some((part) => part.type !== 'text')
      userMessage = hasRichContent
        ? { role: 'user', content: userContentParts }
        : { role: 'user', content: textSegments.join('') }
    }

    return { userMessage, toolResults }
  }

  private translateToolResultBlock(block: any, requestToolMap: RequestToolMap) {
    const toolMessage: any = {
      role: 'tool',
      tool_call_id: block.tool_use_id,
      content: this.normalizeToolResultContent(block.content),
    }

    const resolvedName = this.resolveToolResultName(block, requestToolMap)
    if (resolvedName) {
      toolMessage.name = resolvedName
    }

    return toolMessage
  }

  private resolveToolResultName(block: any, requestToolMap: RequestToolMap): string | undefined {
    const mappedName = typeof block?.tool_use_id === 'string' ? requestToolMap.get(block.tool_use_id) : undefined
    const explicitName = typeof block?.name === 'string' ? block.name : undefined
    const safeName = this.sanitizeToolName(mappedName || explicitName)

    if (safeName) {
      return safeName
    }

    return this.providerRequiresToolMessageName() ? 'unknown_tool' : undefined
  }

  private providerRequiresToolMessageName(): boolean {
    return this.settings.provider !== 'ollama'
  }

  private sanitizeToolName(name: string | undefined): string | undefined {
    if (!name) {
      return undefined
    }

    const cleaned = name.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
    return cleaned || undefined
  }

  private normalizeToolResultContent(content: any): string {
    if (typeof content === 'string') {
      return content
    }

    if (Array.isArray(content)) {
      return content
        .map((block) => {
          if (typeof block === 'string') {
            return block
          }
          if (block?.type === 'text') {
            return block.text || ''
          }
          if (block?.type === 'image') {
            return '[Image content was omitted from tool_result during compatibility translation.]'
          }
          if (block?.type) {
            return `[Unsupported ${block.type} block was omitted from tool_result during compatibility translation.]`
          }
          return '[Unsupported tool_result content was omitted during compatibility translation.]'
        })
        .join('\n')
    }

    try {
      return JSON.stringify(content)
    } catch {
      return String(content)
    }
  }

  private translateImageBlock(block: any): any {
    const visionEnabled = this.settings.capabilities?.vision === true
    if (visionEnabled && block?.source?.type === 'base64' && block.source?.data) {
      const mediaType = block.source.media_type || 'image/png'
      return {
        type: 'image_url',
        image_url: {
          url: `data:${mediaType};base64,${block.source.data}`
        }
      }
    }

    return {
      type: 'text',
      text: '[图片内容已被过滤，此模型不支持视觉或图片格式不受支持]'
    }
  }

  private flattenContentBlocksToText(contentBlocks: any[]): string {
    return contentBlocks
      .map((block) => {
        if (block?.type === 'text') {
          return block.text || ''
        }
        if (block?.type === 'image') {
          return '[图片内容已被过滤，此模型不支持视觉或图片格式不受支持]'
        }
        if (block?.type) {
          return `[Unsupported ${block.type} block was filtered.]`
        }
        return ''
      })
      .join('')
  }

  private translateNonStreamingResponse(data: any, requestToolMap: RequestToolMap): any {
    const msg = data.choices?.[0]?.message || {}
    const contentBlocks: any[] = []

    if (typeof msg.content === 'string' && msg.content) {
      contentBlocks.push({ type: 'text', text: msg.content })
    }

    if (msg.tool_calls) {
      for (const call of msg.tool_calls) {
        const toolName = call.function?.name || 'unknown_tool'
        if (call.id) {
          requestToolMap.set(call.id, toolName)
        }

        contentBlocks.push({
          type: 'tool_use',
          id: call.id,
          name: toolName,
          input: this.safeParseJson(call.function?.arguments)
        })
      }
    }

    // Handle invalid JSON parsing at completion. If we failed to parse,
    // we want to stop and let the model know immediately.
    let hasInvalidJsonToolCall = false
    let stopReason = 'end_turn'
    
    if (msg.tool_calls) {
      for (const call of msg.tool_calls) {
        if (!this.isValidJson(call.function?.arguments)) {
          hasInvalidJsonToolCall = true
        }
      }
    }

    const finishReason = data.choices?.[0]?.finish_reason
    if (finishReason === 'tool_calls' || hasInvalidJsonToolCall) stopReason = 'tool_use'
    else if (finishReason === 'length') stopReason = 'max_tokens'
    else if (msg.tool_calls && msg.tool_calls.length > 0) stopReason = 'tool_use'

    return {
      id: data.id || `msg_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      model: data.model || this.settings.model,
      content: contentBlocks,
      stop_reason: stopReason,
      stop_sequence: null,
      usage: {
        input_tokens: data.usage?.prompt_tokens || 0,
        output_tokens: data.usage?.completion_tokens || 0
      }
    }
  }

  private safeParseJson(value: string | undefined) {
    if (!value) {
      return {}
    }

    try {
      return JSON.parse(value)
    } catch {
      // NOTE: Instead of returning a generic _raw object which the underlying QueryEngine will choke on,
      // we could return a specific format or let QueryEngine crash. But wait! QueryEngine uses Zod to validate.
      // If we pass `{_raw: value}`, Zod validation will fail and it will generate an error tool_result itself!
      // However, sometimes it crashes before that. Let's return a special object that acts as a signal.
      return { _raw: value }
    }
  }

  private isValidJson(value: string | undefined) {
    if (!value) return true
    try {
      JSON.parse(value)
      return true
    } catch {
      return false
    }
  }

  private translateStreamingResponse(response: Response, requestToolMap: RequestToolMap) {
    const modelName = this.settings.model || 'openai-compatible'

    // This is the most critical part for Phase 2:
    // Translating OpenAI SSE stream into Anthropic SDK events (content_block_start, input_json_delta, etc)
    const stream = new ReadableStream({
      async start(controller) {
        if (!response.body) {
          controller.close()
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        const messageId = `msg_${Date.now()}`

        controller.enqueue({
          type: 'message_start',
          message: {
            id: messageId,
            type: 'message',
            role: 'assistant',
            model: modelName,
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 }
          }
        })

        let hasStartedText = false
        const activeToolCalls = new Map<number, { id: string, name: string, args: string, started: boolean }>()

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed || trimmed === 'data: [DONE]') continue
              if (!trimmed.startsWith('data: ')) continue

              const dataStr = trimmed.slice(6)
              try {
                const data = JSON.parse(dataStr)
                const delta = data.choices?.[0]?.delta

                if (!delta) continue

                if (delta.content) {
                  if (!hasStartedText) {
                    controller.enqueue({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })
                    hasStartedText = true
                  }
                  controller.enqueue({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: delta.content } })
                }

                if (delta.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index
                    let state = activeToolCalls.get(idx)

                    if (!state) {
                      state = {
                        id: tc.id || `call_${randomUUID()}`,
                        name: tc.function?.name || 'unknown_tool',
                        args: '',
                        started: false
                      }
                      activeToolCalls.set(idx, state)
                    }

                    if (tc.id) {
                      state.id = tc.id
                    }

                    if (tc.function?.name) {
                      state.name = tc.function.name
                      requestToolMap.set(state.id, state.name)
                    }

                    const blockIdx = idx + (hasStartedText ? 1 : 0)
                    if (!state.started && (tc.function?.name || tc.function?.arguments)) {
                      controller.enqueue({
                        type: 'content_block_start',
                        index: blockIdx,
                        content_block: { type: 'tool_use', id: state.id, name: state.name, input: {} }
                      })
                      state.started = true
                    }

                    if (tc.function?.arguments) {
                      state.args += tc.function.arguments
                      controller.enqueue({
                        type: 'content_block_delta',
                        index: blockIdx,
                        delta: { type: 'input_json_delta', partial_json: tc.function.arguments }
                      })
                    }
                  }
                }

                const finishReason = data.choices?.[0]?.finish_reason
                if (finishReason) {
                  if (hasStartedText) {
                    controller.enqueue({ type: 'content_block_stop', index: 0 })
                  }

                  for (const [idx, state] of activeToolCalls.entries()) {
                    if (!state.started) continue
                    const blockIdx = idx + (hasStartedText ? 1 : 0)
                    controller.enqueue({ type: 'content_block_stop', index: blockIdx })
                  }

                  let mappedReason = 'end_turn'
                  if (finishReason === 'tool_calls') mappedReason = 'tool_use'
                  else if (finishReason === 'length') mappedReason = 'max_tokens'
                  else if (activeToolCalls.size > 0) mappedReason = 'tool_use'

                  controller.enqueue({
                    type: 'message_delta',
                    delta: { stop_reason: mappedReason, stop_sequence: null },
                    usage: { output_tokens: 0 }
                  })
                }
              } catch (e) {
                // Ignore parsing errors for incomplete JSON chunks
              }
            }
          }

          controller.enqueue({ type: 'message_stop' })
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      }
    })

    const asyncIterableStream = {
      [Symbol.asyncIterator]() {
        const reader = stream.getReader()
        return {
          async next() {
            const { done, value } = await reader.read()
            if (done) return { done: true, value: undefined }
            return { done: false, value }
          }
        }
      },
      withResponse() {
        return {
          data: asyncIterableStream,
          response,
          request_id: response.headers.get('x-request-id') || `req_${Date.now()}`,
        }
      },
      controller: new AbortController()
    }

    return asyncIterableStream
  }
}

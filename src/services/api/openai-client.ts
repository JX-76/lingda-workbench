import Anthropic from '@anthropic-ai/sdk'

/**
 * Creates an OpenAI compatible client that mimics the Anthropic SDK interface.
 * This is a shim that translates Anthropic messages API calls into OpenAI chat completions API calls.
 */
export function createOpenAICompatibleClient(settings: any) {
  // We return an object that implements the minimal Beta.Messages interface needed by claude.ts
  const client = {
    beta: {
      messages: {
        create: async (params: any, options: any) => {
          return createStreamOrMessage(params, options, settings)
        }
      }
    }
  }
  return client
}

async function createStreamOrMessage(params: any, options: any, settings: any) {
  // Convert Anthropic messages format to OpenAI messages format
  const openaiMessages: any[] = []

  // Add system prompt if present
  if (params.system) {
    let systemText = ''
    if (typeof params.system === 'string') {
      systemText = params.system
    } else if (Array.isArray(params.system)) {
      systemText = params.system.map((block: any) => block.text || '').join('\n')
    }
    if (systemText) {
      openaiMessages.push({ role: 'system', content: systemText })
    }
  }

  // Define available tools (if any)
  const openaiTools = params.tools ? params.tools.map((t: any) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description || '',
      parameters: t.input_schema || { type: 'object', properties: {} }
    }
  })) : undefined

  // Add user and assistant messages
  for (const msg of params.messages) {
    if (typeof msg.content === 'string') {
      openaiMessages.push({ role: msg.role, content: msg.content })
    } else if (Array.isArray(msg.content)) {
      // For Assistant messages, we need to map tool_use blocks into `tool_calls`
      // For User messages, we need to map tool_result blocks into `tool` role messages
      let textContent = ''
      const toolCalls: any[] = []
      const toolResults: any[] = []

      for (const block of msg.content) {
        if (block.type === 'text') {
          textContent += block.text
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: typeof block.input === 'string' ? block.input : JSON.stringify(block.input)
            }
          })
        } else if (block.type === 'tool_result') {
          toolResults.push({
            role: 'tool',
            tool_call_id: block.tool_use_id,
            name: block.name, // Note: OpenAI requires name, but Anthropic tool_result doesn't have it explicitly here. We may need to guess or pass.
            content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content)
          })
        }
      }

      if (msg.role === 'assistant') {
        const assistantMsg: any = { role: 'assistant', content: textContent || null }
        if (toolCalls.length > 0) {
          assistantMsg.tool_calls = toolCalls
        }
        openaiMessages.push(assistantMsg)
      } else {
        // user role
        if (textContent) {
          openaiMessages.push({ role: 'user', content: textContent })
        }
        // inject tool results separately
        if (toolResults.length > 0) {
          openaiMessages.push(...toolResults)
        }
      }
    }
  }

  const isStreaming = params.stream === true
  let baseUrl = settings.baseUrl
  if (!baseUrl) {
    if (settings.provider === 'ollama') baseUrl = 'http://127.0.0.1:11434/v1'
    else if (settings.provider === 'deepseek') baseUrl = 'https://api.deepseek.com/v1'
    else if (settings.provider === 'kimi') baseUrl = 'https://api.moonshot.cn/v1'
    else if (settings.provider === 'minimax') baseUrl = 'https://api.minimax.chat/v1'
    else baseUrl = 'https://api.openai.com/v1' // Default openai compatible
  }

  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey || 'dummy-key'}`
    },
    body: JSON.stringify({
      model: params.model || settings.model,
      messages: openaiMessages,
      max_tokens: params.max_tokens,
      temperature: params.temperature,
      stream: isStreaming,
      ...(openaiTools && openaiTools.length > 0 ? { tools: openaiTools } : {})
    }),
    signal: options?.signal
  }

  // Add fetch polyfill just in case it's Node without global fetch
  const response = await fetch(`${baseUrl}/chat/completions`, fetchOptions)

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI-compatible API Error: ${response.status} ${errorText}`)
  }

  if (!isStreaming) {
    const data = await response.json()
    const msg = data.choices[0].message
    
    // Build content blocks
    const contentBlocks: any[] = []
    if (msg.content) {
      contentBlocks.push({ type: 'text', text: msg.content })
    }
    if (msg.tool_calls) {
      for (const call of msg.tool_calls) {
        contentBlocks.push({
          type: 'tool_use',
          id: call.id,
          name: call.function.name,
          input: JSON.parse(call.function.arguments || '{}')
        })
      }
    }

    let stopReason = 'end_turn'
    if (data.choices[0].finish_reason === 'tool_calls') stopReason = 'tool_use'
    else if (data.choices[0].finish_reason === 'length') stopReason = 'max_tokens'

    // Convert back to Anthropic response format
    return {
      id: data.id,
      type: 'message',
      role: 'assistant',
      model: data.model,
      content: contentBlocks,
      stop_reason: stopReason,
      stop_sequence: null,
      usage: {
        input_tokens: data.usage?.prompt_tokens || 0,
        output_tokens: data.usage?.completion_tokens || 0,
      }
    }
  }

  // Handle streaming
  const stream = new ReadableStream({
    async start(controller) {
      if (!response.body) {
        controller.close()
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      // Send initial message_start event
      controller.enqueue({
        type: 'message_start',
        message: {
          id: `msg_${Date.now()}`,
          type: 'message',
          role: 'assistant',
          model: settings.model,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 }
        }
      })

      // Send content_block_start
      controller.enqueue({
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' }
      })

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.trim() === '') continue
            if (line.trim() === 'data: [DONE]') continue
            
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6)
              try {
                const data = JSON.parse(dataStr)
                const delta = data.choices?.[0]?.delta

                // Handle text delta
                if (delta?.content) {
                  controller.enqueue({
                    type: 'content_block_delta',
                    index: 0, // In full implementation, manage accurate indices per block type
                    delta: { type: 'text_delta', text: delta.content }
                  })
                }

                // Handle tool calls delta (OpenAI streams tool arguments incrementally)
                if (delta?.tool_calls) {
                  for (const toolCall of delta.tool_calls) {
                    if (toolCall.function?.name) {
                      // New tool call block started
                      controller.enqueue({
                        type: 'content_block_start',
                        index: toolCall.index + 1, // index 0 is usually text
                        content_block: {
                          type: 'tool_use',
                          id: toolCall.id,
                          name: toolCall.function.name,
                          input: {} // the partial string goes via input_json_delta
                        }
                      })
                    }
                    if (toolCall.function?.arguments) {
                      // Partial args
                      controller.enqueue({
                        type: 'content_block_delta',
                        index: toolCall.index + 1,
                        delta: { type: 'input_json_delta', partial_json: toolCall.function.arguments }
                      })
                    }
                  }
                }
                
                const finishReason = data.choices?.[0]?.finish_reason
                if (finishReason) {
                  let mappedReason = 'end_turn'
                  if (finishReason === 'tool_calls') mappedReason = 'tool_use'
                  else if (finishReason === 'length') mappedReason = 'max_tokens'

                  // End of stream logic
                  controller.enqueue({
                    type: 'content_block_stop',
                    index: 0
                  })
                  controller.enqueue({
                    type: 'message_delta',
                    delta: {
                      stop_reason: mappedReason,
                      stop_sequence: null
                    },
                    usage: {
                      output_tokens: 0 // Mock, as some compatible APIs don't return stream usage
                    }
                  })
                }
              } catch (e) {
                // Ignore parse errors for incomplete chunks
              }
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

  // To match the Anthropic SDK stream interface which is an AsyncIterable
  // and has a `withResponse()` method, we need to wrap it.
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
    withResponse: () => {
      return {
        data: asyncIterableStream,
        response: response,
        request_id: response.headers.get('x-request-id') || `req_${Date.now()}`
      }
    },
    controller: new AbortController() // mock controller
  }

  return asyncIterableStream
}

import { randomUUID } from 'crypto'
import { QueryEngine } from '../../QueryEngine.js'
import { getCommands } from '../../commands.js'
import { getAllBaseTools } from '../../tools.js'
import { getDefaultAppState, type AppState } from '../../state/AppStateStore.js'
import { createFileStateCacheWithSizeLimit, READ_FILE_STATE_CACHE_SIZE } from '../../utils/fileStateCache.js'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import { getCwd } from '../../utils/cwd.js'
import { createAssistantMessage, createUserMessage } from '../../utils/messages.js'
import type { CanUseToolFn } from '../../hooks/useCanUseTool.js'
import type { AssistantMessage, Message } from '../../types/message.js'
import type { PermissionDecision } from '../../utils/permissions/PermissionResult.js'
import type { Tool, ToolUseContext } from '../../Tool.js'
import { getMemorySnapshot } from '../../memory/MemoryStore.js'
import { buildContext, type BuildContextDiagnostics } from '../../memory/ContextBuilder.js'
import { writeBackMemory, type WritebackResult } from '../../memory/MemoryWriteback.js'
import { runWithSettingsOverride, type AppSettings } from '../../utils/settings.js'

export type WebChatSessionStatus = 'idle' | 'running' | 'suspended_for_approval' | 'error' | 'stopped'

export type NormalizedChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type PendingApprovalPayload = {
  id: string
  toolName: string
  input: Record<string, unknown>
}

export type ChatSessionSummary = {
  id: string
  status: WebChatSessionStatus
  title: string
  lastMessage: string
  updatedAt: number
}

export type PromotionDiagnostics = {
  promotionCandidates: WritebackResult['promotionCandidates']
  rejectedCandidates: WritebackResult['rejectedCandidates']
  rejectionReasons: WritebackResult['rejectionReasons']
}

export type WritebackDiagnostics = {
  wroteDailySummary: WritebackResult['wroteDailySummary']
  appendedSections: WritebackResult['appendedSections']
  skippedSections: WritebackResult['skippedSections']
  targetFiles: WritebackResult['targetFiles']
  duplicatesSkipped: WritebackResult['duplicatesSkipped']
}

export type MemoryDiagnostics = {
  context?: BuildContextDiagnostics | null
  writeback?: WritebackDiagnostics | null
  promotion?: PromotionDiagnostics | null
}

 export type ChatSessionSnapshot = ChatSessionSummary & {
  messages: NormalizedChatMessage[]
  currentAssistantDraft: string
  pendingApproval: PendingApprovalPayload | null
  memoryDiagnostics?: MemoryDiagnostics
 }

export type RuntimeSelection = {
  mode?: 'plan' | 'act'
  provider?: string
  model?: string
  reasoningEffort?: AppSettings['reasoningEffort']
}

// A simplified Web-based Chat Session that hosts QueryEngine.
export class WebChatSession {
  public id: string
  public status: WebChatSessionStatus = 'idle'
  
  // 对外暴露的业务状态
  public title?: string
  public lastMessage?: string
  public updatedAt: number
  public messages: NormalizedChatMessage[] = [] // For UI / history rendering
  public currentAssistantDraft: string = ''
  
  // 引擎内部运行状态
  private internalMessages: Message[] = []
  private engine: QueryEngine | null = null
  private appState: AppState

  public pendingApproval: {
    id: string
    toolName: string
    input: Record<string, unknown>
    resolve: (approved: boolean) => void
  } | null = null

  public lastContextDiagnostics: BuildContextDiagnostics | null = null
  public lastWritebackDiagnostics: WritebackResult | null = null

  private subscribers: Set<(event: string) => void> = new Set()

  constructor(id?: string) {
    this.id = id || randomUUID()
    this.updatedAt = Date.now()
    this.appState = getDefaultAppState()
  }

  private markUpdated() {
    this.updatedAt = Date.now()
  }

  public getSummary(): ChatSessionSummary {
    return {
      id: this.id,
      status: this.status,
      title: this.title || 'New Session',
      lastMessage: this.lastMessage || '...',
      updatedAt: this.updatedAt,
    }
  }

  public getSnapshot(): ChatSessionSnapshot {
    return {
      ...this.getSummary(),
      messages: this.messages,
      currentAssistantDraft: this.currentAssistantDraft,
      pendingApproval: this.pendingApproval ? {
        id: this.pendingApproval.id,
        toolName: this.pendingApproval.toolName,
        input: this.pendingApproval.input,
      } : null,
      memoryDiagnostics: {
        context: this.lastContextDiagnostics,
        writeback: this.lastWritebackDiagnostics ? {
          wroteDailySummary: this.lastWritebackDiagnostics.wroteDailySummary,
          appendedSections: this.lastWritebackDiagnostics.appendedSections,
          skippedSections: this.lastWritebackDiagnostics.skippedSections,
          targetFiles: this.lastWritebackDiagnostics.targetFiles,
          duplicatesSkipped: this.lastWritebackDiagnostics.duplicatesSkipped,
        } : null,
        promotion: this.lastWritebackDiagnostics ? {
          promotionCandidates: this.lastWritebackDiagnostics.promotionCandidates,
          rejectedCandidates: this.lastWritebackDiagnostics.rejectedCandidates,
          rejectionReasons: this.lastWritebackDiagnostics.rejectionReasons,
        } : null,
      },
    }
  }

  public matchesApprovalId(approvalId: string) {
    return this.pendingApproval?.id === approvalId
  }

  public subscribe(callback: (event: string) => void) {
    this.subscribers.add(callback)
    
    // On first subscribe (or hydrate), send a snapshot of current status
    callback(JSON.stringify({ 
      type: 'session_status', 
      status: this.status 
    }))
    
    if (this.status === 'suspended_for_approval' && this.pendingApproval) {
      callback(JSON.stringify({
        type: 'approval_required',
        toolName: this.pendingApproval.toolName,
        input: this.pendingApproval.input,
        approvalId: this.pendingApproval.id
      }))
    }
    
    return () => this.subscribers.delete(callback)
  }

  public emit(event: any) {
    const data = JSON.stringify(event)
    for (const sub of this.subscribers) {
      sub(data)
    }
  }

  private async initializeEngine() {
    if (this.engine) return

    const cwd = getCwd()
    const commands = await getCommands(cwd)
    
    // Load default tools (similar to runHeadless setup)
    const allTools = [...getAllBaseTools()]
    
    // Inject the factory to construct client internally using settings
    // Note: QueryEngine's configuration doesn't expose client param yet,
    // so client injection relies on `src/services/api/client.ts` hooking 
    // into the ModelAdapterFactory. We maintain QueryEngine's pristine state.

      const readFileCache = createFileStateCacheWithSizeLimit(READ_FILE_STATE_CACHE_SIZE)

      // The interceptor for tool permission
    const canUseTool: CanUseToolFn = async (
      tool: Tool,
      input: Record<string, unknown>,
      _context: ToolUseContext,
      assistantMessage?: AssistantMessage,
      toolUseID?: string,
    ): Promise<PermissionDecision<Record<string, unknown>>> => {
      console.error('[WebChatSession] canUseTool entered', {
        sessionId: this.id,
        toolName: tool.name,
        toolUseID,
        status: this.status,
      })

      // Create a pending promise that blocks the engine
      return new Promise<PermissionDecision<Record<string, unknown>>>((resolve) => {
        const approvalId = randomUUID()

        // 先完整挂载 pendingApproval，再切换状态，避免中间态被读取
        this.pendingApproval = {
          id: approvalId,
          toolName: tool.name,
          input,
          resolve: (approved: boolean) => {
            console.error('[WebChatSession] approval resolve called', {
              sessionId: this.id,
              approvalId,
              toolName: tool.name,
              approved,
              stack: new Error().stack,
            })

            this.pendingApproval = null
            this.status = 'running'
            this.markUpdated()
            this.emit({ type: 'session_status', status: this.status })

            if (approved) {
              resolve({ behavior: 'allow' })
            } else {
              resolve({
                behavior: 'deny',
                message: 'User denied via Web UI',
                decisionReason: {
                  type: 'other',
                  reason: 'User denied via Web UI',
                },
              })
            }
          },
        }

        this.status = 'suspended_for_approval'
        this.markUpdated()

        console.error('[WebChatSession] approval mounted', {
          sessionId: this.id,
          approvalId,
          toolName: tool.name,
        })

        this.emit({ type: 'session_status', status: this.status })

        // Notify UI to show approval dialog
        this.emit({
          type: 'approval_required',
          toolName: tool.name,
          input,
          approvalId,
        })
      })
    }

      this.engine = new QueryEngine({
        cwd,
        commands,
        tools: allTools,
        mcpClients: [], // No MCP clients in Phase 1
        agents: [],
        canUseTool,
        getAppState: () => this.appState,
        setAppState: (updater) => {
          this.appState = updater(this.appState)
        },
        initialMessages: [...this.internalMessages],
        readFileCache,
        maxTurns: 50,
        abortController: new AbortController()
      })
  }

  public async submitMessage(
    historyMessages: NormalizedChatMessage[],
    runtimeSelection?: RuntimeSelection,
  ) {
    if (this.status === 'running' || this.status === 'suspended_for_approval') {
      throw new Error(`Cannot submit message while session is ${this.status}`)
    }

    if (!historyMessages || historyMessages.length === 0) {
      throw new Error('History messages cannot be empty')
    }

    // 真正的上下文修复：将前端传递的连续 historyMessages 重建为 internalMessages
    this.messages = historyMessages
    const currentPrompt = historyMessages[historyMessages.length - 1].content

    if (!this.title && currentPrompt) {
      this.title = currentPrompt.slice(0, 30)
    }
    this.lastMessage = currentPrompt.slice(0, 60)
    this.currentAssistantDraft = '' // Reset draft for new turn
    this.markUpdated()

    this.status = 'running'
    this.emit({ type: 'session_status', status: this.status })

    try {
      // 提取除最后一条之外的历史消息放入 internalMessages 中
      this.internalMessages = historyMessages.slice(0, -1).map(msg => {
        if (msg.role === 'assistant') {
          return createAssistantMessage({ content: msg.content })
        } else {
          return createUserMessage({ content: msg.content })
        }
      })

      const cwd = getCwd()
      const recentMessages = historyMessages.slice(0, -1)
      const memorySnapshot = getMemorySnapshot({
        cwd,
        now: new Date(),
        sessionId: this.id,
      })
      const contextResult = buildContext({
        currentUserPrompt: currentPrompt,
        recentMessages,
        memorySnapshot,
        budget: {
          maxChars: 12000,
        },
        now: new Date(),
      })
      this.lastContextDiagnostics = contextResult.diagnostics
      console.error('[WebChatSession] context diagnostics', {
        sessionId: this.id,
        diagnostics: contextResult.diagnostics,
      })

      const effectiveOverride: Partial<AppSettings> | undefined = runtimeSelection?.provider || runtimeSelection?.model || runtimeSelection?.reasoningEffort
        ? {
            ...(runtimeSelection?.provider ? { provider: runtimeSelection.provider } : {}),
            ...(runtimeSelection?.model ? { model: runtimeSelection.model } : {}),
            ...(runtimeSelection?.reasoningEffort ? { reasoningEffort: runtimeSelection.reasoningEffort } : {}),
          }
        : undefined

      const executeTurn = async () => {
        // 关键收口：每次 submit 都基于最新 history 重建 engine，避免 initialMessages
        // 只在首次构造时生效而导致后续多轮上下文漂移。
        this.engine = null
        await this.initializeEngine()

        // The ask generator yields SDKMessages
        // 这里确保我们传入的是正确的 content blocks
        const promptBlocks: ContentBlockParam[] = []
        if (contextResult.systemContext) {
          promptBlocks.push({
            type: 'text',
            text: `${contextResult.systemContext}\n\n(Use the structured context above as supplementary guidance. Prioritize the user's current request.)`,
          })
        }
        promptBlocks.push({ type: 'text', text: currentPrompt })
        const generator = this.engine!.submitMessage(promptBlocks)

        let currentAssistantText = ''
        for await (const msg of generator) {
          console.error(`[WebChatSession] generator yielded msg.type = ${msg.type}`, { sessionId: this.id })
          if (msg.type === 'assistant') {
             const textBlocks = msg.message.content.filter((c: any) => c.type === 'text')
             if (textBlocks.length > 0) {
               const latestText = textBlocks.map((c: any) => c.text).join('')
               // If we just want to send the delta, it's complex since message is full state,
               // but UI expects chunks. For phase 1, we emit the diff.
               const newText = latestText.slice(currentAssistantText.length)
               if (newText) {
                 this.emit({ type: 'assistant_delta', delta: newText })
                 currentAssistantText = latestText
                 this.currentAssistantDraft = currentAssistantText
                 this.markUpdated()
               }
             }
             
             // Intercept tool_use blocks to emit tool_trace events
             const toolUseBlocks = msg.message.content.filter((c: any) => c.type === 'tool_use')
             for (const toolUse of toolUseBlocks as any[]) {
               this.emit({ 
                 type: 'tool_trace', 
                 toolName: toolUse.name, 
                 input: toolUse.input 
               })
             }
          } else if (msg.type === 'result') {
             // Execution finished
             console.error('[WebChatSession] generator result received', { is_error: msg.is_error, sessionId: this.id })
             if (msg.is_error) {
               this.status = 'error'
             }
          }
        }

        return currentAssistantText
      }

      const currentAssistantText = effectiveOverride
        ? await runWithSettingsOverride(effectiveOverride, executeTurn)
        : await executeTurn()
      
      console.error('[WebChatSession] generator for-await loop ended naturally', { sessionId: this.id, status: this.status, hasPendingApproval: !!this.pendingApproval })
      
      // 保护规则 1：如果 session 处于挂起态，不要覆盖状态、不要清除 pendingApproval 和 draft
      if ((this.status as WebChatSessionStatus) === 'suspended_for_approval' || this.pendingApproval) {
        console.error('[WebChatSession] finalize skipped because suspended_for_approval', { sessionId: this.id })
      } else {
        this.messages.push({ role: 'assistant', content: currentAssistantText })

        if (currentAssistantText.trim()) {
          try {
            const writebackResult = await writeBackMemory({
              currentUserPrompt: currentPrompt,
              assistantOutput: currentAssistantText,
              recentMessages: historyMessages,
              cwd: getCwd(),
              now: new Date(),
            })
            this.lastWritebackDiagnostics = writebackResult
            console.error('[MemoryWriteback] diagnostics', {
              sessionId: this.id,
              diagnostics: writebackResult,
            })
          } catch (error) {
            console.error('[MemoryWriteback] failed', {
              sessionId: this.id,
              error,
            })
          }
        }

        this.currentAssistantDraft = '' // Turn finished, clear draft
        this.lastMessage = currentAssistantText.slice(0, 60)
        this.status = 'idle'
        this.markUpdated()
        
        this.emit({ type: 'session_status', status: this.status })
        this.emit({ type: 'session_completed' })
      }

    } catch (err: any) {
      console.error('WebChatSession.submitMessage failed:', err)

      // 保护规则 2：如果 session 处于挂起态，保留当前状态，不抛错误覆盖
      if ((this.status as WebChatSessionStatus) === 'suspended_for_approval' || this.pendingApproval) {
        console.error('[WebChatSession] catch skipped error transition because approval pending', { sessionId: this.id, err: err?.message })
      } else {
        this.status = 'error'
        
        const errorMsg = err?.message || 'unknown error'
        // 错误透明化：除了发 event 给终端，也将错误显式转化为系统消息存入记录
        // 以便在界面刷新或无事件监听时，前端能够展示错误原因
        const systemError = `[System Error] ${errorMsg}`
        this.messages.push({ role: 'assistant', content: systemError })
        this.lastMessage = systemError.slice(0, 60)
        
        this.markUpdated()
        this.emit({ type: 'session_error', error: errorMsg })
        this.emit({ type: 'session_status', status: this.status })
      }
    }
  }
}

export class SessionManager {
  private static sessions = new Map<string, WebChatSession>()

  static getOrCreateSession(id: string): WebChatSession {
    if (!this.sessions.has(id)) {
      this.sessions.set(id, new WebChatSession(id))
    }
    console.error('[SessionManager] getOrCreateSession', {
      requestedId: id,
      size: this.sessions.size,
      keys: Array.from(this.sessions.keys()),
    })
    return this.sessions.get(id)!
  }

  static getSession(id: string): WebChatSession | undefined {
    const session = this.sessions.get(id)
    console.error('[SessionManager] getSession', {
      requestedId: id,
      found: !!session,
      size: this.sessions.size,
      keys: Array.from(this.sessions.keys()),
    })
    return session
  }

  static listSessions(): ChatSessionSummary[] {
    console.error('[SessionManager] listSessions', {
      size: this.sessions.size,
      keys: Array.from(this.sessions.keys()),
    })
    return Array.from(this.sessions.values())
      .map(s => s.getSummary())
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  static findSessionByApprovalId(approvalId: string): WebChatSession | undefined {
    const session = Array.from(this.sessions.values()).find(session =>
      session.matchesApprovalId(approvalId),
    )
    console.error('[SessionManager] findSessionByApprovalId', {
      approvalId,
      found: !!session,
      size: this.sessions.size,
      keys: Array.from(this.sessions.keys()),
    })
    return session
  }
}

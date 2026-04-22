import { ChatStreamEvent } from '../types/chat'
import { apiClient } from './client'
import { useChatStore } from '../store/chatStore'

type EventCallback = (type: string, data: unknown) => void

type ReconnectResult = 'reconnect' | 'resolved'

export class StreamManager {
  private static instance: StreamManager
  private eventSource: EventSource | null = null
  private currentSessionId: string | null = null
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts = 3
  private reconnectTimeout: number | null = null
  private listeners: Map<string, Set<EventCallback>> = new Map()

  private constructor() {}

  public static getInstance(): StreamManager {
    if (!StreamManager.instance) {
      StreamManager.instance = new StreamManager()
    }
    return StreamManager.instance
  }

  public subscribe(eventType: string, callback: EventCallback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType)?.add(callback)

    return () => {
      this.listeners.get(eventType)?.delete(callback)
    }
  }

  public async connect(sessionId: string): Promise<void> {
    this.disconnect()
    this.currentSessionId = sessionId
    this.reconnectAttempts = 0
    useChatStore.getState().setIsStreaming(true)
    return this.initConnection(sessionId)
  }

  public disconnect() {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }

    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    this.currentSessionId = null
  }

  private dispatch(eventType: string, data?: unknown) {
    const callbacks = this.listeners.get(eventType)
    callbacks?.forEach(cb => cb(eventType, data))
  }

  private initConnection(sessionId: string): Promise<void> {
    const chatStore = useChatStore.getState()
    chatStore.setStreamStatus('streaming')

    return new Promise((resolve, reject) => {
      const es = new EventSource(`/api/chat/stream/${encodeURIComponent(sessionId)}`)
      this.eventSource = es

      es.onmessage = event => {
        try {
          const data = JSON.parse(event.data) as ChatStreamEvent
          this.handleStreamEvent(data)

          if (data.type === 'session_completed') {
            resolve()
            return
          }

          if (data.type === 'session_error') {
            reject(new Error(data.error || '会话执行失败'))
          }
        } catch {
          // ignore malformed SSE fragment
        }
      }

      es.onerror = () => {
        es.close()
        this.eventSource = null

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          chatStore.setStreamStatus('error')
          chatStore.setIsStreaming(false)
          reject(new Error('流断开且重连失败'))
          return
        }

        this.reconnectAttempts += 1
        this.handleReconnect(sessionId)
          .then(result => {
            if (result === 'resolved') {
              resolve()
              return
            }

            this.initConnection(sessionId).then(resolve).catch(reject)
          })
          .catch(error => {
            chatStore.setStreamStatus('error')
            chatStore.setIsStreaming(false)
            reject(error)
          })
      }
    })
  }

  private async handleReconnect(sessionId: string): Promise<ReconnectResult> {
    const chatStore = useChatStore.getState()
    chatStore.setStreamStatus('reconnecting')

    const delay = 800 * this.reconnectAttempts
    await new Promise<void>(resolve => {
      this.reconnectTimeout = window.setTimeout(() => resolve(), delay)
    })

    const { session } = await apiClient.chat.getSession(sessionId)
    if (!session) {
      throw new Error('会话状态恢复失败')
    }

    chatStore.applySessionSnapshot(session)

    if (session.status === 'running' || session.status === 'suspended_for_approval') {
      return 'reconnect'
    }

    if (session.status === 'error') {
      throw new Error('会话已进入错误状态')
    }

    chatStore.setStreamStatus('idle')
    chatStore.setIsStreaming(false)
    return 'resolved'
  }

  private handleStreamEvent(data: ChatStreamEvent) {
    const chatStore = useChatStore.getState()

    switch (data.type) {
      case 'approval_required':
        chatStore.setPendingApproval({
          id: data.approvalId,
          toolName: data.toolName,
          input: data.input,
        })
        this.dispatch('approval_required', data)
        break
      case 'assistant_delta':
        chatStore.appendAssistantDelta(data.delta)
        this.dispatch('assistant_delta', data)
        break
      case 'tool_trace':
        chatStore.appendToolTrace({
          toolName: data.toolName,
          input: data.input,
        })
        this.dispatch('tool_trace', data)
        break
      case 'session_completed':
        chatStore.setStreamStatus('idle')
        chatStore.setIsStreaming(false)
        this.disconnect()
        this.dispatch('session_completed', data)
        break
      case 'session_error':
        chatStore.setStreamStatus('error')
        chatStore.setIsStreaming(false)
        this.disconnect()
        this.dispatch('session_error', data)
        break
      case 'session_status':
        this.dispatch('session_status', data)
        break
    }
  }
}

export const streamManager = StreamManager.getInstance()

import { create } from 'zustand'
import {
  ChatSessionSnapshot,
  ChatSessionSummary,
  Message,
  PendingApprovalPayload,
  StreamStatus,
} from '../types/chat'

export type RehydrationStatus = 'idle' | 'loading' | 'success' | 'error'

function getInitialSessionId() {
  if (typeof window === 'undefined') {
    return `web-${Date.now()}`
  }

  return localStorage.getItem('buddy_active_session_id') || `web-${Date.now()}`
}

function persistSessionId(sessionId: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('buddy_active_session_id', sessionId)
  }
}

function mergeMessagesWithDraft(baseMessages: Message[], draft?: string): Message[] {
  if (!draft) return baseMessages

  const messagesCopy = [...baseMessages]
  const last = messagesCopy[messagesCopy.length - 1]
  if (last?.role === 'assistant') {
    messagesCopy[messagesCopy.length - 1] = { ...last, content: draft }
    return messagesCopy
  }

  return [...messagesCopy, { role: 'assistant', content: draft }]
}

interface ChatStoreState {
  activeSessionId: string
  messages: Message[]
  pendingApproval: PendingApprovalPayload | null
  activeTasks: ChatSessionSummary[]
  streamStatus: StreamStatus
  isStreaming: boolean
  rehydrationStatus: RehydrationStatus
  currentSessionSnapshot: ChatSessionSnapshot | null
  pendingInjection: string | null
  toolTraces: ToolTracePayload[]
  sessionTokenUsage?: { inputTokens: number; outputTokens: number }
  setActiveSessionId: (sessionId: string) => void
  setMessages: (messages: Message[]) => void
  appendMessage: (message: Message) => void
  appendAssistantDelta: (delta: string) => void
  setPendingApproval: (pendingApproval: PendingApprovalPayload | null) => void
  appendToolTrace: (trace: Omit<ToolTracePayload, 'timestamp'>) => void
  clearToolTraces: () => void
  setActiveTasks: (tasks: ChatSessionSummary[]) => void
  setStreamStatus: (status: StreamStatus) => void
  setIsStreaming: (isStreaming: boolean) => void
  setRehydrationStatus: (status: RehydrationStatus) => void
  applySessionSnapshot: (session: ChatSessionSnapshot) => void
  resetForNewSession: (sessionId: string) => void
  setPendingInjection: (text: string) => void
  consumePendingInjection: () => void
}

export const useChatStore = create<ChatStoreState>(set => ({
  activeSessionId: getInitialSessionId(),
  messages: [],
  pendingApproval: null,
  activeTasks: [],
  streamStatus: 'idle',
  isStreaming: false,
  rehydrationStatus: 'idle',
  currentSessionSnapshot: null,
  pendingInjection: null,
  sessionTokenUsage: undefined,
  toolTraces: [],
  setActiveSessionId: (sessionId: string) => {
    persistSessionId(sessionId)
    set({ activeSessionId: sessionId })
  },
  setMessages: (messages: Message[]) => set({ messages }),
  appendMessage: (message: Message) => set(state => ({ messages: [...state.messages, message] })),
  appendAssistantDelta: (delta: string) =>
    set(state => {
      const last = state.messages[state.messages.length - 1]
      if (last?.role === 'assistant') {
        return {
          messages: [
            ...state.messages.slice(0, -1),
            { ...last, content: `${last.content}${delta || ''}` },
          ],
        }
      }

      return {
        messages: [...state.messages, { role: 'assistant', content: delta || '' }],
      }
    }),
  setPendingApproval: (pendingApproval: PendingApprovalPayload | null) => set({ pendingApproval }),
  appendToolTrace: (trace) =>
    set((state) => ({
      toolTraces: [...state.toolTraces, { ...trace, timestamp: Date.now() }],
    })),
  clearToolTraces: () => set({ toolTraces: [] }),
  setActiveTasks: (activeTasks: ChatSessionSummary[]) => set({ activeTasks }),
  setStreamStatus: (streamStatus: StreamStatus) => set({ streamStatus }),
  setIsStreaming: (isStreaming: boolean) => set({ isStreaming }),
  setRehydrationStatus: (rehydrationStatus: RehydrationStatus) => set({ rehydrationStatus }),
  applySessionSnapshot: (session: ChatSessionSnapshot) => {
    persistSessionId(session.id)
    const hydratedMessages = mergeMessagesWithDraft(session.messages || [], session.currentAssistantDraft)
    const isSessionStreaming = session.status === 'running' || session.status === 'suspended_for_approval'

    set({
      activeSessionId: session.id,
      messages: hydratedMessages,
      pendingApproval:
        session.status === 'suspended_for_approval' && session.pendingApproval
          ? session.pendingApproval
          : null,
      currentSessionSnapshot: session,
      isStreaming: isSessionStreaming,
      streamStatus: isSessionStreaming ? 'streaming' : session.status === 'error' ? 'error' : 'idle',
      // Since backend doesn't explicitly expose cost tracking easily over SSE without parsing sys-events,
      // we do a rough estimation based on the snapshot sizes or just leave it undefined
      sessionTokenUsage: {
        inputTokens: hydratedMessages.reduce((sum, m) => sum + (m.role === 'user' ? m.content.length / 3 : 0), 0),
        outputTokens: hydratedMessages.reduce((sum, m) => sum + (m.role === 'assistant' ? m.content.length / 3 : 0), 0)
      }
    })
  },
  resetForNewSession: (sessionId: string) => {
    persistSessionId(sessionId)
    set({
      activeSessionId: sessionId,
      messages: [],
      pendingApproval: null,
      streamStatus: 'idle',
      isStreaming: false,
      currentSessionSnapshot: null,
      rehydrationStatus: 'idle',
      sessionTokenUsage: undefined,
      toolTraces: [],
    })
  },
  setPendingInjection: (text: string) => set({ pendingInjection: text }),
  consumePendingInjection: () => set({ pendingInjection: null }),
}))

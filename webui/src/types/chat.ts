export type MessageRole = 'user' | 'assistant'

export interface Message {
  role: MessageRole
  content: string
}

export interface PendingApprovalPayload {
  id: string
  toolName: string
  input: Record<string, unknown>
}

export interface ChatSessionSummary {
  id: string
  status: 'idle' | 'running' | 'suspended_for_approval' | 'error' | 'stopped'
  title: string
  lastMessage: string
  updatedAt: number
}

export interface ContextDiagnostics {
  usedRecentMessages: number
  usedMemoryBuckets: string[]
  droppedSections: string[]
  estimatedBudgetUsed: number
}

export interface PromotionCandidate {
  type: 'project_constraint' | 'user_preference' | 'technical_decision'
  content: string
  source: 'daily_summary_writeback'
}

export type RejectedCandidateReason =
  | 'phase_only'
  | 'not_stable_enough'
  | 'duplicate_candidate'
  | 'empty_after_normalization'

export interface WritebackDiagnostics {
  wroteDailySummary: boolean
  appendedSections: string[]
  skippedSections: string[]
  targetFiles: string[]
  duplicatesSkipped: string[]
}

export interface PromotionDiagnostics {
  promotionCandidates: PromotionCandidate[]
  rejectedCandidates: string[]
  rejectionReasons: RejectedCandidateReason[]
}

export interface MemoryDiagnostics {
  context?: ContextDiagnostics | null
  writeback?: WritebackDiagnostics | null
  promotion?: PromotionDiagnostics | null
}

export interface ChatSessionSnapshot extends ChatSessionSummary {
  messages: Message[]
  currentAssistantDraft: string
  pendingApproval: PendingApprovalPayload | null
  memoryDiagnostics?: MemoryDiagnostics
}

export type ChatStreamEvent =
  | { type: 'session_status'; status: ChatSessionSummary['status'] }
  | { type: 'approval_required'; approvalId: string; toolName: string; input: Record<string, unknown> }
  | { type: 'assistant_delta'; delta: string }
  | { type: 'tool_trace'; toolName: string; input: Record<string, unknown> }
  | { type: 'session_completed' }
  | { type: 'session_error'; error?: string }

export type StreamStatus = 'idle' | 'streaming' | 'reconnecting' | 'error'

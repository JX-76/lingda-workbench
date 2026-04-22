import React, { useEffect, useRef } from 'react'
import { Message, PendingApprovalPayload } from '../../types/chat'
import MessageBubble from './MessageBubble'
import ApprovalCard from './ApprovalCard'
import MemeAgentLogo from '../MemeAgentLogo'

import { useChatStore } from '../../store/chatStore'
import { CheckCircle2, ChevronDown, ChevronRight, Settings, Wrench } from 'lucide-react'

export default function ChatFeed({
  messages,
  pendingApproval,
  isStreaming,
  onApprove,
  onReject,
}: {
  messages: Message[]
  pendingApproval: PendingApprovalPayload | null
  isStreaming: boolean
  onApprove: () => void
  onReject: () => void
}) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const toolTraces = useChatStore(state => state.toolTraces)
  const [traceExpanded, setTraceExpanded] = React.useState(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingApproval, isStreaming, toolTraces])

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-6 md:px-10">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
            <MemeAgentLogo />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">今天想让我帮你做什么？</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            输入 `/` 呼出快捷指令，或者直接描述您的需求。
          </p>
        </div>
      )}

      {messages.map((message, index) => {
        const isLastAssistantMessage = isStreaming && index === messages.length - 1 && message.role === 'assistant'
        
        return (
          <React.Fragment key={`${message.role}-${index}`}>
            <MessageBubble
              message={message}
              streaming={isLastAssistantMessage}
            />
            {/* Show tool traces after the last user message / before the last assistant message (or during) */}
            {message.role === 'user' && index === messages.length - 2 && toolTraces.length > 0 && (
              <div className="flex flex-col mx-4 my-2 max-w-2xl bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800/50 overflow-hidden shadow-sm">
                <button 
                  onClick={() => setTraceExpanded(!traceExpanded)}
                  className="flex items-center justify-between w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 font-medium">
                    <Wrench size={14} className={isStreaming ? "animate-pulse text-blue-500" : "text-emerald-500"} />
                    <span>{isStreaming ? 'Agent 正在思考并执行工具...' : `已使用 ${toolTraces.length} 个工具`}</span>
                  </div>
                  <div className="text-zinc-400">
                    {traceExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                </button>
                
                {traceExpanded && (
                  <div className="border-t border-zinc-200 dark:border-zinc-800/50 bg-white dark:bg-black/20 px-4 py-3 text-xs font-mono">
                    <div className="flex flex-col gap-3">
                      {toolTraces.map((trace, i) => (
                        <div key={i} className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 font-semibold">
                            <span className="text-blue-500">[{new Date(trace.timestamp).toLocaleTimeString()}]</span>
                            <span>{trace.toolName}</span>
                          </div>
                          <div className="pl-4 text-zinc-500 dark:text-zinc-500 break-all overflow-hidden line-clamp-3">
                            {JSON.stringify(trace.input)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </React.Fragment>
        )
      })}

      {pendingApproval && <ApprovalCard approval={pendingApproval} onApprove={onApprove} onReject={onReject} />}
      <div ref={bottomRef} />
    </div>
  )
}

import React from 'react'
import { Clock3, Loader2 } from 'lucide-react'
import { ChatSessionSummary } from '../../types/chat'

export default function SessionList({
  sessions,
  activeSessionId,
  loading,
  onSelect,
}: {
  sessions: ChatSessionSummary[]
  activeSessionId: string
  loading?: boolean
  onSelect: (sessionId: string) => void
}) {
  return (
    <div className="space-y-2">
      <div className="mb-3 flex items-center justify-between px-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">历史记录 (History)</div>
          <div className="mt-1 text-xs text-zinc-500">支持断点续传的对话记录</div>
        </div>
        {loading && <Loader2 size={14} className="animate-spin text-zinc-400" />}
      </div>

      {sessions.length === 0 && <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-4 text-sm text-zinc-500">暂无历史会话</div>}

      {sessions.map((session) => {
        const isActive = session.id === activeSessionId
        return (
          <button
            key={session.id}
            onClick={() => onSelect(session.id)}
            className={`w-full rounded-2xl border px-3 py-3 text-left transition ${isActive ? 'border-zinc-900 bg-zinc-900 text-white shadow-sm' : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className={`truncate text-sm font-medium ${isActive ? 'text-white' : 'text-zinc-900'}`}>{session.title || '新对话 (Untitled Session)'}</div>
                <div className={`mt-1 line-clamp-2 text-xs leading-5 ${isActive ? 'text-zinc-300' : 'text-zinc-500'}`}>{session.lastMessage || '暂无消息记录'}</div>
              </div>
              {session.status === 'suspended_for_approval' && (
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] ${isActive ? 'bg-amber-400 text-zinc-950' : 'bg-amber-100 text-amber-800'}`}>
                  待确认
                </span>
              )}
            </div>
            <div className={`mt-3 flex items-center gap-1 text-[11px] ${isActive ? 'text-zinc-400' : 'text-zinc-400'}`}>
              <Clock3 size={12} />
              {new Date(session.updatedAt).toLocaleString()}
            </div>
          </button>
        )
      })}
    </div>
  )
}

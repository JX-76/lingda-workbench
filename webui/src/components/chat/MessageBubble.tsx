import React from 'react'
import { Bot, User } from 'lucide-react'
import MarkdownRenderer from './MarkdownRenderer'
import { Message } from '../../types/chat'

export default function MessageBubble({
  message,
  streaming,
}: {
  message: Message
  streaming?: boolean
}) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex w-full gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-700 shadow-sm">
          <Bot size={16} />
        </div>
      )}
      <div
        className={isUser
          ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-zinc-900 px-4 py-3 text-[15px] leading-relaxed text-white shadow-sm dark:bg-zinc-800'
          : 'max-w-[85%] rounded-2xl rounded-bl-sm border border-zinc-200 bg-white px-4 py-3 text-[15px] leading-relaxed shadow-sm dark:border-zinc-800 dark:bg-[#111] dark:text-zinc-200'}
      >
        {isUser ? message.content : <MarkdownRenderer content={message.content || (streaming ? '▍' : '')} />}
      </div>
      {isUser && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-sm">
          <User size={16} />
        </div>
      )}
    </div>
  )
}

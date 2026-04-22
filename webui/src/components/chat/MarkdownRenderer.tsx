import React, { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import { Check, ChevronDown, ChevronRight, Copy } from 'lucide-react'

function parseSegments(content: string) {
  const segments: Array<{ type: 'thinking' | 'tool_result' | 'markdown'; content: string }> = []
  const regex = /<thinking>([\s\S]*?)<\/thinking>|<tool_result>([\s\S]*?)<\/tool_result>/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'markdown', content: content.slice(lastIndex, match.index) })
    }
    if (match[1]) segments.push({ type: 'thinking', content: match[1].trim() })
    if (match[2]) segments.push({ type: 'tool_result', content: match[2].trim() })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < content.length) {
    segments.push({ type: 'markdown', content: content.slice(lastIndex) })
  }

  return segments.filter(segment => segment.content.trim().length > 0)
}

function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const rawCode = String(children ?? '').replace(/\n$/, '')
  const language = className?.replace('language-', '') || 'text'
  const lines = rawCode.split('\n')
  const isLong = lines.length > 15

  const highlighted = useMemo(() => {
    try {
      if (language !== 'text' && hljs.getLanguage(language)) {
        return hljs.highlight(rawCode, { language }).value
      }
      return hljs.highlightAuto(rawCode).value
    } catch {
      return rawCode
    }
  }, [language, rawCode])


  const handleCopy = async () => {
    await navigator.clipboard.writeText(rawCode)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  const displayLines = isLong && !isExpanded ? lines.slice(0, 8) : lines

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-zinc-800 bg-[#0a0a0a] shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-[#111] px-4 py-2 text-xs text-zinc-500">
        <span className="font-medium uppercase tracking-wider">{language}</span>
        <button onClick={() => void handleCopy()} className="inline-flex items-center gap-1 rounded-md px-2 py-1 transition hover:bg-zinc-800 hover:text-zinc-100">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <div className="overflow-x-auto relative">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {displayLines.map((line, index) => (
              <tr key={index} className="align-top">
                <td className="select-none border-r border-zinc-800/60 bg-[#111]/50 px-3 py-0.5 text-right text-xs text-zinc-600">{index + 1}</td>
                <td className="w-full px-4 py-0.5">
                  <code className="font-mono text-[13px] text-zinc-300" dangerouslySetInnerHTML={{ __html: index === 0 && lines.length === 1 ? highlighted : hljs.highlightAuto(line || ' ').value }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {isLong && !isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0a0a0a] to-transparent flex items-end justify-center pb-2">
            <button onClick={() => setIsExpanded(true)} className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700 shadow-lg border border-zinc-700 transition">
              展开剩余 {lines.length - 8} 行
            </button>
          </div>
        )}
        {isLong && isExpanded && (
          <div className="flex items-center justify-center p-2 border-t border-zinc-800/60 bg-[#111]/30">
            <button onClick={() => setIsExpanded(false)} className="rounded-full bg-zinc-800/80 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition">
              收起代码
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function CollapsibleBlock({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="my-3 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100/80">
      <button onClick={() => setOpen(v => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-200/70">
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span>{title}</span>
      </button>
      {open && <div className="border-t border-zinc-200 px-4 py-3 text-sm text-zinc-700">{children}</div>}
    </div>
  )
}

export default function MarkdownRenderer({ content }: { content: string }) {
  const segments = useMemo(() => parseSegments(content), [content])

  return (
    <div className="space-y-2">
      {segments.map((segment, index) => {
        if (segment.type === 'thinking') {
          return (
            <CollapsibleBlock key={index} title="Thinking">
              <div className="whitespace-pre-wrap text-sm text-zinc-600">{segment.content}</div>
            </CollapsibleBlock>
          )
        }

        if (segment.type === 'tool_result') {
          return (
            <CollapsibleBlock key={index} title="Tool Result">
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs text-zinc-700">{segment.content}</pre>
            </CollapsibleBlock>
          )
        }

        return (
          <ReactMarkdown
            key={index}
            remarkPlugins={[remarkGfm]}
            components={{
              code(props) {
                const { className, children, ...rest } = props
                const inline = !className
                if (inline) {
                  return <code className="rounded-md border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[0.85em] text-blue-600" {...rest}>{children}</code>
                }
                return <CodeBlock className={className}>{children}</CodeBlock>
              },
              p(props) {
                return <p className="my-2 leading-7 text-zinc-800" {...props} />
              },
              ul(props) {
                return <ul className="my-2 list-disc space-y-1 pl-6" {...props} />
              },
              ol(props) {
                return <ol className="my-2 list-decimal space-y-1 pl-6" {...props} />
              },
              h1(props) {
                return <h1 className="mt-4 text-2xl font-semibold text-zinc-900" {...props} />
              },
              h2(props) {
                return <h2 className="mt-4 text-xl font-semibold text-zinc-900" {...props} />
              },
              blockquote(props) {
                return <blockquote className="my-3 border-l-2 border-zinc-300 pl-4 text-zinc-600" {...props} />
              },
              img(props) {
                return <img className="max-w-full rounded-xl border border-zinc-200 dark:border-zinc-800" loading="lazy" alt={props.alt || ''} {...props} />
              },
            }}
          >
            {segment.content}
          </ReactMarkdown>
        )
      })}
    </div>
  )
}

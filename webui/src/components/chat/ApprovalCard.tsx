import React, { useMemo } from 'react'
import hljs from 'highlight.js'
import { AlertTriangle, CheckCircle2, ShieldX } from 'lucide-react'
import { PendingApprovalPayload } from '../../types/chat'

function detectLanguage(toolName: string) {
  if (/bash|terminal|command/i.test(toolName)) return 'bash'
  if (/file|edit|write/i.test(toolName)) return 'json'
  return 'plaintext'
}

function stringifyInput(input: Record<string, unknown>) {
  return JSON.stringify(input, null, 2)
}

function renderDiffContent(input: Record<string, any>) {
  if (input.search && input.replace) {
    const search = String(input.search)
    const replace = String(input.replace)
    
    return (
      <div className="flex flex-col text-[13px] font-mono leading-relaxed">
        {search.split('\n').map((line, i) => (
          <div key={`s-${i}`} className="bg-rose-950/40 text-rose-200/90 px-4 py-0.5 border-l-2 border-rose-500">
            <span className="opacity-50 select-none mr-3">-</span>
            <span>{line || ' '}</span>
          </div>
        ))}
        {replace.split('\n').map((line, i) => (
          <div key={`r-${i}`} className="bg-emerald-950/40 text-emerald-200/90 px-4 py-0.5 border-l-2 border-emerald-500">
            <span className="opacity-50 select-none mr-3">+</span>
            <span>{line || ' '}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function ApprovalCard({
  approval,
  onApprove,
  onReject,
}: {
  approval: PendingApprovalPayload
  onApprove: () => void
  onReject: () => void
}) {
  const language = detectLanguage(approval.toolName)
  const isBash = language === 'bash'
  const isEdit = approval.toolName.toLowerCase().includes('replace') || approval.toolName.toLowerCase().includes('edit')
  const code = isEdit && (approval.input.search || approval.input.replace) 
    ? '' // Use custom renderer
    : isBash && approval.input.command 
      ? String(approval.input.command)
      : stringifyInput(approval.input)

  const highlighted = useMemo(() => {
    if (!code) return ''
    try {
      if (hljs.getLanguage(language)) {
        return hljs.highlight(code, { language }).value
      }
      return hljs.highlightAuto(code).value
    } catch {
      return code
    }
  }, [code, language])

  return (
    <div className="overflow-hidden rounded-3xl border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 shadow-[0_12px_40px_rgba(245,158,11,0.18)]">
      <div className="flex items-start gap-3 border-b border-amber-200 px-5 py-4 dark:border-amber-900/30">
        <div className="mt-0.5 rounded-xl bg-amber-100 p-2 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
          <AlertTriangle size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">等待确认 (Awaiting Approval)</h3>
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900 dark:bg-amber-800/80 dark:text-amber-200">
              {approval.toolName}
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-amber-900/80 dark:text-amber-200/70">
            Meme Agent 准备执行以下操作，请审阅并决定是否允许。
          </p>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="mb-4 overflow-hidden rounded-xl border border-zinc-800 bg-[#0a0a0a]">
          <div className="border-b border-zinc-800 bg-[#111] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            {isEdit ? 'Diff Viewer' : isBash ? 'Terminal' : language}
          </div>
          {isEdit && (approval.input.search || approval.input.replace) ? (
            <div className="overflow-x-auto py-2">
              {renderDiffContent(approval.input)}
            </div>
          ) : (
            <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-zinc-300 max-h-[300px]">
              <code dangerouslySetInnerHTML={{ __html: highlighted }} />
            </pre>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={onApprove}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            <CheckCircle2 size={16} />
            允许 (Approve)
          </button>
          <button
            onClick={onReject}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 shadow-sm transition hover:bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-900/50"
          >
            <ShieldX size={16} />
            拒绝 (Reject)
          </button>
        </div>
      </div>
    </div>
  )
}

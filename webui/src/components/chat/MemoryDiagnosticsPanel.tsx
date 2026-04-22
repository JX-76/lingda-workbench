import type { MemoryDiagnostics } from '../../types/chat'

function ListBlock({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null

  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{title}</div>
      <ul className="space-y-1 text-xs text-zinc-700 dark:text-zinc-300">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="break-all rounded bg-zinc-50 px-2 py-1 dark:bg-zinc-950/70">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function MemoryDiagnosticsPanel({
  diagnostics,
}: {
  diagnostics?: MemoryDiagnostics
}) {
  if (!diagnostics) return null

  const { context, writeback, promotion } = diagnostics
  const hasContent = Boolean(
    context ||
      writeback ||
      promotion,
  )

  if (!hasContent) return null

  return (
    <div className="mx-auto mt-4 w-full max-w-5xl px-6 pb-2 md:px-10">
      <div className="rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
              Memory Diagnostics
            </div>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              展示本轮上下文选择、写回结果与长期记忆候选。
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl border border-zinc-200/80 bg-white/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Context</div>
            <div className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
              <div>usedMemoryBuckets: {context?.usedMemoryBuckets?.join(', ') || '—'}</div>
              <div>usedRecentMessages: {context?.usedRecentMessages ?? '—'}</div>
              <div>estimatedBudgetUsed: {context?.estimatedBudgetUsed ?? '—'}</div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200/80 bg-white/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Writeback</div>
            <div className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
              <div>wroteDailySummary: {writeback ? String(writeback.wroteDailySummary) : '—'}</div>
              <div>appendedSections: {writeback?.appendedSections?.join(', ') || '—'}</div>
              <div>targetFiles: {writeback?.targetFiles?.join(', ') || '—'}</div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200/80 bg-white/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Promotion</div>
            <div className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
              <div>promotionCandidates: {promotion?.promotionCandidates?.length ?? 0}</div>
              <div>rejectedCandidates: {promotion?.rejectedCandidates?.length ?? 0}</div>
              <div>rejectionReasons: {promotion?.rejectionReasons?.join(', ') || '—'}</div>
            </div>
          </div>

          <ListBlock title="Dropped Sections" items={context?.droppedSections} />
          <ListBlock title="Duplicates Skipped" items={writeback?.duplicatesSkipped} />
          <ListBlock title="Rejected Candidates" items={promotion?.rejectedCandidates} />
        </div>

        {!!promotion?.promotionCandidates?.length && (
          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Promotion Candidates
            </div>
            <div className="space-y-3">
              {promotion.promotionCandidates.map((candidate, index) => (
                <div
                  key={`${candidate.type}-${index}`}
                  className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{candidate.type}</div>
                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">来源：{candidate.source}</div>
                    </div>
                    <button
                      disabled
                      className="rounded-lg border border-zinc-300 px-3 py-1 text-xs text-zinc-400 opacity-70 dark:border-zinc-700 dark:text-zinc-500"
                      title="下一阶段开放"
                    >
                      Promote to Long-term
                    </button>
                  </div>
                  <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{candidate.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

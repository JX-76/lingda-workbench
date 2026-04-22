import { getTimeBucket } from './timeBuckets.js'
import type { MemorySnapshot } from './MemoryStore.js'

export type ContextMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type ContextStrategyId = 'C0' | 'C1' | 'C2' | 'C3'

export type ContextStrategyConfig = {
  id: ContextStrategyId
  label: string
  maxChars?: number
  maxRecentMessages?: number
  guaranteedRecentMessages?: number
  allocations: {
    recentRatio: number
    timeBucketRatio: number
    dailySummaryRatio: number
    longtermProjectRatio: number
    longtermUserRatio: number
  }
}

export type BuildContextInput = {
  currentUserPrompt: string
  recentMessages: ContextMessage[]
  memorySnapshot: MemorySnapshot
  budget?: {
    maxChars?: number
  }
  now?: Date
  strategy?: ContextStrategyId | ContextStrategyConfig
}

export type BuildContextDiagnostics = {
  usedRecentMessages: number
  usedMemoryBuckets: string[]
  droppedSections: string[]
  estimatedBudgetUsed: number
}

export type BuildContextResult = {
  conversationContext: string
  memoryContext: string
  systemContext: string
  diagnostics: BuildContextDiagnostics
}

type AllocationTarget = {
  key: string
  label: string
  tag: string
  content?: string
  maxChars: number
}

const DEFAULT_MAX_CHARS = 12000
const DEFAULT_MAX_RECENT_MESSAGES = 10
const DEFAULT_GUARANTEED_RECENT_MESSAGES = 2

export const DEFAULT_CONTEXT_STRATEGIES: Record<ContextStrategyId, ContextStrategyConfig> = {
  C0: {
    id: 'C0',
    label: 'Baseline Recent Only',
    allocations: {
      recentRatio: 1,
      timeBucketRatio: 0,
      dailySummaryRatio: 0,
      longtermProjectRatio: 0,
      longtermUserRatio: 0,
    },
  },
  C1: {
    id: 'C1',
    label: 'Static Mix',
    allocations: {
      recentRatio: 0.4,
      timeBucketRatio: 0.2,
      dailySummaryRatio: 0.15,
      longtermProjectRatio: 0.15,
      longtermUserRatio: 0.1,
    },
  },
  C2: {
    id: 'C2',
    label: 'Recent Heavy',
    allocations: {
      recentRatio: 0.6,
      timeBucketRatio: 0.15,
      dailySummaryRatio: 0.1,
      longtermProjectRatio: 0.1,
      longtermUserRatio: 0.05,
    },
  },
  C3: {
    id: 'C3',
    label: 'Memory Heavy',
    allocations: {
      recentRatio: 0.25,
      timeBucketRatio: 0.2,
      dailySummaryRatio: 0.2,
      longtermProjectRatio: 0.2,
      longtermUserRatio: 0.15,
    },
  },
}

export function resolveContextStrategy(
  strategy?: ContextStrategyId | ContextStrategyConfig,
): ContextStrategyConfig {
  if (!strategy) {
    return DEFAULT_CONTEXT_STRATEGIES.C1
  }

  if (typeof strategy === 'string') {
    return DEFAULT_CONTEXT_STRATEGIES[strategy]
  }

  return strategy
}

export function buildContext(input: BuildContextInput): BuildContextResult {
  const strategy = resolveContextStrategy(input.strategy)
  const maxChars = Math.max(
    input.budget?.maxChars ?? strategy.maxChars ?? DEFAULT_MAX_CHARS,
    input.currentUserPrompt.length,
  )
  const maxRecentMessages = Math.max(
    strategy.maxRecentMessages ?? DEFAULT_MAX_RECENT_MESSAGES,
    0,
  )
  const guaranteedRecentMessages = Math.max(
    Math.min(
      strategy.guaranteedRecentMessages ?? DEFAULT_GUARANTEED_RECENT_MESSAGES,
      maxRecentMessages,
    ),
    0,
  )

  const diagnostics: BuildContextDiagnostics = {
    usedRecentMessages: 0,
    usedMemoryBuckets: [],
    droppedSections: [],
    estimatedBudgetUsed: 0,
  }

  const recentCandidates = input.recentMessages
    .filter(message => message.content.trim())
    .slice(-maxRecentMessages)

  const guaranteedRecent = guaranteedRecentMessages > 0
    ? recentCandidates.slice(-guaranteedRecentMessages)
    : []
  const guaranteedRecentBlock = renderRecentConversation(guaranteedRecent)
  const guaranteedRecentLength = guaranteedRecentBlock.length

  let remainingBudget = Math.max(maxChars - guaranteedRecentLength, 0)
  const sharedBudgetBase = remainingBudget

  const additionalRecent = recentCandidates.slice(
    0,
    Math.max(recentCandidates.length - guaranteedRecent.length, 0),
  )
  const additionalRecentQuota = Math.max(
    Math.floor(sharedBudgetBase * strategy.allocations.recentRatio),
    0,
  )
  const selectedAdditionalRecent = selectRecentMessagesWithinBudget(
    additionalRecent,
    additionalRecentQuota,
    diagnostics,
  )
  const selectedRecentMessages = [...selectedAdditionalRecent, ...guaranteedRecent]
  const conversationContext = renderRecentConversation(selectedRecentMessages)
  diagnostics.usedRecentMessages = selectedRecentMessages.length

  remainingBudget = Math.max(maxChars - conversationContext.length, 0)
  const activeBucketKey = getTimeBucket(input.now)
  const memoryAllocations: AllocationTarget[] = [
    {
      key: activeBucketKey,
      label: activeBucketKey,
      tag: 'today_context',
      content: input.memorySnapshot[activeBucketKey],
      maxChars: Math.max(
        Math.floor(sharedBudgetBase * strategy.allocations.timeBucketRatio),
        0,
      ),
    },
    {
      key: 'dailySummary',
      label: 'dailySummary',
      tag: 'daily_summary',
      content: input.memorySnapshot.dailySummary,
      maxChars: Math.max(
        Math.floor(sharedBudgetBase * strategy.allocations.dailySummaryRatio),
        0,
      ),
    },
    {
      key: 'longtermProject',
      label: 'longtermProject',
      tag: 'project_memory',
      content: input.memorySnapshot.longtermProject,
      maxChars: Math.max(
        Math.floor(sharedBudgetBase * strategy.allocations.longtermProjectRatio),
        0,
      ),
    },
    {
      key: 'longtermUser',
      label: 'longtermUser',
      tag: 'user_memory',
      content: input.memorySnapshot.longtermUser,
      maxChars: Math.max(
        Math.floor(sharedBudgetBase * strategy.allocations.longtermUserRatio),
        0,
      ),
    },
  ]

  const memoryBlocks: string[] = []
  for (const allocation of memoryAllocations) {
    const effectiveLimit = Math.max(Math.min(allocation.maxChars, remainingBudget), 0)
    const result = buildMemoryBlock({
      tag: allocation.tag,
      content: allocation.content,
      maxChars: effectiveLimit,
      label: allocation.label,
    })

    if (result.block) {
      memoryBlocks.push(result.block)
      diagnostics.usedMemoryBuckets.push(allocation.label)
      remainingBudget = Math.max(remainingBudget - result.block.length, 0)
    }

    diagnostics.droppedSections.push(...result.droppedSections)
  }

  const memoryContext = memoryBlocks.join('\n\n').trim()
  const systemContext = [memoryContext, conversationContext]
    .filter(Boolean)
    .join('\n\n')
    .trim()
  diagnostics.estimatedBudgetUsed = systemContext.length

  if (systemContext.length > maxChars) {
    const trimmedSystemContext = systemContext.slice(systemContext.length - maxChars)
    diagnostics.droppedSections.push('systemContext:hard-trim')
    diagnostics.estimatedBudgetUsed = trimmedSystemContext.length
    return {
      conversationContext,
      memoryContext,
      systemContext: trimmedSystemContext,
      diagnostics,
    }
  }

  return {
    conversationContext,
    memoryContext,
    systemContext,
    diagnostics,
  }
}

function selectRecentMessagesWithinBudget(
  candidates: ContextMessage[],
  budget: number,
  diagnostics: BuildContextDiagnostics,
): ContextMessage[] {
  if (budget <= 0 || candidates.length === 0) {
    if (candidates.length > 0) {
      diagnostics.droppedSections.push(`recentMessages:older-${candidates.length}`)
    }
    return []
  }

  const selected: ContextMessage[] = []
  let used = 0

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index]
    const rendered = renderRecentMessage(candidate)
    if (used + rendered.length > budget) {
      diagnostics.droppedSections.push(`recentMessages:dropped-index-${index}`)
      continue
    }
    selected.unshift(candidate)
    used += rendered.length
  }

  const droppedCount = candidates.length - selected.length
  if (droppedCount > 0) {
    diagnostics.droppedSections.push(`recentMessages:older-${droppedCount}`)
  }

  return selected
}

function buildMemoryBlock(args: {
  tag: string
  content?: string
  maxChars: number
  label: string
}): { block: string; droppedSections: string[] } {
  const droppedSections: string[] = []
  const content = args.content?.trim()

  if (!content) {
    droppedSections.push(`${args.label}:missing`)
    return { block: '', droppedSections }
  }

  if (args.maxChars <= 0) {
    droppedSections.push(args.label)
    return { block: '', droppedSections }
  }

  const openTag = `<${args.tag}>\n`
  const closeTag = `\n</${args.tag}>`
  const overhead = openTag.length + closeTag.length
  const allowedContentLength = Math.max(args.maxChars - overhead, 0)

  if (allowedContentLength <= 0) {
    droppedSections.push(args.label)
    return { block: '', droppedSections }
  }

  let finalContent = content
  if (content.length > allowedContentLength) {
    finalContent = `${content.slice(0, Math.max(allowedContentLength - 15, 0))}\n...[truncated]`
    droppedSections.push(`${args.label}:truncated`)
  }

  return {
    block: `${openTag}${finalContent}${closeTag}`,
    droppedSections,
  }
}

function renderRecentConversation(messages: ContextMessage[]): string {
  if (messages.length === 0) {
    return ''
  }

  const content = messages.map(renderRecentMessage).join('\n\n')
  return `<recent_conversation>\n${content}\n</recent_conversation>`
}

function renderRecentMessage(message: ContextMessage): string {
  return `<message role="${message.role}">\n${message.content.trim()}\n</message>`
}

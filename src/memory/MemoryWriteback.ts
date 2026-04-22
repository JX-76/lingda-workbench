import fs from 'fs/promises'
import path from 'path'
import { getMemoryPaths } from './timeBuckets.js'
import {
  selectLongtermCandidates,
  type PromotionCandidate,
} from './MemoryPromotion.js'

export type WritebackMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type WritebackInput = {
  currentUserPrompt: string
  assistantOutput: string
  recentMessages: WritebackMessage[]
  cwd: string
  now?: Date
}

export type WritebackResult = {
  wroteDailySummary: boolean
  appendedSections: string[]
  skippedSections: string[]
  targetFiles: string[]
  duplicatesSkipped: string[]
  promotionCandidates: PromotionCandidate[]
  rejectedCandidates: string[]
  rejectionReasons: string[]
}

type ExtractedLine = {
  line: string
  section: string
  rawContent: string
}

const MAX_ITEMS = 5
const MIN_LINE_LENGTH = 16
const MAX_LINE_LENGTH = 220
const DEDUPE_WINDOW = 30
const UNCERTAIN_PATTERN = /(可能|大概|也许|怀疑|猜测|或许|maybe|probably|might|could)/i
const NOISE_PATTERN = /(error:|stack:|trace:|exception|npm ERR|vite v|webpack|tool_trace|assistant_delta)/i
const DECISION_PATTERN = /(决定|采用|改为|改成|统一|必须|不再|改用|should|must|will use|decided to)/i
const CONCLUSION_PATTERN = /(已完成|已通过|已接入|已修复|已定位|进入下一阶段|阶段|完成了|root cause|fixed|completed|integrated)/i
const CONSTRAINT_PATTERN = /(不侵入|外围包裹式|不要改|禁止|必须通过|不能修改|核心链路|QueryEngine|provider adapter)/i

export async function writeBackMemory(input: WritebackInput): Promise<WritebackResult> {
  const now = input.now ?? new Date()
  const memoryRoot = path.join(input.cwd, '.claude-memory')
  const memoryPaths = getMemoryPaths(memoryRoot, now)
  const targetFile = memoryPaths.dailySummary
  const existingSummary = await readOptionalFile(targetFile)
  const existingNormalizedEntries = extractNormalizedSummaryEntries(existingSummary)

  const extracted = extractStableMemoryLines(input)
  const deduped = filterDuplicateLines(extracted.lines, existingNormalizedEntries)
  const promotionSelection = selectLongtermCandidates(
    deduped.lines.map(item => ({
      section: item.section,
      content: item.rawContent,
    })),
  )

  if (deduped.lines.length === 0) {
    return {
      wroteDailySummary: false,
      appendedSections: [],
      skippedSections: dedupe([...extracted.skippedSections, ...deduped.duplicatesSkipped.map(item => `duplicate:${item}`)]),
      targetFiles: [targetFile],
      duplicatesSkipped: dedupe(deduped.duplicatesSkipped),
      promotionCandidates: promotionSelection.promotionCandidates,
      rejectedCandidates: promotionSelection.rejectedCandidates,
      rejectionReasons: dedupe(promotionSelection.rejectionReasons),
    }
  }

  const entry = renderWritebackEntry(now, deduped.lines.map(item => item.line))
  await fs.mkdir(path.dirname(targetFile), { recursive: true })
  await fs.appendFile(targetFile, entry, 'utf-8')

  return {
    wroteDailySummary: true,
    appendedSections: deduped.lines.map(item => item.section).slice(0, MAX_ITEMS),
    skippedSections: dedupe([...extracted.skippedSections, ...deduped.duplicatesSkipped.map(item => `duplicate:${item}`)]),
    targetFiles: [targetFile],
    duplicatesSkipped: dedupe(deduped.duplicatesSkipped),
    promotionCandidates: promotionSelection.promotionCandidates,
    rejectedCandidates: promotionSelection.rejectedCandidates,
    rejectionReasons: dedupe(promotionSelection.rejectionReasons),
  }
}

function extractStableMemoryLines(input: WritebackInput): {
  lines: ExtractedLine[]
  skippedSections: string[]
} {
  const skippedSections: string[] = []
  const seen = new Set<string>()
  const lines: ExtractedLine[] = []

  const candidateSources: Array<{ type: 'user' | 'assistant'; content: string }> = [
    { type: 'user', content: input.currentUserPrompt },
    { type: 'assistant', content: input.assistantOutput },
    ...input.recentMessages.slice(-6).map(message => ({
      type: message.role,
      content: message.content,
    })),
  ]

  for (const source of candidateSources) {
    const sourceLines = splitIntoCandidateLines(source.content)
    for (const rawLine of sourceLines) {
      if (lines.length >= MAX_ITEMS) {
        skippedSections.push('writeback:max-items-reached')
        return { lines, skippedSections }
      }

      const classified = classifyCandidateLine(rawLine, source.type)
      if (!classified) {
        skippedSections.push(`ignored:${rawLine.slice(0, 40)}`)
        continue
      }

      const normalizedKey = `${classified.section}:${normalizeComparableText(classified.rawContent)}`
      if (seen.has(normalizedKey)) {
        skippedSections.push(`${classified.section}:duplicate_in_turn`)
        continue
      }

      seen.add(normalizedKey)
      lines.push(classified)
    }
  }

  return { lines, skippedSections }
}

function splitIntoCandidateLines(content: string): string[] {
  return content
    .split(/\n+/)
    .map(line => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
}

function classifyCandidateLine(
  line: string,
  source: 'user' | 'assistant',
): ExtractedLine | null {
  const normalized = normalizeLine(line)

  if (normalized.length < MIN_LINE_LENGTH) {
    return null
  }
  if (normalized.length > MAX_LINE_LENGTH) {
    return null
  }
  if (UNCERTAIN_PATTERN.test(normalized)) {
    return null
  }
  if (NOISE_PATTERN.test(normalized)) {
    return null
  }

  if (DECISION_PATTERN.test(normalized)) {
    return {
      line: `- 决策：${normalized}`,
      section: 'decision',
      rawContent: normalized,
    }
  }

  if (CONCLUSION_PATTERN.test(normalized)) {
    return {
      line: `- 阶段结论：${normalized}`,
      section: 'phase_conclusion',
      rawContent: normalized,
    }
  }

  if (CONSTRAINT_PATTERN.test(normalized)) {
    return {
      line: `- 项目约束：${normalized}`,
      section: 'project_constraint',
      rawContent: normalized,
    }
  }

  if (source === 'user' && /(偏好|希望|请统一|以后都|习惯|prefer|always|never)/i.test(normalized)) {
    return {
      line: `- 用户偏好：${normalized}`,
      section: 'user_preference',
      rawContent: normalized,
    }
  }

  return null
}

function filterDuplicateLines(
  lines: ExtractedLine[],
  existingNormalizedEntries: Set<string>,
): {
  lines: ExtractedLine[]
  duplicatesSkipped: string[]
} {
  const result: ExtractedLine[] = []
  const duplicatesSkipped: string[] = []

  for (const item of lines) {
    const normalizedKey = `${item.section}:${normalizeComparableText(item.rawContent)}`
    if (existingNormalizedEntries.has(normalizedKey)) {
      duplicatesSkipped.push(`${item.section}:${item.rawContent}`)
      continue
    }
    result.push(item)
  }

  return {
    lines: result,
    duplicatesSkipped,
  }
}

function extractNormalizedSummaryEntries(content?: string): Set<string> {
  if (!content) {
    return new Set()
  }

  const lines = content
    .split(/\n+/)
    .map(line => line.trim())
    .filter(line => line.startsWith('- '))
    .slice(-DEDUPE_WINDOW)

  return new Set(
    lines
      .map(parseSummaryLine)
      .filter((value): value is string => Boolean(value)),
  )
}

function parseSummaryLine(line: string): string | null {
  const match = line.match(/^-\s*(决策|阶段结论|项目约束|用户偏好)：\s*(.+)$/)
  if (!match) {
    return null
  }

  const sectionLabel = match[1]
  const content = match[2]
  const section = mapSectionLabelToKey(sectionLabel)
  return `${section}:${normalizeComparableText(content)}`
}

function mapSectionLabelToKey(label: string): string {
  switch (label) {
    case '决策':
      return 'decision'
    case '阶段结论':
      return 'phase_conclusion'
    case '项目约束':
      return 'project_constraint'
    case '用户偏好':
      return 'user_preference'
    default:
      return 'unknown'
  }
}

function normalizeLine(line: string): string {
  return line.replace(/`+/g, '`').replace(/\s+/g, ' ').trim()
}

function normalizeComparableText(line: string): string {
  return normalizeLine(line)
    .replace(/^[-*]\s*/, '')
    .replace(/^(决策|阶段结论|项目约束|用户偏好)：\s*/, '')
    .toLowerCase()
}

function renderWritebackEntry(now: Date, lines: string[]): string {
  const timestamp = now.toISOString()
  return `\n## ${timestamp}\n${lines.join('\n')}\n`
}

async function readOptionalFile(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch {
    return undefined
  }
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items))
}

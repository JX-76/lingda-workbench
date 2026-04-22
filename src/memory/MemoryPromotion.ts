export type PromotionCandidate = {
  type: 'project_constraint' | 'user_preference' | 'technical_decision'
  content: string
  source: 'daily_summary_writeback'
}

export type PromotionSelectionResult = {
  promotionCandidates: PromotionCandidate[]
  rejectedCandidates: string[]
  rejectionReasons: string[]
}

type CandidateInput = {
  section: string
  content: string
}

const LONGTERM_SIGNAL_PATTERN = /(不侵入|外围包裹式|长期|长期约束|长期原则|基础原则|QueryEngine|provider 主链路|provider adapter|以后都|始终|一律|必须通过)/i
const PHASE_ONLY_PATTERN = /(阶段|本轮|今日|今天|已完成|第二阶段|第三阶段|phase)/i

export function selectLongtermCandidates(
  candidates: CandidateInput[],
): PromotionSelectionResult {
  const promotionCandidates: PromotionCandidate[] = []
  const rejectedCandidates: string[] = []
  const rejectionReasons: string[] = []
  const seen = new Set<string>()

  for (const candidate of candidates) {
    const normalized = normalizeCandidateContent(candidate.content)

    if (!normalized) {
      rejectedCandidates.push(candidate.content)
      rejectionReasons.push('empty_after_normalization')
      continue
    }

    if (seen.has(normalized)) {
      rejectedCandidates.push(candidate.content)
      rejectionReasons.push('duplicate_candidate')
      continue
    }
    seen.add(normalized)

    if (candidate.section === 'project_constraint' && LONGTERM_SIGNAL_PATTERN.test(normalized)) {
      promotionCandidates.push({
        type: 'project_constraint',
        content: candidate.content,
        source: 'daily_summary_writeback',
      })
      continue
    }

    if (candidate.section === 'user_preference' && LONGTERM_SIGNAL_PATTERN.test(normalized)) {
      promotionCandidates.push({
        type: 'user_preference',
        content: candidate.content,
        source: 'daily_summary_writeback',
      })
      continue
    }

    if (candidate.section === 'decision' && LONGTERM_SIGNAL_PATTERN.test(normalized) && !PHASE_ONLY_PATTERN.test(normalized)) {
      promotionCandidates.push({
        type: 'technical_decision',
        content: candidate.content,
        source: 'daily_summary_writeback',
      })
      continue
    }

    rejectedCandidates.push(candidate.content)
    rejectionReasons.push(PHASE_ONLY_PATTERN.test(normalized) ? 'phase_only' : 'not_stable_enough')
  }

  return {
    promotionCandidates,
    rejectedCandidates,
    rejectionReasons,
  }
}

function normalizeCandidateContent(content: string): string {
  return content.replace(/^[-*]\s*/, '').replace(/\s+/g, ' ').trim()
}

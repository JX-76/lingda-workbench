import fs from 'fs'
import path from 'path'
import {
  buildContext,
  DEFAULT_CONTEXT_STRATEGIES,
  type ContextMessage,
  type ContextStrategyId,
} from '../src/memory/ContextBuilder.js'
import type { MemorySnapshot } from '../src/memory/MemoryStore.js'

const outputDir = path.join(process.cwd(), 'outputs', 'context-benchmark')
fs.mkdirSync(outputDir, { recursive: true })

const recentMessages: ContextMessage[] = [
  {
    role: 'user',
    content:
      '我们这轮实验先只做上下文策略评测，不要直接做 query-aware 动态策略。',
  },
  {
    role: 'assistant',
    content:
      '明白，我会先聚焦静态 context allocation 的对比实验，并控制范围。',
  },
  {
    role: 'user',
    content:
      '最终结果要能写进 AI 大模型应用开发简历，重点体现评测体系、策略优化和多模型兼容。',
  },
  {
    role: 'assistant',
    content:
      '收到，结果会围绕 benchmark、quality-cost tradeoff 和多 provider 验证来组织。',
  },
  {
    role: 'user',
    content:
      '继续推进，但不要改 QueryEngine 核心链路，优先最小侵入实现。',
  },
  {
    role: 'assistant',
    content:
      '好的，我会尽量把改动收口在 ContextBuilder 参数化和独立 benchmark runner。',
  },
  {
    role: 'user',
    content:
      '如果可以，请保留阶段总结、历史决策和约束信息，这些对多轮任务很关键。',
  },
  {
    role: 'assistant',
    content:
      '会的，我会同时关注 recent、today summary 和 longterm memory 的配额差异。',
  },
]

const memorySnapshot: MemorySnapshot = {
  morning:
    '今天上午已明确实验 1 的核心目标：对 recent-only、static mix、recent-heavy、memory-heavy 四类上下文预算分配策略进行系统对比。当前计划采用 24 tasks、2 providers、2 repeats，优先做可复现实验链路，再沉淀成简历叙事。',
  dailySummary:
    '阶段总结：已经完成上下文策略问题定义、核心指标设计、provider 方案确认，并决定先通过最小脚本验证策略差异，再实现单条任务 runner，最后再扩到批量 benchmark。',
  longtermProject:
    '长期项目决策：项目定位为 AI 大模型应用开发，不走论文路线。优先强调应用算法、上下文管理、评测体系、多模型兼容、token 与 latency tradeoff、工程可落地性。',
  longtermUser:
    '用户偏好：中文输出；结构化表达；先小步快跑再扩规模；优先形成可写进简历与面试的结论；不建议一开始就做大规模研究型实验。',
}

const currentUserPrompt =
  '继续完善实验方案，并说明当前你会优先保留哪些上下文信息以及为什么。'

const now = new Date('2026-04-11T09:30:00+08:00')
const strategyIds: ContextStrategyId[] = ['C0', 'C1', 'C2', 'C3']

const results = strategyIds.map(strategyId => {
  const result = buildContext({
    currentUserPrompt,
    recentMessages,
    memorySnapshot,
    budget: { maxChars: 1800 },
    now,
    strategy: strategyId,
  })

  return {
    strategyId,
    label: DEFAULT_CONTEXT_STRATEGIES[strategyId].label,
    allocations: DEFAULT_CONTEXT_STRATEGIES[strategyId].allocations,
    diagnostics: result.diagnostics,
    conversationContextChars: result.conversationContext.length,
    memoryContextChars: result.memoryContext.length,
    systemContextChars: result.systemContext.length,
    memoryContextPreview: result.memoryContext.slice(0, 160),
  }
})

const outputPath = path.join(outputDir, 'verify-context-strategies.json')
fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf-8')

console.log('=== Context Strategy Verification ===')
for (const item of results) {
  console.log(`\n[${item.strategyId}] ${item.label}`)
  console.log(`usedRecentMessages=${item.diagnostics.usedRecentMessages}`)
  console.log(`usedMemoryBuckets=${item.diagnostics.usedMemoryBuckets.join(', ') || '(none)'}`)
  console.log(`droppedSections=${item.diagnostics.droppedSections.join(' | ') || '(none)'}`)
  console.log(`conversationChars=${item.conversationContextChars}`)
  console.log(`memoryChars=${item.memoryContextChars}`)
  console.log(`systemChars=${item.systemContextChars}`)
}
console.log(`\nSaved JSON: ${outputPath}`)

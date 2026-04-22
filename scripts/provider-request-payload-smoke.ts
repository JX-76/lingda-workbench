import { createModelAdapter } from '../src/providers/ModelAdapterFactory.js'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const scenarios = [
  {
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    reasoningEffort: 'high',
    expected: ['thinking', 'reasoning_effort'],
  },
  {
    provider: 'deepseek',
    model: 'deepseek-reasoner',
    reasoningEffort: 'medium',
    expected: ['reasoning'],
  },
  {
    provider: 'openai-compatible',
    model: 'gpt-4.1',
    reasoningEffort: 'high',
    expected: ['reasoning_effort'],
  },
] as const

for (const scenario of scenarios) {
  const adapter: any = createModelAdapter({
    provider: scenario.provider,
    model: scenario.model,
    reasoningEffort: scenario.reasoningEffort,
  })

  const payload = adapter['buildRequestBody'](
    scenario.model,
    [{ role: 'user', content: 'hello' }],
    1024,
    false,
    [],
    {},
  )

  for (const key of scenario.expected) {
    assert(key in payload, `[${scenario.provider}] expected payload key missing: ${key}`)
  }
}

console.log(`✅ Provider request payload smoke 通过，共 ${scenarios.length} 个场景`)
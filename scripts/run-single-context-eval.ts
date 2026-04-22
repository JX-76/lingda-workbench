import fs from 'fs'
import path from 'path'
import { buildContext } from '../src/memory/ContextBuilder.js'

const outputDir = path.join(process.cwd(), 'outputs', 'context-benchmark')
fs.mkdirSync(outputDir, { recursive: true })

async function run() {
  console.log('=== Single Task Context Eval ===')

  const provider = 'ollama'
  const model = 'qwen2.5-coder:7b'
  const baseUrl = 'http://127.0.0.1:11434/v1'
  const strategy = 'C2' as const

  console.log(`1. Provider: ${provider}, model: ${model}`)

  const history = [
    { role: 'user' as const, content: '你好，接下来的对话请都用中文，并且尽量精简。' },
    { role: 'assistant' as const, content: '好的，我会用中文并保持精简。' },
  ]
  const currentPrompt = '请写一个10行以内的Python快排算法。'

  console.log(`2. Building context with strategy ${strategy}...`)
  const contextResult = buildContext({
    currentUserPrompt: currentPrompt,
    recentMessages: history,
    memorySnapshot: {},
    budget: { maxChars: 12000 },
    now: new Date(),
    strategy,
  })

  const systemPrompt = contextResult.systemContext
    ? `${contextResult.systemContext}\n\n(Use the structured context above as supplementary guidance. Prioritize the user's current request.)`
    : '请用中文并保持回答精简。'

  console.log('3. Calling Ollama OpenAI-compatible endpoint...')
  const startedAt = Date.now()
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer dummy-key',
    },
    body: JSON.stringify({
      model,
      stream: false,
      temperature: 0.2,
      max_tokens: 512,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: currentPrompt },
      ],
    }),
  })
  const latencyMs = Date.now() - startedAt

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Provider request failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const assistantOutput = data?.choices?.[0]?.message?.content ?? ''
  const usage = data?.usage ?? null

  const result = {
    task_id: 'smoke_test_01',
    strategy,
    provider,
    model,
    success: true,
    latency_ms: latencyMs,
    usage,
    context_diagnostics: contextResult.diagnostics,
    system_context_chars: contextResult.systemContext.length,
    assistant_output: assistantOutput,
    raw_response_meta: {
      id: data?.id ?? null,
      finish_reason: data?.choices?.[0]?.finish_reason ?? null,
    },
  }

  const outputPath = path.join(outputDir, 'single-run.json')
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf-8')

  console.log('\n=== Run Result ===')
  console.log(`Success: ${result.success}`)
  console.log(`Latency: ${latencyMs}ms`)
  console.log(`Usage: ${usage ? JSON.stringify(usage) : '(none returned)'}`)
  console.log(`Output Snippet: ${assistantOutput.slice(0, 120).replace(/\n/g, ' ')}...`)
  console.log(`Saved full result to ${outputPath}`)
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})

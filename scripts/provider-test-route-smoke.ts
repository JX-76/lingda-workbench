export {}

import { createLocalWebServer } from '../src/server/localWebServer.js'

async function testProvider(baseUrl: string, payload: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/api/providers/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))
  return { status: response.status, data }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const scenarios = [
  {
    name: 'openai-compatible',
    payload: { provider: 'openai-compatible', baseUrl: 'https://api.openai.com/v1' },
  },
  {
    name: 'azure-openai',
    payload: {
      provider: 'azure-openai',
      baseUrl: 'https://example.openai.azure.com',
      providerOptions: { 'azure-openai': { apiVersion: '2024-10-21', deployment: 'test-deployment' } },
    },
  },
  {
    name: 'gemini',
    payload: { provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  },
] as const

const app = createLocalWebServer()
const server = app.listen(0)

try {
  await new Promise<void>((resolve, reject) => {
    server.once('listening', () => resolve())
    server.once('error', reject)
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to resolve test server address')
  }

  const baseUrl = `http://127.0.0.1:${address.port}`

  for (const scenario of scenarios) {
    const result = await testProvider(baseUrl, scenario.payload)
    assert(typeof result.status === 'number', `${scenario.name}: status invalid`)
    assert(result.data && typeof result.data === 'object', `${scenario.name}: response body invalid`)
  }

  console.log(`✅ Provider test route smoke 通过，共 ${scenarios.length} 个场景`)
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close(err => (err ? reject(err) : resolve()))
  })
}

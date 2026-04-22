import { createModelAdapter } from '../src/providers/ModelAdapterFactory.js'
import { PROVIDER_REGISTRY } from '../src/providers/registry.js'
import type { ProviderId } from '../src/providers/types.js'

const providersToCheck: ProviderId[] = [
  'openai-compatible',
  'openrouter',
  'azure-openai',
  'gemini',
  'deepseek',
  'kimi',
  'zhipu',
  'dashscope',
  'doubao',
  'minimax',
  'ollama',
  'lmstudio',
  'localai',
  'custom',
]

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

for (const providerId of providersToCheck) {
  const provider = PROVIDER_REGISTRY[providerId]
  assert(provider, `provider missing: ${providerId}`)

  const adapter = createModelAdapter({
    provider: providerId,
    model: provider.defaultModel,
    baseUrl: provider.baseUrl,
    providerOptions: providerId === 'azure-openai'
      ? { 'azure-openai': { deployment: 'test-deployment', apiVersion: '2024-10-21' } }
      : {},
  }) as unknown as {
    baseUrl?: string
    apiKey?: string
    messages?: { create?: unknown }
    beta?: { messages?: { create?: unknown } }
  }

  assert(adapter, `[${providerId}] adapter 未创建`) 
  assert(typeof adapter.messages?.create === 'function', `[${providerId}] messages.create 缺失`)
  assert(typeof adapter.beta?.messages?.create === 'function', `[${providerId}] beta.messages.create 缺失`)

  if (providerId !== 'custom') {
    assert((adapter as any).baseUrl || provider.baseUrl, `[${providerId}] 缺少 baseUrl`)
  }
}

console.log(`✅ Provider adapter smoke 通过，共 ${providersToCheck.length} 个 provider`)
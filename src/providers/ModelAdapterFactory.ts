import type Anthropic from '@anthropic-ai/sdk'
import { OpenAIAdapter } from './adapters/OpenAIAdapter.js'
import { PROVIDER_REGISTRY } from './registry.js'
import type { ProviderId } from './types.js'

/**
 * Factory for creating Anthropic-shaped adapters for non-Anthropic providers.
 * Native Anthropic / Bedrock / Vertex clients should continue to be created
 * by the original client bootstrap path in `src/services/api/client.ts`.
 *
 * 当前策略：
 * - OpenRouter / Azure OpenAI / Groq / LM Studio / LocalAI / Gemini /
 *   Zhipu / DashScope / Doubao 已提升为产品级 provider。
 * - 它们在实现层仍统一复用 OpenAIAdapter，以保持横向扩展收敛在
 *   registry + factory + adapter，不回流到 route / session / UI 特判。
 */
export function createModelAdapter(settings: any): Anthropic {
  const providerId = (settings.provider || 'openai-compatible') as ProviderId
  const providerConfig = PROVIDER_REGISTRY[providerId] || PROVIDER_REGISTRY['openai-compatible']

  if (providerConfig.adapterKind === 'anthropic-native') {
    throw new Error(`Provider "${providerConfig.id}" should use the native Anthropic bootstrap path.`)
  }

  const mergedSettings = {
    ...providerConfig,
    ...settings,
    provider: providerConfig.id,
    model: settings.model || providerConfig.defaultModel,
    baseUrl: settings.baseUrl || providerConfig.baseUrl,
    capabilities: settings.capabilities || providerConfig.capabilities,
    headers: {
      ...(providerConfig.headers || {}),
      ...(settings.headers || {}),
    },
    providerOptions: settings.providerOptions || {},
  }

  const adapter = new OpenAIAdapter(mergedSettings)
  return adapter as unknown as Anthropic
}

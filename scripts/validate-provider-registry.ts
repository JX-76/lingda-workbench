import { PROVIDER_REGISTRY } from '../src/providers/registry.js'
import type { ProviderConfig, ProviderFieldSchema, ProviderId } from '../src/providers/types.js'

const PRIMARY_PROVIDERS: ProviderId[] = [
  'anthropic',
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

function validateFieldSchema(provider: ProviderConfig, field: ProviderFieldSchema) {
  assert(field.key, `[${provider.id}] settingsSchema field.key 不能为空`)
  assert(field.label, `[${provider.id}] settingsSchema.${field.key}.label 不能为空`)
  assert(['text', 'password', 'select'].includes(field.type), `[${provider.id}] settingsSchema.${field.key}.type 非法`)

  if (field.type === 'select') {
    assert(Array.isArray(field.options) && field.options.length > 0, `[${provider.id}] settingsSchema.${field.key} 为 select 时必须提供 options`)
  }
}

function validateProvider(provider: ProviderConfig) {
  assert(provider.id, 'provider.id 不能为空')
  assert(provider.label, `[${provider.id}] label 不能为空`)
  assert(provider.defaultModel, `[${provider.id}] defaultModel 不能为空`)
  assert(Array.isArray(provider.models) && provider.models.length > 0, `[${provider.id}] models 不能为空`)
  assert(provider.models.includes(provider.defaultModel), `[${provider.id}] defaultModel 必须存在于 models 中`)

  if (provider.maturity !== 'planned') {
    assert(provider.description, `[${provider.id}] 非 planned provider 必须提供 description`)
    assert(provider.recommendedFor, `[${provider.id}] 非 planned provider 必须提供 recommendedFor`)
  }

  if (!provider.local && provider.maturity !== 'planned') {
    assert(provider.apiKeyLabel, `[${provider.id}] 非本地 provider 建议至少提供 apiKeyLabel`)
  }

  if (provider.settingsSchema) {
    for (const field of provider.settingsSchema) {
      validateFieldSchema(provider, field)
    }
  }

  if (provider.modelMetadata) {
    for (const [model, metadata] of Object.entries(provider.modelMetadata)) {
      assert(provider.models.includes(model), `[${provider.id}] modelMetadata 中的 ${model} 不在 models 列表里`)
      assert(metadata.label, `[${provider.id}] modelMetadata.${model}.label 不能为空`)
    }

    assert(
      provider.modelMetadata[provider.defaultModel],
      `[${provider.id}] defaultModel=${provider.defaultModel} 必须提供 modelMetadata`,
    )
  }
}

for (const providerId of PRIMARY_PROVIDERS) {
  const provider = PROVIDER_REGISTRY[providerId]
  assert(provider, `缺少主流 provider: ${providerId}`)
  validateProvider(provider)
}

for (const provider of Object.values(PROVIDER_REGISTRY)) {
  validateProvider(provider)
}

console.log(`✅ Provider registry 校验通过，共 ${Object.keys(PROVIDER_REGISTRY).length} 个 provider`)
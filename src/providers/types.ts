export type ProviderId =
  | 'anthropic'
  | 'openai-compatible'
  | 'openrouter'
  | 'azure-openai'
  | 'groq'
  | 'ollama'
  | 'deepseek'
  | 'kimi'
  | 'minimax'
  | 'lmstudio'
  | 'localai'
  | 'gemini'
  | 'bedrock'
  | 'vertex'
  | 'zhipu'
  | 'dashscope'
  | 'doubao'
  | 'custom'

export type ReasoningEffort = 'low' | 'medium' | 'high'
export type ProviderMaturity = 'stable' | 'beta' | 'planned'
export type ProviderGroup = 'native' | 'cloud' | 'local' | 'enterprise' | 'custom' | 'planned'

export type ProviderCapabilityConfig = {
  streaming?: boolean
  tools?: boolean
  vision?: boolean
  reasoning?: boolean
}

export type ProviderFieldOption = {
  label: string
  value: string
}

export type ProviderFieldSchema = {
  key: string
  label: string
  type: 'text' | 'password' | 'select'
  required?: boolean
  placeholder?: string
  description?: string
  options?: ProviderFieldOption[]
}

export type ProviderModelMetadata = {
  label: string
  description?: string
  recommendedFor?: string
  contextWindow?: string
  inputPrice?: string
  outputPrice?: string
  reasoningEfforts?: ReasoningEffort[]
  capabilities?: ProviderCapabilityConfig
}

export type ProviderConfig = {
  id: ProviderId
  label: string
  description?: string
  recommendedFor?: string
  group?: ProviderGroup
  maturity?: ProviderMaturity
  adapterKind?: 'anthropic-native' | 'openai-compatible' | 'future-native'
  baseUrl?: string
  baseUrlEditable?: boolean
  baseUrlRequired?: boolean
  apiKeyEnv?: string
  apiKeyLabel?: string
  apiKeyPlaceholder?: string
  docsUrl?: string
  defaultModel: string
  models: string[]
  modelMetadata?: Record<string, ProviderModelMetadata>
  headers?: Record<string, string>
  capabilities?: ProviderCapabilityConfig
  settingsSchema?: ProviderFieldSchema[]
  supportsReasoningEffort?: boolean
  isOpenAICompatiblePreset?: boolean
  local?: boolean
}

export type RuntimeModelSelection = {
  provider: ProviderId
  model: string
  baseUrl?: string
  apiKey?: string
  headers?: Record<string, string>
  providerOptions?: Record<string, Record<string, string | boolean | undefined>>
}

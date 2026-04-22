import { ChatSessionSnapshot, ChatSessionSummary, Message } from '../types/chat'

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)

  if (!res.ok) {
    let errorMsg = 'Unknown Error'
    try {
      const data = await res.json()
      errorMsg = data.error || data.message || `HTTP ${res.status}: ${res.statusText}`
    } catch {
      errorMsg = await res.text().then(t => t.slice(0, 100)).catch(() => `HTTP ${res.status}: ${res.statusText}`)
    }
    throw new Error(errorMsg)
  }

  try {
    return await res.json()
  } catch {
    return {} as T
  }
}

export interface FsTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FsTreeNode[]
}

export type McpTransportType = 'stdio' | 'http' | 'sse' | 'ws'

export interface McpStdioServerConfig {
  type?: 'stdio'
  command: string
  args?: string[]
  env?: Record<string, string>
  [key: string]: any
}

export interface McpRemoteServerConfig {
  type: 'http' | 'sse' | 'ws'
  url: string
  headers?: Record<string, string>
  headersHelper?: string
  [key: string]: any
}

export type McpServerConfig = McpStdioServerConfig | McpRemoteServerConfig

export interface McpCapabilitySummaryItem {
  name: string
  description?: string
  uri?: string
  title?: string
  arguments?: string[]
}

export interface McpServerDescription {
  tools: McpCapabilitySummaryItem[]
  resources: McpCapabilitySummaryItem[]
  prompts: McpCapabilitySummaryItem[]
  instructions?: string
  serverInfo?: {
    name?: string
    version?: string
  }
}

export type McpAuthState = 'ok' | 'needs-token' | 'needs-oauth' | 'token-expired' | 'unknown'
export type McpLogLevel = 'info' | 'warn' | 'error'
export type McpLogSource = 'manager' | 'auth' | 'reconnect' | 'stdout' | 'stderr'

export interface McpLogEntry {
  id: string
  timestamp: string
  level: McpLogLevel
  source: McpLogSource
  message: string
}

export interface McpRuntimeStatus {
  name: string
  status: 'connected' | 'connecting' | 'disconnected' | 'error'
  transportType?: string
  errorMessage?: string
  toolsCount?: number
  resourcesCount?: number
  promptsCount?: number
  lastConnectionAttemptAt?: string
  lastConnectedAt?: string
  lastErrorAt?: string
  configSource?: 'saved' | 'runtime'
  reconnectAttempt?: number
  maxReconnectAttempts?: number
  nextRetryAt?: string
  lastDisconnectReason?: string
  authState?: McpAuthState
  authHint?: string
  autoReconnectEnabled?: boolean
}

export interface SkillFile {
  id: string
  name: string
  content: string
}

export type ReasoningEffort = 'low' | 'medium' | 'high'
export type ProviderMaturity = 'stable' | 'beta' | 'planned'
export type ProviderGroup = 'native' | 'cloud' | 'local' | 'enterprise' | 'custom' | 'planned'

export interface ProviderCapabilityConfig {
  streaming?: boolean
  tools?: boolean
  vision?: boolean
  reasoning?: boolean
}

export interface ProviderFieldOption {
  label: string
  value: string
}

export interface ProviderFieldSchema {
  key: string
  label: string
  type: 'text' | 'password' | 'select'
  required?: boolean
  placeholder?: string
  description?: string
  options?: ProviderFieldOption[]
}

export interface ProviderModelMetadata {
  label: string
  description?: string
  recommendedFor?: string
  contextWindow?: string
  inputPrice?: string
  outputPrice?: string
  reasoningEfforts?: ReasoningEffort[]
  capabilities?: ProviderCapabilityConfig
}

export interface ProviderConfig {
  id: string
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
  capabilities?: ProviderCapabilityConfig
  settingsSchema?: ProviderFieldSchema[]
  supportsReasoningEffort?: boolean
  isOpenAICompatiblePreset?: boolean
  local?: boolean
}

export interface ProviderSettings {
  provider: string
  model: string
  apiKey: string
  baseUrl: string
  reasoningEffort: ReasoningEffort
  useDifferentModels: boolean
  planModel: string
  actModel: string
  planProvider: string
  actProvider: string
  providerOptions: Record<string, Record<string, string | boolean | undefined>>
  qqId: string
  qqSecret: string
  undercoverMode: boolean
  fastMode: boolean
  debugMode: boolean
  companionMuted: boolean
}

export interface ProviderTestPayload {
  provider: string
  model?: string
  apiKey?: string
  baseUrl?: string
  reasoningEffort?: ReasoningEffort
  providerOptions?: Record<string, Record<string, string | boolean | undefined>>
}

export const apiClient = {
  chat: {
    startSession: (
      sessionId: string,
      messages: Message[],
      prompt?: string,
      runtimeSelection?: {
        mode?: 'plan' | 'act'
        provider?: string
        model?: string
        reasoningEffort?: ReasoningEffort
      },
    ) =>
      fetchJson<{ ok: boolean; data: { sessionId: string; status: string } }>('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, messages, prompt, runtimeSelection }),
      }),

    getSessions: () =>
      fetchJson<{ ok: boolean; sessions: ChatSessionSummary[] }>('/api/chat/sessions'),

    getSession: (id: string) =>
      fetchJson<{ ok: boolean; session: ChatSessionSnapshot }>(`/api/chat/sessions/${encodeURIComponent(id)}`),

    approve: (approvalId: string, sessionId: string, approved: boolean) =>
      fetchJson<{ ok: boolean; data: { approvalId: string; sessionId: string } }>('/api/chat/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId, sessionId, approved }),
      }),
  },

  context: {
    fetchUrl: (url: string) =>
      fetchJson<{ success: boolean; content: string; error?: string }>('/api/context/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      }),
  },

  bot: {
    saveConfig: (qqId: string, qqSecret: string) =>
      fetchJson<{ success: boolean; qqId: string; error?: string }>('/api/bot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qqId, qqSecret }),
      }),

    testConnection: () =>
      fetchJson<{ ok: boolean; accessTokenPreview?: string; expiresIn?: number; error?: string }>('/api/bot/test', {
        method: 'POST',
      }),
  },

  settings: {
    get: () => fetchJson<ProviderSettings>('/api/settings'),
    getProviders: () => fetchJson<{ providers: ProviderConfig[] }>('/api/providers'),
    testProvider: (payload: ProviderTestPayload) =>
      fetchJson<{ ok: boolean; error?: string; warning?: string }>('/api/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    save: (settings: ProviderSettings | Record<string, any>) =>
      fetchJson<Record<string, any>>('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      }),
  },

  mcp: {
    getConfig: () =>
      fetchJson<{ configPath?: string; mcpServers: Record<string, McpServerConfig> }>('/api/mcp/config'),
    getStatus: () => fetchJson<{ statuses: Record<string, McpRuntimeStatus> }>('/api/mcp/status'),
    getDescribe: (name: string) =>
      fetchJson<{ ok: boolean; description: McpServerDescription }>(`/api/mcp/describe/${encodeURIComponent(name)}`),
    getLogs: (name: string) =>
      fetchJson<{ ok: boolean; logs: McpLogEntry[] }>(`/api/mcp/logs/${encodeURIComponent(name)}`),
    getLogStreamUrl: (name: string) =>
      `/api/mcp/logs/${encodeURIComponent(name)}/stream`,
    exportConfig: () =>
      fetchJson<{ configPath?: string; mcpServers: Record<string, McpServerConfig> }>('/api/mcp/export'),
    importConfig: (json: string) =>
      fetchJson<{ success: boolean; configPath?: string; mcpServers: Record<string, McpServerConfig>; validationErrors?: Record<string, string> }>('/api/mcp/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json }),
      }),
    validate: (payload: McpServerConfig) =>
      fetchJson<{ ok: boolean; error?: string }>('/api/mcp/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    saveConfig: (mcpServers: Record<string, McpServerConfig>) =>
      fetchJson<{ success?: boolean; configPath?: string; mcpServers?: Record<string, McpServerConfig>; validationErrors?: Record<string, string> }>('/api/mcp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mcpServers }),
      }),
    connect: (name: string, payload?: McpServerConfig) =>
      fetchJson<{ ok: boolean; status: McpRuntimeStatus }>(`/api/mcp/connect/${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
      }),
    retry: (name: string, payload?: McpServerConfig) =>
      fetchJson<{ ok: boolean; status: McpRuntimeStatus }>(`/api/mcp/retry/${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
      }),
    clearAuth: (name: string) =>
      fetchJson<{ ok: boolean; status: McpRuntimeStatus }>(`/api/mcp/clear-auth/${encodeURIComponent(name)}`, {
        method: 'POST',
      }),
    disconnect: (name: string) =>
      fetchJson<{ ok: boolean; status: McpRuntimeStatus }>(`/api/mcp/disconnect/${encodeURIComponent(name)}`, {
        method: 'POST',
      }),
  },

  skills: {
    list: () => fetchJson<{ skills: SkillFile[] }>('/api/skills'),
    save: (id: string, content: string) =>
      fetchJson<{ ok?: boolean }>('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, content }),
      }),
    remove: (id: string) =>
      fetchJson<{ ok?: boolean }>(`/api/skills/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
  },

  fs: {
    getTree: (path?: string) =>
      fetchJson<{ tree: FsTreeNode[] }>(`/api/fs/tree${path ? `?path=${encodeURIComponent(path)}` : ''}`),
    readFile: (path: string) =>
      fetchJson<{ content: string }>(`/api/fs/file?path=${encodeURIComponent(path)}`),
    createFolder: (path: string) =>
      fetchJson<{ success: boolean; error?: string }>('/api/fs/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      }),
    createFile: (path: string) =>
      fetchJson<{ success: boolean; error?: string }>('/api/fs/create-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      }),
  },
}

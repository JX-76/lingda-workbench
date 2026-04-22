import {
  ListPromptsResultSchema,
  ListResourcesResultSchema,
  ListToolsResultSchema,
  type ListPromptsResult,
  type ListResourcesResult,
  type ListToolsResult,
} from '@modelcontextprotocol/sdk/types.js'
import {
  reconnectMcpServerImpl,
} from '../services/mcp/client.js'
import {
  McpServerConfigSchema,
  type ConnectedMCPServer,
  type MCPServerConnection,
  type McpHTTPServerConfig,
  type McpServerConfig,
  type McpSSEServerConfig,
  type McpStdioServerConfig,
  type McpWebSocketServerConfig,
  type ScopedMcpServerConfig,
} from '../services/mcp/types.js'

export type McpRuntimeState =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'error'

export type McpAuthState =
  | 'ok'
  | 'needs-token'
  | 'needs-oauth'
  | 'token-expired'
  | 'unknown'

export type McpLogLevel = 'info' | 'warn' | 'error'
export type McpLogSource = 'manager' | 'auth' | 'reconnect' | 'stdout' | 'stderr'

export interface McpLogEntry {
  id: string
  timestamp: string
  level: McpLogLevel
  source: McpLogSource
  message: string
}

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

export interface McpRuntimeStatus {
  name: string
  status: McpRuntimeState
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

interface SessionRecord {
  name: string
  config: ScopedMcpServerConfig
  status: McpRuntimeState
  client?: ConnectedMCPServer
  description?: McpServerDescription
  errorMessage?: string
  lastConnectionAttemptAt?: string
  lastConnectedAt?: string
  lastErrorAt?: string
  logs: McpLogEntry[]
  reconnectAttempt?: number
  maxReconnectAttempts?: number
  nextRetryAt?: string
  lastDisconnectReason?: string
  authState?: McpAuthState
  authHint?: string
  autoReconnectEnabled?: boolean
}

type RemoteHeaderConfig =
  | McpHTTPServerConfig
  | McpSSEServerConfig
  | McpWebSocketServerConfig

const sessions = new Map<string, SessionRecord>()
const operationChains = new Map<string, Promise<unknown>>()
const reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>()

const LOG_LIMIT = 300
const MAX_AUTO_RECONNECT_ATTEMPTS = 3
const RECONNECT_DELAYS_MS = [2000, 5000, 10000]

function runSerialized<T>(name: string, task: () => Promise<T>): Promise<T> {
  const previous = operationChains.get(name) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(task)
  operationChains.set(
    name,
    next.finally(() => {
      if (operationChains.get(name) === next) {
        operationChains.delete(name)
      }
    }),
  )
  return next
}

function nowIso() {
  return new Date().toISOString()
}

function isConnectedClient(
  client: MCPServerConnection,
): client is ConnectedMCPServer {
  return client.type === 'connected'
}

function isStdioConfig(
  config: McpServerConfig | ScopedMcpServerConfig,
): config is McpStdioServerConfig {
  return (config.type ?? 'stdio') === 'stdio' && 'command' in config
}

function isRemoteHeaderConfig(
  config: McpServerConfig | ScopedMcpServerConfig,
): config is RemoteHeaderConfig {
  return config.type === 'http' || config.type === 'sse' || config.type === 'ws'
}

function getTransportType(config?: Partial<McpServerConfig>): string | undefined {
  if (!config) return undefined
  return config.type ?? 'stdio'
}

function shouldAutoReconnect(config: McpServerConfig | ScopedMcpServerConfig): boolean {
  return config.type === 'http' || config.type === 'sse' || config.type === 'ws'
}

function createFallbackScopedConfig(): ScopedMcpServerConfig {
  return {
    type: 'stdio',
    command: '',
    args: [],
    scope: 'user',
  }
}

function toScopedConfig(config: McpServerConfig): ScopedMcpServerConfig {
  return {
    ...config,
    scope: 'user',
  }
}

function withRawError(summary: string, raw?: string): string {
  if (!raw || raw === summary) return summary
  return `${summary}；原始错误：${raw}`
}

function createLogEntry(
  level: McpLogLevel,
  source: McpLogSource,
  message: string,
): McpLogEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: nowIso(),
    level,
    source,
    message,
  }
}

function appendLog(
  record: SessionRecord | undefined,
  level: McpLogLevel,
  source: McpLogSource,
  message: string,
): McpLogEntry[] {
  const logs = [...(record?.logs || []), createLogEntry(level, source, message)]
  return logs.slice(-LOG_LIMIT)
}

function clearReconnectTimer(name: string) {
  const timer = reconnectTimers.get(name)
  if (timer) {
    clearTimeout(timer)
    reconnectTimers.delete(name)
  }
}

function detectConfigIssue(config: McpServerConfig): string | undefined {
  const transportType = getTransportType(config)

  if (isStdioConfig(config)) {
    if (!String(config.command || '').trim()) {
      return '缺少启动命令，请先填写 command。'
    }

    const emptyEnvKeys = Object.entries(config.env || {})
      .filter(([, value]) => !String(value ?? '').trim())
      .map(([key]) => key)

    if (emptyEnvKeys.length > 0) {
      return `缺少环境变量值：${emptyEnvKeys.join(', ')}`
    }

    const joinedArgs = (config.args || []).join(' ')
    if (joinedArgs.includes('path/to/database.db')) {
      return 'SQLite 数据库路径仍是示例值，请改成你自己的 .db 文件路径。'
    }
    if (joinedArgs.includes('postgresql://localhost/mydb')) {
      return 'PostgreSQL 连接串仍是示例值，请改成真实连接地址。'
    }
  }

  if (transportType === 'http' || transportType === 'sse' || transportType === 'ws') {
    if (!('url' in config) || !String(config.url || '').trim()) {
      return '缺少服务地址，请先填写 URL。'
    }

    if (isRemoteHeaderConfig(config)) {
      const emptyHeaders = Object.entries(config.headers || {})
        .filter(([, value]) => !String(value ?? '').trim())
        .map(([key]) => key)
      if (emptyHeaders.length > 0) {
        return `以下请求头缺少值：${emptyHeaders.join(', ')}`
      }

      const authHeader = config.headers?.Authorization
      if (typeof authHeader === 'string' && /^Bearer\s*$/i.test(authHeader)) {
        return 'Authorization 请求头里没有实际 Token，请补全 Bearer Token。'
      }
    }
  }

  return undefined
}

function flattenZodError(error: any): string {
  const issues = error?.issues
  if (Array.isArray(issues) && issues.length > 0) {
    return issues
      .map((issue: any) => {
        const path = Array.isArray(issue?.path) && issue.path.length > 0
          ? `${issue.path.join('.')}: `
          : ''
        return `${path}${issue?.message || '配置格式错误'}`
      })
      .join('；')
  }
  return error?.message || '配置格式错误'
}

export function validateMcpServerConfig(config: unknown): {
  ok: boolean
  normalized?: McpServerConfig
  error?: string
} {
  const parsed = McpServerConfigSchema().safeParse(config)
  if (!parsed.success) {
    return {
      ok: false,
      error: flattenZodError(parsed.error),
    }
  }

  const issue = detectConfigIssue(parsed.data)
  if (issue) {
    return {
      ok: false,
      error: issue,
    }
  }

  return {
    ok: true,
    normalized: parsed.data,
  }
}

function inferAuthState(
  config: McpServerConfig,
  errorMessage: string | undefined,
  connectionType?: MCPServerConnection['type'],
): { authState?: McpAuthState; authHint?: string } {
  const raw = (errorMessage || '').toLowerCase()

  if (connectionType === 'needs-auth' || raw.includes('oauth') || raw.includes('authorize') || raw.includes('consent')) {
    return {
      authState: 'needs-oauth',
      authHint: '该服务需要先完成 OAuth 授权。请按提示在浏览器完成登录，再重新连接。',
    }
  }

  if (raw.includes('expired') || raw.includes('invalid_refresh_token') || raw.includes('token expired')) {
    return {
      authState: 'token-expired',
      authHint: '凭据可能已过期。请刷新 Token 或清除旧认证后重新连接。',
    }
  }

  if (isRemoteHeaderConfig(config)) {
    const authHeader = config.headers?.Authorization
    if (!authHeader || /^bearer\s*$/i.test(authHeader)) {
      return {
        authState: 'needs-token',
        authHint: '请在 Headers 中填写有效的 Authorization: Bearer <token>，或补全 OAuth 配置。',
      }
    }
  }

  if (isStdioConfig(config)) {
    const missingSecretKeys = Object.entries(config.env || {})
      .filter(([key, value]) => /(token|key|secret|password)/i.test(key) && !String(value || '').trim())
      .map(([key]) => key)
    if (missingSecretKeys.length > 0) {
      return {
        authState: 'needs-token',
        authHint: `请补全环境变量：${missingSecretKeys.join(', ')}`,
      }
    }
  }

  if (raw.includes('401') || raw.includes('403') || raw.includes('unauthorized')) {
    return {
      authState: 'needs-token',
      authHint: '认证未通过，请检查 Token、Headers、权限范围或组织授权。',
    }
  }

  return raw
    ? {
        authState: 'unknown',
        authHint: '服务连接失败，但未能自动识别认证模式，请结合诊断日志排查。',
      }
    : {}
}

function humanizeRuntimeError(
  errorMessage: string | undefined,
  config: McpServerConfig,
): string {
  const precheck = detectConfigIssue(config)
  if (precheck) {
    return withRawError(precheck, errorMessage)
  }

  const raw = errorMessage || '未知错误'

  if (/ENOENT|spawn .* not found/i.test(raw)) {
    const commandName = isStdioConfig(config)
      ? String(config.command || 'unknown')
      : 'unknown'
    return withRawError(`启动命令不存在或未安装：${commandName}`, raw)
  }

  if (/EACCES|permission denied/i.test(raw)) {
    return withRawError('启动命令没有执行权限，请检查文件权限或运行方式。', raw)
  }

  if (/401|unauthorized/i.test(raw)) {
    return withRawError('认证失败，请检查 Token、Authorization Header 或 OAuth 配置。', raw)
  }

  if (/403/i.test(raw)) {
    return withRawError('服务拒绝访问，请检查账号权限、组织授权或访问范围。', raw)
  }

  if (/404|not found/i.test(raw) && getTransportType(config) !== 'stdio') {
    return withRawError('MCP 服务地址不存在，请检查 URL 是否正确。', raw)
  }

  if (/ECONNREFUSED|connection refused/i.test(raw)) {
    return withRawError('目标服务拒绝连接，请确认 MCP Server 已启动且地址端口正确。', raw)
  }

  if (/ENOTFOUND|getaddrinfo/i.test(raw)) {
    return withRawError('无法解析目标地址，请检查 URL、DNS 或代理配置。', raw)
  }

  if (/timeout|timed out|aborted/i.test(raw)) {
    return withRawError('连接超时，请检查网络、代理设置或服务响应时间。', raw)
  }

  if (/fetch failed|network error/i.test(raw)) {
    return withRawError('无法访问远程 MCP 服务，请检查网络、代理或 HTTPS 证书。', raw)
  }

  if (/json/i.test(raw) && /parse/i.test(raw)) {
    return withRawError('服务返回内容无法解析，可能不是合法的 MCP 响应。', raw)
  }

  return raw
}

function summarizeNonConnectedClient(
  client: Exclude<MCPServerConnection, ConnectedMCPServer>,
): string {
  switch (client.type) {
    case 'failed':
      return humanizeRuntimeError(client.error, client.config)
    case 'needs-auth':
      return '该 MCP Server 需要先完成认证后才能连接。'
    case 'pending':
      return 'MCP Server 正在连接中，请稍后刷新状态。'
    case 'disabled':
      return '该 MCP Server 当前处于禁用状态。'
    default:
      return '连接未成功建立。'
  }
}

async function describeConnectedClient(
  client: ConnectedMCPServer,
): Promise<McpServerDescription> {
  const [toolsResult, resourcesResult, promptsResult] = await Promise.all([
    client.capabilities?.tools
      ? (client.client.request(
          { method: 'tools/list' },
          ListToolsResultSchema,
        ) as Promise<ListToolsResult>)
      : Promise.resolve({ tools: [] } as ListToolsResult),
    client.capabilities?.resources
      ? (client.client.request(
          { method: 'resources/list' },
          ListResourcesResultSchema,
        ) as Promise<ListResourcesResult>)
      : Promise.resolve({ resources: [] } as ListResourcesResult),
    client.capabilities?.prompts
      ? (client.client.request(
          { method: 'prompts/list' },
          ListPromptsResultSchema,
        ) as Promise<ListPromptsResult>)
      : Promise.resolve({ prompts: [] } as ListPromptsResult),
  ])

  return {
    tools: (toolsResult.tools || []).map(tool => ({
      name: tool.name,
      description: tool.description,
      title:
        typeof tool.annotations?.title === 'string'
          ? tool.annotations.title
          : undefined,
    })),
    resources: (resourcesResult.resources || []).map(resource => ({
      name:
        typeof (resource as any).name === 'string'
          ? (resource as any).name
          : String(resource.uri),
      description: resource.description,
      uri: String(resource.uri),
      title:
        typeof (resource as any).title === 'string'
          ? (resource as any).title
          : undefined,
    })),
    prompts: (promptsResult.prompts || []).map(prompt => ({
      name: prompt.name,
      description: prompt.description,
      title:
        typeof (prompt as any).title === 'string'
          ? (prompt as any).title
          : undefined,
      arguments: Array.isArray(prompt.arguments)
        ? prompt.arguments.map(arg => arg.name)
        : [],
    })),
    instructions: client.instructions,
    serverInfo: client.serverInfo,
  }
}

function toPublicStatus(
  record: SessionRecord,
  configSource: 'saved' | 'runtime' = 'runtime',
): McpRuntimeStatus {
  return {
    name: record.name,
    status: record.status,
    transportType: getTransportType(record.config),
    errorMessage: record.errorMessage,
    toolsCount: record.description?.tools.length,
    resourcesCount: record.description?.resources.length,
    promptsCount: record.description?.prompts.length,
    lastConnectionAttemptAt: record.lastConnectionAttemptAt,
    lastConnectedAt: record.lastConnectedAt,
    lastErrorAt: record.lastErrorAt,
    configSource,
    reconnectAttempt: record.reconnectAttempt,
    maxReconnectAttempts: record.maxReconnectAttempts,
    nextRetryAt: record.nextRetryAt,
    lastDisconnectReason: record.lastDisconnectReason,
    authState: record.authState,
    authHint: record.authHint,
    autoReconnectEnabled: record.autoReconnectEnabled,
  }
}

async function safeCleanup(record?: SessionRecord): Promise<void> {
  if (!record?.client) return

  try {
    await record.client.cleanup()
  } catch {
    // best effort cleanup
  }
}

function scheduleReconnect(name: string, config: ScopedMcpServerConfig, nextAttempt: number) {
  clearReconnectTimer(name)
  const delay = RECONNECT_DELAYS_MS[Math.max(0, Math.min(nextAttempt - 1, RECONNECT_DELAYS_MS.length - 1))]
  const timer = setTimeout(() => {
    reconnectTimers.delete(name)
    void runSerialized(name, () => connectFlow(name, config, nextAttempt, false))
  }, delay)
  reconnectTimers.set(name, timer)
  return new Date(Date.now() + delay).toISOString()
}

async function connectFlow(
  name: string,
  rawConfig: unknown,
  attempt = 0,
  manual = true,
): Promise<McpRuntimeStatus> {
  const validation = validateMcpServerConfig(rawConfig)
  const current = sessions.get(name)

  if (!validation.ok || !validation.normalized) {
    const errorRecord: SessionRecord = {
      name,
      config: current?.config || createFallbackScopedConfig(),
      status: 'error',
      errorMessage: validation.error || '配置校验失败',
      lastConnectionAttemptAt: nowIso(),
      lastErrorAt: nowIso(),
      logs: appendLog(current, 'error', 'manager', validation.error || '配置校验失败'),
      authState: 'unknown',
      authHint: '请先修正配置，再重新尝试连接。',
      autoReconnectEnabled: false,
    }
    sessions.set(name, errorRecord)
    return toPublicStatus(errorRecord)
  }

  const config = toScopedConfig(validation.normalized)
  clearReconnectTimer(name)
  if (manual && current?.client) {
    await safeCleanup(current)
  }

  const attemptLabel = attempt > 0
    ? `自动重连第 ${attempt}/${MAX_AUTO_RECONNECT_ATTEMPTS} 次尝试`
    : '开始建立 MCP 连接'

  const connectingRecord: SessionRecord = {
    name,
    config,
    status: 'connecting',
    errorMessage: undefined,
    description: current?.description,
    lastConnectionAttemptAt: nowIso(),
    lastConnectedAt: current?.lastConnectedAt,
    lastErrorAt: current?.lastErrorAt,
    logs: appendLog(current, 'info', attempt > 0 ? 'reconnect' : 'manager', attemptLabel),
    reconnectAttempt: attempt > 0 ? attempt : undefined,
    maxReconnectAttempts: shouldAutoReconnect(config) ? MAX_AUTO_RECONNECT_ATTEMPTS : undefined,
    nextRetryAt: undefined,
    lastDisconnectReason: current?.lastDisconnectReason,
    authState: undefined,
    authHint: undefined,
    autoReconnectEnabled: shouldAutoReconnect(config),
  }
  sessions.set(name, connectingRecord)

  const result = await reconnectMcpServerImpl(name, config)
  if (!isConnectedClient(result.client)) {
    const failureMessage = summarizeNonConnectedClient(result.client)
    const authInfo = inferAuthState(config, failureMessage, result.client.type)
    const eligibleReconnect =
      shouldAutoReconnect(config)
      && !['needs-oauth', 'needs-token', 'token-expired'].includes(authInfo.authState || '')
      && attempt < MAX_AUTO_RECONNECT_ATTEMPTS

    let failureRecord: SessionRecord = {
      ...connectingRecord,
      status: eligibleReconnect ? 'connecting' : 'error',
      client: undefined,
      description: undefined,
      errorMessage: failureMessage,
      lastErrorAt: nowIso(),
      logs: appendLog(connectingRecord, 'error', 'manager', failureMessage),
      lastDisconnectReason: failureMessage,
      authState: authInfo.authState,
      authHint: authInfo.authHint,
    }

    if (eligibleReconnect) {
      const nextAttempt = attempt + 1
      const nextRetryAt = scheduleReconnect(name, config, nextAttempt)
      failureRecord = {
        ...failureRecord,
        reconnectAttempt: nextAttempt,
        maxReconnectAttempts: MAX_AUTO_RECONNECT_ATTEMPTS,
        nextRetryAt,
        logs: appendLog(
          failureRecord,
          'warn',
          'reconnect',
          `将在 ${Math.round((new Date(nextRetryAt).getTime() - Date.now()) / 1000)} 秒后自动重试（${nextAttempt}/${MAX_AUTO_RECONNECT_ATTEMPTS}）`,
        ),
      }
    }

    sessions.set(name, failureRecord)
    return toPublicStatus(failureRecord)
  }

  try {
    const description = await describeConnectedClient(result.client)
    const connectedRecord: SessionRecord = {
      ...connectingRecord,
      status: 'connected',
      client: result.client,
      description,
      errorMessage: undefined,
      lastConnectedAt: nowIso(),
      logs: appendLog(connectingRecord, 'info', 'manager', 'MCP Server 已成功连接并读取能力清单'),
      reconnectAttempt: undefined,
      nextRetryAt: undefined,
      authState: 'ok',
      authHint: undefined,
      lastDisconnectReason: undefined,
    }
    sessions.set(name, connectedRecord)
    return toPublicStatus(connectedRecord)
  } catch (error: any) {
    const failureMessage = withRawError(
      'MCP Server 已连上，但读取 tools/resources/prompts 失败。',
      error?.message,
    )
    const errorRecord: SessionRecord = {
      ...connectingRecord,
      status: 'error',
      client: undefined,
      description: undefined,
      errorMessage: failureMessage,
      lastErrorAt: nowIso(),
      logs: appendLog(connectingRecord, 'error', 'manager', failureMessage),
      lastDisconnectReason: failureMessage,
      authState: 'unknown',
      authHint: '连接已建立，但能力描述阶段失败。请查看诊断日志并手动重试。',
    }
    try {
      await result.client.cleanup()
    } catch {
      // ignore cleanup failure
    }
    sessions.set(name, errorRecord)
    return toPublicStatus(errorRecord)
  }
}

export const mcpSessionManager = {
  async connect(name: string, rawConfig: unknown): Promise<McpRuntimeStatus> {
    return runSerialized(name, () => connectFlow(name, rawConfig, 0, true))
  },

  async retry(name: string, rawConfig: unknown): Promise<McpRuntimeStatus> {
    return runSerialized(name, () => connectFlow(name, rawConfig, 0, false))
  },

  async clearAuth(name: string): Promise<McpRuntimeStatus> {
    return runSerialized(name, async () => {
      clearReconnectTimer(name)
      const current = sessions.get(name)
      const next: SessionRecord = {
        ...(current || {
          name,
          config: createFallbackScopedConfig(),
          status: 'disconnected' as McpRuntimeState,
          logs: [],
        }),
        client: undefined,
        description: undefined,
        status: 'disconnected',
        errorMessage: undefined,
        reconnectAttempt: undefined,
        nextRetryAt: undefined,
        authState: undefined,
        authHint: undefined,
        logs: appendLog(
          current,
          'info',
          'auth',
          '已清理认证状态，请更新凭据后重新连接。',
        ),
      }

      if (current?.client) {
        await safeCleanup(current)
      }

      sessions.set(name, next)
      return toPublicStatus(next)
    })
  },

  async disconnect(name: string): Promise<McpRuntimeStatus> {
    return runSerialized(name, async () => {
      clearReconnectTimer(name)
      const current = sessions.get(name)
      if (current) {
        await safeCleanup(current)
        const disconnectedRecord: SessionRecord = {
          ...current,
          client: undefined,
          description: undefined,
          status: 'disconnected',
          errorMessage: undefined,
          nextRetryAt: undefined,
          reconnectAttempt: undefined,
          logs: appendLog(current, 'info', 'manager', 'MCP Server 已断开连接'),
        }
        sessions.set(name, disconnectedRecord)
        return toPublicStatus(disconnectedRecord)
      }

      const disconnectedRecord: SessionRecord = {
        name,
        config: createFallbackScopedConfig(),
        status: 'disconnected',
        logs: [createLogEntry('info', 'manager', 'MCP Server 处于未连接状态')],
      }
      sessions.set(name, disconnectedRecord)
      return toPublicStatus(disconnectedRecord)
    })
  },

  async disconnectMany(names: string[]): Promise<void> {
    for (const name of names) {
      await this.disconnect(name)
    }
  },

  async describe(name: string): Promise<McpServerDescription | null> {
    const current = sessions.get(name)
    if (!current?.client) return null

    if (current.description) {
      return current.description
    }

    const description = await describeConnectedClient(current.client)
    const updated: SessionRecord = {
      ...current,
      description,
      logs: appendLog(current, 'info', 'manager', '已重新读取 MCP 能力清单'),
    }
    sessions.set(name, updated)
    return description
  },

  getLogs(name: string): McpLogEntry[] {
    return sessions.get(name)?.logs || []
  },

  getStatuses(
    savedConfigs: Record<string, McpServerConfig> = {},
  ): Record<string, McpRuntimeStatus> {
    const names = new Set<string>([
      ...Object.keys(savedConfigs),
      ...Array.from(sessions.keys()),
    ])

    const statuses: Record<string, McpRuntimeStatus> = {}
    for (const name of names) {
      const savedConfig = savedConfigs[name]
      const current = sessions.get(name)

      if (current) {
        statuses[name] = toPublicStatus(
          current,
          savedConfig ? 'saved' : 'runtime',
        )
        continue
      }

      statuses[name] = {
        name,
        status: 'disconnected',
        transportType: getTransportType(savedConfig),
        configSource: savedConfig ? 'saved' : 'runtime',
        autoReconnectEnabled: savedConfig ? shouldAutoReconnect(savedConfig) : false,
      }
    }

    return statuses
  },
}

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Database,
  Download,
  FileCode2,
  FolderOpen,
  GitBranch,
  Loader2,
  PlugZap,
  RefreshCcw,
  Save,
  ScrollText,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Star,
  StarOff,
  TerminalSquare,
  Trash2,
  Upload,
  Webhook,
} from 'lucide-react'
import {
  apiClient,
  type McpLogEntry,
  type McpRuntimeStatus,
  type McpServerConfig,
  type McpServerDescription,
  type McpStdioServerConfig,
} from '../api/client'

type KeyValuePair = { key: string; value: string }
type PresetField = {
  key: string
  label: string
  placeholder: string
  required?: boolean
  secret?: boolean
  help?: string
}
type PresetDefinition = {
  id: string
  name: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  description: string
  helperText: string
  fields: PresetField[]
  buildConfig: (values: Record<string, string>) => McpServerConfig
}
type StatusFilter = 'all' | 'connected' | 'connecting' | 'error' | 'disconnected'
type TransportFilter = 'all' | 'stdio' | 'http' | 'sse' | 'ws'
type SectionKey = 'attention' | 'reconnecting' | 'connected' | 'idle'
type BatchAction = 'connect' | 'disconnect' | 'retry' | null

type ServerEntry = {
  name: string
  config: McpServerConfig
  status?: McpRuntimeStatus
  detail?: McpServerDescription
  logs: McpLogEntry[]
  busy: string
  isFavorite: boolean
  section: SectionKey
  lastConnectedAt: string | null
  lastErrorAt: string | null
  nextRetryText: string | null
  connectLabel: string
}

const CUSTOM_PRESET_ID = 'custom'
const STATUS_POLL_INTERVAL_MS = 3000
const FAVORITES_STORAGE_KEY = 'mcp-panel-favorites'

const MCP_PRESETS: PresetDefinition[] = [
  {
    id: 'github',
    name: 'GitHub',
    icon: GitBranch,
    description: '查看仓库、Issue、Pull Request 等开发协作信息。',
    helperText: '只需要填一个 GitHub Personal Access Token，其余命令会自动生成。',
    fields: [
      {
        key: 'token',
        label: 'GitHub Token',
        placeholder: 'ghp_xxx 或 github_pat_xxx',
        required: true,
        secret: true,
        help: '需要具备访问目标仓库的权限。',
      },
    ],
    buildConfig: values => ({
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: values.token || '',
      },
    }),
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    icon: Database,
    description: '读取本地 SQLite 数据库，适合快速查表与调试。',
    helperText: '只需选择你的数据库文件路径。',
    fields: [
      {
        key: 'dbPath',
        label: '数据库文件路径',
        placeholder: '/Users/you/project/data.db',
        required: true,
      },
    ],
    buildConfig: values => ({
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sqlite', '--db', values.dbPath || ''],
      env: {},
    }),
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    icon: Database,
    description: '连接 PostgreSQL，适合在线查询业务库或测试库。',
    helperText: '填写标准 PostgreSQL 连接串即可。',
    fields: [
      {
        key: 'connectionString',
        label: '数据库连接串',
        placeholder: 'postgresql://user:password@host:5432/database',
        required: true,
      },
    ],
    buildConfig: values => ({
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres', values.connectionString || ''],
      env: {},
    }),
  },
  {
    id: 'fetch',
    name: 'Fetch',
    icon: Webhook,
    description: '抓取网页内容，适合让模型读取页面文本或接口返回。',
    helperText: '这个模板一般无需额外参数，保存后即可连接。',
    fields: [],
    buildConfig: () => ({
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-fetch'],
      env: {},
    }),
  },
  {
    id: 'filesystem',
    name: 'Filesystem',
    icon: FolderOpen,
    description: '开放指定目录给 MCP Server，让模型可浏览你的文件夹。',
    helperText: '建议只授权一个明确目录，而不是整块磁盘。',
    fields: [
      {
        key: 'rootPath',
        label: '允许访问的目录',
        placeholder: '/Users/you/Desktop/project',
        required: true,
      },
    ],
    buildConfig: values => ({
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', values.rootPath || ''],
      env: {},
    }),
  },
]

function isStdioConfig(config: McpServerConfig): config is McpStdioServerConfig {
  return (config.type ?? 'stdio') === 'stdio' && 'command' in config
}

function pairsToObject(pairs: KeyValuePair[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const pair of pairs) {
    const key = pair.key.trim()
    if (!key) continue
    result[key] = pair.value
  }
  return result
}

function formatConfigSummary(config: McpServerConfig): string {
  if (isStdioConfig(config)) {
    return `${config.command} ${(config.args || []).join(' ')}`.trim()
  }
  return `${String(config.type).toUpperCase()} ${config.url}`
}

function formatStatusLabel(status?: McpRuntimeStatus['status']): string {
  switch (status) {
    case 'connected':
      return '已连接'
    case 'connecting':
      return '连接中'
    case 'error':
      return '连接失败'
    default:
      return '未连接'
  }
}

function formatTime(value?: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('zh-CN')
}

function getStatusDotClass(status?: McpRuntimeStatus['status']): string {
  switch (status) {
    case 'connected':
      return 'bg-emerald-500'
    case 'connecting':
      return 'bg-amber-500'
    case 'error':
      return 'bg-red-500'
    default:
      return 'bg-zinc-300 dark:bg-zinc-600'
  }
}

function getPresetById(id: string | null): PresetDefinition | undefined {
  return MCP_PRESETS.find(preset => preset.id === id)
}

function ensureTrailingBlankPair(pairs: KeyValuePair[]): KeyValuePair[] {
  if (pairs.length === 0) return [{ key: '', value: '' }]
  const last = pairs[pairs.length - 1]
  if (last.key || last.value) return [...pairs, { key: '', value: '' }]
  return pairs
}

function getReconnectCountdown(nextRetryAt?: string): string | null {
  if (!nextRetryAt) return null
  const diffMs = new Date(nextRetryAt).getTime() - Date.now()
  if (Number.isNaN(diffMs)) return null
  if (diffMs <= 0) return '即将开始重连'
  return `${Math.ceil(diffMs / 1000)} 秒后自动重试`
}

function getConnectButtonLabel(status?: McpRuntimeStatus): string {
  if (status?.status === 'connecting') return 'Connecting...'
  if (status?.authState === 'needs-oauth') return '授权后重试'
  if (status?.authState === 'needs-token') return '更新凭据后重试'
  if (status?.nextRetryAt) return '立即重试'
  return 'Connect'
}

function getLogLevelClass(level: McpLogEntry['level']): string {
  switch (level) {
    case 'error':
      return 'text-red-600 dark:text-red-400'
    case 'warn':
      return 'text-amber-600 dark:text-amber-400'
    default:
      return 'text-zinc-500 dark:text-zinc-400'
  }
}

function getTimeValue(value?: string | null): number {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function getSectionKey(status?: McpRuntimeStatus): SectionKey {
  if (status?.authState && status.authState !== 'ok') return 'attention'
  if (status?.status === 'error') return 'attention'
  if (status?.status === 'connecting' || !!status?.nextRetryAt) return 'reconnecting'
  if (status?.status === 'connected') return 'connected'
  return 'idle'
}

function matchesStatusFilter(status: McpRuntimeStatus | undefined, filter: StatusFilter): boolean {
  if (filter === 'all') return true
  return (status?.status || 'disconnected') === filter
}

function matchesTransportFilter(config: McpServerConfig, filter: TransportFilter): boolean {
  if (filter === 'all') return true
  return (config.type ?? 'stdio') === filter
}

function sectionTitle(section: SectionKey): string {
  switch (section) {
    case 'attention':
      return '需要处理'
    case 'reconnecting':
      return '正在连接 / 重连中'
    case 'connected':
      return '运行正常'
    default:
      return '未连接'
  }
}

export default function McpPanel({ onClose }: { onClose: () => void }) {
  const [servers, setServers] = useState<Record<string, McpServerConfig>>({})
  const [statuses, setStatuses] = useState<Record<string, McpRuntimeStatus>>({})
  const [descriptions, setDescriptions] = useState<Record<string, McpServerDescription>>({})
  const [logsByServer, setLogsByServer] = useState<Record<string, McpLogEntry[]>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [configPath, setConfigPath] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyServer, setBusyServer] = useState<Record<string, string>>({})
  const [favorites, setFavorites] = useState<Record<string, boolean>>({})
  const logStreamsRef = useRef<Record<string, EventSource>>({})

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [transportFilter, setTransportFilter] = useState<TransportFilter>('all')
  const [authOnly, setAuthOnly] = useState(false)
  const [batchBusy, setBatchBusy] = useState<BatchAction>(null)

  const [isEditing, setIsEditing] = useState(false)
  const [editingName, setEditingName] = useState('')
  const [selectedPresetId, setSelectedPresetId] = useState<string>(CUSTOM_PRESET_ID)
  const [presetValues, setPresetValues] = useState<Record<string, string>>({})
  const [advancedTransport, setAdvancedTransport] = useState<'stdio' | 'http' | 'sse' | 'ws'>('stdio')
  const [advancedCommand, setAdvancedCommand] = useState('')
  const [advancedArgsText, setAdvancedArgsText] = useState('')
  const [advancedUrl, setAdvancedUrl] = useState('')
  const [advancedEnvPairs, setAdvancedEnvPairs] = useState<KeyValuePair[]>([{ key: '', value: '' }])
  const [advancedHeaderPairs, setAdvancedHeaderPairs] = useState<KeyValuePair[]>([{ key: '', value: '' }])
  const [validateStatus, setValidateStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [validating, setValidating] = useState(false)

  const [jsonDraft, setJsonDraft] = useState('')
  const [jsonNotice, setJsonNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [jsonBusy, setJsonBusy] = useState<'import' | 'export' | null>(null)

  const selectedPreset = useMemo(
    () => getPresetById(selectedPresetId),
    [selectedPresetId],
  )

  const expandedNames = useMemo(
    () => Object.entries(expanded).filter(([, value]) => value).map(([name]) => name),
    [expanded],
  )

  const currentDraftConfig = useMemo<McpServerConfig>(() => {
    if (selectedPreset && selectedPreset.id !== CUSTOM_PRESET_ID) {
      return selectedPreset.buildConfig(presetValues)
    }

    if (advancedTransport === 'stdio') {
      return {
        type: 'stdio',
        command: advancedCommand,
        args: advancedArgsText.split('\n').map(item => item.trim()).filter(Boolean),
        env: pairsToObject(advancedEnvPairs),
      }
    }

    return {
      type: advancedTransport,
      url: advancedUrl,
      headers: pairsToObject(advancedHeaderPairs),
    }
  }, [
    selectedPreset,
    presetValues,
    advancedTransport,
    advancedCommand,
    advancedArgsText,
    advancedEnvPairs,
    advancedUrl,
    advancedHeaderPairs,
  ])

  const allEntries = useMemo<ServerEntry[]>(() => {
    return Object.entries(servers).map(([name, config]) => {
      const status = statuses[name]
      return {
        name,
        config,
        status,
        detail: descriptions[name],
        logs: logsByServer[name] || [],
        busy: busyServer[name] || '',
        isFavorite: !!favorites[name],
        section: getSectionKey(status),
        lastConnectedAt: formatTime(status?.lastConnectedAt),
        lastErrorAt: formatTime(status?.lastErrorAt),
        nextRetryText: getReconnectCountdown(status?.nextRetryAt),
        connectLabel: getConnectButtonLabel(status),
      }
    })
  }, [servers, statuses, descriptions, logsByServer, busyServer, favorites])

  const dashboard = useMemo(() => {
    return allEntries.reduce(
      (acc, entry) => {
        const status = entry.status?.status || 'disconnected'
        if (status === 'connected') acc.connected += 1
        if (status === 'error') acc.failed += 1
        if (status === 'connecting' || entry.status?.nextRetryAt) acc.reconnecting += 1
        if (entry.status?.authState && entry.status.authState !== 'ok') acc.needsAuth += 1
        acc.tools += entry.status?.toolsCount || 0
        return acc
      },
      { connected: 0, failed: 0, reconnecting: 0, needsAuth: 0, tools: 0 },
    )
  }, [allEntries])

  const visibleEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return allEntries
      .filter(entry => {
        if (query) {
          const haystack = `${entry.name} ${formatConfigSummary(entry.config)}`.toLowerCase()
          if (!haystack.includes(query)) return false
        }
        if (!matchesStatusFilter(entry.status, statusFilter)) return false
        if (!matchesTransportFilter(entry.config, transportFilter)) return false
        if (authOnly && (!entry.status?.authState || entry.status.authState === 'ok')) return false
        return true
      })
      .sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
        const sectionOrder: Record<SectionKey, number> = {
          attention: 0,
          reconnecting: 1,
          connected: 2,
          idle: 3,
        }
        if (sectionOrder[a.section] !== sectionOrder[b.section]) {
          return sectionOrder[a.section] - sectionOrder[b.section]
        }

        if (a.section === 'attention') {
          return getTimeValue(b.status?.lastErrorAt) - getTimeValue(a.status?.lastErrorAt) || a.name.localeCompare(b.name)
        }
        if (a.section === 'reconnecting') {
          return getTimeValue(a.status?.nextRetryAt) - getTimeValue(b.status?.nextRetryAt) || a.name.localeCompare(b.name)
        }
        if (a.section === 'connected') {
          return getTimeValue(b.status?.lastConnectedAt) - getTimeValue(a.status?.lastConnectedAt) || a.name.localeCompare(b.name)
        }
        return a.name.localeCompare(b.name)
      })
  }, [allEntries, authOnly, searchQuery, statusFilter, transportFilter])

  const groupedEntries = useMemo(() => {
    return visibleEntries.reduce<Record<SectionKey, ServerEntry[]>>(
      (acc, entry) => {
        acc[entry.section].push(entry)
        return acc
      },
      {
        attention: [],
        reconnecting: [],
        connected: [],
        idle: [],
      },
    )
  }, [visibleEntries])

  const selectedPresetSectionTitle = sectionTitle

  const visibleFailedEntries = useMemo(
    () => visibleEntries.filter(entry => entry.status?.status === 'error' || !!entry.status?.nextRetryAt),
    [visibleEntries],
  )

  const visibleConnectedEntries = useMemo(
    () => visibleEntries.filter(entry => entry.status?.status === 'connected'),
    [visibleEntries],
  )

  const visibleDisconnectedEntries = useMemo(
    () => visibleEntries.filter(entry => entry.status?.status !== 'connected'),
    [visibleEntries],
  )

  const refreshStatuses = async () => {
    const data = await apiClient.mcp.getStatus()
    setStatuses(data.statuses || {})
  }

  const refreshLogs = async (names: string[]) => {
    if (names.length === 0) return

    await Promise.all(
      names.map(async name => {
        try {
          const data = await apiClient.mcp.getLogs(name)
          setLogsByServer(prev => ({ ...prev, [name]: data.logs || [] }))
        } catch {
          // ignore log polling failure
        }
      }),
    )
  }

  const stopLogStream = (name: string) => {
    const stream = logStreamsRef.current[name]
    if (stream) {
      stream.close()
      delete logStreamsRef.current[name]
    }
  }

  const startLogStream = (name: string) => {
    if (logStreamsRef.current[name]) return

    const stream = new EventSource(apiClient.mcp.getLogStreamUrl(name))
    stream.onmessage = event => {
      try {
        const log = JSON.parse(event.data) as McpLogEntry
        setLogsByServer(prev => {
          const existing = prev[name] || []
          if (existing.some(entry => entry.id === log.id)) return prev
          return {
            ...prev,
            [name]: [...existing, log].slice(-300),
          }
        })
      } catch {
        // ignore malformed log events
      }
    }
    stream.onerror = () => {
      stopLogStream(name)
    }
    logStreamsRef.current[name] = stream
  }

  const loadInitialData = async () => {
    setLoading(true)
    try {
      const [configData, statusData] = await Promise.all([
        apiClient.mcp.getConfig(),
        apiClient.mcp.getStatus(),
      ])
      setServers(configData.mcpServers || {})
      setConfigPath(configData.configPath || '')
      setStatuses(statusData.statuses || {})
      setJsonDraft(JSON.stringify({ mcpServers: configData.mcpServers || {} }, null, 2))
      try {
        const raw = localStorage.getItem(FAVORITES_STORAGE_KEY)
        if (raw) {
          setFavorites(JSON.parse(raw))
        }
      } catch {
        // ignore local favorites restore failure
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadInitialData()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      void refreshStatuses()
      void refreshLogs(expandedNames)
    }, STATUS_POLL_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [expandedNames])

  useEffect(() => {
    return () => {
      Object.keys(logStreamsRef.current).forEach(stopLogStream)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites))
    } catch {
      // ignore localStorage write failure
    }
  }, [favorites])

  const openPresetEditor = (presetId: string) => {
    setIsEditing(true)
    setValidateStatus(null)
    setSelectedPresetId(presetId)
    const preset = getPresetById(presetId)
    if (preset) {
      const nextValues = Object.fromEntries(preset.fields.map(field => [field.key, '']))
      setPresetValues(nextValues)
      setEditingName(preset.id)
      return
    }

    setEditingName('')
    setAdvancedTransport('stdio')
    setAdvancedCommand('')
    setAdvancedArgsText('')
    setAdvancedUrl('')
    setAdvancedEnvPairs([{ key: '', value: '' }])
    setAdvancedHeaderPairs([{ key: '', value: '' }])
  }

  const toggleFavorite = (name: string) => {
    setFavorites(prev => ({
      ...prev,
      [name]: !prev[name],
    }))
  }

  const updatePair = (
    pairs: KeyValuePair[],
    setPairs: React.Dispatch<React.SetStateAction<KeyValuePair[]>>,
    index: number,
    key: 'key' | 'value',
    value: string,
  ) => {
    const next = pairs.map((pair, pairIndex) =>
      pairIndex === index ? { ...pair, [key]: value } : pair,
    )
    setPairs(ensureTrailingBlankPair(next))
  }

  const removePair = (
    pairs: KeyValuePair[],
    setPairs: React.Dispatch<React.SetStateAction<KeyValuePair[]>>,
    index: number,
  ) => {
    const next = pairs.filter((_, pairIndex) => pairIndex !== index)
    setPairs(ensureTrailingBlankPair(next))
  }

  const loadDetailAndLogs = async (name: string, status?: McpRuntimeStatus) => {
    const tasks: Promise<unknown>[] = [refreshLogs([name])]

    if (status?.status === 'connected' && !descriptions[name]) {
      tasks.push(
        apiClient.mcp.getDescribe(name).then(detail => {
          setDescriptions(prev => ({ ...prev, [name]: detail.description }))
        }).catch(() => undefined),
      )
    }

    await Promise.all(tasks)
  }

  const handleSave = async () => {
    if (!editingName.trim()) {
      setValidateStatus({ type: 'error', text: '请先填写一个易识别的 Server 名称。' })
      return
    }

    setValidating(true)
    setValidateStatus(null)
    try {
      await apiClient.mcp.validate(currentDraftConfig)
      const updated = {
        ...servers,
        [editingName.trim()]: currentDraftConfig,
      }
      const saved = await apiClient.mcp.saveConfig(updated)
      setServers(saved.mcpServers || updated)
      if (saved.configPath) setConfigPath(saved.configPath)
      setJsonDraft(JSON.stringify({ mcpServers: saved.mcpServers || updated }, null, 2))
      setValidateStatus({ type: 'success', text: '配置已保存，现在可以点击 Connect 真正建立连接。' })
      await refreshStatuses()
      setTimeout(() => {
        setIsEditing(false)
        setValidateStatus(null)
      }, 1200)
    } catch (error: any) {
      setValidateStatus({ type: 'error', text: error.message || '保存失败' })
    } finally {
      setValidating(false)
    }
  }

  const handleConnect = async (name: string, config: McpServerConfig) => {
    setBusyServer(prev => ({ ...prev, [name]: 'connect' }))
    setStatuses(prev => ({
      ...prev,
      [name]: {
        ...(prev[name] || { name }),
        name,
        status: 'connecting',
      },
    }))
    try {
      const result = await apiClient.mcp.connect(name, config)
      setStatuses(prev => ({ ...prev, [name]: result.status }))
      await loadDetailAndLogs(name, result.status)
      if (expanded[name]) {
        startLogStream(name)
      }
      await refreshStatuses()
    } catch (error: any) {
      setStatuses(prev => ({
        ...prev,
        [name]: {
          ...(prev[name] || { name }),
          name,
          status: 'error',
          errorMessage: error.message || '连接失败',
        },
      }))
      await refreshLogs([name])
    } finally {
      setBusyServer(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleRetry = async (name: string, config: McpServerConfig) => {
    setBusyServer(prev => ({ ...prev, [name]: 'retry' }))
    try {
      const result = await apiClient.mcp.retry(name, config)
      setStatuses(prev => ({ ...prev, [name]: result.status }))
      await loadDetailAndLogs(name, result.status)
      if (expanded[name]) {
        startLogStream(name)
      }
    } catch (error: any) {
      setStatuses(prev => ({
        ...prev,
        [name]: {
          ...(prev[name] || { name }),
          name,
          status: 'error',
          errorMessage: error.message || '重试失败',
        },
      }))
      await refreshLogs([name])
    } finally {
      setBusyServer(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleClearAuth = async (name: string) => {
    setBusyServer(prev => ({ ...prev, [name]: 'clear-auth' }))
    try {
      const result = await apiClient.mcp.clearAuth(name)
      setStatuses(prev => ({ ...prev, [name]: result.status }))
      await refreshLogs([name])
    } catch (error: any) {
      setStatuses(prev => ({
        ...prev,
        [name]: {
          ...(prev[name] || { name }),
          name,
          status: 'error',
          errorMessage: error.message || '清理认证失败',
        },
      }))
    } finally {
      setBusyServer(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleDisconnect = async (name: string) => {
    setBusyServer(prev => ({ ...prev, [name]: 'disconnect' }))
    try {
      stopLogStream(name)
      const result = await apiClient.mcp.disconnect(name)
      setStatuses(prev => ({ ...prev, [name]: result.status }))
      setDescriptions(prev => {
        const next = { ...prev }
        delete next[name]
        return next
      })
      await refreshLogs([name])
    } catch (error: any) {
      setStatuses(prev => ({
        ...prev,
        [name]: {
          ...(prev[name] || { name }),
          name,
          status: 'error',
          errorMessage: error.message || '断开失败',
        },
      }))
    } finally {
      setBusyServer(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleDelete = async (name: string) => {
    if (!confirm(`确定删除 MCP Server「${name}」吗？`)) return
    setBusyServer(prev => ({ ...prev, [name]: 'delete' }))
    try {
      const updated = { ...servers }
      delete updated[name]
      const saved = await apiClient.mcp.saveConfig(updated)
      setServers(saved.mcpServers || updated)
      setJsonDraft(JSON.stringify({ mcpServers: saved.mcpServers || updated }, null, 2))
      setStatuses(prev => {
        const next = { ...prev }
        delete next[name]
        return next
      })
      setDescriptions(prev => {
        const next = { ...prev }
        delete next[name]
        return next
      })
      stopLogStream(name)
      setLogsByServer(prev => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    } catch (error: any) {
      alert(error.message || '删除失败')
    } finally {
      setBusyServer(prev => ({ ...prev, [name]: '' }))
    }
  }

  const runBatchAction = async (entries: ServerEntry[], action: Exclude<BatchAction, null>) => {
    if (entries.length === 0) return
    setBatchBusy(action)
    try {
      for (const entry of entries) {
        if (action === 'connect') {
          await handleConnect(entry.name, entry.config)
        } else if (action === 'disconnect') {
          await handleDisconnect(entry.name)
        } else {
          await handleRetry(entry.name, entry.config)
        }
      }
    } finally {
      setBatchBusy(null)
    }
  }

  const handleToggleExpand = async (name: string) => {
    const nextExpanded = !expanded[name]
    setExpanded(prev => ({ ...prev, [name]: nextExpanded }))
    if (!nextExpanded) {
      stopLogStream(name)
      return
    }

    setBusyServer(prev => ({ ...prev, [name]: 'inspect' }))
    try {
      await loadDetailAndLogs(name, statuses[name])
      startLogStream(name)
    } finally {
      setBusyServer(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleExport = async () => {
    setJsonBusy('export')
    setJsonNotice(null)
    try {
      const data = await apiClient.mcp.exportConfig()
      setConfigPath(data.configPath || configPath)
      setJsonDraft(JSON.stringify({ mcpServers: data.mcpServers || {} }, null, 2))
      setJsonNotice({ type: 'success', text: '已生成兼容 Cline 的导出 JSON，可直接复制保存。' })
    } catch (error: any) {
      setJsonNotice({ type: 'error', text: error.message || '导出失败' })
    } finally {
      setJsonBusy(null)
    }
  }

  const handleImport = async () => {
    setJsonBusy('import')
    setJsonNotice(null)
    try {
      const data = await apiClient.mcp.importConfig(jsonDraft)
      setServers(data.mcpServers || {})
      setConfigPath(data.configPath || configPath)
      setDescriptions({})
      setLogsByServer({})
      await refreshStatuses()
      setJsonNotice({ type: 'success', text: '导入成功，配置已写回现有 MCP 配置文件。' })
    } catch (error: any) {
      setJsonNotice({ type: 'error', text: error.message || '导入失败，请检查 JSON。' })
    } finally {
      setJsonBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
        <Loader2 size={18} className="mr-2 animate-spin" /> 正在读取 MCP 配置...
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-[#f3f4f6] font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-200">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <PlugZap className="text-blue-500" />
          <div>
            <h2 className="text-xl font-semibold">MCP 管理中心</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">连接、诊断、导入导出与能力浏览都集中在这里。</p>
          </div>
        </div>
        <button onClick={onClose} className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
          返回工作区
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">已连接</div>
              <div className="mt-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{dashboard.connected}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">需要处理</div>
              <div className="mt-2 text-2xl font-semibold text-red-600 dark:text-red-400">{dashboard.failed}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">连接中 / 重连中</div>
              <div className="mt-2 text-2xl font-semibold text-amber-600 dark:text-amber-400">{dashboard.reconnecting}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">需要认证</div>
              <div className="mt-2 text-2xl font-semibold text-blue-600 dark:text-blue-400">{dashboard.needsAuth}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">已暴露 tools 总数</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{dashboard.tools}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">当前配置文件</h3>
                <p className="mt-1 break-all text-sm text-zinc-500 dark:text-zinc-400">
                  {configPath || '尚未检测到配置路径'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => void handleExport()}
                  disabled={jsonBusy !== null}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {jsonBusy === 'export' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  导出 JSON
                </button>
                <button
                  onClick={() => void handleImport()}
                  disabled={jsonBusy !== null}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                >
                  {jsonBusy === 'import' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  导入 JSON
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <textarea
                value={jsonDraft}
                onChange={e => setJsonDraft(e.target.value)}
                rows={8}
                className="w-full rounded-xl bg-transparent px-4 py-3 font-mono text-xs text-zinc-800 outline-none dark:text-zinc-200"
                placeholder="在这里粘贴或导出兼容 cline_mcp_settings.json 的 JSON 配置"
              />
            </div>

            {jsonNotice && (
              <div className={`mt-3 rounded-xl px-3 py-2 text-sm ${jsonNotice.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                {jsonNotice.text}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="rounded-xl border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                  <div className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">搜索</div>
                  <div className="flex items-center gap-2">
                    <Search size={14} className="text-zinc-400" />
                    <input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-transparent text-sm outline-none"
                      placeholder="按名称或命令搜索"
                    />
                  </div>
                </label>

                <label className="rounded-xl border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                  <div className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">状态筛选</div>
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} className="w-full bg-transparent text-sm outline-none">
                    <option value="all">全部状态</option>
                    <option value="connected">已连接</option>
                    <option value="connecting">连接中</option>
                    <option value="error">连接失败</option>
                    <option value="disconnected">未连接</option>
                  </select>
                </label>

                <label className="rounded-xl border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                  <div className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">Transport</div>
                  <select value={transportFilter} onChange={e => setTransportFilter(e.target.value as TransportFilter)} className="w-full bg-transparent text-sm outline-none">
                    <option value="all">全部类型</option>
                    <option value="stdio">stdio</option>
                    <option value="http">http</option>
                    <option value="sse">sse</option>
                    <option value="ws">ws</option>
                  </select>
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-3 dark:border-zinc-800">
                  <input
                    type="checkbox"
                    checked={authOnly}
                    onChange={e => setAuthOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  <div>
                    <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">只看待认证项</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">聚焦 needs-auth / token 问题</div>
                  </div>
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void runBatchAction(visibleDisconnectedEntries, 'connect')}
                  disabled={visibleDisconnectedEntries.length === 0 || batchBusy !== null}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {batchBusy === 'connect' ? '批量连接中...' : '全部连接'}
                </button>
                <button
                  onClick={() => void runBatchAction(visibleConnectedEntries, 'disconnect')}
                  disabled={visibleConnectedEntries.length === 0 || batchBusy !== null}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {batchBusy === 'disconnect' ? '批量断开中...' : '全部断开'}
                </button>
                <button
                  onClick={() => void runBatchAction(visibleFailedEntries, 'retry')}
                  disabled={visibleFailedEntries.length === 0 || batchBusy !== null}
                  className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                >
                  {batchBusy === 'retry' ? '批量重试中...' : '重试失败项'}
                </button>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">MCP 应用中心</h3>
              <button
                onClick={() => openPresetEditor(CUSTOM_PRESET_ID)}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <TerminalSquare size={16} />
                自定义配置
              </button>
            </div>

            <div className="space-y-6">
              {(['attention', 'reconnecting', 'connected', 'idle'] as SectionKey[]).map(section => {
                const sectionEntries = groupedEntries[section]
                if (sectionEntries.length === 0) return null

                return (
                  <div key={section}>
                    <div className="mb-3 flex items-center gap-2">
                      <h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        {sectionTitle(section)}
                      </h4>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {sectionEntries.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {sectionEntries.map(entry => {
                        const { name, config, status, detail, logs, busy, isFavorite, lastConnectedAt, lastErrorAt, nextRetryText, connectLabel } = entry

                        return (
                          <div key={name} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="mb-2 flex flex-wrap items-center gap-3">
                                  <button
                                    onClick={() => void handleToggleExpand(name)}
                                    className="inline-flex items-center gap-2 text-left"
                                  >
                                    {expanded[name] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    <span className="relative flex h-3 w-3">
                                      {status?.status === 'connecting' && (
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                                      )}
                                      <span className={`relative inline-flex h-3 w-3 rounded-full ${getStatusDotClass(status?.status)}`}></span>
                                    </span>
                                    <span className="font-bold text-zinc-900 dark:text-zinc-100">{name}</span>
                                  </button>

                                  <button
                                    onClick={() => toggleFavorite(name)}
                                    className="rounded-lg p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-amber-500 dark:hover:bg-zinc-800"
                                    title={isFavorite ? '取消置顶' : '置顶此服务'}
                                  >
                                    {isFavorite ? <Star size={16} className="fill-amber-400 text-amber-500" /> : <StarOff size={16} />}
                                  </button>

                                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status?.status === 'connected' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : status?.status === 'connecting' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' : status?.status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                                    {formatStatusLabel(status?.status)}
                                  </span>
                                  <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                    {status?.transportType || (isStdioConfig(config) ? 'stdio' : config.type)}
                                  </span>
                                  {status?.autoReconnectEnabled && (
                                    <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                                      自动重连已开启
                                    </span>
                                  )}
                                  {status?.reconnectAttempt !== undefined && status?.maxReconnectAttempts && (
                                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                      重试 {status.reconnectAttempt}/{status.maxReconnectAttempts}
                                    </span>
                                  )}
                                </div>

                                <code className="block rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-black/40 dark:text-zinc-400">
                                  {formatConfigSummary(config)}
                                </code>

                                <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                                  <span>tools: {status?.toolsCount ?? 0}</span>
                                  <span>resources: {status?.resourcesCount ?? 0}</span>
                                  <span>prompts: {status?.promptsCount ?? 0}</span>
                                  {lastConnectedAt && <span>最近连接：{lastConnectedAt}</span>}
                                  {lastErrorAt && <span>最近报错：{lastErrorAt}</span>}
                                  {nextRetryText && <span>重连计划：{nextRetryText}</span>}
                                </div>

                                {status?.authHint && (
                                  <div className={`mt-3 rounded-xl border p-3 text-sm ${status.authState === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400' : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300'}`}>
                                    <div className="mb-1 flex items-center gap-2 font-medium">
                                      {status.authState === 'ok' ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
                                      认证提示
                                    </div>
                                    <div>{status.authHint}</div>
                                    {status.authState && status.authState !== 'ok' && (
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                          onClick={() => void handleRetry(name, config)}
                                          disabled={!!busy}
                                          className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/30"
                                        >
                                          {busy === 'retry' ? '重试中...' : '立即重试'}
                                        </button>
                                        <button
                                          onClick={() => void handleClearAuth(name)}
                                          disabled={!!busy}
                                          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                        >
                                          {busy === 'clear-auth' ? '清理中...' : '清理认证状态'}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {status?.errorMessage && (
                                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
                                    <div className="mb-1 flex items-center gap-2 font-medium">
                                      <AlertCircle size={16} /> 失败原因
                                    </div>
                                    <div>{status.errorMessage}</div>
                                  </div>
                                )}

                                {expanded[name] && (
                                  <div className="mt-4 space-y-4">
                                    {detail && (
                                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                                        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                                          <div className="mb-2 flex items-center gap-2 font-medium">
                                            <Server size={16} /> Tools ({detail.tools.length})
                                          </div>
                                          <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                                            {detail.tools.length === 0 ? <div>暂无 tools</div> : detail.tools.map(tool => (
                                              <div key={tool.name} className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
                                                <div className="font-medium">{tool.title || tool.name}</div>
                                                {tool.description && <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{tool.description}</div>}
                                              </div>
                                            ))}
                                          </div>
                                        </div>

                                        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                                          <div className="mb-2 flex items-center gap-2 font-medium">
                                            <FileCode2 size={16} /> Resources ({detail.resources.length})
                                          </div>
                                          <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                                            {detail.resources.length === 0 ? <div>暂无 resources</div> : detail.resources.map(resource => (
                                              <div key={`${resource.name}-${resource.uri || ''}`} className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
                                                <div className="font-medium">{resource.title || resource.name}</div>
                                                {resource.uri && <div className="mt-1 break-all text-xs text-zinc-500 dark:text-zinc-400">{resource.uri}</div>}
                                              </div>
                                            ))}
                                          </div>
                                        </div>

                                        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                                          <div className="mb-2 flex items-center gap-2 font-medium">
                                            <Webhook size={16} /> Prompts ({detail.prompts.length})
                                          </div>
                                          <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                                            {detail.prompts.length === 0 ? <div>暂无 prompts</div> : detail.prompts.map(prompt => (
                                              <div key={prompt.name} className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
                                                <div className="font-medium">{prompt.title || prompt.name}</div>
                                                {prompt.arguments && prompt.arguments.length > 0 && (
                                                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">参数：{prompt.arguments.join(', ')}</div>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                                      <div className="mb-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2 font-medium">
                                          <ScrollText size={16} /> 诊断日志
                                        </div>
                                        <button
                                          onClick={() => void refreshLogs([name])}
                                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                        >
                                          <RefreshCcw size={14} /> 刷新日志
                                        </button>
                                      </div>
                                      <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl bg-zinc-50 p-3 text-xs dark:bg-black/40">
                                        {logs.length === 0 ? (
                                          <div className="text-zinc-500 dark:text-zinc-400">当前还没有诊断日志。连接、重试、失败或手动刷新后会在这里显示。</div>
                                        ) : (
                                          logs.slice().reverse().map(log => (
                                            <div key={log.id} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                                              <div className="mb-1 flex flex-wrap items-center gap-2">
                                                <span className={`font-medium uppercase ${getLogLevelClass(log.level)}`}>{log.level}</span>
                                                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{log.source}</span>
                                                <span className="text-[10px] text-zinc-400">{formatTime(log.timestamp) || log.timestamp}</span>
                                              </div>
                                              <div className="whitespace-pre-wrap break-words text-zinc-700 dark:text-zinc-200">{log.message}</div>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-2 md:pl-4">
                                {status?.status === 'connected' ? (
                                  <button
                                    onClick={() => void handleDisconnect(name)}
                                    disabled={!!busy}
                                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-amber-600 transition hover:bg-amber-50 disabled:opacity-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                                  >
                                    {busy === 'disconnect' ? '断开中...' : 'Disconnect'}
                                  </button>
                                ) : status?.nextRetryAt ? (
                                  <button
                                    onClick={() => void handleRetry(name, config)}
                                    disabled={!!busy}
                                    className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                                  >
                                    {busy === 'retry' ? '重试中...' : '立即重试'}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => void handleConnect(name, config)}
                                    disabled={!!busy}
                                    className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                                  >
                                    {busy === 'connect' ? '处理中...' : connectLabel}
                                  </button>
                                )}
                                <button
                                  onClick={() => void handleDelete(name)}
                                  disabled={!!busy}
                                  className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30 dark:hover:text-red-500"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {visibleEntries.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 py-12 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  <PlugZap size={32} className="mb-3 opacity-20" />
                  <p>当前筛选条件下没有 MCP Server。</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-6 text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              {isEditing ? '创建 / 调整 MCP 配置' : '选择模板快速创建'}
            </h3>

            {!isEditing ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {MCP_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => openPresetEditor(preset.id)}
                    className="flex flex-col items-start rounded-xl border border-zinc-200 p-4 text-left transition hover:border-blue-500 hover:shadow-md dark:border-zinc-700 dark:hover:border-blue-500 dark:hover:bg-zinc-800"
                  >
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      <preset.icon size={20} />
                    </div>
                    <h4 className="mb-1 font-semibold text-zinc-900 dark:text-zinc-100">{preset.name}</h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{preset.description}</p>
                  </button>
                ))}
                <button
                  onClick={() => openPresetEditor(CUSTOM_PRESET_ID)}
                  className="flex flex-col items-start rounded-xl border border-dashed border-zinc-300 p-4 text-left transition hover:border-blue-500 hover:shadow-md dark:border-zinc-700 dark:hover:border-blue-500 dark:hover:bg-zinc-800"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    <TerminalSquare size={20} />
                  </div>
                  <h4 className="mb-1 font-semibold text-zinc-900 dark:text-zinc-100">Custom</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">适合 HTTP / SSE / WS 或完全手动配置的高级场景。</p>
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
                  <div>
                    <div className="flex items-center gap-3">
                      {selectedPreset && selectedPreset.id !== CUSTOM_PRESET_ID ? (
                        <selectedPreset.icon size={22} className="text-zinc-500 dark:text-zinc-400" />
                      ) : (
                        <TerminalSquare size={22} className="text-zinc-500 dark:text-zinc-400" />
                      )}
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {selectedPreset?.name || 'Custom'} 配置向导
                      </h4>
                    </div>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {selectedPreset?.helperText || '适合高级用户手工输入 transport / command / headers 等完整信息。'}
                    </p>
                  </div>
                  <button onClick={() => setIsEditing(false)} className="text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200">
                    取消
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Server 名称</label>
                    <input
                      type="text"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      placeholder="例如：github-prod / local-sqlite / docs-fetch"
                    />
                  </div>

                  {selectedPreset && selectedPreset.id !== CUSTOM_PRESET_ID ? (
                    <>
                      {selectedPreset.fields.map(field => (
                        <div key={field.key} className="md:col-span-2">
                          <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            {field.label}{field.required ? ' *' : ''}
                          </label>
                          <input
                            type={field.secret ? 'password' : 'text'}
                            value={presetValues[field.key] || ''}
                            onChange={e => setPresetValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                            placeholder={field.placeholder}
                          />
                          {field.help && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{field.help}</p>}
                        </div>
                      ))}

                      <div className="md:col-span-2 rounded-xl border border-dashed border-zinc-200 p-4 dark:border-zinc-700">
                        <div className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">将自动生成的配置预览</div>
                        <code className="block whitespace-pre-wrap break-all rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-black/40 dark:text-zinc-400">
                          {JSON.stringify(currentDraftConfig, null, 2)}
                        </code>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">连接方式</label>
                        <select
                          value={advancedTransport}
                          onChange={e => {
                            const transport = e.target.value as 'stdio' | 'http' | 'sse' | 'ws'
                            setAdvancedTransport(transport)
                            setAdvancedCommand('')
                            setAdvancedArgsText('')
                            setAdvancedUrl('')
                            setAdvancedEnvPairs([{ key: '', value: '' }])
                            setAdvancedHeaderPairs([{ key: '', value: '' }])
                          }}
                          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        >
                          <option value="stdio">stdio（本地命令）</option>
                          <option value="http">http（远程服务）</option>
                          <option value="sse">sse（服务端事件）</option>
                          <option value="ws">ws（WebSocket）</option>
                        </select>
                      </div>

                      {advancedTransport === 'stdio' ? (
                        <>
                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">启动命令</label>
                            <input
                              type="text"
                              value={advancedCommand}
                              onChange={e => setAdvancedCommand(e.target.value)}
                              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 font-mono text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                              placeholder="例如：npx / uvx / node"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">参数列表（每行一个）</label>
                            <textarea
                              value={advancedArgsText}
                              onChange={e => setAdvancedArgsText(e.target.value)}
                              rows={5}
                              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 font-mono text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                              placeholder={'-y\n@modelcontextprotocol/server-fetch'}
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">环境变量</label>
                            <div className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700 dark:bg-zinc-950/40">
                              {advancedEnvPairs.map((pair, index) => (
                                <div key={`env-${index}`} className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={pair.key}
                                    onChange={e => updatePair(advancedEnvPairs, setAdvancedEnvPairs, index, 'key', e.target.value)}
                                    className="w-1/3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
                                    placeholder="KEY"
                                  />
                                  <input
                                    type="text"
                                    value={pair.value}
                                    onChange={e => updatePair(advancedEnvPairs, setAdvancedEnvPairs, index, 'value', e.target.value)}
                                    className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
                                    placeholder="Value"
                                  />
                                  {(pair.key || pair.value) && (
                                    <button onClick={() => removePair(advancedEnvPairs, setAdvancedEnvPairs, index)} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-red-500 dark:hover:bg-zinc-800">
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="md:col-span-2">
                            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">服务地址 URL</label>
                            <input
                              type="text"
                              value={advancedUrl}
                              onChange={e => setAdvancedUrl(e.target.value)}
                              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 font-mono text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                              placeholder="https://example.com/mcp 或 wss://example.com/mcp"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">请求头 Headers</label>
                            <div className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700 dark:bg-zinc-950/40">
                              {advancedHeaderPairs.map((pair, index) => (
                                <div key={`header-${index}`} className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={pair.key}
                                    onChange={e => updatePair(advancedHeaderPairs, setAdvancedHeaderPairs, index, 'key', e.target.value)}
                                    className="w-1/3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
                                    placeholder="Header-Name"
                                  />
                                  <input
                                    type="text"
                                    value={pair.value}
                                    onChange={e => updatePair(advancedHeaderPairs, setAdvancedHeaderPairs, index, 'value', e.target.value)}
                                    className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
                                    placeholder="Header Value"
                                  />
                                  {(pair.key || pair.value) && (
                                    <button onClick={() => removePair(advancedHeaderPairs, setAdvancedHeaderPairs, index)} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-red-500 dark:hover:bg-zinc-800">
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4">
                  {validateStatus ? (
                    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${validateStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {validateStatus.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                      {validateStatus.text}
                    </div>
                  ) : <div />}

                  <button
                    onClick={() => void handleSave()}
                    disabled={validating}
                    className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-black disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                  >
                    {validating ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {validating ? '正在校验并保存...' : '保存配置'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

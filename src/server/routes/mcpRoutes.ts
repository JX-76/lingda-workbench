import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { mcpSessionManager, validateMcpServerConfig } from '../mcpSessionManager.js'
import type { McpServerConfig } from '../../services/mcp/types.js'

export const mcpRouter = Router()

type McpConfigPayload = {
  mcpServers: Record<string, McpServerConfig>
}

function getMcpConfigPath() {
  const clinePath = path.join(
    process.env.HOME || '',
    'Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json',
  )
  if (fs.existsSync(clinePath)) return clinePath
  return path.join(process.env.HOME || '', '.claude', 'mcp_settings.json')
}

function ensureConfigDir(configPath: string) {
  const dir = path.dirname(configPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function readRawConfigFile(configPath = getMcpConfigPath()): Record<string, any> {
  try {
    if (!fs.existsSync(configPath)) return { mcpServers: {} }
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    if (!raw || typeof raw !== 'object') return { mcpServers: {} }
    return raw
  } catch {
    return { mcpServers: {} }
  }
}

function readMcpConfig(configPath = getMcpConfigPath()): McpConfigPayload {
  const raw = readRawConfigFile(configPath)
  return {
    mcpServers:
      raw && typeof raw.mcpServers === 'object' && raw.mcpServers !== null
        ? raw.mcpServers
        : {},
  }
}

function writeMcpConfig(payload: McpConfigPayload, configPath = getMcpConfigPath()) {
  ensureConfigDir(configPath)
  const current = readRawConfigFile(configPath)
  const next = {
    ...current,
    mcpServers: payload.mcpServers || {},
  }
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2), 'utf-8')
}

function validateServerMap(mcpServers: Record<string, unknown>) {
  const errors: Record<string, string> = {}

  for (const [name, config] of Object.entries(mcpServers || {})) {
    const result = validateMcpServerConfig(config)
    if (!result.ok) {
      errors[name] = result.error || '配置校验失败'
    }
  }

  return errors
}

function parseImportPayload(body: any): McpConfigPayload {
  if (typeof body?.json === 'string') {
    const parsed = JSON.parse(body.json)
    return {
      mcpServers:
        parsed && typeof parsed.mcpServers === 'object' && parsed.mcpServers !== null
          ? parsed.mcpServers
          : {},
    }
  }

  if (body && typeof body.mcpServers === 'object' && body.mcpServers !== null) {
    return { mcpServers: body.mcpServers }
  }

  if (body && typeof body.config === 'object' && body.config !== null) {
    const cfg = body.config
    return {
      mcpServers:
        cfg && typeof cfg.mcpServers === 'object' && cfg.mcpServers !== null
          ? cfg.mcpServers
          : {},
    }
  }

  return { mcpServers: {} }
}

mcpRouter.get('/config', (_req, res) => {
  const configPath = getMcpConfigPath()
  try {
    const config = readMcpConfig(configPath)
    res.json({ ...config, configPath })
  } catch (e: any) {
    res.status(500).json({ error: e.message, mcpServers: {}, configPath })
  }
})

mcpRouter.post('/config', async (req, res) => {
  const configPath = getMcpConfigPath()
  try {
    const previous = readMcpConfig(configPath)
    const next: McpConfigPayload = {
      mcpServers:
        req.body && typeof req.body.mcpServers === 'object' && req.body.mcpServers !== null
          ? req.body.mcpServers
          : {},
    }

    const errors = validateServerMap(next.mcpServers)
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        error: 'MCP 配置校验失败',
        validationErrors: errors,
      })
    }

    writeMcpConfig(next, configPath)

    const removedNames = Object.keys(previous.mcpServers).filter(
      name => !(name in next.mcpServers),
    )
    if (removedNames.length > 0) {
      await mcpSessionManager.disconnectMany(removedNames)
    }

    return res.json({
      success: true,
      configPath,
      mcpServers: next.mcpServers,
    })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
})

mcpRouter.post('/validate', (req, res) => {
  const result = validateMcpServerConfig(req.body)
  if (!result.ok) {
    return res.status(400).json({ ok: false, error: result.error || '配置校验失败' })
  }
  return res.json({ ok: true })
})

mcpRouter.post('/connect/:name', async (req, res) => {
  const configPath = getMcpConfigPath()
  const name = req.params.name
  try {
    const savedConfig = readMcpConfig(configPath).mcpServers[name]
    const rawConfig =
      req.body && Object.keys(req.body).length > 0 ? req.body : savedConfig

    if (!rawConfig) {
      return res.status(400).json({ error: `未找到 ${name} 的 MCP 配置` })
    }

    const status = await mcpSessionManager.connect(name, rawConfig)
    return res.json({ ok: status.status === 'connected', status })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
})

mcpRouter.post('/retry/:name', async (req, res) => {
  const configPath = getMcpConfigPath()
  const name = req.params.name
  try {
    const savedConfig = readMcpConfig(configPath).mcpServers[name]
    const rawConfig =
      req.body && Object.keys(req.body).length > 0 ? req.body : savedConfig

    if (!rawConfig) {
      return res.status(400).json({ error: `未找到 ${name} 的 MCP 配置` })
    }

    const status = await mcpSessionManager.retry(name, rawConfig)
    return res.json({ ok: status.status === 'connected', status })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
})

mcpRouter.post('/clear-auth/:name', async (req, res) => {
  const name = req.params.name
  try {
    const status = await mcpSessionManager.clearAuth(name)
    return res.json({ ok: true, status })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
})

mcpRouter.post('/disconnect/:name', async (req, res) => {
  const name = req.params.name
  try {
    const status = await mcpSessionManager.disconnect(name)
    return res.json({ ok: true, status })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
})

mcpRouter.get('/status', (_req, res) => {
  const configPath = getMcpConfigPath()
  try {
    const config = readMcpConfig(configPath)
    res.json({ statuses: mcpSessionManager.getStatuses(config.mcpServers) })
  } catch (e: any) {
    res.status(500).json({ error: e.message, statuses: {} })
  }
})

mcpRouter.get('/describe/:name', async (req, res) => {
  try {
    const description = await mcpSessionManager.describe(req.params.name)
    if (!description) {
      return res.status(404).json({ error: '该 MCP Server 当前未连接，无法读取能力清单。' })
    }
    return res.json({ ok: true, description })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
})

mcpRouter.get('/logs/:name', (req, res) => {
  try {
    return res.json({ ok: true, logs: mcpSessionManager.getLogs(req.params.name) })
  } catch (e: any) {
    return res.status(500).json({ error: e.message, logs: [] })
  }
})

mcpRouter.get('/logs/:name/stream', (req, res) => {
  const name = req.params.name
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const sentIds = new Set<string>()
  const pushLogs = () => {
    try {
      const logs = mcpSessionManager.getLogs(name)
      for (const log of logs) {
        if (sentIds.has(log.id)) continue
        sentIds.add(log.id)
        res.write(`data: ${JSON.stringify(log)}\n\n`)
      }
    } catch (e: any) {
      res.write(`data: ${JSON.stringify({
        id: `stream-error-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'error',
        source: 'manager',
        message: e.message || '日志流读取失败',
      })}\n\n`)
    }
  }

  pushLogs()
  const timer = setInterval(pushLogs, 1000)
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n')
  }, 15000)

  req.on('close', () => {
    clearInterval(timer)
    clearInterval(heartbeat)
    res.end()
  })
})

mcpRouter.get('/export', (_req, res) => {
  const configPath = getMcpConfigPath()
  try {
    const config = readMcpConfig(configPath)
    return res.json({ configPath, ...config })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
})

mcpRouter.post('/import', async (req, res) => {
  const configPath = getMcpConfigPath()
  try {
    const previous = readMcpConfig(configPath)
    const imported = parseImportPayload(req.body)
    const errors = validateServerMap(imported.mcpServers)
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        error: '导入的 MCP 配置格式不合法',
        validationErrors: errors,
      })
    }

    writeMcpConfig(imported, configPath)

    const removedNames = Object.keys(previous.mcpServers).filter(
      name => !(name in imported.mcpServers),
    )
    if (removedNames.length > 0) {
      await mcpSessionManager.disconnectMany(removedNames)
    }

    return res.json({
      success: true,
      configPath,
      mcpServers: imported.mcpServers,
    })
  } catch (e: any) {
    return res.status(400).json({ error: e.message || '导入失败，请检查 JSON 格式。' })
  }
})

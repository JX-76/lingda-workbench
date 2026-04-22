import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { readSettings, writeSettings } from '../../utils/settings.js'
import { getMemoryPaths, getTimeBucket } from '../../memory/timeBuckets.js'
import { listProviders } from '../../providers/registry.js'

export const settingsRouter = Router()

function maskSecret(secret?: string) {
  if (!secret) return ''
  if (secret.length <= 8) return '****'
  return `${secret.slice(0, 4)}****${secret.slice(-4)}`
}

function getTasksPath() {
  return path.join(process.cwd(), '.claude-memory', 'tasks.json')
}

// ----------------------------------------
// Settings
// ----------------------------------------
settingsRouter.get('/', (_req, res) => {
  res.json(readSettings())
})

settingsRouter.post('/', (req, res) => {
  writeSettings(req.body)
  res.json({ success: true })
})

// ----------------------------------------
// Providers
// ----------------------------------------
settingsRouter.get('/providers', (_req, res) => {
  res.json({ providers: listProviders() })
})

// ----------------------------------------
// Tasks
// ----------------------------------------
settingsRouter.get('/tasks', (_req, res) => {
  const p = getTasksPath()
  try {
    if (!fs.existsSync(p)) return res.json({ tasks: [] })
    res.json({ tasks: JSON.parse(fs.readFileSync(p, 'utf-8')) })
  } catch {
    res.json({ tasks: [] })
  }
})

settingsRouter.post('/tasks', (req, res) => {
  const p = getTasksPath()
  try {
    const dir = path.dirname(p)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(p, JSON.stringify(req.body.tasks || [], null, 2), 'utf-8')
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// ----------------------------------------
// Memory
// ----------------------------------------
settingsRouter.get('/memory/paths', (_req, res) => {
  res.json({
    activeBucket: getTimeBucket(),
    paths: getMemoryPaths(path.join(process.cwd(), '.claude-memory')),
  })
})

settingsRouter.post('/memory', (req, res) => {
  const { path: filePath, content } = req.body
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath)
    const dir = path.dirname(fullPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(fullPath, `\n\n${new Date().toISOString()}:\n${content ?? ''}`)
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// ----------------------------------------
// Bot Config
// ----------------------------------------
settingsRouter.get('/bot/config', (_req, res) => {
  const s = readSettings()
  res.json({
    qqId: s.qqId || '',
    qqSecretMasked: maskSecret(s.qqSecret),
  })
})

settingsRouter.post('/bot/config', (req, res) => {
  const s = readSettings()
  const merged = {
    ...s,
    qqId: req.body?.qqId ?? s.qqId,
    qqSecret: req.body?.qqSecret ?? s.qqSecret,
  }
  writeSettings(merged)
  res.json({ success: true, qqId: merged.qqId || '' })
})

settingsRouter.post('/bot/test', async (_req, res) => {
  const s = readSettings()
  if (!s.qqId || !s.qqSecret) {
    return res.status(400).json({ ok: false, error: 'QQ AppID / Secret 未配置' })
  }

  try {
    const resp = await fetch('https://bots.qq.com/app/getAppAccessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: s.qqId,
        clientSecret: s.qqSecret,
      }),
    })

    const data: any = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      return res.status(resp.status).json({
        ok: false,
        error: data?.message || data?.msg || `QQ API error ${resp.status}`,
        details: data,
      })
    }

    return res.json({
      ok: true,
      accessTokenPreview:
        typeof data?.access_token === 'string'
          ? `${data.access_token.slice(0, 6)}...${data.access_token.slice(-4)}`
          : '',
      expiresIn: data?.expires_in,
    })
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message })
  }
})

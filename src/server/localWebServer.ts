import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'

// Import Routers
import { fsRouter } from './routes/fsRoutes.js'
import { mcpRouter } from './routes/mcpRoutes.js'
import { skillsRouter } from './routes/skillsRoutes.js'
import { settingsRouter } from './routes/settingsRoutes.js'
import { chatRouter } from './routes/chatRoutes.js'
import { PROVIDER_REGISTRY } from '../providers/registry.js'

export function createLocalWebServer() {
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '4mb' }))

  const webuiDist = path.join(process.cwd(), 'webui', 'dist')
  if (fs.existsSync(webuiDist)) {
    app.use(express.static(webuiDist))
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'claude-code-local-web' })
  })

  // URL context
  app.post('/api/context/url', async (req, res) => {
    const { url } = req.body
    if (!url) return res.status(400).json({ error: 'url required' })
    try {
      const resp = await fetch(url)
      const text = await resp.text()
      const preview = text.length > 5000 ? text.slice(0, 5000) + '...' : text
      res.json({ success: true, content: preview })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // Provider testing route
  app.post('/api/providers/test', async (req, res) => {
    const { baseUrl, apiKey, provider, providerOptions } = req.body || {}
    const providerConfig = provider ? PROVIDER_REGISTRY[provider as keyof typeof PROVIDER_REGISTRY] : undefined
    const resolvedBaseUrl = String(baseUrl || providerConfig?.baseUrl || '').replace(/\/$/, '')

    if (!resolvedBaseUrl) {
      return res.status(400).json({ ok: false, error: 'No Base URL provided and no default inferred for testing.' })
    }

    const scopedOptions = provider && providerOptions && typeof providerOptions === 'object'
      ? providerOptions[provider] || {}
      : {}

    let testUrl = resolvedBaseUrl
    if (provider === 'openai-compatible' || provider === 'openrouter' || provider === 'groq' || provider === 'deepseek' || provider === 'kimi' || provider === 'minimax' || provider === 'lmstudio' || provider === 'localai' || provider === 'custom' || provider === 'ollama' || provider === 'zhipu' || provider === 'dashscope' || provider === 'doubao') {
      testUrl = `${resolvedBaseUrl}/models`
    } else if (provider === 'anthropic') {
      testUrl = `${resolvedBaseUrl}/v1/models`
    } else if (provider === 'azure-openai') {
      const apiVersion = typeof scopedOptions.apiVersion === 'string' && scopedOptions.apiVersion
        ? scopedOptions.apiVersion
        : '2024-10-21'
      testUrl = `${resolvedBaseUrl}?api-version=${encodeURIComponent(apiVersion)}`
    }

    try {
      const headers: Record<string, string> = {}
      if (provider === 'azure-openai') {
        if (apiKey) headers['api-key'] = apiKey
      } else if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`
      }

      const response = await fetch(testUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000),
      })

      if (response.ok || [400, 401, 403, 404, 405].includes(response.status)) {
        return res.json({
          ok: true,
          warning: response.ok ? undefined : `Endpoint reachable (HTTP ${response.status})`,
        })
      }

      let errorText = ''
      try { errorText = await response.text() } catch (e) {}
      return res.status(400).json({
        ok: false,
        error: `HTTP ${response.status}: ${errorText.slice(0, 100)}`,
      })
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message || 'Connection timeout or failed' })
    }
  })

  // Mount modular routes
  app.use('/api/fs', fsRouter)
  app.use('/api/mcp', mcpRouter)
  app.use('/api/skills', skillsRouter)
  app.use('/api/settings', settingsRouter)
  
  // Note: Mount at root because chatRoutes previously handled /api/chat and /api/webhook/bot 
  // but they are now grouped under /api within chatRouter where we mount it or we explicitly do:
  app.use('/api/chat', chatRouter)
  // We need to move bot webhook to api root if frontend expects it there, or update to /api/chat/webhook/bot
  // The route in chatRoutes is POST /webhook/bot, so mounted under /api/chat it's /api/chat/webhook/bot
  // To preserve backwards compatibility with the previous file, let's explicitly mount it:
  app.post('/api/webhook/bot', (req, res, next) => {
    // forwarding to chatRouter logic
    req.url = '/webhook/bot';
    chatRouter(req, res, next);
  });

  // Also settings bot test is /api/bot/config, so mounted under /api/settings it's /api/settings/bot/config
  // In the original file it was /api/bot/config
  // Forwarding for backwards compatibility:
  app.use('/api/bot', (req, res, next) => {
    req.url = `/bot${req.url}`;
    settingsRouter(req, res, next);
  });

  // Same for memory paths:
  app.use('/api/memory', (req, res, next) => {
    req.url = `/memory${req.url}`;
    settingsRouter(req, res, next);
  });

  // Same for tasks:
  app.use('/api/tasks', (req, res, next) => {
    req.url = `/tasks${req.url}`;
    settingsRouter(req, res, next);
  });

  // Same for providers:
  app.use('/api/providers', (req, res, next) => {
    req.url = `/providers${req.url}`;
    settingsRouter(req, res, next);
  });

  // Fallback for single page application
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    const indexFile = path.join(process.cwd(), 'webui', 'dist', 'index.html')
    if (fs.existsSync(indexFile)) {
      return res.sendFile(indexFile)
    }
    return res.status(404).send('Frontend not built. Run "npm run build" in webui directory first.')
  })

  return app
}

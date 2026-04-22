import { Router } from 'express'
import { readSettings } from '../../utils/settings.js'
import { SessionManager } from '../session/WebChatSession.js'


export const chatRouter = Router()

// 提取原 localWebServer.ts 中的 normalizeMessages 辅助函数
function normalizeMessages(input: unknown, fallbackPrompt?: string): any[] {
  if (Array.isArray(input) && input.length > 0) {
    return input
      .map((m: any) => ({
        role: (m?.role || 'user'),
        content:
          typeof m?.content === 'string'
            ? m.content
            : JSON.stringify(m?.content ?? ''),
      }))
      .filter(m => typeof m.content === 'string' && m.content.length > 0)
  }

  if (fallbackPrompt && fallbackPrompt.trim()) {
    return [{ role: 'user', content: fallbackPrompt.trim() }]
  }

  return []
}

// 模拟原 callOpenAICompatibleModel，阶段 1 将废弃，仅做后门兜底
async function callOpenAICompatibleModel(messages: any[], settings: any): Promise<string> {
  const provider = settings.provider || 'deepseek'
  if (provider === 'anthropic') {
    throw new Error('当前本地 Web /api/chat 测试通道仅支持 OpenAI 兼容 Provider，请先切换 Provider。')
  }

  let baseUrl = settings.baseUrl
  if (!baseUrl) {
    if (provider === 'ollama') baseUrl = 'http://127.0.0.1:11434/v1'
    else if (provider === 'deepseek') baseUrl = 'https://api.deepseek.com/v1'
    else if (provider === 'kimi') baseUrl = 'https://api.moonshot.cn/v1'
    else if (provider === 'minimax') baseUrl = 'https://api.minimax.chat/v1'
    else baseUrl = 'https://api.openai.com/v1'
  }

  const model = settings.model || 'deepseek-chat'
  const apiKey = settings.apiKey || process.env.DEEPSEEK_API_KEY || ''

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      temperature: 0.4,
    }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Provider error ${resp.status}: ${text.slice(0, 500)}`)
  }

  const data: any = await resp.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.length) {
    throw new Error('Provider returned empty content')
  }
  return content
}

// ----------------------------------------
// Chat Core Routes (WebChatSession Integrated)
// ----------------------------------------

chatRouter.post('/', async (req, res) => {
  const prompt = req.body?.prompt
  const rawMessages = req.body?.messages
  const sessionId = req.body?.sessionId || 'default-session'
  const runtimeSelection = req.body?.runtimeSelection || {}
  
  const messages = normalizeMessages(rawMessages, prompt)
  if (!messages.length) {
    return res.status(400).json({ error: 'prompt/messages required' })
  }

  const session = SessionManager.getOrCreateSession(sessionId)

  // Start the task asynchronously with full history instead of only the last turn
  session.submitMessage(messages, runtimeSelection).catch(console.error)

  // Return immediately so the client can hook up to SSE
  res.json({ ok: true, data: { sessionId, status: session.status } })
})

chatRouter.get('/stream/:sessionId', (req, res) => {
  const { sessionId } = req.params
  const session = SessionManager.getSession(sessionId)

  if (!session) {
    return res.status(404).json({ error: 'Session not found' })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const unsubscribe = session.subscribe((data: string) => {
    res.write(`data: ${data}\n\n`)
  })

  req.on('close', () => {
    unsubscribe()
  })
})

chatRouter.post('/approve', (req, res) => {
  const { approvalId, sessionId, approved } = req.body
  if (!approvalId) {
    return res.status(400).json({ error: 'approvalId required' })
  }

  const session = SessionManager.findSessionByApprovalId(String(approvalId))
  if (!session) {
    return res.status(404).json({ error: 'Approval not found' })
  }

  if (sessionId && session.id !== sessionId) {
    return res.status(400).json({ error: 'Session mismatch for approvalId' })
  }

  if (session.pendingApproval?.id === approvalId) {
    session.pendingApproval.resolve(!!approved)
    return res.json({ ok: true, data: { approvalId, sessionId: session.id } })
  }

  return res.status(400).json({ error: 'No pending approval for this approvalId' })
})

chatRouter.get('/sessions', (req, res) => {
  res.json({ ok: true, sessions: SessionManager.listSessions() })
})

chatRouter.get('/sessions/:id', (req, res) => {
  const session = SessionManager.getSession(req.params.id)
  if (!session) {
    return res.status(404).json({ error: 'Session not found' })
  }

  res.json({ ok: true, session: session.getSnapshot() })
})

// Webhook Bot (QQ)
chatRouter.post('/webhook/bot', async (req, res) => {
  const { source, message } = req.body || {}
  if (!message) return res.status(400).json({ error: 'Message required' })
  try {
    const settings = readSettings()
    const reply = await callOpenAICompatibleModel([{ role: 'user', content: String(message) }], settings)
    res.json({
      success: true,
      status: 'acknowledged',
      source: source || 'qq',
      qqConfigured: Boolean(settings.qqId && settings.qqSecret),
      replyPreview: reply.slice(0, 120),
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})
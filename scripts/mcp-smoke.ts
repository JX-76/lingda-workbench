import path from 'path'
import { createLocalWebServer } from '../src/server/localWebServer.js'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function callJson(baseUrl: string, endpoint: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${endpoint}`, init)
  const data = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, data }
}

const serverName = 'mcp-smoke-local-cli'
const repoRoot = process.cwd()
const localMcpServerScript = path.join(repoRoot, 'scripts', 'mcp-local-test-server.mjs')

const app = createLocalWebServer()
const server = app.listen(0)

try {
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to resolve local test server address')
  }

  const baseUrl = `http://127.0.0.1:${address.port}`
  const localConfig = {
    type: 'stdio' as const,
    command: 'node',
    args: [localMcpServerScript],
    env: {},
  }

  const saveConfig = await callJson(baseUrl, '/api/mcp/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mcpServers: { [serverName]: localConfig } }),
  })
  assert(saveConfig.ok, `保存 MCP 配置失败: ${JSON.stringify(saveConfig.data)}`)

  const connect = await callJson(baseUrl, `/api/mcp/connect/${encodeURIComponent(serverName)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(localConfig),
  })
  assert(connect.ok, `连接本地 MCP 测试服务失败: ${JSON.stringify(connect.data)}`)
  assert(connect.data?.status?.status === 'connected', '本地 MCP 测试服务未进入 connected 状态')

  const status = await callJson(baseUrl, '/api/mcp/status')
  assert(status.ok, '获取 MCP 状态失败')
  assert(status.data?.statuses?.[serverName]?.status === 'connected', '状态接口未返回 connected')

  const describe = await callJson(baseUrl, `/api/mcp/describe/${encodeURIComponent(serverName)}`)
  assert(describe.ok, `读取 MCP 能力失败: ${JSON.stringify(describe.data)}`)
  assert(Array.isArray(describe.data?.description?.tools), 'describe 未返回 tools 列表')

  const logs = await callJson(baseUrl, `/api/mcp/logs/${encodeURIComponent(serverName)}`)
  assert(logs.ok, `读取 MCP 日志失败: ${JSON.stringify(logs.data)}`)
  assert(Array.isArray(logs.data?.logs), 'logs 接口未返回数组')

  const disconnect = await callJson(baseUrl, `/api/mcp/disconnect/${encodeURIComponent(serverName)}`, {
    method: 'POST',
  })
  assert(disconnect.ok, `断开本地 MCP 测试服务失败: ${JSON.stringify(disconnect.data)}`)

  console.log('✅ MCP smoke 通过：local stdio connect/status/describe/logs/disconnect 全链路正常')
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close(err => (err ? reject(err) : resolve()))
  })
}

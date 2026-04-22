import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type ListToolsResult,
} from '@modelcontextprotocol/sdk/types.js'

async function main() {
  const server = new Server(
    {
      name: 'mcp-smoke-local-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  )

  server.setRequestHandler(ListToolsRequestSchema, async (): Promise<ListToolsResult> => {
    return {
      tools: [
        {
          name: 'ping',
          description: 'Return pong for MCP smoke testing',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }
  })

  server.setRequestHandler(CallToolRequestSchema, async (): Promise<CallToolResult> => {
    return {
      content: [
        {
          type: 'text',
          text: 'pong',
        },
      ],
    }
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

void main().catch(error => {
  console.error(error)
  process.exit(1)
})

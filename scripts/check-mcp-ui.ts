import { build } from 'esbuild'

const entryPoints = [
  'webui/src/api/client.ts',
  'webui/src/components/McpPanel.tsx',
]

async function main() {
  for (const entryPoint of entryPoints) {
    await build({
      entryPoints: [entryPoint],
      bundle: false,
      write: false,
      format: 'esm',
      platform: 'browser',
      target: ['es2020'],
      jsx: 'automatic',
      tsconfig: 'webui/tsconfig.json',
      logLevel: 'silent',
    })
  }

  console.log('✅ MCP UI 专项校验通过：api/client.ts 与 McpPanel.tsx 可正常解析编译')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})

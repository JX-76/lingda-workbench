import './setup-env.js'
import { createLocalWebServer } from './localWebServer.js'
import { startOllamaHealthCheck } from './ollama.js'

const port = Number(process.env.CLAUDE_CODE_WEB_PORT || 3456)
const app = createLocalWebServer()

startOllamaHealthCheck()

app.listen(port, () => {
  console.log(`Claude Code local web server listening on http://127.0.0.1:${port}`)
})

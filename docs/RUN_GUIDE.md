# 本地运行与配置指南（多 Provider + 聊天 + 记忆 + Ollama 探活 + Bot Webhook）

## 1. 快速启动

### 后端（本地 Web 服务）
```bash
npm install
npm run dev -- --host  # 或 node dist 产物，如果你已经打包
# 或直接： node src/server/start-local-web.ts
```
默认端口：`http://127.0.0.1:3456`

### 前端（WebUI）
```bash
cd webui
npm install
npm run dev -- --host
```
打开浏览器访问 Vite 提示的地址（通常 `http://127.0.0.1:5173`）。

## 2. 一键配置（前端 UI）
- 在 WebUI 左上角的“⚙️ 一键配置”面板：
  - 选择 Provider（Anthropic / OpenAI-Compatible / DeepSeek / Kimi / MiniMax / Ollama / Custom）。
  - 填写 Model、API Key、Base URL（可选）。
  - 点击“保存配置”即写入 `.claude-memory/settings.json`，后端会实时生效。

## 3. 聊天与记忆
- 聊天：在 WebUI “💬 聊天测试”输入消息，后端走 `/api/chat` (SSE) 返回流式结果。
- 记忆：后端会自动读取 `.claude-memory/daily/YYYY-MM-DD/morning.md` 与 `afternoon.md` 拼进 system context。你可用 `/api/memory` 写入（追加文本）。

## 4. Provider 支持与限制
- Anthropic / Bedrock / Vertex / Foundry：沿用原生逻辑（若未配置对应凭据则需要自行提供或关闭相关环境变量）。
- OpenAI 兼容（含 DeepSeek、Kimi、MiniMax、Ollama、自定义）：
  - **已完全打通工具调用能力 (Phase 2)**：后端已内置 `OpenAIAdapter`，会自动将 Claude Code 发出的 Anthropic 风格工具描述与提示词，翻译为 OpenAI 的 `tools` 字段。
  - **SSE 增量流装配**：兼容层的 SSE 流中零碎的 `tool_calls` 会被无缝装配并伪装为原生 Anthropic 事件，完美兼容 Claude Code 核心逻辑及授权挂起机制。
  - *已知限制*：多模态图像识别暂时只在 Anthropic 模型上保证完全兼容；深求/第三方推理字段（Reasoning）可能会以文本形式混合输出。
- Ollama：`start-local-web.ts` 会启动定时探活，访问 `http://127.0.0.1:11434/api/tags` 自动更新可用模型列表。

## 5. Bot Webhook 占位（飞书 / QQ）
- 路由：`POST /api/webhook/bot`
- 请求体：`{ source: 'feishu' | 'qq' | string, message: string, replyToken?: string }`
- 当前行为：立即返回 `{ success: true }`，后台调用 `queryModelWithStreaming` 生成回复并打印到控制台。你可在此处对接飞书/QQ 的发送 API，将 `fullResponse` 发回。

## 6. 构建与已知问题
- `npm run build` 目前会提示缺失若干外部模块，仓库自带 stub 生成但仍有 70+ 未补全。这是上游已知问题，推荐开发阶段使用 `npm run dev`。若必须打包，可在 `build-src/src/` 为缺失模块手工补 stub 再运行 `node scripts/build.mjs`。
- TypeScript 类型警告：通过 `types/shims.d.ts` 声明了缺失模块；如需严格类型，可按需安装对应 SDK 或继续补充声明。
- OpenAI 兼容层工具能力：Phase 2 已接入 Provider Adapter，可在支持 tool call 的第三方模型上尝试文件/终端等工具调用；如遇兼容性问题，优先检查 provider 是否完整支持 OpenAI tools / streaming tool_calls 协议。

## 7. 环境变量速览
- `CLAUDE_CODE_WEB_PORT`: 本地 Web 服务端口（默认 3456）。
- `RUNTIME_PROVIDER`, `RUNTIME_MODEL`, `RUNTIME_API_KEY`, `RUNTIME_BASE_URL`: 由前端保存到 settings 后自动注入的运行时配置（也可手工导出）。
- Ollama 默认 Base URL: `http://127.0.0.1:11434`。

## 8. 后续改进建议
- **(Phase 3 计划)** 完成前端重构：对接到后端的 `approval_required` 事件以弹出美观的拦截授权框。
- 为 `/api/webhook/bot` 增加异步发送逻辑（调用 Feishu/QQ 官方 SDK），并增加签名校验与重放保护。
- 增加前端对工具能力的开关与实时日志面板，以便观察第三方模型的调用行为。

# Claude Code 改造版说明与进度报告

## 1. 当前实现进度

按照计划，我已经为你搭建完成了**多模型 + 三层记忆 + Web UI** 的框架骨架：

- **✅ 依赖与基础运行**：修复了 `package.json` 中的基础依赖，引入了 `express`, `vite`, `react` 等 Web 支持依赖，调整了 TypeScript 配置。
- **✅ 统一 Provider 配置层**：在 `src/providers` 目录下抽象了 `ProviderRegistry`，预置了：
  - Anthropic (原版)
  - OpenAI Compatible
  - Ollama
  - DeepSeek
  - Kimi
  - MiniMax
  - Custom
- **✅ 三层记忆管理**：在 `src/memory/timeBuckets.ts` 目录下实现了记忆管理路径划分，支持 `morning`（上午）, `afternoon`（下午）, `daily-summary`（每日总结）, `longterm-project/user`（长期约束）。
- **✅ 独立 Web 控制台**：
  - 后端：在 `src/server/localWebServer.ts` 中基于 Express 提供 API 服务。
  - 前端：在 `webui/` 下基于 Vite + React 搭建了包含“模型选择”、“记忆管理”、“聊天占位”、“监控占位”的本地面板。
- **✅ 一键启动**：修改了 `package.json`，现在可以通过 `npm run dev` 一键并行启动本地后端服务 (Port: 3456) 与前端 UI (Port: 5173)，前后端 API 代理已打通。

## 2. 剩余构建阻塞项说明 (Known Issues)

目前 `npm run build` 和 `npm run check` 依然有约 70 处错误，主要是因为当前的反编译源码库缺失了一些关键的文件和类型定义：

1. **Bun FFI 与系统 API 缺失**：例如 `bun-ffi`, `execa`, 导致底层很多系统调用无法通过类型检查。
2. **SDK 类型缺失**：`src/entrypoints/sdk/` 目录下大量诸如 `coreTypes.generated.js`、`runtimeTypes.js` 等由自动脚本生成的文件未能完全找回。
3. **未定义的类型**：如 `RenderableMessage`, `ResolveAntModel` 等。

**这是否影响 Web 骨架运行？**
不影响。由于 Web UI 和本地 Server 服务采用的是独立的 entrypoint，并通过 `tsx` 绕过了严格的 tsc 编译，因此我们构建的**“多模型扩展控制台”可以在 `npm run dev` 下正常访问测试**。

## 3. 下一步建议 (Next Steps)

如果你希望继续将这个原型变成完全可用的工具，接下来建议：

1. **核心模型调用替换**：在 `src/services/api/client.ts` 或 `claude.ts` 中，将原有的硬编码 Anthropic 调用逻辑，改为读取我们刚刚搭建的 `src/providers/registry.ts` 中的配置。
2. **记忆读写联调**：将前端 Web 界面中用户的选项，真正写入到 `.claude-memory/` 的文件中，并在 `src/query.ts` 组装系统提示词时把对应的 `morning.md` / `afternoon.md` 拼进去。
3. **聊天面板接入**：将 Web UI 中的聊天占位符，连接到本地 Web 服务的 WebSocket 或 SSE 流，从而真正在网页里和模型对话。
4. **Ollama 探活**：在 Node server 层加入定时任务探测 `localhost:11434` 以自动拉取可用模型列表更新给前端。

## 4. 体验方法

你可以直接在终端中运行：
```bash
npm run dev
```
然后用浏览器打开 `http://localhost:5173/` 体验多模型与记忆管理控制台面板原型。
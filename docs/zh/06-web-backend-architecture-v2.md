# 架构总纲：Web 后端非侵入式桥接设计 (v2)

本文档确立了将 `Claude Code` 混合架构（原 CLI 驱动模型）彻底演进为“现代化 Agent Web 服务”的最高设计准则。

## 1. 核心矛盾与解决方针

**痛点总结**：
原先的代码在前端 Web 化时，为了尽快跑通流程，采用了“粗暴”的路由缝合。比如 `localWebServer.ts` 中针对第三方模型强行用 Fetch 调用（绕过了原有的工具挂载逻辑），且大量 API 堆砌在一个文件中，使得颗粒度不一、容易引发 Context Window 爆炸与无限流转。

**总方针：保护心脏，代理外围 (Non-invasive Proxy Architecture)**
绝不允许修改核心的 `QueryEngine`、`Tools` 等原有经过深思熟虑的逻辑。相反，我们要建立标准化的代理器（Adapter / Proxy / Manager）在外部截获并转换数据。

## 2. 架构三层设计 (The Three Blades)

### 刀片 1：路由解耦与会话层 (API & Session Layer) 【阶段 1 已完成】
**目标**：彻底告别面条式的 `localWebServer.ts`。
**设计**：
- 拆分 `src/server/routes/`：划分出 `chat.ts`, `fs.ts`, `mcp.ts`, `skills.ts`, `settings.ts` 等规范 API，暴露完整的系统能力供 WebIDE 和界面使用。
- 建立 `WebChatSession`：托管单个聊天进程，包括实例化 `QueryEngine`，提供心跳保活、历史记录和状态管理。它作为“粘合剂”负责将后端的事件 (SSE) 转换推给前端。

### 刀片 2：工具挂起与断路授权 (Suspense & Authorization) 【阶段 1 已完成】
**目标**：解决异步执行长耗时任务及敏感操作时的阻塞问题，不能让 Node 进程卡死，同时不能要求前端长连接不出错。
**设计**：
- 依靠 `QueryEngine` 提供给我们的 `canUseTool` Hook 接口拦截操作。
- 当 `QueryEngine` 申请执行 `BashTool` 或 `FileEditTool` 等涉及权限审查的工具时：
  1. `WebChatSession` 创建一个 `Promise` 并将其挂起。
  2. 通过 SSE 向前端抛出 `approval_required` 事件，并向状态机写入 `suspended_for_approval` 状态。
  3. 前端界面弹窗要求用户确认，确认后调用 `POST /api/chat/approve`。
  4. 拿到调用后，`WebChatSession` 解析并将挂起的 `Promise` `resolve`（允许/拒绝），引擎恢复运转。
- 这解决了前后端流转的问题，而且前端断开并不会导致引擎崩溃（只需通过 sessionId 重新订阅 SSE 即可拉取最新挂起状态）。

### 刀片 3：模型适配器 (Model Adapter) 【待阶段 2 实施】
**目标**：无缝对接 DeepSeek, OpenAI 等第三方大模型并使其拥有调用工具的能力，同时不对 `QueryEngine` 的底层要求造成破坏。
**设计**：
- `QueryEngine` 只能理解 Anthropic SDK 结构（`content_block_start`, `tool_use`, `<functions>` xml）。
- 我们在注入 `client` 给 `QueryEngine` 时，需要写一个 `OpenAICompatibleClient`。
- 它截获 `messages.create()` 和 `stream`，在内部将 `Anthropic Message` 解析为 `OpenAI JSON Schema`；收到第三方回复后，再“暗箱”翻译回 `tool_use` 结构返回给引擎。
- 原系统“以为”自己在和 Claude 对话，实则是 DeepSeek 在干活。

## 3. 开发规范约定

1. **不可修改核心层**：原则上不能为了 Web 需求修改 `QueryEngine.ts` 等核心库，除非是非常底层的 Bug。
2. **高内聚低耦合**：模块化划分，确保每次代码修改在可控上下文范围内。
3. **接口契约**：所有暴露给前端的 `/api` 都必须返回标准的 JSON，例如 `{ "ok": true, "data": ... }` 或 `{ "error": "..." }`。

## 4. 阶段 1 实施结案说明

第一阶段已经成功打通了上述刀片 1 和刀片 2 的基础设施：

1. **会话控制骨架建立**
   在 `src/server/session/WebChatSession.ts` 中封装了 `WebChatSession` 与 `SessionManager`，在其中直接实例化并挂载原生 `QueryEngine`，提供标准的 SSE (`subscribe`) 数据泵出接口。

2. **工具授权异步挂起落地**
   利用 `QueryEngine` 的 `canUseTool` 注入函数，通过 `Promise` 成功拦截了底层引擎向上的权限询问，并转换为向 Web 前端的流式事件 `approval_required` 推送。当前审批恢复不再依赖页面级 `sessionId` 模糊匹配，而是使用独立的 `approvalId` 进行精确恢复，`/api/chat/approve` 已按 `approvalId -> session -> pendingApproval` 的链路逆向唤醒。

3. **Hydration 基础版已闭环**
   前端当前会将活动 `sessionId` 保存在本地；页面刷新后，会主动请求 `/api/chat/sessions/:id` 恢复消息、状态与 `pendingApproval`，并在 `running / suspended_for_approval` 状态下自动重连 `/api/chat/stream/:sessionId`。这意味着挂起中的工具审批不会因为页面刷新而丢失。

4. **多轮上下文注入已从“只发最后一句”修正为“历史重建 + 当前 turn 提交”**
   `POST /api/chat` 现在提交的是完整历史消息；`WebChatSession` 会将除最后一条用户输入外的历史消息重建为 `QueryEngine` 的 `initialMessages`，并在每次提交前重建 engine，避免 `initialMessages` 仅在首次构造时生效导致的上下文漂移。

5. **第一阶段的降级边界已明确**
   当前阶段只保证 **纯文本历史** 的重建与恢复；如果未来 Web 前端引入 tool trace、thinking blocks、结构化内容块或多模态 message block，它们暂未在本阶段做完整语义回放。也就是说，本阶段解决的是“会话托管 / SSE / 审批挂起 / Hydration 基础设施”，不是完整消息语义镜像。

6. **临时兼容路径已标注**
   `chatRoutes.ts` 中的 `webhook bot` 仍保留 `callOpenAICompatibleModel` 作为兼容后门，这不是第二阶段的正式模型接入方式。阶段 2 必须从 `WebChatSession.initializeEngine()` 的模型客户端注入点进入，统一收敛 Provider Adapter，而不是继续扩散兼容 fetch 路径。

7. **保留了极度纯净的接力插槽**
   `WebChatSession` 在初始化 `QueryEngine` 时，所有的 `tools` 和核心对象都通过原生方法 (`getAllBaseTools()`) 收集，没有进行魔改，为第二阶段预留了最纯净的环境。

## 5. 阶段 2 实施结案说明 (Provider Adapter 落地)

第二阶段已成功完成，实现了完全非侵入式的 Provider Adapter 模式：

1. **核心原则守住**：完全没有修改 `QueryEngine.ts` 等底层代码。
2. **Factory 统一收口**：在 `src/providers/ModelAdapterFactory.ts` 与 `src/services/api/client.ts` 结合层做了全局拦截。当系统检测到用户设定了非 Anthropic provider（如 DeepSeek、OpenAI、Kimi 等）时，会自动返回一个被代理伪装过的 `OpenAIAdapter` 实例。
3. **彻底解决 Tool Call 碎片化**：
   - 实现了对 `beta.messages.create` 的伪装。
   - 上行拦截：在流式 SSE 解析中，自行维护了一个增量 tool calls 状态机，能把 OpenAI 风格的零碎 `arguments` 和 `id` 拼凑并按 Anthropic 标准逐一抛出 `content_block_start` / `input_json_delta` / `content_block_stop`。
   - 下行拦截：把发往大模型的 Anthropic prompt（包括 tools 结构）实时翻译为 OpenAI 标准形式。
4. **与阶段 1 完美闭环**：因为伪装层输出的事件格式极其标准，底层的 `QueryEngine` 会认为自己接到了正常的 Claude Tool Use，于是再次走到了 `canUseTool` 钩子，实现了**第三方大模型与第一阶段授权审批前端机制**的历史性会师。

### **👉 交接点：阶段定义统一与后续入口指示**

当前阶段定义统一如下：

- **Phase 1**：Session / SSE / Approval / Hydration 基础设施
- **Phase 2**：Provider Adapter 接入与工具调用主链路打通
- **Phase 3**：Adapter Hardening / Edge Cases 修复 / 真实 E2E 校验
- **Phase 4**：前端体验重构与交互增强

其中，**Phase 3 已不再是前端重构**，而是聚焦于 Adapter 鲁棒性增强，包括：
1. system prompt 中 XML 工具约束的补充保留与告警；
2. tool id -> tool name 的请求级映射管理；
3. 多模态内容块过滤与视觉能力降级；
4. 流式 tool call 与兼容 provider 边界问题修复。

需要特别说明的是：`unknown_tool` 目前仅作为**最后一道安全 fallback**，用于避免兼容接口因缺失合法工具名而直接报错；它不代表已经实现了跨所有 provider 的完全精准追溯。

**后续 Phase 4 的任务接手者需要做的是：**
将重心移向前端 `webui` 目录。
1. 在前端接收 `approval_required` 的 SSE 消息并渲染出一个美观的审批弹窗。
2. 点击确认或拒绝时，请求 `/api/chat/approve`。
3. 打通文件树和 MCP 侧边栏的状态更新。

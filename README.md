# 灵搭 · Lingda Workbench

> Turn a powerful terminal-native coding agent into a browser workbench people can actually use.

**灵搭** is a web-first adaptation of the Claude Code runtime.
If tools like **Cline** made AI coding agents more visible, Lingda pushes one step further: it tries to make them **operable, reviewable, recoverable, and easier to integrate into real engineering workflows**.

This project is built around a very practical idea:

- keep the execution power of a Claude Code–style agent runtime
- lower the usage threshold through a browser UI
- preserve human control with approval gates
- expose tools, MCP, memory, and multi-provider access in a more productized way

## Why this project matters

There is a gap between two kinds of AI dev tools:

1. **terminal-first agents** — powerful, but often too opaque or too hard to operate for non-expert users
2. **chat-style web UIs** — approachable, but too shallow to support real engineering workflows

Lingda is an attempt to bridge that gap.
It is not just “another chat page”. It is a browser workbench designed to keep the strengths of an agent runtime while making it more usable:

- **streaming sessions** instead of one-shot responses
- **approval-gated tool execution** instead of silent command running
- **session restore and hydration** instead of losing context on refresh
- **MCP configuration and management** instead of raw config files only
- **multi-provider model access** through a unified adapter layer
- **lightweight memory and context management** instead of full reset every turn

In short, this project is about turning a strong but terminal-centric AI agent into something closer to a real engineering product.

## What is inside

The current implementation is organized around these layers:

1. **Bootstrap compatibility layer**  
   Makes the original runtime work in a web/server context.

2. **Provider adapter layer**  
   Supports Anthropic plus OpenAI-compatible providers through adapter-based normalization.

3. **Session orchestration layer**  
   Web chat sessions, SSE streaming, tool approval, suspension/resume, and recovery.

4. **Frontend foundation layer**  
   API client, stream manager, shared stores, and modular React components.

5. **Memory and context layer**  
   Read-only memory snapshots, context building, diagnostics, and conservative write-back.

## Project goals

- Preserve the strengths of the original runtime
- Reduce operational complexity for end users
- Make tool use safer through explicit approval flows
- Expose core agent capabilities through a browser UI
- Keep the architecture layered and non-invasive

## Key capabilities currently included

### Agent interaction
- streaming responses over SSE
- session snapshots and restore
- approval-required tool execution
- safe resume after approval

### Tooling and extensions
- MCP configuration panel
- MCP presets for common servers
- file tree browsing and file preview
- project-oriented quick actions

### Provider support
- Anthropic
- OpenAI-compatible
- DeepSeek
- Ollama
- Kimi
- MiniMax
- custom compatible endpoints

## Memory and context

The project includes a lightweight memory pipeline:

- `MemoryStore` for reading structured memory buckets
- `ContextBuilder` for selecting and assembling prompt context
- `MemoryWriteback` for conservative daily-summary persistence
- `MemoryPromotion` for long-term promotion candidates and diagnostics

This is intentionally lightweight and explainable rather than vector-database based.

## Running locally

### Backend
```bash
npm install
npm run dev:server
```

Default backend port:
```text
http://127.0.0.1:3456
```

### Frontend
```bash
cd webui
npm install
npm run dev
```

Then open the Vite URL shown in the terminal.

## Current status

This repository is positioned as a working engineering prototype / research-grade implementation of a browser-based Claude Code workbench.

What is stable:
- core web session flow
- approval suspend/resume path
- provider adapter routing
- frontend workspace shell
- memory/context read pipeline

What is still evolving:
- broader provider productization
- richer MCP lifecycle management
- deeper diagnostics surfacing in UI
- further UX simplification for non-technical users

## Intended audience

This repository is most useful for:
- engineers exploring browser-based agent workbenches
- developers studying non-invasive runtime adaptation
- teams evaluating how to expose agent runtime capabilities safely in a GUI

## Notes

This `github-release/` directory is a cleaned packaging target prepared from a larger working directory. Temporary logs, local state, and obvious machine-specific artifacts have been excluded to make review and publication easier.

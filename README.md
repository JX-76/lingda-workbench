# Claude Code Web Workbench

A web-first adaptation of the Claude Code runtime, turning a terminal-centric coding agent into a browser-based engineering workspace.

## What this project is

This project takes the core Claude Code agent loop and wraps it with a web delivery layer so users can work through a browser instead of only through CLI flows. The focus is not just chat, but a usable agent workbench with:

- streaming chat sessions
- tool execution with approval gates
- session persistence and hydration
- MCP configuration and management
- multi-provider model access through an adapter layer
- lightweight memory and context management
- modular React-based front-end workspace

In practical terms, this is an attempt to productize a powerful agent runtime without rewriting its core execution engine.

## Project goals

- Preserve the strengths of the original runtime
- Reduce operational complexity for end users
- Make tool use safer through explicit approval flows
- Expose core agent capabilities through a browser UI
- Keep the architecture layered and non-invasive

## Core architecture

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

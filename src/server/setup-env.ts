import { createRequire } from 'module'
import { enableConfigs } from '../utils/config.js'

import path from 'path'
import { fileURLToPath } from 'url'

// 1. 注入 require 垫片以解决基于 Bun 源码中大量的懒加载 require() 在 Node.js ESM 下报错问题。
// 必须挂载到 globalThis，从而让所有模块在运行时都能访问到 `require`
// 注意：为了让相对路径的 require 能够按照调用方的路径正确解析，这里应该使用一个相对项目根目录的路径作为基准
// 但更简单的方式是代理 require 使其能解析基于 src 的相对路径
// 拦截原生的 import.meta.url 的 createRequire() 以免在各种层级中出错。
// 最安全的方法是统一提供一个基于绝对路径前缀自动补全逻辑的代理 require。
if (typeof globalThis.require === 'undefined') {
  const _require = createRequire(import.meta.url)
  
  globalThis.require = function (id: string) {
    // 处理 Claude Code 中那些隐式依赖相对路径的动态 require
    // 因为这通常是 `require('./tools/...')` 且实际上处于 `src/` 目录下调用
    if (id.startsWith('./') || id.startsWith('../')) {
      // 猜测它们要么相对 src 根目录，要么相对当前被调用的代码（不可控）
      // 由于 `src/tools.ts` 中 require('./tools/SendMessageTool/...') 会命中这里，
      // 我们用绝对路径替换试试：
      const possiblePath = path.resolve(process.cwd(), 'src', id.replace(/^\.\//, ''))
      try {
        return _require(possiblePath)
      } catch (e: any) {
        if (e.code === 'MODULE_NOT_FOUND') {
          try {
            return _require(id)
          } catch (e2) {
             throw e
          }
        }
        throw e
      }
    }
    
    // 如果不是相对路径，正常 fallback
    return _require(id)
  } as any
}

// 2. 解除 Config 访问限制。
// 原 CLI 在 `src/cli/index.ts` 中通过流程逐步解锁，而 Web 容器直接启动需要手动初始化。
enableConfigs()

// 3. 环境变量降级。
// 对于在 Web 环境中未定义、但在业务逻辑中直接取值的特殊变量进行安全兜底，
// 防止比如 advisor 内部直接访问 process.env 发生异常。
if (typeof process.env.NODE_ENV === 'undefined') {
  process.env.NODE_ENV = 'development'
}

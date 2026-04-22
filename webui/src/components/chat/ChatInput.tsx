import React, { useEffect, useMemo, useState } from 'react'
import { ArrowUp, Loader2, Command } from 'lucide-react'
import { AgentMode, ViewMode } from '../../store/uiStore'
import { useChatStore } from '../../store/chatStore'
import { useConfigStore } from '../../store/configStore'
import { useUiStore } from '../../store/uiStore'

const QUICK_ACTIONS = [
  {
    label: '✨ 分析当前项目结构',
    prompt: '请用树状图列出当前项目核心结构并做一句话架构总结',
    requiresApiKey: false,
  },
  {
    label: '🔍 寻找潜在报错',
    prompt: '请帮我搜索项目中最近修改的文件，看有没有明显的语法错误',
    requiresApiKey: false,
  },
  {
    label: '🛠️ 测试配置环境',
    prompt: '请检查当前环境配置是否完整，并告诉我下一步需要补什么配置',
    requiresApiKey: true,
  },
] as const

export default function ChatInput({
  disabled,
  mode,
  viewMode,
  onSend,
}: {
  disabled?: boolean
  mode: AgentMode
  viewMode: ViewMode
  onSend: (text: string) => Promise<void> | void
}) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [configTip, setConfigTip] = useState<string | null>(null)
  const pendingInjection = useChatStore(state => state.pendingInjection)
  const consumePendingInjection = useChatStore(state => state.consumePendingInjection)
  const settingsSnapshot = useConfigStore(state => state.settingsSnapshot)
  const setMode = useUiStore(state => state.setMode)
  const [showCommands, setShowCommands] = useState(false)

  const placeholder = useMemo(() => {
    if (viewMode === 'minimal') return '告诉我你的目标，我会自己规划步骤…'
    return '描述任务、粘贴代码，或要求我修改文件…'
  }, [viewMode])

  useEffect(() => {
    if (!pendingInjection) return
    setInput(prev => (prev ? `${prev}\n${pendingInjection}` : pendingInjection))
    consumePendingInjection()
  }, [consumePendingInjection, pendingInjection])

  const handleSubmit = async (customText?: string) => {
    const value = (customText ?? input).trim()
    if (!value || disabled || sending) return
    setSending(true)
    try {
      await onSend(value)
      if (!customText) {
        setInput('')
      }
      setConfigTip(null)
    } finally {
      setSending(false)
    }
  }

  const handleQuickAction = async (action: (typeof QUICK_ACTIONS)[number]) => {
    const hasApiKey = Boolean((settingsSnapshot?.apiKey as string | undefined)?.trim())
    if (action.requiresApiKey && !hasApiKey) {
      setConfigTip('请先在 Settings → API Configuration 中配置 API Key，再使用环境测试。')
      return
    }

    await handleSubmit(action.prompt)
  }

  return (
    <div className="px-6 py-4 md:px-10 dark:bg-[#0a0a0a]">
      {configTip && (
        <div className="mx-auto mb-3 max-w-4xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
          {configTip}
        </div>
      )}

      <div className="mx-auto max-w-4xl relative">
        {showCommands && (
          <div className="absolute bottom-[calc(100%+8px)] left-0 w-64 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-[#1a1a1a]">
            {QUICK_ACTIONS.map(action => (
              <button
                key={action.label}
                onClick={() => {
                  void handleQuickAction(action)
                  setShowCommands(false)
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Command size={14} />
                {action.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex min-h-[120px] flex-col rounded-xl border border-zinc-200 bg-white p-2 shadow-sm transition-colors focus-within:border-blue-500 dark:border-zinc-800 dark:bg-[#111]">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !showCommands) {
                event.preventDefault()
                void handleSubmit()
              }
            }}
            onInput={(e) => {
              const val = (e.target as HTMLTextAreaElement).value
              if (val === '/') setShowCommands(true)
              else setShowCommands(false)
            }}
            rows={1}
            placeholder={placeholder}
            className="flex-1 resize-none bg-transparent px-3 py-2 text-[15px] leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-600"
          />
          
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1 pl-2">
              <button
                onClick={() => setMode('act')}
                className={`rounded px-2.5 py-1 text-xs font-bold tracking-wider transition ${mode === 'act' ? 'bg-zinc-900 text-white dark:bg-zinc-700 dark:text-zinc-100' : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:bg-zinc-800'}`}
              >
                ACT
              </button>
              <button
                onClick={() => setMode('plan')}
                className={`rounded px-2.5 py-1 text-xs font-bold tracking-wider transition ${mode === 'plan' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:bg-zinc-800'}`}
              >
                PLAN
              </button>
            </div>
            
            <button
              onClick={() => void handleSubmit()}
              disabled={disabled || sending || !input.trim()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white shadow-sm transition hover:bg-black disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {sending || disabled ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={14} />}
            </button>
          </div>
        </div>
        
        <div className="mt-2 text-center text-[10px] text-zinc-400 dark:text-zinc-600">
          Type / for commands • ⌥ Enter for new line
        </div>
      </div>
    </div>
  )
}

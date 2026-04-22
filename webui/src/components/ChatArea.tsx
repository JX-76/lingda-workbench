import React, { useEffect, useState } from 'react'
import { Activity, Loader2, RefreshCw, ChevronLeft, ChevronRight, Wand2 } from 'lucide-react'
import { apiClient } from '../api/client'
import { useChatStream } from '../hooks/useChatStream'
import { useChatStore } from '../store/chatStore'
import { useConfigStore } from '../store/configStore'
import { useUiStore } from '../store/uiStore'
import ChatFeed from './chat/ChatFeed'
import ChatInput from './chat/ChatInput'
import MemoryDiagnosticsPanel from './chat/MemoryDiagnosticsPanel'

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

export default function ChatArea({
  onThinkingChange,
  onNavigate,
}: {
  onThinkingChange: (thinking: boolean) => void
  onNavigate: (tab: string) => void
}) {
  const messages = useChatStore(state => state.messages)
  const activeSessionId = useChatStore(state => state.activeSessionId)
  const pendingApproval = useChatStore(state => state.pendingApproval)
  const isStreaming = useChatStore(state => state.isStreaming)
  const streamStatus = useChatStore(state => state.streamStatus)
  const rehydrationStatus = useChatStore(state => state.rehydrationStatus)
  const sessionTokenUsage = useChatStore(state => state.sessionTokenUsage)
  const currentSessionSnapshot = useChatStore(state => state.currentSessionSnapshot)
  const setMessages = useChatStore(state => state.setMessages)
  const setPendingApproval = useChatStore(state => state.setPendingApproval)
  const setActiveTasks = useChatStore(state => state.setActiveTasks)
  const setIsStreaming = useChatStore(state => state.setIsStreaming)
  const setActiveSessionId = useChatStore(state => state.setActiveSessionId)
  const applySessionSnapshot = useChatStore(state => state.applySessionSnapshot)
  const setRehydrationStatus = useChatStore(state => state.setRehydrationStatus)

  const provider = useConfigStore(state => state.provider)
  const model = useConfigStore(state => state.model)
  const hydrateSettings = useConfigStore(state => state.hydrateSettings)

  const viewMode = useUiStore(state => state.viewMode)
  const mode = useUiStore(state => state.mode)
  const setViewMode = useUiStore(state => state.setViewMode)
  const setMode = useUiStore(state => state.setMode)
  const theme = useUiStore(state => state.theme)
  const isToolbarOpen = useUiStore(state => state.isToolbarOpen)
  const toggleToolbar = useUiStore(state => state.toggleToolbar)
  const settingsSnapshot = useConfigStore(state => state.settingsSnapshot)
  const useDifferentModels = Boolean(settingsSnapshot?.useDifferentModels)
  const planProvider = typeof settingsSnapshot?.planProvider === 'string' ? settingsSnapshot.planProvider : provider
  const actProvider = typeof settingsSnapshot?.actProvider === 'string' ? settingsSnapshot.actProvider : provider
  const planModel = typeof settingsSnapshot?.planModel === 'string' ? settingsSnapshot.planModel : model
  const actModel = typeof settingsSnapshot?.actModel === 'string' ? settingsSnapshot.actModel : model

  const { connect, disconnect } = useChatStream()
  const [loadingSessions, setLoadingSessions] = useState(false)

  useEffect(() => {
    const bootstrap = async () => {
      setRehydrationStatus('loading')
      try {
        const [sessions, settings, sessionData] = await Promise.all([
          apiClient.chat.getSessions(),
          apiClient.settings.get(),
          apiClient.chat.getSession(activeSessionId),
        ])
        setActiveTasks(sessions.sessions || [])
        hydrateSettings(settings)
        if (sessionData.session) {
          applySessionSnapshot(sessionData.session)
          if (sessionData.session.status === 'running' || sessionData.session.status === 'suspended_for_approval') {
            await connect(sessionData.session.id)
          }
        }
        setRehydrationStatus('success')
      } catch (error) {
        console.error('Failed to bootstrap chat area:', error)
        setRehydrationStatus('error')
      }
    }

    void bootstrap()
    return () => disconnect()
  }, [])

  const refreshSessions = async () => {
    try {
      setLoadingSessions(true)
      const data = await apiClient.chat.getSessions()
      setActiveTasks(data.sessions || [])
      window.dispatchEvent(new Event('sessions_updated'))
    } finally {
      setLoadingSessions(false)
    }
  }

  const handleQuickAction = async (action: (typeof QUICK_ACTIONS)[number]) => {
    const hasApiKey = Boolean((settingsSnapshot?.apiKey as string | undefined)?.trim())
    if (action.requiresApiKey && !hasApiKey) {
      alert('请先在 Settings → API Configuration 中配置 API Key，再使用环境测试。')
      return
    }
    if (isToolbarOpen) toggleToolbar()
    await handleSend(action.prompt)
  }

  const handleSend = async (text: string) => {
    if (!text.trim() || isStreaming) return
    const normalizedText = mode === 'plan' ? `请先给出计划，不要直接执行。\n\n用户请求：${text}` : text
    const newMessages = [...messages, { role: 'user' as const, content: `[${mode.toUpperCase()}] ${normalizedText}` }]
    setMessages([...newMessages, { role: 'assistant', content: '' }])
    setPendingApproval(null)
    useChatStore.getState().clearToolTraces()
    setIsStreaming(true)
    onThinkingChange(true)

    try {
      const effectiveProvider =
        mode === 'plan'
          ? (typeof settingsSnapshot?.planProvider === 'string' ? settingsSnapshot.planProvider : provider)
          : (typeof settingsSnapshot?.actProvider === 'string' ? settingsSnapshot.actProvider : provider)

      const effectiveModel =
        mode === 'plan'
          ? (typeof settingsSnapshot?.planModel === 'string' ? settingsSnapshot.planModel : model)
          : (typeof settingsSnapshot?.actModel === 'string' ? settingsSnapshot.actModel : model)

      const effectiveReasoningEffort =
        typeof settingsSnapshot?.reasoningEffort === 'string'
          ? settingsSnapshot.reasoningEffort
          : undefined

      const payload = await apiClient.chat.startSession(activeSessionId, newMessages, undefined, {
        mode,
        provider: effectiveProvider,
        model: effectiveModel,
        reasoningEffort: effectiveReasoningEffort as any,
      })
      const sessionId = payload?.data?.sessionId || activeSessionId
      setActiveSessionId(sessionId)
      await connect(sessionId)
      await refreshSessions()
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsStreaming(false)
      onThinkingChange(false)
    }
  }

  const handleApproval = async (approved: boolean) => {
    if (!pendingApproval) return
    try {
      await apiClient.chat.approve(pendingApproval.id, activeSessionId, approved)
      setPendingApproval(null)
      await refreshSessions()
    } catch (error) {
      console.error('Failed to submit approval:', error)
    }
  }

  return (
    <div className="flex h-full flex-col bg-[radial-gradient(circle_at_top,#fafafa,white_45%)] text-zinc-900 dark:bg-[radial-gradient(circle_at_top,#18181b,#09090b_45%)] dark:text-zinc-100">
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur md:px-10 dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-400 dark:text-zinc-500 flex items-center gap-4">
              <span>Meme Agent 工作台</span>
              {sessionTokenUsage && (
                <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded flex items-center gap-1.5 lowercase tracking-normal font-mono">
                  <span className="text-zinc-500 text-[10px]">in:</span> {Math.round(sessionTokenUsage.inputTokens).toLocaleString()}
                  <span className="text-zinc-500 text-[10px] ml-1">out:</span> {Math.round(sessionTokenUsage.outputTokens).toLocaleString()}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              <span className="text-sm font-normal text-zinc-500 mr-2">当前 Provider / 模型:</span>
              <span>{provider || 'unknown'} / {model || '尚未选择模型'}</span>
              {streamStatus === 'reconnecting' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                  <RefreshCw size={12} className="animate-spin" />
                  Reconnecting
                </span>
              )}
              {isStreaming && streamStatus === 'streaming' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                  <Loader2 size={12} className="animate-spin" />
                  Running
                </span>
              )}
            </div>
            {useDifferentModels && (
              <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Plan: {planProvider} / {planModel} · Act: {actProvider} / {actModel}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <ChatFeed
          messages={messages}
          pendingApproval={pendingApproval}
          isStreaming={isStreaming}
          onApprove={() => void handleApproval(true)}
          onReject={() => void handleApproval(false)}
        />
        <MemoryDiagnosticsPanel diagnostics={currentSessionSnapshot?.memoryDiagnostics} />
      </div>


      <ChatInput disabled={isStreaming} mode={mode} viewMode={viewMode} onSend={handleSend} />

      {/* Edge Toolbar */}
      <div 
        className={`fixed inset-y-0 right-0 z-50 flex items-center transition-transform duration-300 ease-out ${isToolbarOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <button
          onClick={toggleToolbar}
          className="absolute -left-6 flex h-16 w-6 items-center justify-center rounded-l-xl bg-zinc-900/10 text-zinc-500 opacity-30 backdrop-blur transition hover:bg-zinc-900/30 hover:opacity-100 hover:text-zinc-900 dark:bg-white/10 dark:text-zinc-400 dark:hover:bg-white/20 dark:hover:text-white"
        >
          {isToolbarOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        <div className="flex h-full w-64 flex-col border-l border-zinc-200 bg-white/95 p-4 shadow-2xl backdrop-blur-xl dark:border-zinc-800/50 dark:bg-[#111]/95">
          <div className="mb-6 mt-4 px-2">
            <h3 className="text-xs font-bold tracking-widest text-zinc-500 dark:text-zinc-400">快捷工具 (Tools)</h3>
          </div>

          <div className="flex flex-col gap-2">
            {QUICK_ACTIONS.map(action => (
              <button
                key={action.label}
                onClick={() => void handleQuickAction(action)}
                disabled={isStreaming}
                className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-left text-[13px] font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800/60 dark:bg-zinc-900/50 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <div className="flex shrink-0 items-center justify-center text-zinc-400 dark:text-zinc-500">
                  <Wand2 size={16} />
                </div>
                <span>{action.label}</span>
              </button>
            ))}
          </div>

          <div className="mb-4 mt-auto px-2">
            <div className="text-[10px] text-zinc-400 dark:text-zinc-600">Tip: 也可在输入框内输入 '/' 唤出</div>
          </div>
        </div>
      </div>
      
      {/* Invisible hover trigger area when closed */}
      {!isToolbarOpen && (
        <div 
          className="fixed inset-y-0 right-0 z-40 w-4 cursor-pointer"
          onMouseEnter={() => {
            // Optional: Auto open on hover (commented out to require click)
            // toggleToolbar()
          }}
        />
      )}
    </div>
  )
}

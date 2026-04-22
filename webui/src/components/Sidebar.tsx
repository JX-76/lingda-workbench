import React, { useEffect, useState } from 'react'
import { FolderTree, MessagesSquare, PanelRightClose, PanelRightOpen, Settings2 } from 'lucide-react'
import { apiClient } from '../api/client'
import { useChatStore } from '../store/chatStore'
import { useUiStore } from '../store/uiStore'
import SessionList from './sidebar/SessionList'
import MemeAgentLogo from './MemeAgentLogo'

import { Plug, Wrench, ListTodo, Plus } from 'lucide-react'

export default function Sidebar({
  activeTab,
  setActiveTab,
}: {
  activeTab: string
  setActiveTab: (tab: string) => void
}) {
  const activeSessionId = useChatStore(state => state.activeSessionId)
  const activeTasks = useChatStore(state => state.activeTasks)
  const applySessionSnapshot = useChatStore(state => state.applySessionSnapshot)
  const setActiveTasks = useChatStore(state => state.setActiveTasks)
  const [loading, setLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    const loadSessions = async () => {
      try {
        setLoading(true)
        const data = await apiClient.chat.getSessions()
        setActiveTasks(data.sessions || [])
      } catch (error) {
        console.error('Failed to load sessions:', error)
      } finally {
        setLoading(false)
      }
    }

    const handleSessionsUpdated = () => {
      void loadSessions()
    }

    void loadSessions()
    window.addEventListener('sessions_updated', handleSessionsUpdated)
    return () => window.removeEventListener('sessions_updated', handleSessionsUpdated)
  }, [setActiveTasks])

  const handleSelectSession = async (sessionId: string) => {
    try {
      const data = await apiClient.chat.getSession(sessionId)
      if (data.session) {
        applySessionSnapshot(data.session)
        setActiveTab('chat')
        setShowHistory(false)
      }
    } catch (error) {
      console.error('Failed to load session snapshot:', error)
    }
  }

  const NavItem = ({ tab, icon: Icon, title }: { tab: string; icon: any; title: string }) => {
    const isActive = activeTab === tab
    return (
      <div className="group relative flex items-center justify-center py-2">
        <button
          onClick={() => setActiveTab(tab)}
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${isActive ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-white' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-white'}`}
        >
          <Icon size={18} />
        </button>
        <div className="pointer-events-none absolute left-14 z-50 ml-2 w-max translate-x-1 whitespace-nowrap rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-all group-hover:translate-x-0 group-hover:opacity-100 dark:bg-white dark:text-zinc-900">
          {title}
        </div>
      </div>
    )
  }

  return (
    <>
      <aside className="fixed bottom-0 left-0 top-0 z-50 flex w-14 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#111] transition-colors">
        <div className="flex flex-col items-center py-4">
          <div className="group relative mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900">
              <MemeAgentLogo />
            </div>
            <div className="pointer-events-none absolute left-14 z-50 ml-2 w-max translate-x-1 whitespace-nowrap rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-all group-hover:translate-x-0 group-hover:opacity-100 dark:bg-white dark:text-zinc-900">
              Meme Agent
            </div>
          </div>

          <NavItem tab="chat" icon={MessagesSquare} title="对话 (Chat)" />
          <NavItem tab="mcp" icon={Plug} title="工具箱 (MCP)" />
          <NavItem tab="skills" icon={Wrench} title="自定义规则 (Skills)" />

          <div className="my-2 h-px w-8 bg-zinc-200 dark:bg-zinc-800" />
          
          <div className="group relative flex items-center justify-center py-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${showHistory ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-white' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-white'}`}
            >
              <ListTodo size={18} />
            </button>
            <div className="pointer-events-none absolute left-14 z-50 ml-2 w-max translate-x-1 whitespace-nowrap rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-all group-hover:translate-x-0 group-hover:opacity-100 dark:bg-white dark:text-zinc-900">
              历史会话 (History)
            </div>
          </div>
        </div>

        <div className="mt-auto flex flex-col items-center pb-4">
          <NavItem tab="settings" icon={Settings2} title="设置 (Settings)" />
        </div>
      </aside>

      {/* History Drawer */}
      <div
        className={`fixed bottom-0 left-14 top-0 z-40 flex w-[280px] transform flex-col border-r border-zinc-200 bg-[#fbfbfb] shadow-2xl transition-transform duration-300 ease-in-out dark:border-zinc-800 dark:bg-[#111] ${
          showHistory ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">历史记录</h2>
          <button
            onClick={() => setShowHistory(false)}
            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <PanelRightClose size={16} />
          </button>
        </div>
        <div className="px-4 pt-4">
          <button
            onClick={() => {
              const freshId = `web-${Date.now()}`
              useChatStore.getState().resetForNewSession(freshId)
              setActiveTab('chat')
              setShowHistory(false)
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-black dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            <Plus size={16} /> 新建对话
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <SessionList
            sessions={activeTasks}
            activeSessionId={activeSessionId}
            loading={loading}
            onSelect={handleSelectSession}
          />
        </div>
      </div>

      {showHistory && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm transition-opacity dark:bg-black/40"
          onClick={() => setShowHistory(false)}
        />
      )}
    </>
  )
}

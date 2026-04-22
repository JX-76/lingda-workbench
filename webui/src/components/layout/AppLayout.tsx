import React from 'react'
import Sidebar from '../Sidebar'
import FileTree from '../sidebar/FileTree'
import { useUiStore } from '../../store/uiStore'

interface AppLayoutProps {
  children: React.ReactNode
  activeTab: string
  setActiveTab: (tab: string) => void
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const { isFileTreeVisible, toggleFileTree, isSidebarOpen, toggleSidebar, theme } = useUiStore()

  // Apply dark mode class based on theme preference
  React.useEffect(() => {
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-zinc-900 font-sans transition-colors dark:bg-[#0a0a0a] dark:text-zinc-100">
      {/* Sidebar as Drawer */}
      {/* Static Left Icon Bar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="flex flex-1 overflow-hidden pl-14">
        <main className="relative flex min-w-0 flex-1 flex-col bg-white dark:bg-[#0a0a0a]">
          {children}
        </main>

        {/* Right Explorer - Now a floating drawer on the right when active */}
        {isFileTreeVisible && (
          <aside className="absolute bottom-0 right-0 top-0 z-40 flex w-[320px] flex-col border-l border-zinc-200 bg-[#fafafa] shadow-2xl transition-all duration-300 dark:border-zinc-800 dark:bg-[#111]">
            <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-[#111]">
              <h3 className="text-xs font-bold tracking-[0.18em] text-zinc-500 uppercase dark:text-zinc-400">文件树 (Explorer)</h3>
              <button
                onClick={toggleFileTree}
                className="rounded-lg p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                title="关闭文件树"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="relative flex-1 overflow-y-auto">
              <FileTree />
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

export default AppLayout

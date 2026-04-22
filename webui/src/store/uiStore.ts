import { create } from 'zustand'

export type ViewMode = 'minimal' | 'expert'
export type AgentMode = 'plan' | 'act'
export type ThemeMode = 'light' | 'dark' | 'system'

interface UiState {
  showConfig: boolean
  showMcp: boolean
  showTasks: boolean
  showPet: boolean
  isFileTreeVisible: boolean
  isSidebarOpen: boolean
  isToolbarOpen: boolean
  viewMode: ViewMode
  mode: AgentMode
  theme: ThemeMode
  toggleConfig: () => void
  toggleMcp: () => void
  toggleTasks: () => void
  togglePet: () => void
  toggleFileTree: () => void
  toggleSidebar: () => void
  toggleToolbar: () => void
  setViewMode: (viewMode: ViewMode) => void
  setMode: (mode: AgentMode) => void
  setTheme: (theme: ThemeMode) => void
}

export const useUiStore = create<UiState>((set) => ({
  showConfig: false,
  showMcp: false,
  showTasks: false,
  showPet: true,
  isFileTreeVisible: false,
  isSidebarOpen: false,
  isToolbarOpen: false,
  viewMode: 'expert',
  mode: 'act',
  theme: 'dark',
  toggleConfig: () => set((state) => ({ showConfig: !state.showConfig })),
  toggleMcp: () => set((state) => ({ showMcp: !state.showMcp })),
  toggleTasks: () => set((state) => ({ showTasks: !state.showTasks })),
  togglePet: () => set((state) => ({ showPet: !state.showPet })),
  toggleFileTree: () => set((state) => ({ isFileTreeVisible: !state.isFileTreeVisible })),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  toggleToolbar: () => set((state) => ({ isToolbarOpen: !state.isToolbarOpen })),
  setViewMode: (viewMode) => set({ viewMode }),
  setMode: (mode) => set({ mode }),
  setTheme: (theme) => set({ theme }),
}))

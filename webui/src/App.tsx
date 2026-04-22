import React, { useState } from 'react'
import ChatArea from './components/ChatArea'
import EditorArea from './components/EditorArea'
import McpPanel from './components/McpPanel'
import SettingsPanel from './components/SettingsPanel'
import SkillsPanel from './components/SkillsPanel'
import TaskTracker from './components/TaskTracker'
import AppLayout from './components/layout/AppLayout'

export function App() {
  const [activeTab, setActiveTab] = useState('chat')

  return (
    <AppLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'chat' && <ChatArea onThinkingChange={() => {}} onNavigate={setActiveTab} />}
      {activeTab === 'editor' && <EditorArea />}
      {activeTab === 'settings' && <SettingsPanel onClose={() => setActiveTab('chat')} />}
      {activeTab === 'mcp' && <McpPanel onClose={() => setActiveTab('chat')} />}
      {activeTab === 'skills' && <SkillsPanel onClose={() => setActiveTab('chat')} />}
      {activeTab === 'tasks' && <TaskTracker onClose={() => setActiveTab('chat')} />}
    </AppLayout>
  )
}

import React, { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { FiFolder, FiFile, FiRefreshCw } from 'react-icons/fi'

type FsNode = { name: string; path: string; type: 'file' | 'directory'; children?: FsNode[] }

export default function EditorArea() {
  const [tree, setTree] = useState<FsNode[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('// Select a file from the left panel to start editing')
  const [loading, setLoading] = useState(false)
  const [terminalVisible, setTerminalVisible] = useState(false)
  const [terminalSession, setTerminalSession] = useState<string | null>(null)
  const [terminalOutput, setTerminalOutput] = useState<string[]>([])
  const [cmdInput, setCmdInput] = useState('')
  const [uiError, setUiError] = useState<string | null>(null)
  const terminalEndRef = React.useRef<HTMLDivElement>(null)

  const loadTree = () => {
    fetch('/api/fs/tree')
      .then(r => r.json())
      .then(d => setTree(d.tree || []))
      .catch((e: any) => setUiError(e?.message || '加载文件树失败'))
  }

  useEffect(() => {
    loadTree()
  }, [])

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'auto' })
    }
  }, [terminalOutput])

  const handleStartCommand = async () => {
    if (!cmdInput.trim()) return
    const cmd = cmdInput
    setCmdInput('')
    setTerminalOutput(prev => [...prev, `\n$ ${cmd}\n`])
    
    try {
      const res = await fetch('/api/terminal/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
      })
      const data = await res.json()
      if (data.sessionId) {
        setTerminalSession(data.sessionId)
        
        const es = new EventSource(`/api/terminal/stream/${data.sessionId}`)
        es.onmessage = (e) => {
          const ev = JSON.parse(e.data)
          if (ev.type === 'output') {
            setTerminalOutput(prev => [...prev, ev.chunk])
          } else if (ev.type === 'exit') {
            setTerminalOutput(prev => [...prev, `\n[Process exited with code ${ev.code}${ev.killed ? ' (killed)' : ''}]\n`])
            setTerminalSession(null)
            es.close()
          }
        }
        es.onerror = () => {
          es.close()
          setTerminalSession(null)
        }
      }
    } catch (e: any) {
      setUiError(e?.message || '终端启动失败')
      setTerminalOutput(prev => [...prev, `Error: ${e.message}\n`])
    }
  }

  const handleKillCommand = () => {
    if (terminalSession) {
      fetch(`/api/terminal/kill/${terminalSession}`, { method: 'POST' })
    }
  }

  const handleSelectFile = (path: string) => {
    setLoading(true)
    fetch(`/api/fs/file?path=${encodeURIComponent(path)}`)
      .then(r => r.json())
      .then(d => {
        setActiveFile(path)
        setFileContent(d.content || '')
        setLoading(false)
      })
      .catch((e: any) => {
        setUiError(e?.message || '读取文件失败')
        setLoading(false)
      })
  }

  const handleSaveFile = () => {
    if (!activeFile) return
    fetch('/api/fs/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: activeFile, content: fileContent })
    }).catch((e: any) => setUiError(e?.message || '保存文件失败'))
  }

  const renderTree = (nodes: FsNode[]) => {
    return (
      <div className="pl-2 space-y-1">
        {nodes.map(n => (
          <div key={n.path} className="text-sm">
            {n.type === 'directory' ? (
              <div className="flex items-center space-x-2 text-[#cccccc] py-1">
                <FiFolder className="text-[#dcb67a]" /> <span>{n.name}</span>
              </div>
            ) : (
              <div 
                className={`flex items-center space-x-2 py-1 px-2 cursor-pointer hover:bg-[#2a2d2e] rounded ${activeFile === n.path ? 'bg-[#37373d] text-white' : 'text-[#cccccc]'}`}
                onClick={() => handleSelectFile(n.path)}
              >
                <FiFile className="text-[#858585]" /> <span>{n.name}</span>
              </div>
            )}
            {n.children && renderTree(n.children)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex h-full bg-[#1e1e1e]">
      <div className="w-64 border-r border-[#333333] bg-[#252526] flex flex-col h-full">
        <div className="p-3 border-b border-[#333333] flex justify-between items-center shrink-0">
          <span className="text-xs font-bold uppercase tracking-wider text-[#858585]">Explorer</span>
          <button onClick={loadTree} className="text-[#858585] hover:text-[#cccccc]"><FiRefreshCw size={14} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {renderTree(tree)}
        </div>
      </div>
      
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-10 bg-[#1e1e1e] border-b border-[#333333] flex items-center px-4 shrink-0 space-x-2 justify-between">
          <div className="flex items-center">
            {activeFile ? (
              <div className="text-[#cccccc] text-sm px-4 py-2 bg-[#1e1e1e] border-t-2 border-[#007acc]">
                {activeFile.split('/').pop()}
              </div>
            ) : (
              <div className="text-[#858585] text-sm px-4 py-2">No file opened</div>
            )}
          </div>
          {activeFile && (
            <button onClick={handleSaveFile} className="bg-[#0e639c] hover:bg-[#1177bb] text-white text-xs px-3 py-1 rounded">Save (Ctrl+S)</button>
          )}
        </div>
        <div className="flex-1 relative flex flex-col">
          <div className="flex-1 relative">
            {loading && <div className="absolute inset-0 bg-[#1e1e1e]/50 z-10 flex items-center justify-center text-white">Loading...</div>}
            {uiError && <div className="absolute right-4 top-4 z-10 rounded border border-red-800 bg-red-900/80 px-3 py-2 text-xs text-red-200">{uiError}</div>}
            <Editor
              height="100%"
              theme="vs-dark"
              value={fileContent}
              onChange={val => setFileContent(val || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                padding: { top: 16 }
              }}
            />
          </div>
          
          <div className={`border-t border-[#333333] bg-[#1e1e1e] flex flex-col transition-all duration-300 ${terminalVisible ? 'h-64' : 'h-8'}`}>
            <div 
              className="h-8 shrink-0 flex items-center justify-between px-4 cursor-pointer hover:bg-[#252526] select-none"
              onClick={() => setTerminalVisible(!terminalVisible)}
            >
              <div className="text-xs font-bold uppercase tracking-wider text-[#858585] flex items-center space-x-2">
                <span>TERMINAL</span>
                {terminalSession && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>}
              </div>
              <div className="text-[#858585]">{terminalVisible ? '▼' : '▲'}</div>
            </div>
            
            {terminalVisible && (
              <div className="flex-1 flex flex-col p-2 min-h-0">
                <div className="flex-1 overflow-y-auto font-mono text-sm text-[#cccccc] whitespace-pre-wrap break-all p-2 bg-[#090b10] border border-[#333333] rounded">
                  {terminalOutput.length === 0 ? <span className="text-[#858585]">Welcome to Claude local terminal...</span> : terminalOutput.join('')}
                  <div ref={terminalEndRef} />
                </div>
                <div className="mt-2 flex items-center space-x-2 shrink-0">
                  <span className="text-[#007acc] font-bold">$</span>
                  <input
                    type="text"
                    value={cmdInput}
                    onChange={e => setCmdInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleStartCommand()}
                    disabled={!!terminalSession}
                    className="flex-1 bg-transparent border border-[#333333] rounded px-3 py-1 text-[#cccccc] focus:outline-none focus:border-[#007acc] disabled:opacity-50"
                    placeholder={terminalSession ? "Command running..." : "Enter shell command..."}
                  />
                  <button onClick={() => setTerminalOutput([])} className="bg-[#252526] hover:bg-[#2d2d2d] text-[#cccccc] border border-[#333333] px-3 py-1 rounded text-sm transition-colors">
                    Clear
                  </button>
                  {terminalSession && (
                    <button onClick={handleKillCommand} className="bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800 px-3 py-1 rounded text-sm transition-colors">
                      Kill
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

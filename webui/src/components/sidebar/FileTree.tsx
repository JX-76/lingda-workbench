import React, { useEffect, useMemo, useState } from 'react'
import { ChevronRight, FileCode2, FileJson2, FileText, Folder, FolderOpen, ImageIcon, X, Wand2 } from 'lucide-react'
import { apiClient, FsTreeNode } from '../../api/client'
import { useChatStore } from '../../store/chatStore'

export const FileTree: React.FC = () => {
  const [tree, setTree] = useState<FsTreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string } | null>(null)

  useEffect(() => {
    const loadTree = async () => {
      try {
        setLoading(true)
        const data = await apiClient.fs.getTree()
        setTree(data.tree || [])
      } catch (error) {
        console.error('Failed to fetch file tree:', error)
      } finally {
        setLoading(false)
      }
    }

    void loadTree()
  }, [])

  const content = useMemo(() => {
    if (loading) {
      return <div className="p-4 text-xs text-zinc-500 dark:text-zinc-400">Loading workspace…</div>
    }

    if (tree.length === 0) {
      return <div className="p-4 text-xs text-zinc-500 dark:text-zinc-400">Workspace is empty.</div>
    }

    return tree.map(node => <TreeNode key={node.path} node={node} depth={0} onOpenFile={setSelectedFile} />)
  }, [loading, tree])

  return (
    <>
      <div className="p-2 text-[13px] text-zinc-800 dark:text-zinc-200">{content}</div>
      {selectedFile && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="flex h-[70vh] w-[90%] max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <div className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{selectedFile.path}</div>
              <button
                onClick={() => setSelectedFile(null)}
                className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X size={16} />
              </button>
            </div>
            <pre className="flex-1 overflow-auto bg-zinc-950 p-4 text-xs text-zinc-100 dark:bg-black">{selectedFile.content}</pre>
          </div>
        </div>
      )}
    </>
  )
}

const TreeNode: React.FC<{
  node: FsTreeNode
  depth: number
  onOpenFile: (file: { path: string; content: string }) => void
}> = ({ node, depth, onOpenFile }) => {
  const [expanded, setExpanded] = useState(depth < 1)
  const isDir = node.type === 'directory'
  const setPendingInjection = useChatStore(state => state.setPendingInjection)

  const getFileIcon = () => {
    if (isDir) {
      return expanded ? <FolderOpen size={16} className="text-sky-500" /> : <Folder size={16} className="text-sky-500" />
    }
    const ext = node.name.split('.').pop()?.toLowerCase()
    if (['ts', 'tsx', 'js', 'jsx'].includes(ext || '')) return <FileCode2 size={16} className="text-amber-500" />
    if (['json', 'yml', 'yaml'].includes(ext || '')) return <FileJson2 size={16} className="text-emerald-500" />
    if (['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp'].includes(ext || '')) return <ImageIcon size={16} className="text-fuchsia-500" />
    return <FileText size={16} className="text-zinc-500 dark:text-zinc-400" />
  }

  const handleClick = async () => {
    if (isDir) {
      setExpanded(current => !current)
      return
    }

    try {
      const data = await apiClient.fs.readFile(node.path)
      onOpenFile({ path: node.path, content: data.content })
    } catch (error) {
      console.error('Failed to read file:', error)
    }
  }

  const injectPrompt = (e: React.MouseEvent, type: 'explain' | 'refactor') => {
    e.stopPropagation()
    const prompt = type === 'explain' 
      ? `请解释这个文件的作用：${node.path}` 
      : `请帮我重构 ${node.path}，提升可读性并说明改进点`
    setPendingInjection(prompt)
  }

  return (
    <div>
      <div
        className="group relative flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        <button
          onClick={() => void handleClick()}
          className="flex flex-1 items-center gap-2 truncate text-left"
        >
          <span className="flex h-4 w-4 items-center justify-center text-zinc-400 dark:text-zinc-500">
            {isDir ? <ChevronRight size={14} className={`transition ${expanded ? 'rotate-90' : ''}`} /> : null}
          </span>
          {getFileIcon()}
          <span className="truncate">{node.name}</span>
        </button>

        {!isDir && (
          <div className="absolute right-2 hidden items-center gap-1 group-hover:flex">
            <button
              onClick={(e) => injectPrompt(e, 'explain')}
              className="rounded bg-white p-1 text-zinc-500 shadow-sm transition hover:text-zinc-900 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100"
              title="解释此文件"
            >
              <Wand2 size={12} />
            </button>
            <button
              onClick={(e) => injectPrompt(e, 'refactor')}
              className="rounded bg-white p-1 text-zinc-500 shadow-sm transition hover:text-zinc-900 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100"
              title="重构此文件"
            >
              <FileCode2 size={12} />
            </button>
          </div>
        )}
      </div>
      {isDir && expanded && node.children?.map(child => (
        <TreeNode key={child.path} node={child} depth={depth + 1} onOpenFile={onOpenFile} />
      ))}
    </div>
  )
}

export default FileTree

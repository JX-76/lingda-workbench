import React, { useState, useEffect } from 'react'
import { FiCircle, FiCheckCircle, FiTrash2, FiPlus } from 'react-icons/fi'

type Task = {
  id: string
  text: string
  completed: boolean
}

export default function TaskTracker({ onClose }: { onClose: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTask, setNewTask] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/tasks')
      .then(r => r.json())
      .then(data => {
        if (data.tasks && data.tasks.length > 0) {
          setTasks(data.tasks)
        } else {
          setTasks([
            { id: '1', text: 'Analyze requirements', completed: true },
            { id: '2', text: 'Set up necessary files', completed: true },
            { id: '3', text: 'Implement main functionality', completed: false },
            { id: '4', text: 'Handle edge cases', completed: false },
          ])
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const saveTasks = (newTasks: Task[]) => {
    setTasks(newTasks)
    fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: newTasks })
    })
    window.dispatchEvent(new Event('tasks_updated'))
  }

  const toggleTask = (id: string) => {
    saveTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
  }

  const addTask = () => {
    if (!newTask.trim()) return
    saveTasks([...tasks, { id: Date.now().toString(), text: newTask.trim(), completed: false }])
    setNewTask('')
  }

  const deleteTask = (id: string) => {
    saveTasks(tasks.filter(t => t.id !== id))
  }

  const completedCount = tasks.filter(t => t.completed).length

  if (loading) return <div className="p-8 text-gray-400">Loading Tasks...</div>

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-[#cccccc]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#333333] shrink-0">
        <div>
          <h2 className="text-2xl font-semibold text-[#ffffff]">Task Tracker</h2>
          <p className="text-sm text-[#858585] mt-1">{completedCount} / {tasks.length} completed</p>
        </div>
        <button onClick={onClose} className="bg-[#37373d] hover:bg-[#4d4d53] text-white px-4 py-1.5 rounded text-sm font-medium">Back to Chat</button>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto">
          {/* Progress Bar */}
          <div className="w-full h-2 bg-[#333333] rounded-full mb-8 overflow-hidden">
            <div 
              className="h-full bg-[#007acc] transition-all duration-300" 
              style={{ width: tasks.length ? `${(completedCount / tasks.length) * 100}%` : '0%' }}
            ></div>
          </div>

          <div className="space-y-2 mb-8">
            {tasks.map((task, i) => (
              <div 
                key={task.id} 
                className="flex items-center justify-between group p-3 bg-[#252526] hover:bg-[#2d2d2d] rounded-lg border border-transparent hover:border-[#3c3c3c] transition-colors"
              >
                <div className="flex items-center space-x-3 cursor-pointer flex-1" onClick={() => toggleTask(task.id)}>
                  {task.completed ? (
                    <FiCheckCircle className="text-[#007acc] shrink-0" size={20} />
                  ) : (
                    <FiCircle className="text-[#858585] shrink-0" size={20} />
                  )}
                  <span className={`text-base select-none ${task.completed ? 'text-[#858585] line-through' : 'text-[#cccccc]'}`}>
                    <span className="text-[#858585] mr-2 text-sm">{i + 1}/</span> {task.text}
                  </span>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                  className="opacity-0 group-hover:opacity-100 text-[#858585] hover:text-red-400 p-1"
                >
                  <FiTrash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          {/* Add New Task */}
          <div className="flex items-center bg-[#252526] border border-[#3c3c3c] rounded-lg p-2 focus-within:border-[#007acc]">
            <input 
              type="text" 
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTask()}
              placeholder="Add a new task..."
              className="flex-1 bg-transparent border-none outline-none text-[#cccccc] px-3 py-1"
            />
            <button 
              onClick={addTask}
              disabled={!newTask.trim()}
              className="bg-[#007acc] hover:bg-[#006bb3] disabled:bg-[#333333] disabled:text-[#858585] text-white p-2 rounded"
            >
              <FiPlus size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

import React, { useEffect, useMemo, useState } from 'react'
import { apiClient, SkillFile } from '../api/client'
import { Plus, Save, Trash2 } from 'lucide-react'

type SkillFormState = {
  id: string
  name: string
  trigger: string
  rule: string
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildSkillContent(form: SkillFormState) {
  return `---
name: ${form.name || 'New Rule'}
description: 当满足「${form.trigger || '自定义条件'}」时，执行「${form.rule || '自定义规则'}」
---

# Rule
当${form.trigger || '用户触发指定场景'}时，请遵循以下规则：
${form.rule || '请在此填写规则内容。'}
`
}

function parseSkillContent(skill: SkillFile): SkillFormState {
  const lines = skill.content.split('\n')
  const nameLine = lines.find(line => line.startsWith('name:'))
  const descriptionLine = lines.find(line => line.startsWith('description:'))
  const ruleStart = lines.findIndex(line => line.trim() === '# Rule')
  const name = nameLine?.replace('name:', '').trim() || skill.name
  const description = descriptionLine?.replace('description:', '').trim() || ''
  const triggerMatch = description.match(/当满足「(.+)」时/)
  const ruleMatch = description.match(/执行「(.+)」/)
  const rule = ruleStart >= 0 ? lines.slice(ruleStart + 2).join('\n').trim() : skill.content

  return {
    id: skill.id,
    name,
    trigger: triggerMatch?.[1] || '我提出这类问题时',
    rule: ruleMatch?.[1] || rule,
  }
}

export default function SkillsPanel({ onClose }: { onClose: () => void }) {
  const [skills, setSkills] = useState<SkillFile[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null)
  const [form, setForm] = useState<SkillFormState>({ id: '', name: '', trigger: '', rule: '' })
  const [status, setStatus] = useState<string | null>(null)

  const fetchSkills = () => {
    apiClient.skills
      .list()
      .then(data => {
        setSkills(data.skills || [])
        if (data.skills?.length > 0 && !activeSkillId) {
          const first = data.skills[0]
          setActiveSkillId(first.id)
          setForm(parseSkillContent(first))
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchSkills()
  }, [])

  const handleSelectSkill = (skill: SkillFile) => {
    setActiveSkillId(skill.id)
    setForm(parseSkillContent(skill))
    setStatus(null)
  }

  const handleCreateNew = () => {
    const id = `rule-${Date.now()}.md`
    setActiveSkillId(id)
    setForm({
      id,
      name: '新规则',
      trigger: '当我问前端代码时',
      rule: '始终优先使用 React Hooks，并给出简短解释。',
    })
    setStatus(null)
  }

  const preview = useMemo(() => buildSkillContent(form), [form])

  const handleSave = async () => {
    const name = form.name.trim() || '新规则'
    const skillId = form.id || `${slugify(name) || `rule-${Date.now()}`}.md`
    const nextForm = { ...form, id: skillId, name }

    await apiClient.skills.save(skillId, buildSkillContent(nextForm))
    setActiveSkillId(skillId)
    setForm(nextForm)
    setStatus('规则已保存')
    fetchSkills()
  }

  const handleDelete = async () => {
    if (!activeSkillId) return
    if (!confirm('Delete this rule?')) return
    await apiClient.skills.remove(activeSkillId)
    setActiveSkillId(null)
    setForm({ id: '', name: '', trigger: '', rule: '' })
    setStatus('规则已删除')
    fetchSkills()
  }

  if (loading) return <div className="p-8 text-gray-400 dark:bg-zinc-950">Loading Rules & Workflows...</div>

  return (
    <div className="flex h-full flex-col bg-[#f3f4f6] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-200">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-semibold">Rules & Workflows</h2>
          <button onClick={handleCreateNew} className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-white dark:text-zinc-900">
            <Plus size={16} /> 添加新规则
          </button>
        </div>
        <div className="flex space-x-2">
          {activeSkillId && (
            <>
              <button onClick={handleDelete} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-500 dark:border-red-900/60">
                <Trash2 size={16} /> 删除
              </button>
              <button onClick={() => void handleSave()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
                <Save size={16} /> 保存
              </button>
            </>
          )}
          <button onClick={onClose} className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">Back</button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60">
          {skills.map(skill => (
            <button
              key={skill.id}
              onClick={() => handleSelectSkill(skill)}
              className={`w-full border-l-2 px-4 py-3 text-left ${activeSkillId === skill.id ? 'border-blue-500 bg-blue-50 text-zinc-900 dark:bg-blue-950/30 dark:text-zinc-100' : 'border-transparent text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60'}`}
            >
              <div className="font-medium">{skill.name}</div>
              <div className="mt-1 truncate text-xs text-zinc-400">{skill.id}</div>
            </button>
          ))}
          {skills.length === 0 && <div className="p-4 text-sm text-zinc-400">No rules found yet.</div>}
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-5 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">规则名称</label>
                <input
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950"
                  placeholder="比如：前端代码规则"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">触发条件</label>
                <textarea
                  value={form.trigger}
                  onChange={e => setForm(prev => ({ ...prev, trigger: e.target.value }))}
                  className="min-h-[120px] w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950"
                  placeholder="比如：当我问前端代码时"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">执行规则</label>
                <textarea
                  value={form.rule}
                  onChange={e => setForm(prev => ({ ...prev, rule: e.target.value }))}
                  className="min-h-[160px] w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950"
                  placeholder="比如：始终使用 React Hooks，并顺带指出可能的性能问题。"
                />
              </div>

              {status && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">{status}</div>}
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">系统会自动生成的规则内容</div>
              <pre className="min-h-[420px] whitespace-pre-wrap rounded-2xl bg-zinc-950 p-4 text-sm text-zinc-100">{preview}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

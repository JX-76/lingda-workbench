import { Router } from 'express'
import fs from 'fs'
import path from 'path'

export const skillsRouter = Router()

function getSkillsDir() {
  return path.join(process.env.HOME || '', '.claude', 'skills')
}

skillsRouter.get('/', (_req, res) => {
  const skillsDir = getSkillsDir()
  try {
    if (!fs.existsSync(skillsDir)) return res.json({ skills: [] })
    const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.md'))
    const skills = files.map(f => ({
      id: f,
      name: f.replace('.md', ''),
      content: fs.readFileSync(path.join(skillsDir, f), 'utf-8')
    }))
    res.json({ skills })
  } catch {
    res.json({ skills: [] })
  }
})

skillsRouter.post('/', (req, res) => {
  const skillsDir = getSkillsDir()
  try {
    if (!fs.existsSync(skillsDir)) fs.mkdirSync(skillsDir, { recursive: true })
    const { id, content } = req.body
    if (!id || !content) return res.status(400).json({ error: 'Missing id or content' })
    const filePath = path.join(skillsDir, id.endsWith('.md') ? id : `${id}.md`)
    fs.writeFileSync(filePath, content, 'utf-8')
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

skillsRouter.delete('/:id', (req, res) => {
  const skillsDir = getSkillsDir()
  try {
    const id = req.params.id
    const filePath = path.join(skillsDir, id.endsWith('.md') ? id : `${id}.md`)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

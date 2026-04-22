import { Router } from 'express'
import fs from 'fs'
import path from 'path'

export const fsRouter = Router()

fsRouter.get('/tree', (req, res) => {
  const root = (req.query.path as string) || process.cwd()
  try {
    const getTree = (dir: string): any[] =>
      fs.readdirSync(dir)
        .map(file => {
          const full = path.join(dir, file)
          const stat = fs.statSync(full)
          const isDir = stat.isDirectory()
          if (file === 'node_modules' || file === '.git') return null
          return {
            name: file,
            path: full,
            type: isDir ? 'directory' : 'file',
            children: isDir ? [] : undefined,
          }
        })
        .filter(Boolean) as any[]
    res.json({ tree: getTree(root) })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

fsRouter.get('/file', (req, res) => {
  const filePath = req.query.path as string
  if (!filePath) return res.status(400).json({ error: 'path required' })
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    res.json({ content })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

fsRouter.post('/file', (req, res) => {
  const filePath = req.body?.path as string
  const content = req.body?.content
  if (!filePath) return res.status(400).json({ error: 'path required' })
  try {
    fs.writeFileSync(filePath, String(content ?? ''), 'utf-8')
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

fsRouter.post('/create-folder', (req, res) => {
  const { path: dirPath } = req.body
  if (!dirPath) return res.status(400).json({ error: 'path required' })
  try {
    const fullPath = path.isAbsolute(dirPath) ? dirPath : path.join(process.cwd(), dirPath)
    fs.mkdirSync(fullPath, { recursive: true })
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

fsRouter.post('/create-file', (req, res) => {
  const { path: filePath } = req.body
  if (!filePath) return res.status(400).json({ error: 'path required' })
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath)
    const dir = path.dirname(fullPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    if (!fs.existsSync(fullPath)) fs.writeFileSync(fullPath, '', 'utf-8')
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

import fs from 'fs'
import path from 'path'
import { getMemoryPaths } from './timeBuckets.js'

export type MemorySnapshot = {
  morning?: string
  afternoon?: string
  dailySummary?: string
  longtermProject?: string
  longtermUser?: string
}

export function getMemorySnapshot(args: {
  cwd: string
  now?: Date
  sessionId?: string
}): MemorySnapshot {
  const memoryRoot = path.join(args.cwd, '.claude-memory')
  const memoryPaths = getMemoryPaths(memoryRoot, args.now)

  return {
    morning: readOptionalFile(memoryPaths.morning),
    afternoon: readOptionalFile(memoryPaths.afternoon),
    dailySummary: readOptionalFile(memoryPaths.dailySummary),
    longtermProject: readOptionalFile(memoryPaths.longtermProject),
    longtermUser: readOptionalFile(memoryPaths.longtermUser),
  }
}

function readOptionalFile(filePath: string): string | undefined {
  try {
    if (!fs.existsSync(filePath)) {
      return undefined
    }

    const content = fs.readFileSync(filePath, 'utf-8').trim()
    return content || undefined
  } catch {
    return undefined
  }
}

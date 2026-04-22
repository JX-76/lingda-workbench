export type MemoryBucket = 'morning' | 'afternoon' | 'daily-summary' | 'longterm-project' | 'longterm-user'

export function getTimeBucket(date = new Date()): MemoryBucket {
  const hour = date.getHours()
  if (hour < 12) return 'morning'
  return 'afternoon'
}

export function getMemoryPaths(baseDir: string, date = new Date()) {
  const day = date.toISOString().slice(0, 10)
  return {
    morning: `${baseDir}/daily/${day}/morning.md`,
    afternoon: `${baseDir}/daily/${day}/afternoon.md`,
    dailySummary: `${baseDir}/daily/${day}/summary.md`,
    longtermProject: `${baseDir}/longterm/project.md`,
    longtermUser: `${baseDir}/longterm/user.md`,
  }
}

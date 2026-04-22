import fs from 'fs'
import path from 'path'
import { AsyncLocalStorage } from 'node:async_hooks'

export const SETTINGS_FILE = path.join(process.cwd(), '.claude-memory', 'settings.json')

export type AppSettings = {
  provider: string
  model: string
  apiKey: string
  baseUrl: string
  reasoningEffort: 'low' | 'medium' | 'high'
  useDifferentModels: boolean
  planModel: string
  actModel: string
  planProvider: string
  actProvider: string
  providerOptions: Record<string, Record<string, string | boolean | undefined>>
  qqId: string
  qqSecret: string
  undercoverMode: boolean
  fastMode: boolean
  debugMode: boolean
  companionMuted: boolean
}

const runtimeSettingsOverrideStorage = new AsyncLocalStorage<Partial<AppSettings>>()

export const DEFAULT_SETTINGS: AppSettings = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  apiKey: '',
  baseUrl: '',
  reasoningEffort: 'medium',
  useDifferentModels: false,
  planModel: 'claude-sonnet-4-6',
  actModel: 'claude-sonnet-4-6',
  planProvider: 'anthropic',
  actProvider: 'anthropic',
  providerOptions: {},
  qqId: '',
  qqSecret: '',
  undercoverMode: false,
  fastMode: false,
  debugMode: false,
  companionMuted: false,
}

function normalizeSettings(raw?: Partial<AppSettings>): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    providerOptions:
      raw && typeof raw.providerOptions === 'object' && raw.providerOptions !== null
        ? raw.providerOptions
        : DEFAULT_SETTINGS.providerOptions,
  }
}

export function readSettings(): AppSettings {
  const runtimeOverride = runtimeSettingsOverrideStorage.getStore() || {}

  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'))
      return normalizeSettings({
        ...raw,
        ...runtimeOverride,
        providerOptions:
          runtimeOverride.providerOptions
          || (raw && typeof raw.providerOptions === 'object' && raw.providerOptions !== null
            ? raw.providerOptions
            : {}),
      })
    }
  } catch (e) {
    console.error('Error reading settings:', e)
  }

  return normalizeSettings(runtimeOverride)
}

export function writeSettings(settings: Partial<AppSettings>) {
  try {
    const dir = path.dirname(SETTINGS_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    const merged = normalizeSettings(settings)

    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2))
  } catch (e) {
    console.error('Error writing settings:', e)
  }
}

export function runWithSettingsOverride<T>(
  override: Partial<AppSettings>,
  fn: () => Promise<T>,
): Promise<T> {
  return runtimeSettingsOverrideStorage.run(override, fn)
}

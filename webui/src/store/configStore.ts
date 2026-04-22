import { create } from 'zustand'
import type { ProviderSettings } from '../api/client'

type SettingsSnapshot = Partial<ProviderSettings>

function resolvePrimaryProvider(settings: SettingsSnapshot): string {
  if (typeof settings.provider === 'string' && settings.provider) {
    return settings.provider
  }
  if (typeof settings.actProvider === 'string' && settings.actProvider) {
    return settings.actProvider
  }
  if (typeof settings.planProvider === 'string' && settings.planProvider) {
    return settings.planProvider
  }
  return 'anthropic'
}

function resolvePrimaryModel(settings: SettingsSnapshot): string {
  if (typeof settings.model === 'string' && settings.model) {
    return settings.model
  }
  if (typeof settings.actModel === 'string' && settings.actModel) {
    return settings.actModel
  }
  if (typeof settings.planModel === 'string' && settings.planModel) {
    return settings.planModel
  }
  return 'claude-sonnet-4-6'
}

export interface ConfigStoreState {
  provider: string
  model: string
  settingsSnapshot: SettingsSnapshot | null
  setModel: (model: string) => void
  hydrateSettings: (settings: SettingsSnapshot) => void
}

export const useConfigStore = create<ConfigStoreState>(set => ({
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  settingsSnapshot: null,
  setModel: (model: string) => set({ model }),
  hydrateSettings: (settings: SettingsSnapshot) =>
    set({
      settingsSnapshot: settings,
      provider: resolvePrimaryProvider(settings),
      model: resolvePrimaryModel(settings),
    }),
}))

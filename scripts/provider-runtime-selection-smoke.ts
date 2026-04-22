import { runWithSettingsOverride, readSettings } from '../src/utils/settings.js'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const baseSettings = readSettings()

const override = {
  provider: 'gemini',
  model: 'gemini-2.0-flash',
  reasoningEffort: 'high' as const,
}

const result = await runWithSettingsOverride(override, async () => {
  const current = readSettings()
  return {
    provider: current.provider,
    model: current.model,
    reasoningEffort: current.reasoningEffort,
    providerOptions: current.providerOptions,
  }
})

assert(result.provider === override.provider, 'runtimeSelection provider 未生效')
assert(result.model === override.model, 'runtimeSelection model 未生效')
assert(result.reasoningEffort === override.reasoningEffort, 'runtimeSelection reasoningEffort 未生效')
assert(baseSettings.provider !== '', 'base settings provider 为空')

console.log('✅ Provider runtime selection smoke 通过')
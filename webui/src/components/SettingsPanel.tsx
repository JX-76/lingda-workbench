import React, { useEffect, useMemo, useState } from 'react'
import { useUiStore } from '../store/uiStore'
import { useConfigStore } from '../store/configStore'
import {
  apiClient,
  type ProviderConfig,
  type ProviderGroup,
  type ProviderMaturity,
  type ProviderSettings,
  type ReasoningEffort,
} from '../api/client'
import { validateProviderSettings } from '../utils/providerValidation'
import { ProviderSelectorCard } from './settings/ProviderSelectorCard'
import { ProviderOverviewCard } from './settings/ProviderOverviewCard'
import { ConnectionConfigCard } from './settings/ConnectionConfigCard'
import { ModelMetadataCard } from './settings/ModelMetadataCard'
import { ProviderValidationPanel } from './settings/ProviderValidationPanel'
import { ProviderSpecificFields } from './settings/ProviderSpecificFields'
import { AdvancedModelSplitCard } from './settings/AdvancedModelSplitCard'

const defaultSettings: ProviderSettings = {
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

const fallbackProviders: ProviderConfig[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    defaultModel: 'claude-sonnet-4-6',
    models: ['claude-sonnet-4-6'],
    capabilities: { streaming: true, tools: true, vision: true, reasoning: true },
  },
]

const effortLabels: Record<ReasoningEffort, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

const inputClassName = 'w-full bg-[#3c3c3c] border border-[#3c3c3c] rounded px-3 py-2 text-[#cccccc] focus:outline-none focus:border-[#007acc]'

type SettingsTab = 'api' | 'bot' | 'hidden'

function normalizeSettings(raw: Partial<ProviderSettings>, providers: ProviderConfig[]): ProviderSettings {
  const providerMap = new Map(providers.map(provider => [provider.id, provider]))
  const provider = providerMap.get(raw.provider || '') || providerMap.get(defaultSettings.provider) || providers[0] || fallbackProviders[0]
  const model = typeof raw.model === 'string' && provider.models.includes(raw.model)
    ? raw.model
    : provider.defaultModel

  const planProvider = providerMap.get(raw.planProvider || '')?.id || provider.id
  const actProvider = providerMap.get(raw.actProvider || '')?.id || provider.id
  const planProviderConfig = providerMap.get(planProvider) || provider
  const actProviderConfig = providerMap.get(actProvider) || provider

  return {
    ...defaultSettings,
    ...raw,
    provider: provider.id,
    model,
    baseUrl: typeof raw.baseUrl === 'string' ? raw.baseUrl : '',
    planProvider,
    actProvider,
    planModel:
      typeof raw.planModel === 'string' && planProviderConfig.models.includes(raw.planModel)
        ? raw.planModel
        : planProviderConfig.defaultModel,
    actModel:
      typeof raw.actModel === 'string' && actProviderConfig.models.includes(raw.actModel)
        ? raw.actModel
        : actProviderConfig.defaultModel,
    providerOptions:
      raw.providerOptions && typeof raw.providerOptions === 'object'
        ? raw.providerOptions
        : {},
  }
}

function getFieldValue(
  settings: ProviderSettings,
  providerId: string,
  field: { key: string },
): string {
  if (field.key === 'reasoningEffort') {
    return settings.reasoningEffort
  }

  const providerOptions = settings.providerOptions[providerId] || {}
  const value = providerOptions[field.key]
  return typeof value === 'string' ? value : ''
}

function resolveProviderGroup(provider: ProviderConfig): ProviderGroup {
  if (provider.group) return provider.group
  if (provider.local) return 'local'
  if (provider.id === 'custom') return 'custom'
  if (provider.id === 'azure-openai') return 'enterprise'
  if (provider.adapterKind === 'anthropic-native') return 'native'
  return 'cloud'
}

function resolveProviderMaturity(provider: ProviderConfig): ProviderMaturity {
  return provider.maturity || 'stable'
}

function getReasoningEfforts(provider: ProviderConfig | undefined, model: string): ReasoningEffort[] {
  const modelEfforts = provider?.modelMetadata?.[model]?.reasoningEfforts
  if (modelEfforts && modelEfforts.length > 0) {
    return modelEfforts
  }

  if (provider?.supportsReasoningEffort || provider?.capabilities?.reasoning) {
    return ['low', 'medium', 'high']
  }

  return []
}

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<ProviderSettings>(defaultSettings)
  const [providers, setProviders] = useState<ProviderConfig[]>(fallbackProviders)
  const [activeTab, setActiveTab] = useState<SettingsTab>('api')
  const [activeModeTab, setActiveModeTab] = useState<'plan' | 'act'>('plan')
  const [customBaseUrl, setCustomBaseUrl] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(true)
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [botTestStatus, setBotTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [botTestMessage, setBotTestMessage] = useState('')
  const [providerTestStatus, setProviderTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [providerTestMessage, setProviderTestMessage] = useState('')
  const theme = useUiStore(state => state.theme)
  const setTheme = useUiStore(state => state.setTheme)

  const availableProviders = useMemo(
    () => providers.filter(provider => resolveProviderMaturity(provider) !== 'planned'),
    [providers],
  )
  const plannedProviders = useMemo(
    () => providers.filter(provider => resolveProviderMaturity(provider) === 'planned'),
    [providers],
  )
  const groupedProviders = useMemo(() => {
    const groups = new Map<ProviderGroup, ProviderConfig[]>()
    for (const provider of availableProviders) {
      const group = resolveProviderGroup(provider)
      groups.set(group, [...(groups.get(group) || []), provider])
    }
    return groups
  }, [availableProviders])
  const providerMap = useMemo(() => new Map(providers.map(provider => [provider.id, provider])), [providers])
  const currentProvider = providerMap.get(settings.provider) || availableProviders[0] || providers[0]
  const currentModelMeta = currentProvider?.modelMetadata?.[settings.model]
  const reasoningEfforts = getReasoningEfforts(currentProvider, settings.model)
  const providerFields = (currentProvider?.settingsSchema || []).filter(field => field.key !== 'reasoningEffort')
  const currentMaturity = currentProvider ? resolveProviderMaturity(currentProvider) : 'stable'
  const currentGroup = currentProvider ? resolveProviderGroup(currentProvider) : 'cloud'
  const validationMessages = useMemo(
    () => validateProviderSettings(currentProvider, settings, customBaseUrl),
    [currentProvider, settings, customBaseUrl],
  )

  useEffect(() => {
    async function load() {
      try {
        const [providerRes, settingsRes, botRes] = await Promise.all([
          apiClient.settings.getProviders().catch(() => ({ providers: fallbackProviders })),
          apiClient.settings.get().catch(() => defaultSettings),
          fetch('/api/bot/config').then(r => r.json()).catch(() => ({ qqId: '', qqSecretMasked: '' })),
        ])

        const nextProviders = Array.isArray(providerRes.providers) && providerRes.providers.length > 0
          ? providerRes.providers
          : fallbackProviders

        setProviders(nextProviders)
        setSettings(normalizeSettings({
          ...settingsRes,
          qqId: botRes.qqId || settingsRes.qqId || '',
          qqSecret: botRes.qqSecretMasked || settingsRes.qqSecret || '',
        }, nextProviders))
        setCustomBaseUrl(Boolean(settingsRes.baseUrl))
      } finally {
        setLoadingProviders(false)
      }
    }

    load()
  }, [])

  const setProviderOption = (providerId: string, key: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      providerOptions: {
        ...prev.providerOptions,
        [providerId]: {
          ...(prev.providerOptions[providerId] || {}),
          [key]: value,
        },
      },
    }))
    resetProviderTestState()
  }

  const resetProviderTestState = () => {
    setProviderTestStatus('idle')
    setProviderTestMessage('')
  }

  const handleProviderChange = (providerId: string) => {
    const nextProvider = providerMap.get(providerId)
    if (!nextProvider) return

    const nextModel = nextProvider.models.includes(settings.model)
      ? settings.model
      : nextProvider.defaultModel

    const nextEfforts = getReasoningEfforts(nextProvider, nextModel)
    const nextReasoning = nextEfforts.includes(settings.reasoningEffort)
      ? settings.reasoningEffort
      : (nextEfforts[0] || 'medium')

    setSettings(prev => ({
      ...prev,
      provider: nextProvider.id,
      model: nextModel,
      baseUrl:
        customBaseUrl || nextProvider.baseUrlRequired || nextProvider.local
          ? (prev.baseUrl && prev.provider === nextProvider.id ? prev.baseUrl : (nextProvider.baseUrl || ''))
          : '',
      reasoningEffort: nextReasoning,
      planProvider: prev.useDifferentModels ? prev.planProvider : nextProvider.id,
      actProvider: prev.useDifferentModels ? prev.actProvider : nextProvider.id,
      planModel: prev.useDifferentModels ? prev.planModel : nextModel,
      actModel: prev.useDifferentModels ? prev.actModel : nextModel,
      providerOptions: {
        ...prev.providerOptions,
        [nextProvider.id]: prev.providerOptions[nextProvider.id] || {},
      },
    }))

    resetProviderTestState()

    if (nextProvider.baseUrlRequired || nextProvider.local) {
      setCustomBaseUrl(true)
    }
  }

  const handleModelChange = (model: string) => {
    const nextEfforts = getReasoningEfforts(currentProvider, model)
    setSettings(prev => ({
      ...prev,
      model,
      reasoningEffort: nextEfforts.includes(prev.reasoningEffort) ? prev.reasoningEffort : (nextEfforts[0] || 'medium'),
      ...(prev.useDifferentModels ? {} : { planModel: model, actModel: model }),
    }))
    resetProviderTestState()
  }

  const handleModeProviderChange = (mode: 'plan' | 'act', providerId: string) => {
    const provider = providerMap.get(providerId)
    if (!provider) return

    setSettings(prev => ({
      ...prev,
      [mode === 'plan' ? 'planProvider' : 'actProvider']: provider.id,
      [mode === 'plan' ? 'planModel' : 'actModel']: provider.defaultModel,
    }))
  }

  const handleSave = async () => {
    const provider = currentProvider
    const shouldPersistBaseUrl = Boolean(customBaseUrl || provider?.baseUrlRequired || provider?.local)

    await apiClient.settings.save({
      ...settings,
      baseUrl: shouldPersistBaseUrl ? settings.baseUrl : '',
      planProvider: settings.useDifferentModels ? settings.planProvider : settings.provider,
      actProvider: settings.useDifferentModels ? settings.actProvider : settings.provider,
      planModel: settings.useDifferentModels ? settings.planModel : settings.model,
      actModel: settings.useDifferentModels ? settings.actModel : settings.model,
    })

    await fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        qqId: settings.qqId,
        qqSecret: settings.qqSecret.includes('****') ? undefined : settings.qqSecret,
      }),
    })

    // Ensure the global configStore is hydrated immediately after save
    // so ChatArea doesn't have to wait for a refresh to get the new model
    const { hydrateSettings } = useConfigStore.getState()
    hydrateSettings({
      ...settings,
      baseUrl: shouldPersistBaseUrl ? settings.baseUrl : '',
      planProvider: settings.useDifferentModels ? settings.planProvider : settings.provider,
      actProvider: settings.useDifferentModels ? settings.actProvider : settings.provider,
      planModel: settings.useDifferentModels ? settings.planModel : settings.model,
      actModel: settings.useDifferentModels ? settings.actModel : settings.model,
    })

    window.dispatchEvent(new Event('settings_updated'))
    onClose()
  }

  const handleTestProvider = async () => {
    setProviderTestStatus('loading')
    setProviderTestMessage('正在测试 Provider 连接...')

    try {
      const shouldPersistBaseUrl = Boolean(customBaseUrl || currentProvider?.baseUrlRequired || currentProvider?.local)
      const result = await apiClient.settings.testProvider({
        provider: settings.provider,
        apiKey: settings.apiKey,
        baseUrl: shouldPersistBaseUrl ? settings.baseUrl : currentProvider?.baseUrl,
        providerOptions: settings.providerOptions,
      })
      setProviderTestStatus('success')
      setProviderTestMessage(result.warning || '连接成功，Endpoint 可达。')
    } catch (e: any) {
      setProviderTestStatus('error')
      setProviderTestMessage(e.message || 'Provider 连接失败')
    }
  }

  const handleTestBot = async () => {
    setBotTestStatus('loading')
    setBotTestMessage('正在连接 QQ 开放平台...')

    try {
      await fetch('/api/bot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qqId: settings.qqId,
          qqSecret: settings.qqSecret.includes('****') ? undefined : settings.qqSecret,
        }),
      })

      const resp = await fetch('/api/bot/test', { method: 'POST' })
      const data = await resp.json()
      if (!resp.ok || !data.ok) {
        setBotTestStatus('error')
        setBotTestMessage(data.error || 'QQ 连接失败')
        return
      }

      setBotTestStatus('success')
      setBotTestMessage(`连接成功，Token: ${data.accessTokenPreview || 'OK'}，有效期 ${data.expiresIn || '-'} 秒`)
    } catch (e: any) {
      setBotTestStatus('error')
      setBotTestMessage(e.message || 'QQ 连接失败')
    }
  }

  const statusColor =
    botTestStatus === 'success'
      ? 'text-green-400'
      : botTestStatus === 'error'
        ? 'text-red-400'
        : 'text-[#858585]'


  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-[#cccccc]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#333333]">
        <h2 className="text-2xl font-semibold text-[#ffffff]">Settings</h2>
        <button
          onClick={handleSave}
          disabled={validationMessages.errors.length > 0}
          className="bg-[#0e639c] hover:bg-[#1177bb] disabled:bg-[#3c3c3c] disabled:text-[#888] disabled:cursor-not-allowed text-white px-4 py-1.5 rounded text-sm font-medium"
        >
          Done
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-48 border-r border-[#333333] bg-[#252526] flex flex-col">
          <button
            onClick={() => setActiveTab('api')}
            className={`flex items-center space-x-2 px-4 py-3 border-l-2 ${activeTab === 'api' ? 'bg-[#37373d] text-white border-[#007acc]' : 'text-[#cccccc] hover:bg-[#2a2d2e] border-transparent'}`}
          >
            <span className="text-lg">⚙️</span>
            <span>API 核心配置</span>
          </button>
          <button
            onClick={() => setActiveTab('bot')}
            className={`flex items-center space-x-2 px-4 py-3 border-l-2 ${activeTab === 'bot' ? 'bg-[#37373d] text-white border-[#007acc]' : 'text-[#cccccc] hover:bg-[#2a2d2e] border-transparent'}`}
          >
            <span className="text-lg">🤖</span>
            <span>群聊机器人接入</span>
          </button>
          <button
            onClick={() => setActiveTab('hidden')}
            className={`flex items-center space-x-2 px-4 py-3 border-l-2 ${activeTab === 'hidden' ? 'bg-[#37373d] text-white border-[#007acc]' : 'text-[#cccccc] hover:bg-[#2a2d2e] border-transparent'}`}
          >
            <span className="text-lg">🕶️</span>
            <span>隐藏功能 (Hidden)</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl">
            {activeTab === 'api' && currentProvider && (
              <>
                <div className="flex border-b border-[#333333] mb-6">
                  <button
                    onClick={() => setActiveModeTab('plan')}
                    className={`px-4 py-2 font-medium ${activeModeTab === 'plan' ? 'text-[#ffffff] border-b-2 border-[#007acc]' : 'text-[#858585] hover:text-[#cccccc]'}`}
                  >
                    Plan Mode
                  </button>
                  <button
                    onClick={() => setActiveModeTab('act')}
                    className={`px-4 py-2 font-medium ${activeModeTab === 'act' ? 'text-[#ffffff] border-b-2 border-[#007acc]' : 'text-[#858585] hover:text-[#cccccc]'}`}
                  >
                    Act Mode
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-[#cccccc] mb-2">Theme</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['light', 'dark', 'system'] as const).map(option => (
                        <button
                          key={option}
                          onClick={() => setTheme(option)}
                          className={`rounded px-3 py-2 text-sm capitalize ${theme === option ? 'bg-[#0e639c] text-white' : 'bg-[#3c3c3c] text-[#cccccc]'}`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>

                  <ProviderSelectorCard
                    value={settings.provider}
                    groupedProviders={Array.from(groupedProviders.entries())}
                    disabled={loadingProviders}
                    onChange={handleProviderChange}
                  />

                  <ProviderOverviewCard
                    provider={currentProvider}
                    group={currentGroup}
                    maturity={currentMaturity}
                  />

                  <ConnectionConfigCard
                    provider={currentProvider}
                    apiKey={settings.apiKey}
                    baseUrl={settings.baseUrl}
                    customBaseUrl={customBaseUrl}
                    providerTestStatus={providerTestStatus}
                    providerTestMessage={providerTestMessage}
                    onApiKeyChange={(value) => setSettings(prev => ({ ...prev, apiKey: value }))}
                    onBaseUrlChange={(value) => setSettings(prev => ({ ...prev, baseUrl: value }))}
                    onToggleCustomBaseUrl={(checked) => {
                      setCustomBaseUrl(checked)
                      setSettings(prev => ({
                        ...prev,
                        baseUrl: checked ? (prev.baseUrl || currentProvider.baseUrl || '') : '',
                      }))
                    }}
                    onTestProvider={handleTestProvider}
                  />

                  <div>
                    <label className="block text-sm font-bold text-[#cccccc] mb-2">Model</label>
                    <select
                      value={settings.model}
                      onChange={e => handleModelChange(e.target.value)}
                      className={inputClassName}
                    >
                      {currentProvider.models.map(model => (
                        <option key={model} value={model}>{currentProvider.modelMetadata?.[model]?.label || model}</option>
                      ))}
                    </select>
                  </div>

                  {currentModelMeta && <ModelMetadataCard metadata={currentModelMeta} />}

                  {reasoningEfforts.length > 0 && (
                    <div>
                      <label className="block text-sm font-bold text-[#cccccc] mb-2">Reasoning Effort</label>
                      <select
                        value={settings.reasoningEffort}
                        onChange={e => setSettings(prev => ({ ...prev, reasoningEffort: e.target.value as ReasoningEffort }))}
                        className={inputClassName}
                      >
                        {reasoningEfforts.map(effort => (
                          <option key={effort} value={effort}>{effortLabels[effort]}</option>
                        ))}
                      </select>
                      <p className="text-xs text-[#858585] mt-2">Higher effort improves depth, but uses more tokens.</p>
                    </div>
                  )}

                  <ProviderValidationPanel
                    errors={validationMessages.errors}
                    warnings={validationMessages.warnings}
                  />

                  <ProviderSpecificFields
                    fields={providerFields}
                    values={Object.fromEntries(providerFields.map(field => [field.key, getFieldValue(settings, currentProvider.id, field)]))}
                    onChange={(key, value) => setProviderOption(currentProvider.id, key, value)}
                  />

                  <div className="pt-6 border-t border-[#333333]">
                    <button
                      onClick={() => setAdvancedOpen(prev => !prev)}
                      className="flex items-center text-xs font-bold text-[#858585] tracking-wider uppercase mb-4"
                    >
                      <span className="mr-1">{advancedOpen ? '▼' : '▶'}</span> ADVANCED
                    </button>

                    {advancedOpen && (
                      <AdvancedModelSplitCard
                        useDifferentModels={settings.useDifferentModels}
                        currentProviderId={settings.provider}
                        currentModel={settings.model}
                        availableProviders={availableProviders}
                        planProvider={settings.planProvider}
                        actProvider={settings.actProvider}
                        planModel={settings.planModel}
                        actModel={settings.actModel}
                        onToggle={(enabled) => setSettings(prev => ({
                          ...prev,
                          useDifferentModels: enabled,
                          ...(enabled
                            ? {}
                            : {
                                planProvider: prev.provider,
                                actProvider: prev.provider,
                                planModel: prev.model,
                                actModel: prev.model,
                              }),
                        }))}
                        onModeProviderChange={handleModeProviderChange}
                        onModeModelChange={(mode, model) => setSettings(prev => ({
                          ...prev,
                          [mode === 'plan' ? 'planModel' : 'actModel']: model,
                        }))}
                      />
                    )}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'api' && plannedProviders.length > 0 && (
              <div className="mt-8 rounded border border-dashed border-[#4b5563] bg-[#1f2937]/30 p-4">
                <h4 className="text-sm font-semibold text-white mb-3">下一梯队 / 预留 Provider</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {plannedProviders.map(provider => (
                    <div key={provider.id} className="rounded border border-[#374151] bg-[#111827]/40 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-[#e5e7eb]">{provider.label}</div>
                        <span className="text-[10px] uppercase tracking-wider text-amber-300">Planned</span>
                      </div>
                      <p className="mt-2 text-xs text-[#9ca3af]">{provider.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'bot' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold mb-6 text-[#ffffff]">Bot Integrations</h3>

                <div className="space-y-5">
                  <div className="p-4 bg-[#252526] rounded border border-[#3c3c3c]">
                    <h4 className="font-medium text-[#cccccc] mb-2 text-sm">Webhook URL (For WeChat/Feishu/QQ)</h4>
                    <code className="text-xs text-[#ce9178] break-all bg-[#1e1e1e] p-2 rounded block border border-[#333333]">http://localhost:3000/api/webhook/bot</code>
                    <p className="text-xs text-[#858585] mt-2">Use this URL to receive messages from external platforms.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[#cccccc] mb-2">QQ Bot App ID</label>
                    <input
                      type="text"
                      value={settings.qqId}
                      onChange={e => setSettings(prev => ({ ...prev, qqId: e.target.value }))}
                      className={inputClassName}
                      placeholder="e.g. 102030405"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#cccccc] mb-2">QQ Bot App Secret</label>
                    <input
                      type="text"
                      value={settings.qqSecret}
                      onChange={e => setSettings(prev => ({ ...prev, qqSecret: e.target.value }))}
                      className={inputClassName}
                      placeholder="Enter new secret to update..."
                    />
                  </div>
                  <div className="pt-2 border-t border-[#333333]">
                    <button
                      onClick={handleTestBot}
                      disabled={botTestStatus === 'loading' || !settings.qqId}
                      className="bg-[#2ea043] hover:bg-[#2c974b] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                    >
                      {botTestStatus === 'loading' ? 'Testing Connection...' : 'Test Bot Connection'}
                    </button>
                    {botTestMessage && <p className={`text-sm mt-3 ${statusColor} p-3 rounded bg-[#252526] border border-[#333333]`}>{botTestMessage}</p>}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'hidden' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold mb-6 text-[#ffffff]">Hidden Features</h3>
                <div className="space-y-4 p-5 bg-[#252526] rounded border border-[#3c3c3c]">
                  <label className="flex items-center space-x-3 cursor-pointer group">
                    <input type="checkbox" className="w-4 h-4 rounded border-[#3c3c3c] bg-[#3c3c3c] text-[#007acc] focus:ring-0" checked={settings.undercoverMode} onChange={e => setSettings(prev => ({ ...prev, undercoverMode: e.target.checked }))} />
                    <span className="group-hover:text-white transition-colors">Undercover Mode</span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer group">
                    <input type="checkbox" className="w-4 h-4 rounded border-[#3c3c3c] bg-[#3c3c3c] text-[#007acc] focus:ring-0" checked={settings.fastMode} onChange={e => setSettings(prev => ({ ...prev, fastMode: e.target.checked }))} />
                    <span className="group-hover:text-white transition-colors">Fast Mode</span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer group">
                    <input type="checkbox" className="w-4 h-4 rounded border-[#3c3c3c] bg-[#3c3c3c] text-[#007acc] focus:ring-0" checked={settings.debugMode} onChange={e => setSettings(prev => ({ ...prev, debugMode: e.target.checked }))} />
                    <span className="group-hover:text-white transition-colors">Developer / Debug Mode</span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer group">
                    <input type="checkbox" className="w-4 h-4 rounded border-[#3c3c3c] bg-[#3c3c3c] text-[#007acc] focus:ring-0" checked={settings.companionMuted} onChange={e => setSettings(prev => ({ ...prev, companionMuted: e.target.checked }))} />
                    <span className="group-hover:text-white transition-colors">Mute Buddy</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

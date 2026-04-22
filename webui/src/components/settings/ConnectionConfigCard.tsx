import type { ProviderConfig } from '../../api/client'
import { ProviderTestPanel } from './ProviderTestPanel'

const inputClassName = 'w-full bg-[#3c3c3c] border border-[#3c3c3c] rounded px-3 py-2 text-[#cccccc] focus:outline-none focus:border-[#007acc]'

export function ConnectionConfigCard({
  provider,
  apiKey,
  baseUrl,
  customBaseUrl,
  providerTestStatus,
  providerTestMessage,
  onApiKeyChange,
  onBaseUrlChange,
  onToggleCustomBaseUrl,
  onTestProvider,
}: {
  provider: ProviderConfig
  apiKey: string
  baseUrl: string
  customBaseUrl: boolean
  providerTestStatus: 'idle' | 'loading' | 'success' | 'error'
  providerTestMessage: string
  onApiKeyChange: (value: string) => void
  onBaseUrlChange: (value: string) => void
  onToggleCustomBaseUrl: (checked: boolean) => void
  onTestProvider: () => void
}) {
  return (
    <>
      <div>
        <label className="block text-sm font-bold text-[#cccccc] mb-2">{provider.apiKeyLabel || `${provider.label} API Key`}</label>
        <input
          type="password"
          value={apiKey}
          onChange={e => onApiKeyChange(e.target.value)}
          className={inputClassName}
          placeholder={provider.apiKeyPlaceholder || '请输入 API Key'}
        />
        <p className="text-xs text-[#858585] mt-2">
          密钥仅保存在本地，用于当前扩展发起 API 请求。
          {provider.local ? ' 对于本地模型入口，很多场景下可留空。' : ''}
        </p>
        <ProviderTestPanel
          status={providerTestStatus}
          message={providerTestMessage}
          onTest={onTestProvider}
        />
      </div>

      {provider.baseUrlEditable && !provider.baseUrlRequired && !provider.local && (
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={customBaseUrl}
            onChange={e => onToggleCustomBaseUrl(e.target.checked)}
            className="w-4 h-4 rounded border-[#3c3c3c] bg-[#3c3c3c] text-[#007acc] focus:ring-0"
          />
          <span className="text-sm font-medium">Use custom base URL</span>
        </label>
      )}

      {(customBaseUrl || provider.baseUrlRequired || provider.local) && (
        <div>
          <label className="block text-sm font-bold text-[#cccccc] mb-2">Base URL</label>
          <input
            type="text"
            value={baseUrl}
            onChange={e => onBaseUrlChange(e.target.value)}
            className={inputClassName}
            placeholder={provider.baseUrl || 'https://api.example.com/v1'}
          />
          <p className="text-xs text-[#858585] mt-2">
            {provider.local
              ? '本地 provider 通常需要确保这里指向你正在运行的本地服务地址。'
              : '如果留空，后端会回退到该 provider 的默认官方地址。'}
          </p>
        </div>
      )}
    </>
  )
}

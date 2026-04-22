import type { ProviderConfig, ProviderSettings } from '../api/client'

export function validateProviderSettings(
  provider: ProviderConfig | undefined,
  settings: ProviderSettings,
  customBaseUrl: boolean,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  const providerOptions = settings.providerOptions[provider?.id || ''] || {}

  if (!provider) {
    errors.push('当前 provider 不存在或尚未加载完成。')
    return { errors, warnings }
  }

  if (!settings.apiKey.trim() && !provider.local) {
    warnings.push('当前 provider 通常需要 API Key，建议在保存前确认。')
  }

  if ((customBaseUrl || provider.baseUrlRequired || provider.local) && !settings.baseUrl.trim()) {
    errors.push('当前 provider 需要有效的 Base URL。')
  }

  if (provider.id === 'azure-openai' && !String(providerOptions.deployment || '').trim()) {
    errors.push('Azure OpenAI 需要填写 Deployment Name。')
  }

  if (
    (provider.id === 'ollama' || provider.id === 'lmstudio' || provider.id === 'localai')
    && !settings.baseUrl.trim()
  ) {
    warnings.push('本地 provider 建议确认本地服务已启动且 Base URL 可访问。')
  }

  if (provider.capabilities?.vision === false) {
    warnings.push('当前 provider 不支持视觉能力，图片输入会被降级过滤。')
  }

  if (provider.capabilities?.tools === false) {
    warnings.push('当前 provider 工具调用能力有限，更适合纯文本任务。')
  }

  return { errors, warnings }
}

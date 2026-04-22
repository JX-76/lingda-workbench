import type { ProviderConfig } from '../../api/client'

const inputClassName = 'w-full bg-[#3c3c3c] border border-[#3c3c3c] rounded px-3 py-2 text-[#cccccc] focus:outline-none focus:border-[#007acc]'
const panelCardClassName = 'rounded border border-[#3c3c3c] bg-[#252526] p-4'

export function AdvancedModelSplitCard({
  useDifferentModels,
  currentProviderId,
  currentModel,
  availableProviders,
  planProvider,
  actProvider,
  planModel,
  actModel,
  onToggle,
  onModeProviderChange,
  onModeModelChange,
}: {
  useDifferentModels: boolean
  currentProviderId: string
  currentModel: string
  availableProviders: ProviderConfig[]
  planProvider: string
  actProvider: string
  planModel: string
  actModel: string
  onToggle: (enabled: boolean) => void
  onModeProviderChange: (mode: 'plan' | 'act', providerId: string) => void
  onModeModelChange: (mode: 'plan' | 'act', model: string) => void
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start space-x-2">
        <input
          type="checkbox"
          checked={useDifferentModels}
          onChange={e => onToggle(e.target.checked)}
          id="diffModels"
          className="w-4 h-4 rounded border-[#3c3c3c] bg-[#3c3c3c] text-[#007acc] focus:ring-0 mt-0.5"
        />
        <div>
          <label htmlFor="diffModels" className="text-sm font-medium block">Use different models for Plan and Act modes</label>
          <p className="text-xs text-[#858585] mt-2 leading-relaxed">
            可为 Plan 与 Act 配置不同 provider / model，适合“强规划 + 低成本执行”的组合。
          </p>
        </div>
      </div>

      {useDifferentModels && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['plan', 'act'] as const).map(mode => {
            const selectedProviderId = mode === 'plan' ? planProvider : actProvider
            const selectedProvider = availableProviders.find(provider => provider.id === selectedProviderId)
              || availableProviders[0]
            const selectedModel = mode === 'plan' ? planModel : actModel

            return (
              <div key={mode} className={panelCardClassName}>
                <h4 className="text-sm font-semibold text-white mb-4 uppercase">{mode} mode</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#cccccc] mb-2">Provider</label>
                    <select
                      value={selectedProviderId}
                      onChange={e => onModeProviderChange(mode, e.target.value)}
                      className={inputClassName}
                    >
                      {availableProviders.map(provider => (
                        <option key={provider.id} value={provider.id}>{provider.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#cccccc] mb-2">Model</label>
                    <select
                      value={selectedModel}
                      onChange={e => onModeModelChange(mode, e.target.value)}
                      className={inputClassName}
                    >
                      {selectedProvider.models.map(model => (
                        <option key={model} value={model}>{selectedProvider.modelMetadata?.[model]?.label || model}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="mt-3 text-xs text-[#8f8f8f]">
                  {selectedProvider.modelMetadata?.[selectedModel]?.description
                    || (mode === 'plan' ? `Plan 默认继承 ${currentProviderId}/${currentModel}` : `Act 默认继承 ${currentProviderId}/${currentModel}`)}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

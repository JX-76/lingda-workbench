import type { ProviderConfig, ProviderGroup } from '../../api/client'

const inputClassName = 'w-full bg-[#3c3c3c] border border-[#3c3c3c] rounded px-3 py-2 text-[#cccccc] focus:outline-none focus:border-[#007acc]'

const groupLabels: Record<ProviderGroup, string> = {
  native: '原生入口',
  cloud: '云端兼容入口',
  local: '本地入口',
  enterprise: '企业托管入口',
  custom: '自定义入口',
  planned: '下一梯队（预留）',
}

export function ProviderSelectorCard({
  value,
  groupedProviders,
  disabled,
  onChange,
}: {
  value: string
  groupedProviders: Array<[ProviderGroup, ProviderConfig[]]>
  disabled?: boolean
  onChange: (providerId: string) => void
}) {
  return (
    <div>
      <label className="block text-sm font-bold text-[#cccccc] mb-2">API Provider</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={inputClassName}
        disabled={disabled}
      >
        {groupedProviders.map(([group, items]) => (
          <optgroup key={group} label={groupLabels[group]}>
            {items.map(provider => (
              <option key={provider.id} value={provider.id}>{provider.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}

import type {
  ProviderCapabilityConfig,
  ProviderConfig,
  ProviderGroup,
  ProviderMaturity,
} from '../../api/client'

const capabilityLabels = {
  streaming: 'Streaming',
  tools: 'Tools',
  vision: 'Vision',
  reasoning: 'Reasoning',
} as const

const groupLabels: Record<ProviderGroup, string> = {
  native: '原生入口',
  cloud: '云端兼容入口',
  local: '本地入口',
  enterprise: '企业托管入口',
  custom: '自定义入口',
  planned: '下一梯队（预留）',
}

const maturityLabels: Record<ProviderMaturity, string> = {
  stable: 'Stable',
  beta: 'Beta',
  planned: 'Planned',
}

export function ProviderBadgeRow({
  provider,
  group,
  maturity,
}: {
  provider: ProviderConfig
  group: ProviderGroup
  maturity: ProviderMaturity
}) {
  return (
    <div className="flex flex-wrap gap-2 mt-4">
      <span className="text-xs px-2.5 py-1 rounded-full border border-[#4b5563] text-[#d1d5db] bg-[#111827]/40">
        {groupLabels[group]}
      </span>
      <span
        className={`text-xs px-2.5 py-1 rounded-full border ${maturity === 'planned' ? 'border-[#a16207] text-[#fde68a] bg-[#854d0e]/20' : maturity === 'beta' ? 'border-[#1d4ed8] text-[#bfdbfe] bg-[#1d4ed8]/20' : 'border-[#166534] text-[#bbf7d0] bg-[#166534]/20'}`}
      >
        {maturityLabels[maturity]}
      </span>
      {Object.entries(capabilityLabels).map(([key, label]) => (
        <span
          key={key}
          className={`text-xs px-2.5 py-1 rounded-full border ${provider.capabilities?.[key as keyof ProviderCapabilityConfig] ? 'border-[#0e639c] text-[#9cdcff] bg-[#0e639c]/20' : 'border-[#555] text-[#8a8a8a]'}`}
        >
          {label}
        </span>
      ))}
      {provider.local && (
        <span className="text-xs px-2.5 py-1 rounded-full border border-[#3f8f5f] text-[#91e5b0] bg-[#3f8f5f]/20">
          Local
        </span>
      )}
      {provider.isOpenAICompatiblePreset && (
        <span className="text-xs px-2.5 py-1 rounded-full border border-[#8d6ad8] text-[#d0b9ff] bg-[#8d6ad8]/20">
          OpenAI-Compatible Preset
        </span>
      )}
    </div>
  )
}

import type { ProviderCapabilityConfig, ProviderModelMetadata } from '../../api/client'

const capabilityLabels = {
  streaming: 'Streaming',
  tools: 'Tools',
  vision: 'Vision',
  reasoning: 'Reasoning',
} as const

export function ModelMetadataCard({
  metadata,
}: {
  metadata: ProviderModelMetadata
}) {
  return (
    <div className="rounded border border-[#3c3c3c] bg-[#252526] p-4">
      <div className="text-sm text-white font-medium">{metadata.label}</div>
      {metadata.description && (
        <p className="text-sm text-[#b8b8b8] mt-2">{metadata.description}</p>
      )}
      {metadata.recommendedFor && (
        <p className="text-xs text-[#8f8f8f] mt-2">推荐用途：{metadata.recommendedFor}</p>
      )}
      <div className="flex flex-wrap gap-6 text-sm text-[#c5c5c5] mt-3">
        {metadata.contextWindow && <span>Context: <strong>{metadata.contextWindow}</strong></span>}
        {metadata.inputPrice && <span>Input: <strong>{metadata.inputPrice}</strong></span>}
        {metadata.outputPrice && <span>Output: <strong>{metadata.outputPrice}</strong></span>}
      </div>
      {metadata.capabilities && (
        <div className="flex flex-wrap gap-2 mt-3">
          {Object.entries(capabilityLabels).map(([key, label]) => (
            <span
              key={`model-${key}`}
              className={`text-[11px] px-2 py-1 rounded-full border ${metadata.capabilities?.[key as keyof ProviderCapabilityConfig] ? 'border-[#2563eb] text-[#bfdbfe] bg-[#2563eb]/20' : 'border-[#555] text-[#8a8a8a]'}`}
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

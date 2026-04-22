import type {
  ProviderConfig,
  ProviderGroup,
  ProviderMaturity,
} from '../../api/client'
import { ProviderBadgeRow } from './ProviderBadgeRow'

const panelCardClassName = 'rounded border border-[#3c3c3c] bg-[#252526] p-4'

export function ProviderOverviewCard({
  provider,
  group,
  maturity,
}: {
  provider: ProviderConfig
  group: ProviderGroup
  maturity: ProviderMaturity
}) {
  return (
    <div className={panelCardClassName}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{provider.label}</h3>
          <p className="text-sm text-[#b8b8b8] mt-2">{provider.description || '暂无 Provider 描述。'}</p>
          {provider.recommendedFor && (
            <p className="text-xs text-[#8f8f8f] mt-3">适用场景：{provider.recommendedFor}</p>
          )}
        </div>
        {provider.docsUrl && (
          <a
            href={provider.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-[#4ea1ff] hover:underline whitespace-nowrap"
          >
            官方文档 ↗
          </a>
        )}
      </div>

      <ProviderBadgeRow provider={provider} group={group} maturity={maturity} />
    </div>
  )
}

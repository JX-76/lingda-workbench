import type { ProviderFieldSchema } from '../../api/client'

const inputClassName = 'w-full bg-[#3c3c3c] border border-[#3c3c3c] rounded px-3 py-2 text-[#cccccc] focus:outline-none focus:border-[#007acc]'
const panelCardClassName = 'rounded border border-[#3c3c3c] bg-[#252526] p-4'

export function ProviderSpecificFields({
  fields,
  values,
  onChange,
}: {
  fields: ProviderFieldSchema[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  if (fields.length === 0) return null

  return (
    <div className={panelCardClassName}>
      <h4 className="text-sm font-semibold text-white mb-4">Provider Specific Settings</h4>
      <div className="space-y-4">
        {fields.map(field => (
          <div key={field.key}>
            <label className="block text-sm font-bold text-[#cccccc] mb-2">{field.label}</label>
            {field.type === 'select' ? (
              <select
                value={values[field.key] || ''}
                onChange={e => onChange(field.key, e.target.value)}
                className={inputClassName}
              >
                <option value="">请选择</option>
                {(field.options || []).map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            ) : (
              <input
                type={field.type === 'password' ? 'password' : 'text'}
                value={values[field.key] || ''}
                onChange={e => onChange(field.key, e.target.value)}
                className={inputClassName}
                placeholder={field.placeholder || ''}
              />
            )}
            {field.description && (
              <p className="text-xs text-[#858585] mt-2">{field.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ProviderValidationPanel({
  errors,
  warnings,
}: {
  errors: string[]
  warnings: string[]
}) {
  if (errors.length === 0 && warnings.length === 0) {
    return null
  }

  return (
    <div className="rounded border border-[#3c3c3c] bg-[#252526] p-4">
      {errors.length > 0 && (
        <div className="mb-3">
          <div className="text-sm font-semibold text-red-300 mb-2">保存前需处理</div>
          <ul className="space-y-1 text-xs text-red-200">
            {errors.map(message => <li key={message}>• {message}</li>)}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-amber-300 mb-2">提示</div>
          <ul className="space-y-1 text-xs text-amber-200">
            {warnings.map(message => <li key={message}>• {message}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

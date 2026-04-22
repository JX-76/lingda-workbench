export function ProviderTestPanel({
  status,
  message,
  onTest,
}: {
  status: 'idle' | 'loading' | 'success' | 'error'
  message: string
  onTest: () => void
}) {
  const providerStatusColor =
    status === 'success'
      ? 'text-green-400'
      : status === 'error'
        ? 'text-red-400'
        : 'text-[#858585]'

  return (
    <div className="mt-3">
      <button
        onClick={onTest}
        disabled={status === 'loading'}
        className="bg-[#2d7d46] hover:bg-[#2f8a4c] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium transition-colors"
      >
        {status === 'loading' ? 'Testing Provider...' : 'Test Provider Connection'}
      </button>
      {message && (
        <p className={`text-sm mt-3 ${providerStatusColor} p-3 rounded bg-[#252526] border border-[#333333]`}>
          {message}
        </p>
      )}
    </div>
  )
}

import type { LocalizedOption } from '../lib/api'

/** Compact label + inline pill buttons, used for the red-flag checklist so
 * ten questions fit on one screen instead of ten. */
export function CompactChoiceRow({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string
  options: LocalizedOption[]
  value: string | undefined
  onChange: (code: string) => void
  error?: boolean
}) {
  return (
    <div
      className={
        'rounded-xl border px-4 py-3.5 ' +
        (error ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white')
      }
    >
      <p className="mb-2.5 text-sm leading-snug text-slate-800">{label}</p>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.code}
            type="button"
            onClick={() => onChange(opt.code)}
            aria-pressed={value === opt.code}
            className={
              'flex-1 rounded-lg border px-2 py-2 text-sm font-medium transition ' +
              (value === opt.code
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-200 bg-white text-slate-700')
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

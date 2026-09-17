import type { AnswerValue } from '../questionnaire/types'
import type { LocalizedOption, LocalizedQuestion } from '../lib/api'

interface Props {
  question: LocalizedQuestion
  options?: LocalizedOption[]
  value: AnswerValue | undefined
  onChange: (value: AnswerValue) => void
  autoFocus?: boolean
}

function OptionCard({
  label,
  selected,
  onClick,
  multi,
}: {
  label: string
  selected: boolean
  onClick: () => void
  multi?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        'flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-base transition active:scale-[0.99] ' +
        (selected
          ? 'border-blue-600 bg-blue-50 text-blue-900'
          : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300')
      }
    >
      <span
        className={
          'flex h-5 w-5 shrink-0 items-center justify-center border text-xs ' +
          (multi ? 'rounded-md' : 'rounded-full') +
          ' ' +
          (selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white')
        }
      >
        {selected ? '✓' : ''}
      </span>
      <span className="flex-1">{label}</span>
    </button>
  )
}

export function QuestionInput({ question, options, value, onChange, autoFocus }: Props) {
  const opts = options ?? question.options ?? []

  switch (question.type) {
    case 'text':
      return (
        <input
          type="text"
          autoFocus={autoFocus}
          value={typeof value === 'string' ? value : ''}
          maxLength={question.maxLength}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-4 py-3.5 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      )

    case 'textarea':
      return (
        <textarea
          autoFocus={autoFocus}
          value={typeof value === 'string' ? value : ''}
          maxLength={question.maxLength}
          rows={4}
          onChange={(e) => onChange(e.target.value)}
          className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3.5 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      )

    case 'number':
      return (
        <input
          type="number"
          inputMode="numeric"
          autoFocus={autoFocus}
          value={typeof value === 'number' ? value : (value as string) ?? ''}
          min={question.min}
          max={question.max}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          className="w-full rounded-xl border border-slate-300 px-4 py-3.5 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      )

    case 'tel':
      return (
        <input
          type="tel"
          inputMode="numeric"
          autoFocus={autoFocus}
          value={typeof value === 'string' ? value : ''}
          maxLength={question.maxLength ?? 10}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          className="w-full rounded-xl border border-slate-300 px-4 py-3.5 text-base tracking-wide focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      )

    case 'scale': {
      const min = question.min ?? 0
      const max = question.max ?? 10
      const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i)
      const current = typeof value === 'number' ? value : Number(value)
      return (
        <div>
          <div className="flex flex-wrap gap-2">
            {numbers.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                aria-pressed={current === n}
                className={
                  'flex h-11 w-11 items-center justify-center rounded-full border text-sm font-semibold transition ' +
                  (current === n
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300')
                }
              >
                {n}
              </button>
            ))}
          </div>
          {(question.minLabel || question.maxLabel) && (
            <div className="mt-2 flex justify-between text-xs text-slate-400">
              <span>{question.minLabel}</span>
              <span>{question.maxLabel}</span>
            </div>
          )}
        </div>
      )
    }

    case 'single_choice':
    case 'yes_no':
      return (
        <div className="space-y-2.5">
          {opts.map((opt) => (
            <OptionCard
              key={opt.code}
              label={opt.label}
              selected={value === opt.code}
              onClick={() => onChange(opt.code)}
            />
          ))}
        </div>
      )

    case 'multi_choice': {
      const selected = Array.isArray(value) ? value.map(String) : []
      const toggle = (code: string) => {
        onChange(
          selected.includes(code)
            ? selected.filter((c) => c !== code)
            : [...selected, code],
        )
      }
      return (
        <div className="space-y-2.5">
          {opts.map((opt) => (
            <OptionCard
              key={opt.code}
              label={opt.label}
              selected={selected.includes(opt.code)}
              onClick={() => toggle(opt.code)}
              multi
            />
          ))}
        </div>
      )
    }

    default:
      return null
  }
}

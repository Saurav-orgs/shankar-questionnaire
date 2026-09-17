import { useTranslation } from 'react-i18next'

export function ProgressBar({ answered, total }: { answered: number; total: number }) {
  const { t } = useTranslation()
  const pct = total > 0 ? Math.min(100, Math.round((answered / total) * 100)) : 0

  return (
    <div className="mb-6">
      <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
        <span>{t('questionOf', { answered, total })}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

import { useTranslation } from 'react-i18next'
import type { Lang } from '../questionnaire/types'

export function LanguageToggle({
  value,
  onChange,
}: {
  value: Lang
  onChange: (lang: Lang) => void
}) {
  const { t } = useTranslation()
  return (
    <div
      className="inline-flex overflow-hidden rounded-full border border-slate-200 text-sm"
      role="group"
      aria-label={t('language')}
    >
      {(['en', 'hi'] as const).map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => onChange(lang)}
          className={
            'px-3 py-1.5 font-medium transition ' +
            (value === lang
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50')
          }
        >
          {lang === 'en' ? 'EN' : 'हिं'}
        </button>
      ))}
    </div>
  )
}

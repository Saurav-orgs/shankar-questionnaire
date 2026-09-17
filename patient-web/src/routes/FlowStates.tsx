import { useTranslation } from 'react-i18next'
import { PageShell, PrimaryButton } from '../components/PageShell'

export function AssessmentFlowSkeleton() {
  return (
    <PageShell>
      <div className="animate-pulse space-y-4 pt-4">
        <div className="h-2 w-full rounded bg-slate-100" />
        <div className="h-6 w-3/4 rounded bg-slate-100" />
        <div className="h-12 w-full rounded-xl bg-slate-100" />
        <div className="h-12 w-full rounded-xl bg-slate-100" />
        <div className="h-12 w-full rounded-xl bg-slate-100" />
      </div>
    </PageShell>
  )
}

export function ResumeError({ onStartOver }: { onStartOver: () => void }) {
  const { t } = useTranslation()
  return (
    <PageShell>
      <div className="flex flex-col items-center py-16 text-center">
        <p className="text-base text-slate-600">{t('resumeError')}</p>
        <div className="mt-6 w-full max-w-xs">
          <PrimaryButton onClick={onStartOver}>{t('startOver')}</PrimaryButton>
        </div>
      </div>
    </PageShell>
  )
}

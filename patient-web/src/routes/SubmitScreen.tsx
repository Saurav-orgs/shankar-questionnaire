import { useTranslation } from 'react-i18next'
import { ErrorBanner, PrimaryButton, SecondaryButton } from '../components/PageShell'

export function SubmitScreen({
  onSubmit,
  onBack,
  canGoBack,
  pending,
  serverError,
}: {
  onSubmit: () => void
  onBack: () => void
  canGoBack: boolean
  pending: boolean
  serverError: string | null
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl">
        ✓
      </div>
      <h2 className="text-xl font-semibold text-slate-900">{t('reviewTitle')}</h2>
      <p className="mt-2 max-w-xs text-sm text-slate-500">{t('reviewBody')}</p>

      {serverError && (
        <div className="mt-4 w-full">
          <ErrorBanner message={serverError} />
        </div>
      )}

      <div className="mt-8 flex w-full gap-3">
        {canGoBack && (
          <div className="w-24">
            <SecondaryButton onClick={onBack}>{t('back')}</SecondaryButton>
          </div>
        )}
        <div className="flex-1">
          <PrimaryButton onClick={onSubmit} loading={pending}>
            {t('submit')}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}

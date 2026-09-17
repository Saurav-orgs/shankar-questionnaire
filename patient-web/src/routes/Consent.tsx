import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createAssessment, fetchQuestionnaire } from '../lib/api'
import type { Lang } from '../questionnaire/types'
import { Disclaimer } from '../components/Disclaimer'
import { LanguageToggle } from '../components/LanguageToggle'
import { ErrorBanner, PageShell, PrimaryButton } from '../components/PageShell'

export function Consent() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const lang: Lang = params.get('lang') === 'hi' ? 'hi' : 'en'
  const [agreed, setAgreed] = useState(false)
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    void i18n.changeLanguage(lang)
  }, [lang, i18n])

  const { data: schema, isLoading, isError } = useQuery({
    queryKey: ['questionnaire', lang],
    queryFn: () => fetchQuestionnaire(lang),
  })

  const create = useMutation({
    mutationFn: () => createAssessment(lang, true),
    onSuccess: (state) => navigate(`/a/${state.token}`),
  })

  const handleContinue = () => {
    setAttempted(true)
    if (!agreed) return
    create.mutate()
  }

  return (
    <PageShell footer={schema && <Disclaimer text={schema.disclaimer} />}>
      <div className="flex items-center justify-between pb-6 pt-2">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm text-slate-400"
        >
          ← {t('back')}
        </button>
        <LanguageToggle
          value={lang}
          onChange={(next) => setParams({ lang: next })}
        />
      </div>

      {isLoading && <p className="text-sm text-slate-500">{t('loading')}</p>}
      {isError && <p className="text-sm text-red-600">{t('cannotReachServer')}</p>}

      {schema && (
        <>
          <p className="text-base leading-relaxed text-slate-700">
            {schema.consent.body}
          </p>

          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-blue-600"
            />
            <span className="text-sm font-medium text-slate-800">
              {schema.consent.checkboxLabel}
            </span>
          </label>

          {attempted && !agreed && (
            <p className="mt-2 text-sm text-red-600">{t('mustAgree')}</p>
          )}

          {create.isError && <ErrorBanner message={t('somethingWentWrong')} />}

          <div className="mt-6">
            <PrimaryButton onClick={handleContinue} loading={create.isPending}>
              {t('continue')}
            </PrimaryButton>
          </div>
        </>
      )}
    </PageShell>
  )
}

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchDoctorProfile } from '../lib/api'
import type { Lang } from '../questionnaire/types'
import { LanguageToggle } from '../components/LanguageToggle'
import { PageShell, PrimaryButton } from '../components/PageShell'

export function Landing() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [lang, setLang] = useState<Lang>('en')

  useEffect(() => {
    void i18n.changeLanguage(lang)
  }, [lang, i18n])

  const { data: doctor, isLoading, isError } = useQuery({
    queryKey: ['doctor-profile', lang],
    queryFn: () => fetchDoctorProfile(lang),
  })

  return (
    <PageShell>
      <div className="flex items-center justify-between pb-6 pt-2">
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
          {t('appName')}
        </p>
        <LanguageToggle value={lang} onChange={setLang} />
      </div>

      {isLoading && (
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-2/3 rounded bg-slate-100" />
          <div className="h-4 w-full rounded bg-slate-100" />
          <div className="h-4 w-5/6 rounded bg-slate-100" />
        </div>
      )}

      {isError && <p className="text-sm text-red-600">{t('cannotReachServer')}</p>}

      {doctor && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h1 className="text-xl font-semibold text-slate-900">{doctor.fullName}</h1>
          {doctor.qualifications && (
            <p className="mt-0.5 text-sm text-slate-500">{doctor.qualifications}</p>
          )}
          {doctor.specialty && (
            <p className="mt-0.5 text-sm font-medium text-blue-700">{doctor.specialty}</p>
          )}
          {doctor.bio && (
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{doctor.bio}</p>
          )}
          {doctor.clinicName && (
            <div className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-500">
              <p className="font-medium text-slate-700">{doctor.clinicName}</p>
              {doctor.clinicAddress && <p>{doctor.clinicAddress}</p>}
            </div>
          )}
        </div>
      )}

      <div className="mt-8">
        <PrimaryButton
          disabled={!doctor}
          onClick={() => navigate(`/consent?lang=${lang}`)}
        >
          {t('startAssessment')}
        </PrimaryButton>
      </div>
    </PageShell>
  )
}

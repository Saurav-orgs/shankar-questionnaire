import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchDoctorProfile } from '../lib/api'

interface EmergencyState {
  heading: string
  body: string
  clinicPhone?: string | null
}

/**
 * Says nothing about what the patient's answers mean — no condition, no
 * severity, no interpretation. It routes to a human and stops. See plan.md §2
 * and the copy in api/src/questionnaire/v1/copy.ts, which is the actual
 * source of the heading/body text rendered here.
 *
 * No token in the URL by design (plan.md §12) — state arrives via router
 * navigation. A direct hit or refresh falls back to a generic version built
 * from the doctor profile, so the screen still works standalone.
 */
export function Emergency() {
  const { t } = useTranslation()
  const location = useLocation()
  const state = location.state as EmergencyState | null

  const { data: doctor } = useQuery({
    queryKey: ['doctor-profile', 'en'],
    queryFn: () => fetchDoctorProfile('en'),
    enabled: !state,
  })

  const heading = state?.heading ?? 'Please contact the clinic today'
  const body =
    state?.body ??
    'Some of your answers need to be reviewed by the doctor urgently. Please call the clinic now. If you cannot reach them, go to your nearest hospital emergency department.'
  const phone = state?.clinicPhone ?? doctor?.emergencyPhone ?? doctor?.clinicPhone

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-red-50 px-6 py-10 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
        ⚠️
      </div>
      <h1 className="text-2xl font-bold text-red-900">{heading}</h1>
      <p className="mt-4 max-w-sm text-base leading-relaxed text-red-800">{body}</p>

      {phone && (
        <a
          href={`tel:${phone.replace(/\s+/g, '')}`}
          className="mt-8 w-full max-w-xs rounded-xl bg-red-700 px-6 py-4 text-lg font-semibold text-white shadow-sm"
        >
          {t('call', { phone })}
        </a>
      )}
    </div>
  )
}

import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchDetail } from '../lib/api'
import { CATEGORY_STYLE, formatWhen, URGENCY_LABEL } from '../lib/triage'
import { AppHeader } from '../components/AppHeader'
import { ReviewForm } from './ReviewForm'

export function PatientDetail({ onLoggedOut }: { onLoggedOut: () => void }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const { data: detail, isLoading, isError } = useQuery({
    queryKey: ['detail', id],
    queryFn: () => fetchDetail(id),
  })

  return (
    <div className="min-h-full">
      <AppHeader onLoggedOut={onLoggedOut} />

      <main className="mx-auto max-w-3xl px-6 py-6">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mb-4 text-sm text-slate-500 hover:text-slate-700"
        >
          ← Back to all patients
        </button>

        {isLoading && <p className="py-12 text-center text-slate-400">Loading…</p>}
        {isError && (
          <p className="py-12 text-center text-red-600">
            Could not load this patient.
          </p>
        )}

        {detail && (
          <div className="space-y-5">
            {/* Verdict banner */}
            {detail.triage && (
              <VerdictBanner triage={detail.triage} />
            )}

            {/* Snapshot */}
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {detail.patient.name ?? 'Unnamed patient'}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {[
                      detail.patient.age ? `${detail.patient.age}y` : null,
                      detail.patient.gender,
                      detail.patient.occupation,
                      detail.patient.city,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="text-right text-sm text-slate-500">
                  {detail.patient.mobile && (
                    <p className="font-medium text-slate-700">
                      {detail.patient.mobile}
                    </p>
                  )}
                  <p>{formatWhen(detail.submittedAt)}</p>
                  <p className="text-xs uppercase tracking-wide">
                    Filled in {detail.language === 'hi' ? 'Hindi' : 'English'}
                  </p>
                </div>
              </div>

              {detail.emergencyTriggered && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  Emergency interrupt fired — this form was cut short and sent
                  immediately. It may be incomplete.
                </p>
              )}
              {detail.triage &&
                detail.triage.completeness !== null &&
                detail.triage.completeness < 1 &&
                !detail.emergencyTriggered && (
                  <p className="mt-3 text-xs text-slate-400">
                    {Math.round(detail.triage.completeness * 100)}% of applicable
                    questions answered.
                  </p>
                )}
            </section>

            {/* AI / template summary */}
            {detail.triage?.summaryText && (
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Summary
                </h2>
                <div className="space-y-1.5 text-sm leading-relaxed text-slate-700">
                  {detail.triage.summaryText.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </section>
            )}

            {/* Why this verdict */}
            {detail.triage && detail.triage.matchedRules.length > 0 && (
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Why this verdict
                </h2>
                <ul className="space-y-2.5">
                  {detail.triage.matchedRules.map((rule) => (
                    <li key={rule.code} className="flex gap-2.5 text-sm">
                      <span
                        className={
                          'mt-1.5 h-2 w-2 shrink-0 rounded-full ' +
                          CATEGORY_STYLE[rule.category].dot
                        }
                      />
                      <div>
                        <p className="font-medium text-slate-800">{rule.label}</p>
                        <p className="text-slate-500">{rule.explain}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                {detail.triage.secondaryNotes.length > 0 && (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    {detail.triage.secondaryNotes.map((note, i) => (
                      <p key={i} className="text-sm text-slate-500">
                        • {note}
                      </p>
                    ))}
                  </div>
                )}
                {detail.triage.contradictions.length > 0 && (
                  <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase text-amber-700">
                      Inconsistencies to verify
                    </p>
                    {detail.triage.contradictions.map((c, i) => (
                      <p key={i} className="text-sm text-amber-800">
                        • {c}
                      </p>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Red flags */}
            {detail.triage && (
              <RedFlags flags={detail.triage.redFlags} />
            )}

            {/* Decision capture */}
            <ReviewForm detail={detail} />

            {/* Full answers */}
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Full answers
              </h2>
              <div className="space-y-5">
                {detail.sections.map((section) => (
                  <div key={section.key}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {section.title}
                    </h3>
                    <dl className="space-y-1.5">
                      {section.items.map((item) => (
                        <div
                          key={item.key}
                          className="flex justify-between gap-4 text-sm"
                        >
                          <dt className="text-slate-500">{item.question}</dt>
                          <dd className="text-right font-medium text-slate-800">
                            {item.answer}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            </section>

            <p className="pb-8 text-xs text-slate-400">
              Draft triage logic — pending clinical review. This is a
              pre-consultation aid, not a diagnosis.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

function VerdictBanner({
  triage,
}: {
  triage: NonNullable<import('../lib/api').AssessmentDetail['triage']>
}) {
  const style = CATEGORY_STYLE[triage.category]
  return (
    <section className={'rounded-xl border p-5 ' + style.chip}>
      <div className="flex items-center gap-2">
        <span className={'h-3 w-3 rounded-full ' + style.dot} />
        <p className="text-lg font-bold">{style.label}</p>
        <span className="ml-auto rounded-full bg-white/60 px-2.5 py-0.5 text-xs font-semibold">
          {URGENCY_LABEL[triage.urgency]}
        </span>
      </div>
      <p className="mt-1.5 text-sm font-medium">{triage.pathway}</p>
    </section>
  )
}

function RedFlags({
  flags,
}: {
  flags: import('../lib/api').RedFlag[]
}) {
  const positive = flags.filter(
    (f) => f.answer !== 'No' && f.answer !== 'Not answered',
  )
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Red flags
      </h2>
      {positive.length === 0 ? (
        <p className="text-sm text-emerald-600">
          All red flags answered no.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {positive.map((f) => (
            <li key={f.key} className="flex justify-between gap-4 text-sm">
              <span className="text-slate-700">{f.label}</span>
              <span className="font-semibold text-red-600">{f.answer}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

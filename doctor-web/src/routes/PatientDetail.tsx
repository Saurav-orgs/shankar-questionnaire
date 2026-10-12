import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchDetail } from '../lib/api'
import {
  CATEGORY_STYLE,
  formatPoints,
  formatWhen,
  PATIENT_FACING_WORDING,
  URGENCY_LABEL,
} from '../lib/triage'
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

            {/* Team summary, in the WhatsApp format from the SOP */}
            {detail.triage?.summaryText && (
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Summary for the team
                  </h2>
                  <CopyButton text={detail.triage.summaryText} />
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
                  {detail.triage.summaryText}
                </pre>
              </section>
            )}

            {/* Why this category */}
            {detail.triage && detail.triage.matchedRules.length > 0 && (
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Why this category
                </h2>
                <ul className="space-y-2.5">
                  {detail.triage.matchedRules
                    .filter((rule) => rule.category)
                    .map((rule) => (
                      <li key={rule.code} className="flex gap-2.5 text-sm">
                        <span
                          className={
                            'mt-1.5 h-2 w-2 shrink-0 rounded-full ' +
                            (rule.category
                              ? (CATEGORY_STYLE[rule.category]?.dot ?? 'bg-slate-300')
                              : 'bg-slate-300')
                          }
                        />
                        <div>
                          <p className="font-medium text-slate-800">{rule.label}</p>
                          <p className="text-slate-500">{rule.explain}</p>
                        </div>
                      </li>
                    ))}
                </ul>

                {detail.triage.matchedRules.some((rule) => rule.points !== undefined) && (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Score breakdown
                      </h3>
                      <span className="text-sm font-semibold tabular-nums text-slate-700">
                        {detail.triage.score ?? '—'}
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {detail.triage.matchedRules
                        .filter((rule) => rule.points !== undefined)
                        .map((rule) => (
                          <li
                            key={rule.code}
                            className="flex items-baseline justify-between gap-4 text-sm"
                          >
                            <span className="text-slate-700" title={rule.explain}>
                              {rule.label}
                            </span>
                            <span
                              className={
                                'shrink-0 tabular-nums font-semibold ' +
                                ((rule.points ?? 0) < 0 ? 'text-slate-400' : 'text-slate-700')
                              }
                            >
                              {formatPoints(rule.points ?? 0)}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

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

            {/* What the team may tell the patient (SOP §7) */}
            <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-5">
              <div className="mb-1.5 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                  What to tell the patient
                </h2>
                <CopyButton text={PATIENT_FACING_WORDING} />
              </div>
              <p className="text-sm leading-relaxed text-slate-700">
                “{PATIENT_FACING_WORDING}”
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Never tell a patient they are, or are not, a surgical patient.
                The screening is administrative; the surgical decision is Dr.
                Acharya's, after examination.
              </p>
            </section>

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
              Administrative triage for appointment allocation — not a medical
              score, not a diagnosis. Draft logic pending Dr. Acharya's review.
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
        <span className="text-lg leading-none">{style.emoji}</span>
        <p className="text-lg font-bold">{style.label}</p>
        <span className="ml-auto flex items-center gap-2">
          {triage.score !== null && (
            <span
              className="rounded-full bg-white/60 px-2.5 py-0.5 text-xs font-semibold tabular-nums"
              title="Internal screening score — never shown to the patient"
            >
              Score {triage.score}
            </span>
          )}
          <span className="rounded-full bg-white/60 px-2.5 py-0.5 text-xs font-semibold">
            {URGENCY_LABEL[triage.urgency]}
          </span>
        </span>
      </div>
      <p className="mt-1.5 text-sm font-medium">{triage.pathway}</p>
    </section>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can be unavailable (http, old WebView) — the text is on
      // screen to select by hand, so there is nothing else to do.
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
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

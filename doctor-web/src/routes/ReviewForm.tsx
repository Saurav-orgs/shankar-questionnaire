import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  saveReview,
  type AssessmentDetail,
  type ReviewDecision,
} from '../lib/api'
import { DECISION_LABEL } from '../lib/triage'

const DECISIONS: ReviewDecision[] = [
  'accept_consult',
  'route_physio',
  'route_other_specialty',
  'request_more_info',
  'decline',
]

export function ReviewForm({ detail }: { detail: AssessmentDetail }) {
  const queryClient = useQueryClient()
  const existing = detail.review
  const [decision, setDecision] = useState<ReviewDecision | ''>(
    (existing?.decision as ReviewDecision) ?? '',
  )
  const [routeTo, setRouteTo] = useState(existing?.routeTo ?? '')
  const [agreed, setAgreed] = useState<boolean | null>(
    existing?.agreedWithTriage ?? null,
  )
  const [notes, setNotes] = useState(existing?.notes ?? '')

  const mutation = useMutation({
    mutationFn: () =>
      saveReview(detail.id, {
        decision: decision as ReviewDecision,
        routeTo: routeTo || undefined,
        agreedWithTriage: agreed ?? undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['detail', detail.id] })
      void queryClient.invalidateQueries({ queryKey: ['assessments'] })
    },
  })

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Your decision
      </h2>

      {existing && !mutation.isSuccess && (
        <p className="mt-1 text-xs text-slate-400">
          Previously recorded. Saving again adds a new entry.
        </p>
      )}

      <div className="mt-4 space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Decision</p>
          <div className="flex flex-wrap gap-2">
            {DECISIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDecision(d)}
                className={
                  'rounded-lg border px-3 py-1.5 text-sm transition ' +
                  (decision === d
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50')
                }
              >
                {DECISION_LABEL[d]}
              </button>
            ))}
          </div>
        </div>

        {decision === 'route_other_specialty' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Refer to
            </label>
            <input
              type="text"
              value={routeTo}
              onChange={(e) => setRouteTo(e.target.value)}
              placeholder="e.g. Orthopaedics — hip"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">
            Do you agree with the suggested verdict?
          </p>
          <div className="flex gap-2">
            {[
              { v: true, label: 'Agree' },
              { v: false, label: 'Disagree' },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => setAgreed(o.v)}
                className={
                  'rounded-lg border px-3 py-1.5 text-sm transition ' +
                  (agreed === o.v
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50')
                }
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!decision || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition disabled:bg-slate-300"
          >
            {mutation.isPending ? 'Saving…' : 'Save decision'}
          </button>
          {mutation.isSuccess && (
            <span className="text-sm text-emerald-600">Saved.</span>
          )}
        </div>
      </div>
    </section>
  )
}

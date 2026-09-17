import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchAssessments, type TriageCategory } from '../lib/api'
import { CATEGORY_STYLE, formatWhen, URGENCY_LABEL } from '../lib/triage'
import { AppHeader } from '../components/AppHeader'

const FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'RED', label: 'Emergency' },
  { key: 'AMBER', label: 'Spine consult' },
  { key: 'GREY', label: 'Refer elsewhere' },
  { key: 'GREEN', label: 'Conservative' },
]

export function Dashboard({ onLoggedOut }: { onLoggedOut: () => void }) {
  const navigate = useNavigate()
  const [category, setCategory] = useState('')
  const [q, setQ] = useState('')

  const { data: rows, isLoading, isError } = useQuery({
    queryKey: ['assessments', category, q],
    queryFn: () => fetchAssessments({ category, q }),
  })

  return (
    <div className="min-h-full">
      <AppHeader onLoggedOut={onLoggedOut} />

      <main className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setCategory(f.key)}
                className={
                  'rounded-full border px-3 py-1.5 text-sm font-medium transition ' +
                  (category === f.key
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50')
                }
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            type="search"
            placeholder="Search name or mobile"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-56 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {isLoading && <p className="py-12 text-center text-slate-400">Loading…</p>}
        {isError && (
          <p className="py-12 text-center text-red-600">
            Could not load patients.
          </p>
        )}

        {rows && rows.length === 0 && (
          <p className="py-12 text-center text-slate-400">
            No patients match this filter yet.
          </p>
        )}

        {rows && rows.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">Age/Sex</th>
                  <th className="px-4 py-3 font-medium">Main complaint</th>
                  <th className="px-4 py-3 font-medium">Red flags</th>
                  <th className="px-4 py-3 font-medium">Verdict</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const style = row.category
                    ? CATEGORY_STYLE[row.category as TriageCategory]
                    : null
                  return (
                    <tr
                      key={row.id}
                      onClick={() => navigate(`/patients/${row.id}`)}
                      className={
                        'cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 ' +
                        (style?.row ?? '')
                      }
                    >
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          <span
                            className={
                              'h-2.5 w-2.5 rounded-full ' + (style?.dot ?? 'bg-slate-300')
                            }
                          />
                          <span className="text-slate-600">
                            {row.urgency ? URGENCY_LABEL[row.urgency] : '—'}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {row.patientName ?? '—'}
                        {row.emergencyTriggered && (
                          <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700">
                            EMERGENCY
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.patientAge ?? '—'}
                        {row.patientGender ? ` / ${row.patientGender[0].toUpperCase()}` : ''}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.mainComplaint
                          ? row.mainComplaint.replace(/_/g, ' ')
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {row.redFlagCount > 0 ? (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700">
                            {row.redFlagCount}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {style && (
                          <span
                            className={
                              'rounded-full border px-2 py-0.5 text-xs font-medium ' +
                              style.chip
                            }
                          >
                            {style.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatWhen(row.submittedAt)}
                      </td>
                      <td className="px-4 py-3">
                        {row.reviewed ? (
                          <span className="text-emerald-600">Reviewed</span>
                        ) : (
                          <span className="text-slate-400">New</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-xs text-slate-400">
          Draft triage logic — pending clinical review. Not a diagnosis.
        </p>
      </main>
    </div>
  )
}

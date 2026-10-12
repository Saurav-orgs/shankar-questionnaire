import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchAssessments, type TriageCategory } from '../lib/api'
import { CATEGORY_STYLE, formatWhen, URGENCY_LABEL } from '../lib/triage'
import { AppHeader } from '../components/AppHeader'

// The SOP's letters are the chip labels everywhere — six chips fit one row
// at 375px, and the chips must never scroll. The full names are the tooltip.
const FILTERS: { key: string; label: string; title: string }[] = [
  { key: '', label: 'All', title: 'All patients' },
  ...(['URGENT', 'SURGICAL', 'REVIEW', 'ROUTINE', 'REPORT_ONLY'] as const).map(
    (key) => ({
      key,
      label: `${CATEGORY_STYLE[key].emoji} ${CATEGORY_STYLE[key].letter}`,
      title: CATEGORY_STYLE[key].label,
    }),
  ),
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

      <main className="mx-auto max-w-6xl px-3 py-3 md:px-6 md:py-6">
        {/* On a phone the six chips fit one row and the search takes the
            full width, so the list starts near the top. */}
        <div className="mb-3 flex flex-col gap-2 md:mb-4 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-3">
          <div className="flex flex-wrap gap-1.5 md:gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setCategory(f.key)}
                title={f.title}
                className={
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition md:px-3 md:py-1.5 md:text-sm ' +
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
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 md:w-56"
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
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white md:hidden">
            {rows.map((row) => {
              const style = row.category
                ? (CATEGORY_STYLE[row.category as TriageCategory] ?? null)
                : null
              return (
                // Two tight lines per patient: who + verdict, then the
                // details — so a phone screen shows ten or more at once.
                <li
                  key={row.id}
                  onClick={() => navigate(`/patients/${row.id}`)}
                  className={'cursor-pointer px-3 py-2 active:bg-slate-50 ' + (style?.row ?? '')}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        'h-2.5 w-2.5 shrink-0 rounded-full ' + (style?.dot ?? 'bg-slate-300')
                      }
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                      {row.patientName ?? '—'}
                      {row.emergencyTriggered && (
                        <span className="ml-1.5 rounded bg-red-100 px-1 py-0.5 text-[10px] font-semibold text-red-700">
                          EMERGENCY
                        </span>
                      )}
                    </span>
                    {style && (
                      <span
                        className={
                          'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ' +
                          style.chip
                        }
                        title={style.label}
                      >
                        {style.letter}
                        {row.score !== null && (
                          <span className="ml-1 opacity-70">{row.score}</span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 pl-[18px] text-xs text-slate-500">
                    <span className="shrink-0">
                      {row.patientAge ?? '—'}
                      {row.patientGender ? `/${row.patientGender[0].toUpperCase()}` : ''}
                    </span>
                    <span aria-hidden>·</span>
                    <span className="min-w-0 flex-1 truncate">
                      {row.mainComplaint ? row.mainComplaint.replace(/_/g, ' ') : '—'}
                    </span>
                    {row.redFlagCount > 0 && (
                      <span className="shrink-0 rounded bg-red-100 px-1 text-[11px] font-semibold text-red-700">
                        {row.redFlagCount} flag{row.redFlagCount > 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="shrink-0">{formatWhen(row.submittedAt)}</span>
                    <span
                      className={
                        'shrink-0 ' + (row.reviewed ? 'text-emerald-600' : 'text-slate-400')
                      }
                    >
                      {row.reviewed ? 'Reviewed' : 'New'}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {rows && rows.length > 0 && (
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">Age/Sex</th>
                  <th className="px-4 py-3 font-medium">Main complaint</th>
                  <th className="px-4 py-3 font-medium">Red flags</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const style = row.category
                    ? (CATEGORY_STYLE[row.category as TriageCategory] ?? null)
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
                            {style.emoji} {style.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium tabular-nums text-slate-700">
                        {row.score ?? '—'}
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
          Administrative triage for appointment allocation — not a medical
          score, not a diagnosis. Draft logic pending Dr. Acharya's review.
        </p>
      </main>
    </div>
  )
}

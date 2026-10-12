import type { TriageCategory, TriageUrgency } from './api'

/**
 * Dr. Acharya's appointment categories, named and coloured as in his SOP
 * (🔴 RED, 🟢 A, 🟡 B, ⚪ C, ⚫ D). `letter` is the chip on a phone, `label`
 * the full name on desktop, `action` what the team does with the patient.
 */
export const CATEGORY_STYLE: Record<
  TriageCategory,
  {
    letter: string
    emoji: string
    label: string
    action: string
    chip: string
    dot: string
    row: string
  }
> = {
  URGENT: {
    letter: 'RED',
    emoji: '🔴',
    label: 'RED — Urgent',
    action:
      'Do not put in a routine appointment slot. Advise urgent/emergency medical assessment.',
    chip: 'bg-red-100 text-red-800 border-red-200',
    dot: 'bg-red-500',
    row: 'bg-red-50/60',
  },
  SURGICAL: {
    letter: 'A',
    emoji: '🟢',
    label: 'A — High priority surgical evaluation',
    action: "Priority appointment in Dr. Acharya's next suitable surgical OPD.",
    chip: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
    row: '',
  },
  REVIEW: {
    letter: 'B',
    emoji: '🟡',
    label: 'B — Possible surgical case',
    action: 'Review MRI/report and questionnaire, then allocate a suitable slot.',
    chip: 'bg-amber-100 text-amber-800 border-amber-200',
    dot: 'bg-amber-400',
    row: '',
  },
  ROUTINE: {
    letter: 'C',
    emoji: '⚪',
    label: 'C — Routine / low surgical priority',
    action: "Not prioritised for Dr. Acharya's limited surgical OPD slots.",
    chip: 'bg-slate-100 text-slate-700 border-slate-300',
    dot: 'bg-slate-300',
    row: '',
  },
  REPORT_ONLY: {
    letter: 'D',
    emoji: '⚫',
    label: 'D — Report-only / second-opinion request',
    action:
      'Explain that Dr. Acharya does not give a report-only or online surgical opinion without a physical consultation.',
    chip: 'bg-zinc-200 text-zinc-800 border-zinc-300',
    dot: 'bg-zinc-700',
    row: '',
  },
}

export const URGENCY_LABEL: Record<TriageUrgency, string> = {
  emergency: 'See today',
  urgent: 'Urgent',
  priority: 'Prioritise',
  routine: 'Review',
  non_urgent: 'Routine',
}

/**
 * The only thing the team may tell a patient about the outcome (SOP §7).
 * Never "you are / are not a surgical patient".
 */
export const PATIENT_FACING_WORDING =
  'Based on the information provided, your appointment has been categorized for appropriate consultation priority. The need for surgery can only be decided by Dr. Shankar Acharya after examining you and reviewing the relevant investigations.'

export const DECISION_LABEL: Record<string, string> = {
  accept_consult: 'Accept for consult',
  route_physio: 'Send to physiotherapy',
  route_other_specialty: 'Refer to other specialty',
  request_more_info: 'Request more information',
  decline: 'Decline',
}

export function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "+4" / "−2" for a scoring finding. */
export function formatPoints(points: number): string {
  return points < 0 ? `−${Math.abs(points)}` : `+${points}`
}

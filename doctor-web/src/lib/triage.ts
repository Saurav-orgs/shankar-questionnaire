import type { TriageCategory, TriageUrgency } from './api'

export const CATEGORY_STYLE: Record<
  TriageCategory,
  { label: string; chip: string; dot: string; row: string }
> = {
  RED: {
    label: 'Emergency',
    chip: 'bg-red-100 text-red-800 border-red-200',
    dot: 'bg-red-500',
    row: 'bg-red-50/60',
  },
  AMBER: {
    label: 'Spine consult',
    chip: 'bg-amber-100 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    row: '',
  },
  GREY: {
    label: 'Refer elsewhere',
    chip: 'bg-slate-200 text-slate-700 border-slate-300',
    dot: 'bg-slate-400',
    row: '',
  },
  GREEN: {
    label: 'Conservative',
    chip: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
    row: '',
  },
}

export const URGENCY_LABEL: Record<TriageUrgency, string> = {
  emergency: 'See today',
  urgent: 'Urgent',
  routine: 'Routine',
  non_urgent: 'Non-urgent',
}

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

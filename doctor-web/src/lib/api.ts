import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api',
  // The doctor session is an httpOnly cookie, so every request must carry it.
  withCredentials: true,
})

export type TriageCategory =
  | 'URGENT'
  | 'SURGICAL'
  | 'REVIEW'
  | 'ROUTINE'
  | 'REPORT_ONLY'
export type TriageUrgency =
  | 'emergency'
  | 'urgent'
  | 'priority'
  | 'routine'
  | 'non_urgent'

export interface DashboardRow {
  id: string
  patientName: string | null
  patientAge: number | null
  patientGender: string | null
  patientMobile: string | null
  mainComplaint: string | null
  category: TriageCategory | null
  urgency: TriageUrgency | null
  score: number | null
  emergencyTriggered: boolean
  redFlagCount: number
  reviewed: boolean
  submittedAt: string | null
}

export interface MatchedRule {
  code: string
  label: string
  explain: string
  /** Category rules only. */
  severity?: number
  category?: TriageCategory
  /** Scoring rules only. */
  points?: number
}

export interface RedFlag {
  key: string
  label: string
  answer: string
}

export interface AssessmentDetail {
  id: string
  patient: {
    name: string | null
    age: number | null
    gender: string | null
    mobile: string | null
    city: string | null
    occupation: string | null
  }
  language: string
  status: string
  emergencyTriggered: boolean
  submittedAt: string | null
  triage: {
    category: TriageCategory
    urgency: TriageUrgency
    pathway: string
    score: number | null
    summaryText: string | null
    summarySource: string | null
    matchedRules: MatchedRule[]
    redFlags: RedFlag[]
    secondaryNotes: string[]
    contradictions: string[]
    unmatched: boolean
    completeness: number | null
  } | null
  sections: {
    key: string
    title: string
    items: { key: string; question: string; answer: string }[]
  }[]
  review: {
    decision: string
    routeTo: string | null
    agreedWithTriage: boolean | null
    notes: string | null
    reviewedAt: string
  } | null
}

export type ReviewDecision =
  | 'accept_consult'
  | 'route_physio'
  | 'route_other_specialty'
  | 'request_more_info'
  | 'decline'

export interface ReviewInput {
  decision: ReviewDecision
  routeTo?: string
  agreedWithTriage?: boolean
  notes?: string
}

export async function checkSession(): Promise<boolean> {
  try {
    await api.get('/doctor/me')
    return true
  } catch {
    return false
  }
}

export async function login(passcode: string): Promise<void> {
  await api.post('/doctor/auth', { passcode })
}

export async function logout(): Promise<void> {
  await api.post('/doctor/logout')
}

export async function fetchAssessments(params: {
  category?: string
  q?: string
}): Promise<DashboardRow[]> {
  const { data } = await api.get<DashboardRow[]>('/doctor/assessments', {
    params: {
      category: params.category || undefined,
      q: params.q || undefined,
    },
  })
  return data
}

export async function fetchDetail(id: string): Promise<AssessmentDetail> {
  const { data } = await api.get<AssessmentDetail>(`/doctor/assessments/${id}`)
  return data
}

export async function saveReview(id: string, input: ReviewInput): Promise<void> {
  await api.post(`/doctor/assessments/${id}/review`, input)
}

import axios from 'axios'
import type { AnswerMap, AnswerValue, Lang, QuestionType } from '../questionnaire/types'

export const api = axios.create({
  baseURL:  'https://api.devenvironment.space/api',
})

export interface HealthReport {
  status: 'ok' | 'degraded'
  uptimeSeconds: number
  timestamp: string
  database: {
    connected: boolean
    name?: string
    serverVersion?: string
    latencyMs?: number
    error?: string
  }
}

export async function fetchHealth(): Promise<HealthReport> {
  const { data } = await api.get<HealthReport>('/health')
  return data
}

export interface DoctorProfile {
  id: string
  fullName: string
  qualifications: string | null
  specialty: string | null
  bio: string | null
  photoUrl: string | null
  clinicName: string | null
  clinicAddress: string | null
  clinicPhone: string | null
  emergencyPhone: string | null
}

export async function fetchDoctorProfile(lang: Lang): Promise<DoctorProfile> {
  const { data } = await api.get<DoctorProfile>('/doctor-profile', { params: { lang } })
  return data
}

/* -------- Localized schema (resolved strings, not the bilingual pairs) -------- */

export interface LocalizedOption {
  code: string
  label: string
}

export interface LocalizedQuestion {
  key: string
  section: string
  type: QuestionType
  text: string
  help?: string
  options?: LocalizedOption[]
  optionsFromKey?: string
  min?: number
  max?: number
  minLabel?: string
  maxLabel?: string
  maxLength?: number
  required: boolean
  minSelections?: number
  showIf?: unknown
  isRedFlag?: boolean
  isEmergencyTrigger?: boolean
  emergencyValues?: string[]
}

export interface LocalizedSection {
  key: string
  order: number
  title: string
}

export interface LocalizedSchema {
  version: number
  language: Lang
  sections: LocalizedSection[]
  questions: LocalizedQuestion[]
  consent: { body: string; checkboxLabel: string }
  emergencyScreen: { heading: string; body: string }
  completionScreen: { heading: string; body: string }
  disclaimer: string
}

export async function fetchQuestionnaire(lang: Lang): Promise<LocalizedSchema> {
  const { data } = await api.get<LocalizedSchema>('/questionnaire/active', { params: { lang } })
  return data
}

/* -------- Assessment lifecycle -------- */

export interface AssessmentState {
  token: string
  language: Lang
  status: 'in_progress' | 'submitted' | 'abandoned'
  emergencyTriggered: boolean
  answers: AnswerMap
  progress: { answered: number; total: number }
  nextQuestionKey: string | null
  missingRequiredKeys: string[]
  schema?: LocalizedSchema
}

export interface AnswerProblem {
  key: string
  message: string
}

export class AnswerRejected extends Error {
  problems: AnswerProblem[]
  constructor(problems: AnswerProblem[]) {
    super('Some answers could not be accepted.')
    this.problems = problems
  }
}

function extractProblems(error: unknown): AnswerProblem[] | null {
  if (axios.isAxiosError(error) && error.response?.status === 400) {
    const body = error.response.data as { problems?: AnswerProblem[] }
    if (Array.isArray(body?.problems)) return body.problems
  }
  return null
}

export async function createAssessment(
  language: Lang,
  consent: boolean,
): Promise<AssessmentState> {
  const { data } = await api.post<AssessmentState>('/assessments', { language, consent })
  return data
}

export async function fetchAssessment(
  token: string,
  withSchema = true,
): Promise<AssessmentState> {
  const { data } = await api.get<AssessmentState>(`/assessments/${token}`, {
    params: { schema: withSchema ? 'true' : undefined },
  })
  return data
}

export async function setAssessmentLanguage(
  token: string,
  language: Lang,
): Promise<AssessmentState> {
  const { data } = await api.patch<AssessmentState>(`/assessments/${token}/language`, {
    language,
  })
  return data
}

export async function patchAnswers(
  token: string,
  answers: Record<string, AnswerValue>,
  currentQuestionKey?: string,
): Promise<AssessmentState & { emergency: boolean }> {
  try {
    const { data } = await api.patch<AssessmentState & { emergency: boolean }>(
      `/assessments/${token}/answers`,
      { answers, currentQuestionKey },
    )
    return data
  } catch (error) {
    const problems = extractProblems(error)
    if (problems) throw new AnswerRejected(problems)
    throw error
  }
}

export async function submitAssessment(token: string): Promise<AssessmentState> {
  try {
    const { data } = await api.post<AssessmentState>(`/assessments/${token}/submit`)
    return data
  } catch (error) {
    const problems = extractProblems(error)
    if (problems) throw new AnswerRejected(problems)
    throw error
  }
}

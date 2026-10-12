import { missingRequired, visibleQuestions } from '../questionnaire/evaluator'
import type {
  AnswerValue,
  EvaluationContext,
  QuestionnaireSchema,
} from '../questionnaire/types'
import type { LocalizedQuestion, LocalizedSchema } from './api'

/**
 * Three steps: Section A (patient details), Section B (Q1–4), then Sections
 * C–E (Q5–10). A page is a list of schema sections; the sections themselves
 * stay separate because the doctor panel groups answers by them.
 */
export const PAGES: readonly (readonly string[])[] = [
  ['details'],
  ['problem'],
  ['treatment', 'imaging', 'reason'],
]

/** Index of the page a section is on, or -1 if it is shown one question at a time. */
export function pageOf(section: string): number {
  return PAGES.findIndex((sections) => sections.includes(section))
}

/**
 * The evaluator (evaluateCondition, visibleQuestions, ...) only reads
 * question.key/.section/.type/.showIf/.required/.isRedFlag/.isEmergencyTrigger
 * /.emergencyValues/.minSelections — never .text/.options/.help, which are the
 * only fields that differ between the bilingual `Question` the evaluator was
 * written against and the resolved-string `LocalizedQuestion` the API sends.
 * The cast is safe for that reason; do not start reading label fields off the
 * cast value.
 */
export function asEvaluatorSchema(schema: LocalizedSchema): QuestionnaireSchema {
  return schema as unknown as QuestionnaireSchema
}

export function sectionOf(schema: LocalizedSchema, key: string): string | null {
  return schema.questions.find((q) => q.key === key)?.section ?? null
}

/** Visible questions on a page, in schema order, for the given answers. */
export function questionsOnPage(
  schema: LocalizedSchema,
  page: number,
  context: EvaluationContext,
): LocalizedQuestion[] {
  const evalSchema = asEvaluatorSchema(schema)
  const visibleKeys = new Set(
    visibleQuestions(evalSchema, context).map((q) => q.key),
  )
  return schema.questions.filter(
    (q) => pageOf(q.section) === page && visibleKeys.has(q.key),
  )
}

function isBlank(value: AnswerValue | undefined): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

/**
 * The next question to show, walking visible questions in schema order.
 *
 * "Next" is the first visible question that is still blank — with two carve-outs
 * for optional questions, which otherwise stall the flow because a blank
 * optional answer is indistinguishable from an unreached one and would be
 * re-offered forever:
 *
 *  1. A page submits every visible field at once. Once every REQUIRED field
 *     on the page is answered, the whole page counts as done even if an
 *     optional field (e.g. surgery_advised_detail) stayed blank.
 *
 *  2. Ungrouped optional questions (none in v2, kept for schema changes) are
 *     shown once; when the patient skips one it is added to `skipped` by the
 *     caller, and from then on a blank-but-skipped optional question no longer
 *     blocks progression to the submit screen.
 *
 * Required questions always block until answered, regardless of `skipped`.
 */
export function nextVisibleQuestion(
  schema: LocalizedSchema,
  context: EvaluationContext,
  skipped: ReadonlySet<string> = new Set(),
): LocalizedQuestion | null {
  const evalSchema = asEvaluatorSchema(schema)
  const visible = visibleQuestions(evalSchema, context)

  for (const q of visible) {
    const page = pageOf(q.section)
    if (page >= 0 && !q.required) {
      const pageRequired = visible.filter(
        (v) => pageOf(v.section) === page && v.required,
      )
      const pageRequiredDone = pageRequired.every(
        (v) => !isBlank(context[v.key] as AnswerValue | undefined),
      )
      if (pageRequiredDone) continue
    }
    // An optional question the patient already skipped no longer blocks.
    if (!q.required && skipped.has(q.key)) continue
    if (isBlank(context[q.key] as AnswerValue | undefined)) {
      return schema.questions.find((sq) => sq.key === q.key) ?? null
    }
  }
  return null
}

export function missingRequiredKeys(
  schema: LocalizedSchema,
  context: EvaluationContext,
): string[] {
  return missingRequired(asEvaluatorSchema(schema), context).map((q) => q.key)
}

/** Options for a question, narrowed to another question's selected codes. */
export function optionsFor(
  question: LocalizedQuestion,
  answers: EvaluationContext,
): { code: string; label: string }[] {
  if (!question.optionsFromKey) return question.options ?? []
  const selected = answers[question.optionsFromKey]
  const codes = new Set(Array.isArray(selected) ? selected.map(String) : [])
  return (question.options ?? []).filter((o) => codes.has(o.code))
}

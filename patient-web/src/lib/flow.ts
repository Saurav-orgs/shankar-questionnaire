import { missingRequired, visibleQuestions } from '../questionnaire/evaluator'
import type {
  AnswerValue,
  EvaluationContext,
  QuestionnaireSchema,
} from '../questionnaire/types'
import type { LocalizedQuestion, LocalizedSchema } from './api'

/**
 * Sections rendered as one grouped screen instead of one screen per question.
 * A full patient answers ~45-47 questions (measured in Phase 2) — one screen
 * each would blow the 5-7 minute budget. See plan.md §6.
 */
export const GROUPED_SECTIONS = new Set(['details', 'red_flags', 'function'])

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

export function questionsInSection(
  schema: LocalizedSchema,
  section: string,
  context: EvaluationContext,
): LocalizedQuestion[] {
  const evalSchema = asEvaluatorSchema(schema)
  const visibleKeys = new Set(
    visibleQuestions(evalSchema, context).map((q) => q.key),
  )
  return schema.questions.filter(
    (q) => q.section === section && visibleKeys.has(q.key),
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
 *  1. Grouped sections (details/red_flags/function) submit every visible field
 *     at once. Once every REQUIRED field in the section is answered, the whole
 *     section counts as done even if an optional field (e.g. city) stayed blank.
 *
 *  2. Ungrouped optional questions (free_text, tx_prior_surgery_detail) are
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
    if (GROUPED_SECTIONS.has(q.section) && !q.required) {
      const sectionRequired = visible.filter(
        (v) => v.section === q.section && v.required,
      )
      const sectionRequiredDone = sectionRequired.every(
        (v) => !isBlank(context[v.key] as AnswerValue | undefined),
      )
      if (sectionRequiredDone) continue
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

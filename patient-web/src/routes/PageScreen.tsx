import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LocalizedQuestion, LocalizedSchema } from '../lib/api'
import { PAGES, questionsOnPage } from '../lib/flow'
import { CompactChoiceRow } from '../components/CompactChoiceRow'
import { QuestionInput } from '../components/QuestionInput'
import { ErrorBanner, PrimaryButton, SecondaryButton } from '../components/PageShell'
import type { AnswerValue, EvaluationContext } from '../questionnaire/types'

function isBlank(value: AnswerValue | undefined | null): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

/** Yes/no pickers render as one compact row; longer lists and labels stack. */
function isCompact(question: LocalizedQuestion): boolean {
  return (
    question.type === 'single_choice' &&
    (question.options?.length ?? 0) <= 3 &&
    question.options!.every((o) => o.label.length <= 12)
  )
}

/**
 * One step of the form (details, Q1–4, Q5–10). Visibility is re-evaluated on
 * every change, so "Name of surgery advised" appears under Q9 the moment the
 * patient taps Yes — the follow-ups live on the same page as their trigger.
 *
 * The last page's button reads "Submit" and hands the answers straight to
 * the parent, which saves and submits in one go — there is no separate
 * review screen.
 */
export function PageScreen({
  page,
  schema,
  answers,
  onContinue,
  onBack,
  canGoBack,
  pending,
  serverError,
}: {
  page: number
  schema: LocalizedSchema
  answers: EvaluationContext
  onContinue: (values: Record<string, AnswerValue>) => void
  onBack: () => void
  canGoBack: boolean
  pending: boolean
  serverError: string | null
}) {
  const { t } = useTranslation()
  const [values, setValues] = useState<Record<string, AnswerValue>>(() => {
    const initial: Record<string, AnswerValue> = {}
    for (const q of schema.questions) {
      const existing = answers[q.key] as AnswerValue | undefined
      if (existing !== undefined) initial[q.key] = existing
    }
    return initial
  })
  const [attempted, setAttempted] = useState(false)

  // A new page starts at the top — otherwise page 2 opens wherever the
  // patient had scrolled to on page 1.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [page])

  const context = useMemo(() => ({ ...answers, ...values }), [answers, values])
  const visible = useMemo(
    () => questionsOnPage(schema, page, context),
    [schema, page, context],
  )

  const set = (key: string, value: AnswerValue) =>
    setValues((prev) => ({ ...prev, [key]: value }))

  const invalidKeys = visible
    .filter((q) => q.required && isBlank(values[q.key]))
    .map((q) => q.key)

  const handleContinue = () => {
    setAttempted(true)
    if (invalidKeys.length) return
    // Only what is visible now — a follow-up hidden by a changed answer must
    // not be sent as a stale value.
    const out: Record<string, AnswerValue> = {}
    for (const q of visible) out[q.key] = values[q.key] ?? (q.type === 'multi_choice' ? [] : null)
    onContinue(out)
  }

  const sections = PAGES[page]
    .map((key) => schema.sections.find((s) => s.key === key))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))

  return (
    <div>
      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-slate-400">
        {t('pageOf', { page: page + 1, total: PAGES.length })}
      </p>

      <div className="space-y-8">
        {sections.map((section) => {
          const questions = visible.filter((q) => q.section === section.key)
          if (!questions.length) return null
          return (
            <section key={section.key}>
              <h2 className="mb-3 text-lg font-semibold text-slate-900">{section.title}</h2>
              <div className="space-y-4">
                {questions.map((question) => {
                  const error = attempted && invalidKeys.includes(question.key)
                  if (question.options && isCompact(question)) {
                    return (
                      <CompactChoiceRow
                        key={question.key}
                        label={question.text}
                        help={question.help}
                        options={question.options}
                        value={values[question.key] as string | undefined}
                        onChange={(code) => set(question.key, code)}
                        error={error}
                      />
                    )
                  }
                  return (
                    <div key={question.key}>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        {question.text}
                      </label>
                      {question.help && (
                        <p className="mb-2 text-sm text-slate-500">{question.help}</p>
                      )}
                      <QuestionInput
                        question={question}
                        value={values[question.key] ?? undefined}
                        onChange={(v) => set(question.key, v)}
                      />
                      {error && <p className="mt-1.5 text-sm text-red-600">{t('required')}</p>}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      {attempted && invalidKeys.length > 0 && (
        <div className="mt-4"><ErrorBanner message={t('fixErrors')} /></div>
      )}
      {serverError && <div className="mt-4"><ErrorBanner message={serverError} /></div>}

      <div className="mt-6 flex gap-3">
        {canGoBack && (
          <div className="w-24">
            <SecondaryButton onClick={onBack}>{t('back')}</SecondaryButton>
          </div>
        )}
        <div className="flex-1">
          <PrimaryButton onClick={handleContinue} loading={pending}>
            {page === PAGES.length - 1 ? t('submit') : t('next')}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}

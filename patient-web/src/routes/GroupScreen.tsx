import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LocalizedQuestion } from '../lib/api'
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

const TITLE_KEY: Record<string, string> = {
  details: 'yourDetails',
  red_flags: 'importantChecks',
  function: 'dailyLife',
}

export function GroupScreen({
  section,
  questions,
  answers,
  onContinue,
  onBack,
  canGoBack,
  pending,
  serverError,
}: {
  section: string
  questions: LocalizedQuestion[]
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
    for (const q of questions) {
      const existing = answers[q.key] as AnswerValue | undefined
      initial[q.key] = existing ?? (q.type === 'multi_choice' ? [] : null)
    }
    return initial
  })
  const [attempted, setAttempted] = useState(false)

  const set = (key: string, value: AnswerValue) =>
    setValues((prev) => ({ ...prev, [key]: value }))

  const invalidKeys = questions
    .filter((q) => q.required && isBlank(values[q.key]))
    .map((q) => q.key)

  const handleContinue = () => {
    setAttempted(true)
    if (invalidKeys.length) return
    onContinue(values)
  }

  const isCompact = section === 'red_flags'
  const titleKey = TITLE_KEY[section] ?? section

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{t(titleKey)}</h2>

      <div className={isCompact ? 'space-y-3' : 'space-y-6'}>
        {questions.map((question) => {
          if (isCompact && question.options) {
            return (
              <CompactChoiceRow
                key={question.key}
                label={question.text}
                options={question.options}
                value={values[question.key] as string | undefined}
                onChange={(code) => set(question.key, code)}
                error={attempted && invalidKeys.includes(question.key)}
              />
            )
          }
          return (
            <div key={question.key}>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {question.text}
              </label>
              <QuestionInput
                question={question}
                value={values[question.key] ?? undefined}
                onChange={(v) => set(question.key, v)}
              />
              {attempted && invalidKeys.includes(question.key) && (
                <p className="mt-1.5 text-sm text-red-600">{t('required')}</p>
              )}
            </div>
          )
        })}
      </div>

      {serverError && <div className="mt-4"><ErrorBanner message={serverError} /></div>}

      <div className="mt-6 flex gap-3">
        {canGoBack && (
          <div className="w-24">
            <SecondaryButton onClick={onBack}>{t('back')}</SecondaryButton>
          </div>
        )}
        <div className="flex-1">
          <PrimaryButton onClick={handleContinue} loading={pending}>
            {t('continue')}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}

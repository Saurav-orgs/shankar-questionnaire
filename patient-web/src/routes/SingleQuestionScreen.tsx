import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LocalizedQuestion } from '../lib/api'
import { optionsFor } from '../lib/flow'
import { QuestionInput } from '../components/QuestionInput'
import { ErrorBanner, PrimaryButton, SecondaryButton } from '../components/PageShell'
import type { AnswerValue, EvaluationContext } from '../questionnaire/types'

function isBlank(value: AnswerValue | undefined): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

/** Loose client-side mirror of the server's rules, for instant feedback only. */
function clientError(question: LocalizedQuestion, value: AnswerValue | undefined): string | null {
  if (isBlank(value)) return question.required ? 'required' : null
  if (question.type === 'tel' && typeof value === 'string' && !/^\d{10}$/.test(value)) {
    return 'mobile'
  }
  if (
    question.type === 'multi_choice' &&
    Array.isArray(value) &&
    question.minSelections &&
    value.length < question.minSelections
  ) {
    return 'minSelections'
  }
  return null
}

export function SingleQuestionScreen({
  question,
  answers,
  onContinue,
  onBack,
  canGoBack,
  pending,
  serverError,
}: {
  question: LocalizedQuestion
  answers: EvaluationContext
  onContinue: (value: AnswerValue) => void
  onBack: () => void
  canGoBack: boolean
  pending: boolean
  serverError: string | null
}) {
  const { t } = useTranslation()
  const initial = (answers[question.key] as AnswerValue | undefined) ?? null
  const [value, setValue] = useState<AnswerValue>(
    question.type === 'multi_choice' ? (Array.isArray(initial) ? initial : []) : initial,
  )
  const [attempted, setAttempted] = useState(false)

  const options = optionsFor(question, answers)
  const error = clientError(question, value)

  const handleContinue = () => {
    setAttempted(true)
    if (error) return
    onContinue(value)
  }

  const errorText =
    error === 'required'
      ? t('required')
      : error === 'mobile'
        ? t('enterMobile')
        : error === 'minSelections'
          ? t('selectAtLeastOne')
          : null

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold leading-snug text-slate-900">
        {question.text}
      </h2>
      {question.help && <p className="mb-4 text-sm text-slate-500">{question.help}</p>}
      {!question.help && <div className="mb-4" />}

      <QuestionInput
        question={question}
        options={options}
        value={value ?? undefined}
        onChange={setValue}
        autoFocus={question.type === 'text' || question.type === 'textarea'}
      />

      {attempted && errorText && <p className="mt-3 text-sm text-red-600">{errorText}</p>}
      {serverError && <div className="mt-3"><ErrorBanner message={serverError} /></div>}

      <div className="mt-6 flex gap-3">
        {canGoBack && (
          <div className="w-24">
            <SecondaryButton onClick={onBack}>{t('back')}</SecondaryButton>
          </div>
        )}
        <div className="flex-1">
          <PrimaryButton
            onClick={handleContinue}
            loading={pending}
            disabled={attempted && !!error}
          >
            {question.required ? t('next') : value === null || (Array.isArray(value) && value.length === 0) ? t('skip') : t('next')}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}

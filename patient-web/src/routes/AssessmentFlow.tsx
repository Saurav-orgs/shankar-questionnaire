import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AnswerRejected,
  fetchAssessment,
  patchAnswers,
  setAssessmentLanguage,
  submitAssessment,
  type LocalizedQuestion,
} from '../lib/api'
import { PAGES, nextVisibleQuestion, pageOf } from '../lib/flow'
import type { AnswerValue } from '../questionnaire/types'
import { Disclaimer } from '../components/Disclaimer'
import { LanguageToggle } from '../components/LanguageToggle'
import { PageShell } from '../components/PageShell'
import { ProgressBar } from '../components/ProgressBar'
import { AssessmentFlowSkeleton, ResumeError } from './FlowStates'
import { Done } from './Done'
import { PageScreen } from './PageScreen'
import { SingleQuestionScreen } from './SingleQuestionScreen'

function screenId(section: string | null, key: string): string {
  const page = section ? pageOf(section) : -1
  if (page >= 0) return `page:${page}`
  return `q:${key}`
}

export function AssessmentFlow() {
  const { token = '' } = useParams()
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [backOverride, setBackOverride] = useState<string | null>(null)
  const historyRef = useRef<string[]>([])
  const [serverError, setServerError] = useState<string | null>(null)
  // Optional questions the patient chose to skip. Without this, a blank
  // optional answer (e.g. free_text) is re-offered forever and the flow can
  // never reach the submit screen. See nextVisibleQuestion in lib/flow.ts.
  const skippedRef = useRef<Set<string>>(new Set())

  const query = useQuery({
    queryKey: ['assessment', token],
    queryFn: () => fetchAssessment(token, true),
    retry: 1,
  })

  const state = query.data

  useEffect(() => {
    if (state?.language) void i18n.changeLanguage(state.language)
  }, [state?.language, i18n])

  const patch = useMutation({
    mutationFn: (vars: { answers: Record<string, AnswerValue>; key?: string }) =>
      patchAnswers(token, vars.answers, vars.key),
    onSuccess: (result) => {
      setServerError(null)
      queryClient.setQueryData(['assessment', token], (prev: typeof state) => ({
        ...prev,
        ...result,
        schema: prev?.schema,
      }))
      // On a red-flag early-submit the patch result already carries
      // status='submitted', so the cached state renders the completion screen;
      // no refetch needed. Otherwise refetch to advance to the next question.
      if (!result.emergency) void query.refetch()
    },
    onError: (error) => {
      setServerError(
        error instanceof AnswerRejected
          ? error.problems.map((p) => p.message).join(' ')
          : 'Something went wrong. Please try again.',
      )
    },
  })

  const submit = useMutation({
    mutationFn: () => submitAssessment(token),
    onSuccess: () => {
      setServerError(null)
      void query.refetch()
    },
    onError: () => setServerError('Something went wrong. Please try again.'),
  })

  const languageMutation = useMutation({
    mutationFn: (lang: 'en' | 'hi') => setAssessmentLanguage(token, lang),
    onSuccess: () => void query.refetch(),
  })

  if (query.isLoading) return <AssessmentFlowSkeleton />
  if (query.isError || !state) return <ResumeError onStartOver={() => navigate('/')} />
  if (!state.schema) return <AssessmentFlowSkeleton />

  const schema = state.schema

  // Every submitted assessment ends on the same calm completion screen —
  // including one cut short by a red flag. The patient is never shown anything
  // alarming; the doctor sees red-flag cases prioritised on their side and
  // decides. See the completionScreen note in api/.../v1/copy.ts.
  if (state.status === 'submitted') {
    return (
      <PageShell footer={<Disclaimer text={schema.disclaimer} />}>
        <Done
          heading={schema.completionScreen.heading}
          body={schema.completionScreen.body}
        />
      </PageShell>
    )
  }

  // Computed client-side, not from state.nextQuestionKey — see nextVisibleQuestion's
  // doc comment for why: the server's version can't tell "optional field left
  // blank inside an already-submitted group" from "never reached", which stalls
  // the flow on a field like `city` forever. This computation can.
  //
  // When nothing is left to answer (e.g. a resumed, fully-filled form) the
  // last page is shown again with its Submit button rather than a separate
  // review screen.
  const lastPageId = `page:${PAGES.length - 1}`
  const upcoming = nextVisibleQuestion(schema, state.answers, skippedRef.current)
  const effectiveId =
    backOverride ??
    (upcoming === null ? lastPageId : screenId(upcoming.section, upcoming.key))

  if (!backOverride) {
    const last = historyRef.current[historyRef.current.length - 1]
    if (last !== effectiveId) historyRef.current.push(effectiveId)
  }

  const canGoBack = historyRef.current.length > 1
  const handleBack = () => {
    const hist = historyRef.current
    if (hist.length <= 1) return
    hist.pop()
    setBackOverride(hist[hist.length - 1])
  }

  const advanceFromOverride = () => setBackOverride(null)

  const handleGroupContinue = (page: number) => (values: Record<string, AnswerValue>) => {
    patch.mutate(
      { answers: values },
      {
        onSuccess: (result) => {
          advanceFromOverride()
          // Last page: save, then submit — unless a red flag on this page
          // already submitted the assessment server-side.
          if (page === PAGES.length - 1 && !result.emergency) submit.mutate()
        },
      },
    )
  }

  const handleSingleContinue = (key: string) => (value: AnswerValue) => {
    // Skipping an optional question (advancing while blank) records the key so
    // nextVisibleQuestion stops re-offering it and the flow can reach submit.
    const blank =
      value === null ||
      value === undefined ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0)
    if (blank) skippedRef.current.add(key)
    else skippedRef.current.delete(key)

    patch.mutate(
      { answers: { [key]: value }, key },
      { onSuccess: () => advanceFromOverride() },
    )
  }

  const renderById = (id: string) => {
    if (id.startsWith('page:')) {
      const page = Number(id.slice('page:'.length))
      return (
        // key forces a remount when the page changes, so PageScreen's
        // internal useState re-initialises from this page's answers instead
        // of carrying the previous screen's selections forward.
        <PageScreen
          key={id}
          page={page}
          schema={schema}
          answers={state.answers}
          onContinue={handleGroupContinue(page)}
          onBack={handleBack}
          canGoBack={canGoBack}
          pending={patch.isPending || submit.isPending}
          serverError={serverError}
        />
      )
    }

    const key = id.slice('q:'.length)
    const question = schema.questions.find((q: LocalizedQuestion) => q.key === key)
    if (!question) return <AssessmentFlowSkeleton />
    return (
      // key={id} is essential: without it React reuses one SingleQuestionScreen
      // instance across every question, and its `value` useState keeps the prior
      // question's answer — e.g. ["none"] from the scans/comorbidities question
      // bleeding into chief_complaint, which the server then rejects.
      <SingleQuestionScreen
        key={id}
        question={question}
        answers={state.answers}
        onContinue={handleSingleContinue(key)}
        onBack={handleBack}
        canGoBack={canGoBack}
        pending={patch.isPending}
        serverError={serverError}
      />
    )
  }

  return (
    <PageShell footer={<Disclaimer text={schema.disclaimer} />}>
      <div className="mb-2 flex justify-end">
        <LanguageToggle
          value={state.language}
          onChange={(lang) => languageMutation.mutate(lang)}
        />
      </div>
      <ProgressBar answered={state.progress.answered} total={state.progress.total} />
      {renderById(effectiveId)}
    </PageShell>
  )
}

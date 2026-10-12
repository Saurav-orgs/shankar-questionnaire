import type { AnswerValue, Question } from './types';

export interface AnswerProblem {
  key: string;
  message: string;
}

/**
 * Server-side answer validation.
 *
 * The client evaluates branching locally so screens change instantly, but it is
 * a convenience only — everything is re-checked here. A client cannot invent an
 * option code, exceed a scale, or skip a required question by editing requests.
 */
export function validateAnswer(
  question: Question,
  value: AnswerValue,
): string | null {
  const blank =
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0);

  if (blank) {
    return question.required ? 'This question is required.' : null;
  }

  switch (question.type) {
    case 'text':
    case 'textarea': {
      if (typeof value !== 'string') return 'Expected text.';
      if (question.maxLength && value.length > question.maxLength) {
        return `Must be ${question.maxLength} characters or fewer.`;
      }
      return null;
    }

    case 'tel': {
      if (typeof value !== 'string') return 'Expected a phone number.';
      if (!/^[0-9]{10}$/.test(value.trim())) {
        return 'Enter a 10-digit mobile number.';
      }
      return null;
    }

    case 'number':
    case 'scale': {
      const parsed = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(parsed)) return 'Expected a number.';
      if (question.min !== undefined && parsed < question.min) {
        return `Must be ${question.min} or more.`;
      }
      if (question.max !== undefined && parsed > question.max) {
        return `Must be ${question.max} or less.`;
      }
      return null;
    }

    case 'yes_no':
    case 'single_choice': {
      if (Array.isArray(value)) return 'Expected a single choice.';
      const codes = question.options?.map((o) => o.code) ?? [];
      if (!codes.includes(String(value))) return 'Not a valid choice.';
      return null;
    }

    case 'multi_choice': {
      if (!Array.isArray(value)) return 'Expected a list of choices.';
      const codes = new Set(question.options?.map((o) => o.code) ?? []);
      for (const item of value) {
        if (!codes.has(String(item))) return `"${String(item)}" is not a valid choice.`;
      }
      if (new Set(value.map(String)).size !== value.length) {
        return 'Duplicate choices.';
      }
      if (question.minSelections && value.length < question.minSelections) {
        return `Select at least ${question.minSelections}.`;
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Answers that contradict each other. These do not block submission — the
 * doctor decides what to make of them — but an intake where someone reports no
 * back pain and then answers the whole back-pain branch is worth flagging
 * rather than presenting as clean data.
 */
export function findContradictions(
  answers: Record<string, AnswerValue>,
): string[] {
  const notes: string[] = [];

  const listOf = (key: string): string[] =>
    Array.isArray(answers[key]) ? (answers[key] as unknown[]).map(String) : [];

  const problems = listOf('main_problem');
  const treatment = listOf('treatment');

  if (problems.includes('weakness') && answers.weakness === 'no') {
    notes.push(
      'Selected "weakness in arm/leg" as a main problem, but answered no to weakness.',
    );
  }

  if (problems.includes('walking_balance') && answers.walking_balance === 'no') {
    notes.push(
      'Selected "difficulty walking/balance" as a main problem, but answered no to walking difficulty.',
    );
  }

  const diagnosis = listOf('diagnosis');
  if (diagnosis.includes('dont_know') && diagnosis.length > 1) {
    notes.push('Selected "don\'t know" alongside a named diagnosis.');
  }

  if (treatment.includes('none') && treatment.length > 1) {
    notes.push('Selected "no treatment" alongside other treatments.');
  }

  if (
    answers.surgery_advised === 'no' &&
    answers.consult_reason === 'surgery_advised'
  ) {
    notes.push(
      'Says no doctor has advised surgery, but gives "surgery has already been advised" as the reason for consultation.',
    );
  }

  if (answers.has_imaging === 'no' && answers.consult_reason === 'report_review') {
    notes.push('Has no imaging, but only wants a report reviewed.');
  }

  if (
    answers.consult_reason === 'worsening_despite_treatment' &&
    treatment.includes('none')
  ) {
    notes.push('Reports worsening despite treatment, but has had no treatment.');
  }

  return notes;
}

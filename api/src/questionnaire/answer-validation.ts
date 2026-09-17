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
  const complaints = Array.isArray(answers.chief_complaint)
    ? answers.chief_complaint.map(String)
    : [];

  const answered = (key: string) =>
    answers[key] !== undefined && answers[key] !== null && answers[key] !== '';

  if (
    complaints.length > 0 &&
    !complaints.some((c) =>
      ['low_back_pain', 'leg_pain', 'walking_difficulty'].includes(c),
    ) &&
    answered('lbp_duration') &&
    answers.symptom_area !== 'back_leg' &&
    answers.symptom_area !== 'both'
  ) {
    notes.push(
      'Did not report back or leg pain, but answered the back and leg questions.',
    );
  }

  if (answers.lbp_radiate === 'none' && answers.lbp_side) {
    notes.push('Reported no radiating pain, but also named a side.');
  }

  if (
    Array.isArray(answers.tx_tried) &&
    answers.tx_tried.map(String).includes('nothing') &&
    answers.tx_tried.length > 1
  ) {
    notes.push('Selected "nothing yet" alongside other treatments.');
  }

  if (
    Array.isArray(answers.comorbidities) &&
    answers.comorbidities.map(String).includes('none') &&
    answers.comorbidities.length > 1
  ) {
    notes.push('Selected "none of these" alongside other conditions.');
  }

  if (
    Array.isArray(answers.img_done) &&
    answers.img_done.map(String).includes('none') &&
    answers.img_done.length > 1
  ) {
    notes.push('Selected "no scans done" alongside specific scans.');
  }

  // Someone answering yes to everything is a known intake pattern that wastes
  // clinical time; surfacing it is more useful than silently trusting it.
  const redFlagKeys = Object.keys(answers).filter((k) => k.startsWith('rf_'));
  const yesCount = redFlagKeys.filter((k) => answers[k] === 'yes').length;
  if (redFlagKeys.length >= 8 && yesCount >= 7) {
    notes.push(
      `Answered yes to ${yesCount} of ${redFlagKeys.length} red-flag questions — verify in person.`,
    );
  }

  return notes;
}

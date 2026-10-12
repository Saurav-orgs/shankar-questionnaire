import type { TriageCategory } from '../questionnaire/types';

/**
 * Dr. Acharya's appointment categories exactly as his SOP names them, with
 * the action his team takes for each. The patient never sees any of this —
 * the score and category are internal to the clinic (SCREENING §2).
 */
export interface CategoryInfo {
  /** RED / A / B / C / D */
  letter: string;
  emoji: string;
  /** The full name from the SOP, e.g. "HIGH PRIORITY SURGICAL EVALUATION". */
  name: string;
  /** What the team does with the patient. */
  action: string;
}

export const CATEGORY_INFO: Record<TriageCategory, CategoryInfo> = {
  URGENT: {
    letter: 'RED',
    emoji: '🔴',
    name: 'URGENT',
    action:
      'Do not put in a routine appointment slot. Advise urgent/emergency medical assessment.',
  },
  SURGICAL: {
    letter: 'A',
    emoji: '🟢',
    name: 'HIGH PRIORITY SURGICAL EVALUATION',
    action: "Priority appointment in Dr. Acharya's next suitable surgical OPD.",
  },
  REVIEW: {
    letter: 'B',
    emoji: '🟡',
    name: 'POSSIBLE SURGICAL CASE',
    action: 'Review MRI/report and questionnaire, then allocate a suitable slot.',
  },
  ROUTINE: {
    letter: 'C',
    emoji: '⚪',
    name: 'ROUTINE / LOW SURGICAL PRIORITY',
    action: "Not prioritised for Dr. Acharya's limited surgical OPD slots.",
  },
  REPORT_ONLY: {
    letter: 'D',
    emoji: '⚫',
    name: 'REPORT-ONLY / SECOND-OPINION REQUEST',
    action:
      'Explain that Dr. Acharya does not give a report-only or online surgical opinion without a physical consultation.',
  },
};

/** "🟢 A – HIGH PRIORITY SURGICAL EVALUATION", as in the WhatsApp summary. */
export function categoryHeadline(category: TriageCategory): string {
  const info = CATEGORY_INFO[category];
  return `${info.emoji} ${info.letter} – ${info.name}`;
}

/**
 * The one thing the team may say to a patient about the outcome (SCREENING
 * §7). Never "you are / are not a surgical patient" — the screening is
 * administrative; the surgical decision is the doctor's, after examination.
 */
export const PATIENT_FACING_WORDING =
  'Based on the information provided, your appointment has been categorized for appropriate consultation priority. The need for surgery can only be decided by Dr. Shankar Acharya after examining you and reviewing the relevant investigations.';

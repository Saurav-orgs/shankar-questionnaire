/**
 * Shared vocabulary for the questionnaire and the triage rules.
 *
 * NOTE: `evaluateCondition` in ./evaluator.ts is duplicated in
 * patient-web/src/questionnaire/evaluator.ts. The two must stay in sync —
 * see the fixture suite in ./evaluator.fixtures.ts, which is copied verbatim
 * into patient-web and asserted there too.
 */

export type Lang = 'en' | 'hi';

/** Every patient-visible string carries both languages. */
export type Localized = Record<Lang, string>;

export type QuestionType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'tel'
  | 'yes_no'
  | 'single_choice'
  | 'multi_choice'
  | 'scale';

export interface QuestionOption {
  code: string;
  label: Localized;
}

/* ------------------------------------------------------------------ *
 * Conditions
 * ------------------------------------------------------------------ */

export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'in'
  | 'not_in'
  | 'includes'
  | 'excludes'
  | 'gte'
  | 'lte'
  | 'answered'
  | 'unanswered';

export interface LeafCondition {
  /**
   * A question key, or one of the derived facts merged into the evaluation
   * context: `age`, `gender`, and — for category rules only — `score`.
   */
  q: string;
  op: ConditionOperator;
  value?: string | number | string[] | number[];
}

export type Condition =
  | LeafCondition
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

/* ------------------------------------------------------------------ *
 * Questions
 * ------------------------------------------------------------------ */

export interface Question {
  key: string;
  section: string;
  type: QuestionType;
  text: Localized;
  help?: Localized;
  options?: QuestionOption[];
  /**
   * Narrow this question's options to the codes selected in another question.
   * Used by `primary_complaint`, which only offers what the patient already
   * ticked in `chief_complaint`.
   */
  optionsFromKey?: string;
  /** For `scale` and `number`. */
  min?: number;
  max?: number;
  minLabel?: Localized;
  maxLabel?: Localized;
  maxLength?: number;
  required: boolean;
  /** Minimum selections for `multi_choice`. */
  minSelections?: number;
  /** Omitted means always shown. */
  showIf?: Condition;
  /** Red-flag questions are always asked and always reported, yes or no. */
  isRedFlag?: boolean;
  /**
   * Answering this affirmatively halts the questionnaire and shows the
   * contact-the-clinic screen. See EMERGENCY_INTERRUPT_ENABLED.
   */
  isEmergencyTrigger?: boolean;
  /** Values that count as an emergency trigger. Defaults to ['yes']. */
  emergencyValues?: string[];
}

export interface Section {
  key: string;
  order: number;
  title: Localized;
}

export interface QuestionnaireSchema {
  version: number;
  sections: Section[];
  questions: Question[];
  consent: {
    body: Localized;
    checkboxLabel: Localized;
  };
  /**
   * Deliberately says nothing about what the answers mean — it routes the
   * patient to a human and stops. The system never interprets for the patient.
   */
  emergencyScreen: {
    heading: Localized;
    body: Localized;
  };
  disclaimer: Localized;
  completionScreen: {
    heading: Localized;
    body: Localized;
  };
}

/* ------------------------------------------------------------------ *
 * Rules
 * ------------------------------------------------------------------ */

/**
 * Dr. Acharya's appointment categories, in priority order. The codes are
 * stable identifiers; the doctor's own labels (RED / A / B / C / D) live in
 * `triage/categories.ts`.
 *
 *   URGENT      🔴 RED — urgent/emergency assessment, not a routine slot
 *   SURGICAL    🟢 A   — high priority surgical evaluation
 *   REVIEW      🟡 B   — possible surgical case: review reports, then book
 *   ROUTINE     ⚪ C   — routine / low surgical priority
 *   REPORT_ONLY ⚫ D   — report-only / second-opinion request
 */
export type TriageCategory =
  | 'URGENT'
  | 'SURGICAL'
  | 'REVIEW'
  | 'ROUTINE'
  | 'REPORT_ONLY';

export const TRIAGE_CATEGORIES: TriageCategory[] = [
  'URGENT',
  'SURGICAL',
  'REVIEW',
  'ROUTINE',
  'REPORT_ONLY',
];

/** `priority` sits between urgent and routine — the SURGICAL bucket's slot. */
export type TriageUrgency =
  | 'emergency'
  | 'urgent'
  | 'priority'
  | 'routine'
  | 'non_urgent';

interface RuleBase {
  code: string;
  label: string;
  /** Why this fired, in plain English, for the doctor to audit. */
  explain: string;
  when: Condition;
  /** Non-blocking observation added to the report when this rule matches. */
  secondaryNote?: string;
}

/**
 * A finding from the doctor's scoring table. Every matching scoring rule
 * adds its points to the patient's score; the total is then exposed to the
 * category rules as the derived fact `score`.
 */
export interface ScoringRule extends RuleBase {
  kind: 'score';
  points: number;
}

/**
 * Sets the category. Several may match; the highest severity wins, so the
 * severity bands double as precedence (RED > A > D > B > C). Score bands are
 * category rules too — they condition on `score`.
 */
export interface CategoryRule extends RuleBase {
  kind: 'category';
  category: TriageCategory;
  urgency: TriageUrgency;
  severity: number;
  /** What the team should do. Shown verbatim in the dashboard. */
  pathway: string;
}

/**
 * Advisory rules contribute only their `secondaryNote`. They never set the
 * category or the score — they exist to say "also worth a look".
 */
export interface AdvisoryRule extends RuleBase {
  kind: 'advisory';
  secondaryNote: string;
}

export type TriageRule = ScoringRule | CategoryRule | AdvisoryRule;

export interface RuleSet {
  version: number;
  rules: TriageRule[];
}

/* ------------------------------------------------------------------ *
 * Answers
 * ------------------------------------------------------------------ */

export type AnswerValue = string | number | string[] | null;

export type AnswerMap = Record<string, AnswerValue>;

/**
 * Answers plus the patient-detail columns merged in under their schema keys,
 * so a condition can reference `age` or `gender` the same way it references
 * any other question. The rules engine adds `score` before evaluating the
 * category rules. Values may be absent, which every operator treats as
 * "unknown" rather than as a match.
 */
export type EvaluationContext = Record<string, AnswerValue | undefined>;

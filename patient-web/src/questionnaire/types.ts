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
   * context: `age`, `gender`, `primary_complaint`.
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

export type TriageCategory = 'RED' | 'AMBER' | 'GREY' | 'GREEN';

export type TriageUrgency = 'emergency' | 'urgent' | 'routine' | 'non_urgent';

export interface TriageRule {
  code: string;
  label: string;
  category: TriageCategory;
  urgency: TriageUrgency;
  /** Higher wins when several rules match. */
  severity: number;
  /** What the doctor should do. Shown verbatim in the dashboard. */
  pathway: string;
  /** Why this fired, in plain English, for the doctor to audit. */
  explain: string;
  when: Condition;
  /** Non-blocking observation added to the report when this rule matches. */
  secondaryNote?: string;
  /**
   * Advisory rules contribute only their `secondaryNote`. They never set the
   * category and never count as a match for `unmatched` detection — they exist
   * to say "also worth a look" without competing with the real verdict.
   */
  advisory?: boolean;
}

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
 * any other question. Values may be absent, which every operator treats as
 * "unknown" rather than as a match.
 */
export type EvaluationContext = Record<string, AnswerValue | undefined>;

import { evaluateCondition } from '../questionnaire/evaluator';
import type {
  AdvisoryRule,
  CategoryRule,
  EvaluationContext,
  Question,
  QuestionnaireSchema,
  ScoringRule,
  TriageCategory,
  TriageRule,
  TriageUrgency,
} from '../questionnaire/types';

export interface MatchedRule {
  code: string;
  label: string;
  explain: string;
  /** Category rules only. */
  severity?: number;
  category?: TriageCategory;
  /** Scoring rules only — the points this finding contributed. */
  points?: number;
}

export interface RedFlagAnswer {
  key: string;
  label: string;
  answer: string;
}

export interface TriageEvaluation {
  category: TriageCategory;
  urgency: TriageUrgency;
  pathway: string;
  /** Sum of the matched scoring rules' points (SCREENING §2). */
  score: number;
  /** Category rules first (highest severity first), then scoring rules. */
  matchedRules: MatchedRule[];
  secondaryNotes: string[];
  unmatched: boolean;
}

/**
 * Deterministic evaluation of Dr. Acharya's screening SOP, in two passes:
 *
 *   1. Scoring — every matching scoring rule adds its points. The total is
 *      the administrative score from SCREENING §2, never shown to the patient.
 *   2. Category — the category rules are evaluated with `score` merged into
 *      the context, so the 8+ / 4–7 / 0–3 bands are ordinary rules on a
 *      derived fact. The highest-severity match wins. Severity bands are
 *      disjoint per category (URGENT 90+, SURGICAL 60–79, REPORT_ONLY 40–49,
 *      REVIEW 30–39, ROUTINE 10–29), so "highest severity" is the SOP's
 *      Step 2 → Step 3 precedence: RED, then A, then D, then B, then C.
 *
 * The score bands cover every integer, so a submitted form always lands in a
 * category; the REVIEW fallback only exists for a rule set that omits them.
 */
export function evaluateRules(
  rules: TriageRule[],
  context: EvaluationContext,
): TriageEvaluation {
  const scoring = rules.filter((r): r is ScoringRule => r.kind === 'score');
  const categories = rules.filter(
    (r): r is CategoryRule => r.kind === 'category',
  );
  const advisories = rules.filter(
    (r): r is AdvisoryRule => r.kind === 'advisory',
  );

  const matchedScoring = scoring.filter((rule) =>
    evaluateCondition(rule.when, context),
  );
  const score = matchedScoring.reduce((sum, rule) => sum + rule.points, 0);

  const scored: EvaluationContext = { ...context, score };

  const matchedCategory = categories
    .filter((rule) => evaluateCondition(rule.when, scored))
    .sort((a, b) => b.severity - a.severity);

  const winner = matchedCategory[0];

  const secondaryNotes = [
    ...advisories
      .filter((rule) => evaluateCondition(rule.when, scored))
      .map((rule) => rule.secondaryNote),
    ...matchedCategory
      .map((rule) => rule.secondaryNote)
      .filter((note): note is string => Boolean(note)),
  ];

  return {
    category: winner?.category ?? 'REVIEW',
    urgency: winner?.urgency ?? 'routine',
    pathway:
      winner?.pathway ??
      'Review details before slot allocation — no category rule matched',
    score,
    matchedRules: [
      ...matchedCategory.map((rule) => ({
        code: rule.code,
        label: rule.label,
        explain: rule.explain,
        severity: rule.severity,
        category: rule.category,
      })),
      ...matchedScoring.map((rule) => ({
        code: rule.code,
        label: rule.label,
        explain: rule.explain,
        points: rule.points,
      })),
    ],
    secondaryNotes,
    unmatched: matchedCategory.length === 0,
  };
}

/**
 * Every red-flag question with its answer, negatives included — the doctor
 * needs to see "all red flags answered no" as explicitly as a positive one.
 * A question property (schema), not a rule property, so it's computed
 * separately from evaluateRules and combined by the caller.
 */
export function redFlagsFromSchema(
  schema: QuestionnaireSchema,
  context: EvaluationContext,
): RedFlagAnswer[] {
  const labelFor = (question: Question, code: string): string =>
    question.options?.find((o) => o.code === code)?.label.en ?? code;

  return schema.questions
    .filter((q) => q.isRedFlag)
    .map((q) => {
      const answer = context[q.key];
      return {
        key: q.key,
        label: q.text.en,
        answer:
          answer === null || answer === undefined
            ? 'Not answered'
            : labelFor(q, String(answer)),
      };
    });
}

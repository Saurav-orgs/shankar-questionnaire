import { evaluateCondition } from '../questionnaire/evaluator';
import type {
  EvaluationContext,
  Question,
  QuestionnaireSchema,
  TriageCategory,
  TriageRule,
  TriageUrgency,
} from '../questionnaire/types';

export interface MatchedRule {
  code: string;
  label: string;
  explain: string;
  severity: number;
  category: TriageCategory;
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
  matchedRules: MatchedRule[];
  secondaryNotes: string[];
  unmatched: boolean;
}

/**
 * Deterministic rule evaluation — see plan.md §8. Severity ranges are
 * non-overlapping by category (RED 85-100, AMBER 55-75, GREY 30-45,
 * GREEN 15-25), so "highest severity among matched non-advisory rules" and
 * "category precedence RED > AMBER > GREY > GREEN" are the same computation.
 */
export function evaluateRules(
  rules: TriageRule[],
  context: EvaluationContext,
): TriageEvaluation {
  const matched = rules
    .filter((rule) => !rule.advisory)
    .filter((rule) => evaluateCondition(rule.when, context))
    .sort((a, b) => b.severity - a.severity);

  const advisoryMatched = rules
    .filter((rule) => rule.advisory)
    .filter((rule) => evaluateCondition(rule.when, context));

  const winner = matched[0];

  return {
    category: winner?.category ?? 'GREEN',
    urgency: winner?.urgency ?? 'non_urgent',
    pathway:
      winner?.pathway ?? 'Needs clinical assessment — no rule pattern matched',
    matchedRules: matched.map((rule) => ({
      code: rule.code,
      label: rule.label,
      explain: rule.explain,
      severity: rule.severity,
      category: rule.category,
    })),
    secondaryNotes: advisoryMatched
      .map((rule) => rule.secondaryNote)
      .filter((note): note is string => Boolean(note)),
    unmatched: matched.length === 0,
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

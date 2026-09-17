/**
 * Pure condition evaluator, used for two things:
 *   1. branching  — should this question be shown?
 *   2. triage     — does this rule match?
 *
 * DUPLICATED FILE. The twin lives at:
 *   patient-web/src/questionnaire/evaluator.ts
 * Keep both in sync. evaluator.fixtures.ts is copied into patient-web too and
 * asserted on both sides, so a drift fails a test rather than shipping.
 *
 * No imports, no side effects — this must stay portable between the two.
 */

import type {
  AnswerValue,
  Condition,
  EvaluationContext,
  LeafCondition,
  Question,
  QuestionnaireSchema,
} from './types';

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function toArray(value: AnswerValue): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (isBlank(value)) return [];
  return [String(value)];
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function expected(condition: LeafCondition): string[] {
  const { value } = condition;
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

function evaluateLeaf(
  condition: LeafCondition,
  context: EvaluationContext,
): boolean {
  const actual = context[condition.q] as AnswerValue | undefined;

  switch (condition.op) {
    case 'answered':
      return !isBlank(actual);

    case 'unanswered':
      return isBlank(actual);

    case 'eq':
      if (isBlank(actual)) return false;
      return String(actual) === expected(condition)[0];

    case 'neq':
      // An unanswered question is not "not equal" to anything — it is unknown.
      // Treating unknown as a match would fire rules on missing data.
      if (isBlank(actual)) return false;
      return String(actual) !== expected(condition)[0];

    case 'in':
      if (isBlank(actual)) return false;
      return expected(condition).includes(String(actual));

    case 'not_in':
      if (isBlank(actual)) return false;
      return !expected(condition).includes(String(actual));

    case 'includes': {
      // True when the answer array contains ANY of the expected codes.
      const selected = toArray(actual ?? null);
      return expected(condition).some((code) => selected.includes(code));
    }

    case 'excludes': {
      if (isBlank(actual)) return false;
      const selected = toArray(actual ?? null);
      return !expected(condition).some((code) => selected.includes(code));
    }

    case 'gte': {
      const left = toNumber(actual);
      const right = toNumber(condition.value);
      if (left === null || right === null) return false;
      return left >= right;
    }

    case 'lte': {
      const left = toNumber(actual);
      const right = toNumber(condition.value);
      if (left === null || right === null) return false;
      return left <= right;
    }

    default:
      return false;
  }
}

export function evaluateCondition(
  condition: Condition,
  context: EvaluationContext,
): boolean {
  if ('all' in condition) {
    return condition.all.every((child) => evaluateCondition(child, context));
  }
  if ('any' in condition) {
    return condition.any.some((child) => evaluateCondition(child, context));
  }
  if ('not' in condition) {
    return !evaluateCondition(condition.not, context);
  }
  return evaluateLeaf(condition, context);
}

export function isQuestionVisible(
  question: Question,
  context: EvaluationContext,
): boolean {
  if (!question.showIf) return true;
  return evaluateCondition(question.showIf, context);
}

/**
 * Questions currently in scope, in schema order. Recomputed after every answer,
 * so answering a question can reveal or hide later ones.
 */
export function visibleQuestions(
  schema: QuestionnaireSchema,
  context: EvaluationContext,
): Question[] {
  return schema.questions.filter((question) =>
    isQuestionVisible(question, context),
  );
}

/** The next unanswered visible question, or null when the flow is complete. */
export function nextQuestion(
  schema: QuestionnaireSchema,
  context: EvaluationContext,
): Question | null {
  const visible = visibleQuestions(schema, context);
  return (
    visible.find((question) => isBlank(context[question.key])) ?? null
  );
}

/** Visible + required + unanswered. Empty means the assessment can be submitted. */
export function missingRequired(
  schema: QuestionnaireSchema,
  context: EvaluationContext,
): Question[] {
  return visibleQuestions(schema, context).filter(
    (question) => question.required && isBlank(context[question.key]),
  );
}

export function hasEmergencyTrigger(
  schema: QuestionnaireSchema,
  context: EvaluationContext,
): Question[] {
  return schema.questions.filter((question) => {
    if (!question.isEmergencyTrigger) return false;
    const triggers = question.emergencyValues ?? ['yes'];
    const answer = context[question.key];
    if (isBlank(answer)) return false;
    return toArray(answer as AnswerValue).some((code) =>
      triggers.includes(code),
    );
  });
}

export function progress(
  schema: QuestionnaireSchema,
  context: EvaluationContext,
): { answered: number; total: number } {
  const visible = visibleQuestions(schema, context);
  return {
    answered: visible.filter((q) => !isBlank(context[q.key])).length,
    total: visible.length,
  };
}

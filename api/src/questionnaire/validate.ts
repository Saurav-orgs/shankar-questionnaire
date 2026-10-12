import type {
  Condition,
  LeafCondition,
  Question,
  QuestionnaireSchema,
  TriageRule,
} from './types';

/**
 * Derived facts merged into the evaluation context rather than read from
 * `answers`: `age` and `gender` come from the assessments table (and are also
 * asked as questions); `score` is computed by the rules engine from the
 * scoring rules and is only meaningful to category rules.
 */
const DERIVED_FACTS = new Set(['age', 'gender', 'score']);

const VALUE_CHECKED_OPERATORS = new Set([
  'eq',
  'neq',
  'in',
  'not_in',
  'includes',
  'excludes',
]);

const CHOICE_TYPES = new Set(['single_choice', 'multi_choice', 'yes_no']);

function walkConditions(
  condition: Condition,
  visit: (leaf: LeafCondition) => void,
): void {
  if ('all' in condition) {
    condition.all.forEach((child) => walkConditions(child, visit));
    return;
  }
  if ('any' in condition) {
    condition.any.forEach((child) => walkConditions(child, visit));
    return;
  }
  if ('not' in condition) {
    walkConditions(condition.not, visit);
    return;
  }
  visit(condition);
}

function expectedValues(leaf: LeafCondition): string[] {
  if (leaf.value === null || leaf.value === undefined) return [];
  return Array.isArray(leaf.value)
    ? leaf.value.map(String)
    : [String(leaf.value)];
}

/**
 * Structural check over the questionnaire and its rules. Catches the mistakes
 * that a bilingual 60-question schema invites: a condition pointing at a
 * renamed question, an option code that never existed, a duplicate key.
 *
 * Returns a list of human-readable problems; empty means valid.
 */
export function validateQuestionnaire(
  schema: QuestionnaireSchema,
  rules: TriageRule[],
): string[] {
  const errors: string[] = [];

  const byKey = new Map<string, Question>();
  for (const question of schema.questions) {
    if (byKey.has(question.key)) {
      errors.push(`Duplicate question key "${question.key}".`);
    }
    byKey.set(question.key, question);
  }

  const sectionKeys = new Set(schema.sections.map((s) => s.key));

  for (const question of schema.questions) {
    if (!sectionKeys.has(question.section)) {
      errors.push(
        `Question "${question.key}" references unknown section "${question.section}".`,
      );
    }

    if (CHOICE_TYPES.has(question.type)) {
      if (!question.options?.length) {
        errors.push(
          `Question "${question.key}" is a choice type with no options.`,
        );
      } else {
        const seen = new Set<string>();
        for (const option of question.options) {
          if (seen.has(option.code)) {
            errors.push(
              `Question "${question.key}" has duplicate option code "${option.code}".`,
            );
          }
          seen.add(option.code);
          if (!option.label.en?.trim() || !option.label.hi?.trim()) {
            errors.push(
              `Option "${question.key}.${option.code}" is missing an en or hi label.`,
            );
          }
        }
      }
    }

    if (!question.text.en?.trim() || !question.text.hi?.trim()) {
      errors.push(`Question "${question.key}" is missing an en or hi text.`);
    }

    if (question.optionsFromKey && !byKey.has(question.optionsFromKey)) {
      errors.push(
        `Question "${question.key}" draws options from unknown question "${question.optionsFromKey}".`,
      );
    }

    if (question.isEmergencyTrigger) {
      const codes = new Set(question.options?.map((o) => o.code) ?? []);
      for (const value of question.emergencyValues ?? ['yes']) {
        if (!codes.has(value)) {
          errors.push(
            `Question "${question.key}" lists emergency value "${value}" which is not one of its options.`,
          );
        }
      }
    }
  }

  const checkLeaf = (leaf: LeafCondition, origin: string): void => {
    const target = byKey.get(leaf.q);

    if (!target && !DERIVED_FACTS.has(leaf.q)) {
      errors.push(`${origin} references unknown question "${leaf.q}".`);
      return;
    }

    if (!target || !VALUE_CHECKED_OPERATORS.has(leaf.op)) return;
    if (!CHOICE_TYPES.has(target.type)) return;

    const codes = new Set(target.options?.map((o) => o.code) ?? []);
    for (const value of expectedValues(leaf)) {
      if (!codes.has(value)) {
        errors.push(
          `${origin} expects "${leaf.q}" to be "${value}", which is not one of its options.`,
        );
      }
    }
  };

  for (const question of schema.questions) {
    if (!question.showIf) continue;
    walkConditions(question.showIf, (leaf) =>
      checkLeaf(leaf, `showIf on "${question.key}"`),
    );
  }

  const ruleCodes = new Set<string>();
  for (const rule of rules) {
    if (ruleCodes.has(rule.code)) {
      errors.push(`Duplicate rule code "${rule.code}".`);
    }
    ruleCodes.add(rule.code);

    if (rule.kind === 'category' && !rule.pathway.trim()) {
      errors.push(`Rule "${rule.code}" has no pathway.`);
    }
    if (rule.kind === 'advisory' && !rule.secondaryNote?.trim()) {
      errors.push(`Advisory rule "${rule.code}" has no secondaryNote.`);
    }
    if (rule.kind === 'score' && !Number.isInteger(rule.points)) {
      errors.push(`Scoring rule "${rule.code}" has non-integer points.`);
    }

    walkConditions(rule.when, (leaf) => {
      // Only the category pass sees `score`; a scoring rule that read it
      // would be reading a total that has not been computed yet.
      if (leaf.q === 'score' && rule.kind !== 'category') {
        errors.push(
          `Rule "${rule.code}" reads "score" but is not a category rule.`,
        );
      }
      checkLeaf(leaf, `Rule "${rule.code}"`);
    });
  }

  return errors;
}

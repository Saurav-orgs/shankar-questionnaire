import { buildLabelLookup } from '../questionnaire/localize';
import { isQuestionVisible } from '../questionnaire/evaluator';
import type {
  EvaluationContext,
  Lang,
  QuestionnaireSchema,
} from '../questionnaire/types';
import type { RedFlagAnswer, TriageEvaluation } from './rules-engine';

/**
 * Renders the document the summary model reads — plan.md §9.
 *
 * This lives in `src/` rather than in the generator script on purpose: the
 * training set and the production request must be byte-identical in shape, or
 * the model sees one format during training and a different one at inference.
 * Both call this function.
 *
 * Two deliberate omissions: `name` and `mobile` never reach the model. The
 * summary has no use for them and there is no reason to put identifiers
 * through a generative step.
 */

/** Detail columns handled by the snapshot line, so not repeated in ANSWERS. */
const SNAPSHOT_KEYS = new Set([
  'name',
  'age',
  'gender',
  'mobile',
  'city',
  'occupation',
  'chief_complaint',
  'primary_complaint',
]);

/** Answered free-text questions, rendered verbatim in their own block. */
const FREE_TEXT_KEYS = ['free_text', 'tx_prior_surgery_detail'];

export interface ModelInputOptions {
  /** Language the patient filled the form in — drives the free-text note. */
  language: Lang;
}

export function renderModelInput(
  schema: QuestionnaireSchema,
  context: EvaluationContext,
  evaluation: TriageEvaluation,
  redFlags: RedFlagAnswer[],
  contradictions: string[],
  options: ModelInputOptions,
): string {
  const labels = buildLabelLookup(schema);
  const out: string[] = [];

  out.push('PATIENT');
  out.push(snapshotLine(labels, context, options.language));

  const complaint = complaintLines(labels, context);
  if (complaint.length) {
    out.push('', 'COMPLAINT', ...complaint);
  }

  const answers = answerLines(schema, labels, context);
  if (answers.length) {
    out.push('', 'ANSWERS', ...answers);
  }

  const freeText = freeTextLines(labels, context, options.language);
  if (freeText.length) {
    out.push('', ...freeText);
  }

  out.push('', 'TRIAGE — decided by the rules engine, do not contradict');
  out.push(...triageLines(evaluation, redFlags));

  // Inconsistencies the validator caught between answers. These are prime
  // material for the "what the doctor may want to ask" section — an answer
  // that disagrees with another answer is exactly what a consult should
  // resolve, so the model needs to see them rather than the doctor alone.
  if (contradictions.length) {
    out.push('', 'INCONSISTENCIES FLAGGED');
    for (const note of contradictions) out.push(`  - ${note}`);
  }

  return out.join('\n');
}

function snapshotLine(
  labels: ReturnType<typeof buildLabelLookup>,
  context: EvaluationContext,
  language: Lang,
): string {
  const parts = [
    context.age ? `${String(context.age)}y` : 'age unknown',
    context.gender ? String(context.gender) : 'sex unknown',
    context.occupation
      ? labels.answerLabel('occupation', context.occupation)
      : null,
    context.city ? String(context.city) : null,
  ].filter(Boolean);

  const filledIn = language === 'hi' ? 'Hindi' : 'English';
  return `${parts.join(', ')}. Form completed in ${filledIn}.`;
}

function complaintLines(
  labels: ReturnType<typeof buildLabelLookup>,
  context: EvaluationContext,
): string[] {
  const lines: string[] = [];

  if (context.primary_complaint) {
    lines.push(
      `Main complaint: ${labels.answerLabel('chief_complaint', context.primary_complaint)}`,
    );
  }

  const all = context.chief_complaint;
  if (Array.isArray(all) && all.length) {
    const others = all.filter((c) => c !== context.primary_complaint);
    if (others.length) {
      lines.push(
        `Also reported: ${labels.answerLabel('chief_complaint', others)}`,
      );
    }
  }

  return lines;
}

/**
 * Visible, answered questions grouped under their section heading. Visibility
 * is recomputed rather than trusted: a context carrying a stale answer from a
 * branch the patient no longer qualifies for must not reach the model.
 */
function answerLines(
  schema: QuestionnaireSchema,
  labels: ReturnType<typeof buildLabelLookup>,
  context: EvaluationContext,
): string[] {
  const sectionTitles = new Map(
    schema.sections.map((s) => [s.key, s.title.en]),
  );
  const bySection = new Map<string, string[]>();

  for (const question of schema.questions) {
    if (SNAPSHOT_KEYS.has(question.key)) continue;
    if (FREE_TEXT_KEYS.includes(question.key)) continue;
    if (!isQuestionVisible(question, context)) continue;

    const value = context[question.key];
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;

    const line = `${question.text.en} ${labels.answerLabel(question.key, value)}`;
    const existing = bySection.get(question.section);
    if (existing) existing.push(line);
    else bySection.set(question.section, [line]);
  }

  const lines: string[] = [];
  // Section order follows the schema, so the document is stable across patients.
  for (const section of schema.sections) {
    const entries = bySection.get(section.key);
    if (!entries?.length) continue;
    lines.push(`[${sectionTitles.get(section.key) ?? section.key}]`);
    lines.push(...entries.map((e) => `  ${e}`));
  }

  return lines;
}

function freeTextLines(
  labels: ReturnType<typeof buildLabelLookup>,
  context: EvaluationContext,
  language: Lang,
): string[] {
  const lines: string[] = [];

  for (const key of FREE_TEXT_KEYS) {
    const value = context[key];
    if (typeof value !== 'string' || !value.trim()) continue;

    // The stated language is the form language, which is a hint and not a
    // guarantee: a patient on the English form may still type Hinglish, and
    // one on the Hindi form may type Roman script. The model has to read what
    // is actually there.
    lines.push(
      `FREE TEXT — ${labels.questionLabel(key)} (patient's own words, form language ${language === 'hi' ? 'Hindi' : 'English'})`,
      `  ${value.trim()}`,
    );
  }

  return lines;
}

function triageLines(
  evaluation: TriageEvaluation,
  redFlags: RedFlagAnswer[],
): string[] {
  const lines = [
    `Category: ${evaluation.category}`,
    `Urgency: ${evaluation.urgency}`,
    `Pathway: ${evaluation.pathway}`,
  ];

  if (evaluation.matchedRules.length) {
    lines.push('Matched rules:');
    for (const rule of evaluation.matchedRules) {
      lines.push(`  - ${rule.label}: ${rule.explain}`);
    }
  } else {
    lines.push('Matched rules: none — this case needs manual clinical triage.');
  }

  const positive = redFlags.filter(
    (f) => f.answer !== 'No' && f.answer !== 'Not answered',
  );
  if (positive.length) {
    lines.push('Red flags reported:');
    for (const flag of positive) {
      lines.push(`  - ${flag.label} ${flag.answer}`);
    }
  } else {
    lines.push('Red flags: none reported.');
  }

  if (evaluation.secondaryNotes.length) {
    lines.push('Advisory notes:');
    for (const note of evaluation.secondaryNotes) {
      lines.push(`  - ${note}`);
    }
  }

  return lines;
}

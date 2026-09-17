import { buildLabelLookup } from '../questionnaire/localize';
import type {
  EvaluationContext,
  QuestionnaireSchema,
} from '../questionnaire/types';
import type { RedFlagAnswer, TriageEvaluation } from './rules-engine';

/**
 * Deterministic, template-built summary — the guaranteed fallback from plan.md
 * §9. An LLM pass can replace the body later, but the doctor must never open a
 * patient to a blank card, so this always produces something usable and is what
 * runs while ANTHROPIC_API_KEY is unset.
 *
 * It states facts the patient reported and the rule verdict; it does not add
 * clinical inference of its own beyond what the matched rules already say.
 */
export function buildTemplateSummary(
  schema: QuestionnaireSchema,
  context: EvaluationContext,
  evaluation: TriageEvaluation,
  redFlags: RedFlagAnswer[],
): string {
  const labels = buildLabelLookup(schema);
  const lines: string[] = [];

  const age = context.age ? `${String(context.age)}y` : 'age unknown';
  const sex = context.gender ? String(context.gender) : 'sex unknown';
  const occupation = context.occupation
    ? labels.answerLabel('occupation', context.occupation)
    : null;

  const snapshot = [`${age} ${sex}`, occupation].filter(Boolean).join(', ');
  lines.push(snapshot + '.');

  const main = context.primary_complaint ?? firstComplaint(context);
  if (main) {
    const duration = context.lbp_duration ?? context.neck_duration;
    const durationText = duration
      ? ` for ${labels.answerLabel('lbp_duration', duration).toLowerCase()}`
      : '';
    lines.push(
      `Main complaint: ${labels.answerLabel('chief_complaint', main).toLowerCase()}${durationText}.`,
    );
  }

  const findings = keyFindings(labels, context);
  if (findings.length) lines.push('Key findings: ' + findings.join('; ') + '.');

  const positiveFlags = redFlags.filter(
    (f) => f.answer !== 'No' && f.answer !== 'Not answered',
  );
  if (positiveFlags.length) {
    lines.push(
      'Red flags: ' +
        positiveFlags.map((f) => `${flagShort(f.key)} (${f.answer})`).join(', ') +
        '.',
    );
  } else {
    lines.push('Red flags: none reported.');
  }

  if (evaluation.matchedRules.length) {
    lines.push(
      'Supporting the verdict: ' +
        evaluation.matchedRules.map((r) => r.explain).join(' ') ,
    );
  } else {
    lines.push(
      'No rule pattern matched — this case needs manual clinical triage.',
    );
  }

  if (evaluation.secondaryNotes.length) {
    lines.push('Also: ' + evaluation.secondaryNotes.join(' '));
  }

  return lines.join('\n');
}

function firstComplaint(context: EvaluationContext): string | null {
  const cc = context.chief_complaint;
  if (Array.isArray(cc) && cc.length) return String(cc[0]);
  return null;
}

function keyFindings(
  labels: ReturnType<typeof buildLabelLookup>,
  context: EvaluationContext,
): string[] {
  const out: string[] = [];

  if (context.lbp_radiate && context.lbp_radiate !== 'none') {
    out.push(
      `pain radiates ${labels.answerLabel('lbp_radiate', context.lbp_radiate).toLowerCase()}`,
    );
  }
  if (context.neck_radiate && context.neck_radiate !== 'none') {
    out.push(
      `arm pain ${labels.answerLabel('neck_radiate', context.neck_radiate).toLowerCase()}`,
    );
  }
  if (context.lbp_severity !== undefined && context.lbp_severity !== null) {
    out.push(`pain ${String(context.lbp_severity)}/10`);
  } else if (
    context.neck_severity !== undefined &&
    context.neck_severity !== null
  ) {
    out.push(`pain ${String(context.neck_severity)}/10`);
  }
  if (context.lbp_numbness === 'yes' || context.lbp_weakness === 'yes') {
    out.push('leg numbness/weakness');
  }
  if (context.func_work && context.func_work !== 'fully') {
    out.push(
      `work: ${labels.answerLabel('func_work', context.func_work).toLowerCase()}`,
    );
  }
  if (
    Array.isArray(context.tx_tried) &&
    !context.tx_tried.includes('nothing') &&
    context.tx_tried.length
  ) {
    out.push(
      `tried ${context.tx_tried.map((t) => labels.answerLabel('tx_tried', t).toLowerCase()).join(', ')}`,
    );
  }
  return out;
}

/** Compact human label for a red-flag key, for the summary line. */
function flagShort(key: string): string {
  const map: Record<string, string> = {
    rf_bladder: 'bladder',
    rf_bowel: 'bowel',
    rf_saddle: 'saddle numbness',
    rf_progressive_weakness: 'progressive weakness',
    rf_trauma: 'recent trauma',
    rf_fever: 'fever',
    rf_cancer: 'cancer history',
    rf_weight_loss: 'weight loss',
    rf_night_pain: 'night pain',
    rf_immuno: 'immunosuppression',
  };
  return map[key] ?? key;
}

/** answered visible / total visible, clamped 0..1. */
export function computeCompleteness(answered: number, total: number): number {
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, answered / total));
}

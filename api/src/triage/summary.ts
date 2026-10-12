import { buildLabelLookup } from '../questionnaire/localize';
import type {
  EvaluationContext,
  QuestionnaireSchema,
} from '../questionnaire/types';
import { CATEGORY_INFO, categoryHeadline } from './categories';
import type { RedFlagAnswer, TriageEvaluation } from './rules-engine';

/**
 * Deterministic, template-built summary in exactly the format the team gets
 * on WhatsApp (SCREENING §6):
 *
 *   SPINE APPOINTMENT TRIAGE
 *   Patient: Mr. ABC, 54 yrs
 *   Category: 🟢 A – HIGH PRIORITY SURGICAL EVALUATION
 *   Score: 11
 *
 *   Key findings:
 *   • Back + leg pain
 *   • ...
 *
 *   Action: Priority appointment with Dr. Acharya
 *   MRI/CT: To be brought/uploaded
 *   Final decision: Dr. Acharya after physical examination
 *
 * It is the guaranteed fallback from plan.md §9 — the doctor must never open
 * a patient to a blank card — and it states only what the patient reported
 * and what the rules concluded, never a clinical inference of its own.
 */
export function buildTemplateSummary(
  schema: QuestionnaireSchema,
  context: EvaluationContext,
  evaluation: TriageEvaluation,
  redFlags: RedFlagAnswer[],
): string {
  void redFlags; // Q2/Q3 are rendered from the answers below, positives and negatives alike.
  const labels = buildLabelLookup(schema);
  const lines: string[] = [];

  lines.push('SPINE APPOINTMENT TRIAGE');
  lines.push(`Patient: ${patientLine(context)}`);
  lines.push(`Category: ${categoryHeadline(evaluation.category)}`);
  lines.push(`Score: ${evaluation.score}`);
  lines.push('');
  lines.push('Key findings:');
  for (const finding of keyFindings(labels, context)) lines.push(`• ${finding}`);
  lines.push('');
  lines.push(`Action: ${CATEGORY_INFO[evaluation.category].action}`);
  lines.push(
    `MRI/CT: ${
      context.has_imaging === 'yes'
        ? 'To be brought/uploaded'
        : context.has_imaging === 'no'
          ? 'None available'
          : 'Not stated'
    }`,
  );
  lines.push('Final decision: Dr. Acharya after physical examination');

  if (evaluation.unmatched) {
    lines.push('');
    lines.push('No category rule matched — this case needs manual triage.');
  }

  return lines.join('\n');
}

function patientLine(context: EvaluationContext): string {
  const title =
    context.gender === 'male' ? 'Mr. ' : context.gender === 'female' ? 'Mrs. ' : '';
  const name = context.name ? String(context.name) : 'Name not given';
  const age = context.age ? `, ${String(context.age)} yrs` : '';
  const city = context.city ? ` (${String(context.city)})` : '';
  return `${title}${name}${age}${city}`;
}

const PROBLEM_SHORT: Record<string, string> = {
  neck_pain: 'Neck pain',
  back_pain: 'Back pain',
  arm_pain: 'arm pain',
  leg_pain: 'leg pain',
};

const DURATION_SHORT: Record<string, string> = {
  lt_6w: 'Symptoms < 6 weeks',
  '6w_3m': 'Symptoms 6 weeks – 3 months',
  '3_6m': 'Symptoms 3–6 months',
  gt_6m: 'Symptoms > 6 months',
};

const RESPONSE_SHORT: Record<string, string> = {
  improved: 'significant improvement',
  partial: 'partial improvement',
  no_improvement: 'failed (no improvement)',
  worse: 'symptoms getting worse',
};

/**
 * One bullet per fact the team needs, positives and negatives alike, in the
 * order of the doctor's own examples: pain pattern, neurology, duration,
 * treatment, imaging, diagnosis, surgery advice, reason.
 */
function keyFindings(
  labels: ReturnType<typeof buildLabelLookup>,
  context: EvaluationContext,
): string[] {
  const out: string[] = [];
  const problems = Array.isArray(context.main_problem)
    ? context.main_problem.map(String)
    : [];

  const axial = problems.filter((p) => p === 'neck_pain' || p === 'back_pain');
  const radiating = problems.filter((p) => p === 'arm_pain' || p === 'leg_pain');
  if (axial.length || radiating.length) {
    const parts = [...axial, ...radiating].map((p) => PROBLEM_SHORT[p]);
    const onlyAxial = radiating.length === 0;
    out.push(
      parts.length === 1 && onlyAxial
        ? `${parts[0]} only`
        : parts.join(' + ').replace(/^./, (c) => c.toUpperCase()),
    );
  }
  if (!radiating.length && problems.length) out.push('No radiating arm/leg pain');
  if (problems.includes('numbness_tingling')) out.push('Numbness/tingling');
  if (problems.includes('deformity')) out.push('Spine deformity');
  if (problems.includes('injury')) out.push('Spine injury/fracture');
  if (problems.includes('other') && context.main_problem_other) {
    out.push(`Other: "${String(context.main_problem_other).trim()}"`);
  }

  if (context.weakness === 'no') out.push('No weakness');
  if (context.weakness === 'stable') out.push('Arm/leg weakness (stable)');
  if (context.weakness === 'progressive') out.push('Progressive arm/leg weakness');

  if (context.walking_balance === 'no') out.push('No walking difficulty');
  if (context.walking_balance === 'yes') out.push('Walking/balance difficulty');
  if (context.walking_balance === 'progressive') {
    out.push('Walking/balance getting progressively worse');
  }

  if (context.duration) {
    out.push(DURATION_SHORT[String(context.duration)] ?? String(context.duration));
  }

  const treatment = Array.isArray(context.treatment)
    ? context.treatment.map(String)
    : [];
  if (treatment.includes('none')) {
    out.push('No treatment yet');
  } else if (treatment.length) {
    const tried = treatment
      .filter((t) => t !== 'previous_surgery')
      .map((t) => labels.answerLabel('treatment', t));
    const response = context.treatment_response
      ? ` — ${RESPONSE_SHORT[String(context.treatment_response)] ?? labels.answerLabel('treatment_response', context.treatment_response).toLowerCase()}`
      : '';
    if (tried.length) out.push(`${tried.join('/')}${response}`);
    if (treatment.includes('previous_surgery')) out.push('Previous spine surgery');
  }

  if (context.has_imaging === 'yes') out.push('MRI/CT/X-ray available');
  if (context.has_imaging === 'no') out.push('No imaging');

  const diagnosis = Array.isArray(context.diagnosis)
    ? context.diagnosis.map(String).filter((d) => d !== 'dont_know')
    : [];
  if (diagnosis.length) {
    const named = diagnosis.map((d) =>
      d === 'other' && context.diagnosis_other
        ? `other ("${String(context.diagnosis_other).trim()}")`
        : labels.answerLabel('diagnosis', d).toLowerCase(),
    );
    out.push(`Diagnosis mentioned: ${named.join(', ')}`);
  }

  if (context.surgery_advised === 'yes') {
    const detail = context.surgery_advised_detail
      ? `: ${String(context.surgery_advised_detail).trim()}`
      : '';
    out.push(`Surgery advised${detail}`);
  }

  if (context.consult_reason) {
    out.push(`Reason: ${labels.answerLabel('consult_reason', context.consult_reason)}`);
  }

  if (context.previous_patient === 'yes') out.push('Previous patient of Dr. Acharya');

  return out;
}

/** answered visible / total visible, clamped 0..1. */
export function computeCompleteness(answered: number, total: number): number {
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, answered / total));
}

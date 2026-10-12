import { CATEGORY_INFO } from '../../triage/categories';
import type { CategoryRule, Condition, TriageRule } from '../types';
import { STRUCTURAL_DIAGNOSES } from './options';

/**
 * DRAFT CLINICAL LOGIC — Dr. Acharya's internal scoring table and appointment
 * categories (SCREENING §2–§3), transcribed as data. Not yet reviewed by him
 * against real patients.
 *
 * Two kinds of rule do the work:
 *
 *   score     One per row of his points table. Matching rows add up to the
 *             administrative score. "Maximum score need not be rigidly
 *             interpreted as a medical score. It is an administrative triage
 *             tool for appointment allocation."
 *
 *   category  RED / A / B / C / D. The score bands (8+, 4–7, 0–3) are category
 *             rules on the derived fact `score`; the "significant surgical
 *             features even if score is lower" list is a set of A rules that
 *             fire on the answers directly. Highest severity wins:
 *
 *               RED  90+     A  60–79     D  40–49     B  30–39     C  10–29
 *
 *             so RED is checked before anything else (SOP Step 2), A beats D
 *             (a report-only request with genuine surgical features is still
 *             a surgical evaluation — the team explains the physical-consult
 *             policy either way), and D beats the B/C bands.
 *
 * What the form cannot detect: two of the RED examples — new bladder/bowel
 * dysfunction and saddle numbness — have no question. "Rapidly progressive
 * neurological weakness" is approximated as weakness AND walking both
 * getting progressively worse; progressive weakness alone is A, as in his A
 * examples. "Major recent trauma with neurological symptoms" is injury/
 * fracture in Q1 plus any neurological answer.
 */

const WEAKNESS_ANY = ['stable', 'progressive'];
const WALKING_ANY = ['yes', 'progressive'];
const DURATION_3M_PLUS = ['3_6m', 'gt_6m'];
const NOT_IMPROVING = ['no_improvement', 'worse'];

/** Q1 answers that are more than neck/back pain. */
const NON_ROUTINE_PROBLEMS = [
  'arm_pain',
  'leg_pain',
  'numbness_tingling',
  'weakness',
  'walking_balance',
  'deformity',
  'injury',
  'other',
];

const RADIATING_PAIN: Condition = {
  q: 'main_problem',
  op: 'includes',
  value: ['arm_pain', 'leg_pain'],
};

const ANY_WEAKNESS: Condition = {
  q: 'weakness',
  op: 'in',
  value: WEAKNESS_ANY,
};
const ANY_WALKING: Condition = {
  q: 'walking_balance',
  op: 'in',
  value: WALKING_ANY,
};

/** Any neurological answer anywhere on the form. */
const ANY_NEURO: Condition = {
  any: [
    ANY_WEAKNESS,
    ANY_WALKING,
    {
      q: 'main_problem',
      op: 'includes',
      value: ['numbness_tingling', 'weakness', 'walking_balance'],
    },
  ],
};

const surgical = (
  rule: Omit<CategoryRule, 'kind' | 'category' | 'urgency' | 'pathway'>,
): CategoryRule => ({
  kind: 'category',
  category: 'SURGICAL',
  urgency: 'priority',
  pathway: CATEGORY_INFO.SURGICAL.action,
  ...rule,
});

export const rules: TriageRule[] = [
  /* =================== SCORING (SCREENING §2) =================== */
  {
    kind: 'score',
    code: 'SCORE_PROGRESSIVE_WEAKNESS',
    label: 'Progressive weakness',
    points: 4,
    explain: 'Arm or leg weakness that is progressively increasing (Q2).',
    when: { q: 'weakness', op: 'eq', value: 'progressive' },
  },
  {
    kind: 'score',
    code: 'SCORE_WALKING_DETERIORATION',
    label: 'Walking/balance deterioration',
    points: 3,
    explain: 'Difficulty walking or keeping balance (Q3).',
    when: ANY_WALKING,
  },
  {
    kind: 'score',
    code: 'SCORE_RADIATING_PAIN',
    label: 'Significant radiating arm/leg pain',
    points: 2,
    explain: 'Pain going to the arm/hand or leg/foot (Q1).',
    when: RADIATING_PAIN,
  },
  {
    kind: 'score',
    code: 'SCORE_NUMBNESS',
    label: 'Numbness/tingling',
    points: 1,
    explain: 'Numbness or tingling (Q1).',
    when: { q: 'main_problem', op: 'includes', value: ['numbness_tingling'] },
  },
  {
    kind: 'score',
    code: 'SCORE_DURATION_3M',
    label: 'Symptoms > 3 months',
    points: 1,
    explain: 'Problem present for more than three months (Q4).',
    when: { q: 'duration', op: 'in', value: DURATION_3M_PLUS },
  },
  {
    kind: 'score',
    code: 'SCORE_FAILED_CONSERVATIVE',
    label: 'Failed medicines/physiotherapy',
    points: 2,
    explain:
      'Medicines or physiotherapy tried (Q5) with no improvement or worsening (Q6).',
    when: {
      all: [
        { q: 'treatment', op: 'includes', value: ['medicines', 'physio'] },
        { q: 'treatment_response', op: 'in', value: NOT_IMPROVING },
      ],
    },
  },
  {
    kind: 'score',
    code: 'SCORE_WORSENING',
    label: 'Symptoms worsening',
    points: 2,
    explain:
      'Symptoms getting worse (Q6), or worsening despite treatment given as the reason for consultation (Q10).',
    when: {
      any: [
        { q: 'treatment_response', op: 'eq', value: 'worse' },
        { q: 'consult_reason', op: 'eq', value: 'worsening_despite_treatment' },
      ],
    },
  },
  {
    kind: 'score',
    code: 'SCORE_IMAGING',
    label: 'MRI/CT/X-ray available',
    points: 1,
    explain: 'Has spine imaging (Q7).',
    when: { q: 'has_imaging', op: 'eq', value: 'yes' },
  },
  {
    kind: 'score',
    code: 'SCORE_STRUCTURAL_DIAGNOSIS',
    label: 'Structural spine diagnosis mentioned',
    points: 2,
    explain:
      'A doctor has mentioned disc prolapse, canal stenosis, spondylolisthesis, cervical myelopathy, deformity/scoliosis or fracture (Q8).',
    when: { q: 'diagnosis', op: 'includes', value: STRUCTURAL_DIAGNOSES },
  },
  {
    kind: 'score',
    code: 'SCORE_SURGERY_ADVISED',
    label: 'Surgery already advised',
    points: 3,
    explain: 'A doctor has already advised spine surgery (Q9).',
    when: { q: 'surgery_advised', op: 'eq', value: 'yes' },
  },
  {
    kind: 'score',
    code: 'SCORE_PREVIOUS_SURGERY',
    label: 'Previous spine surgery with recurrent/new problem',
    points: 2,
    explain:
      'Has had spine surgery before (Q5) and is presenting with a problem.',
    when: { q: 'treatment', op: 'includes', value: ['previous_surgery'] },
  },
  {
    kind: 'score',
    code: 'SCORE_ROUTINE_ONLY',
    label: 'Routine pain only, no neurological symptoms',
    points: -2,
    explain:
      'Neck/back pain only (Q1), no weakness (Q2), no walking difficulty (Q3).',
    when: {
      all: [
        { q: 'main_problem', op: 'answered' },
        { q: 'main_problem', op: 'excludes', value: NON_ROUTINE_PROBLEMS },
        { q: 'weakness', op: 'eq', value: 'no' },
        { q: 'walking_balance', op: 'eq', value: 'no' },
      ],
    },
  },
  {
    kind: 'score',
    code: 'SCORE_NO_TREATMENT',
    label: 'No treatment tried',
    points: -1,
    explain: 'No treatment taken so far (Q5).',
    when: { q: 'treatment', op: 'includes', value: ['none'] },
  },
  {
    kind: 'score',
    code: 'SCORE_REPORT_ONLY',
    label: 'Only report/MRI review requested',
    points: -2,
    explain: 'Only wants the MRI/report reviewed (Q10).',
    when: { q: 'consult_reason', op: 'eq', value: 'report_review' },
  },

  /* =================== 🔴 RED — URGENT =================== */
  {
    kind: 'category',
    code: 'RED_TRAUMA_NEURO',
    label: 'Spine injury with neurological symptoms',
    category: 'URGENT',
    urgency: 'urgent',
    severity: 95,
    pathway: CATEGORY_INFO.URGENT.action,
    explain:
      'Reports a spine injury/fracture (Q1) together with weakness, walking difficulty or numbness.',
    when: {
      all: [
        { q: 'main_problem', op: 'includes', value: ['injury'] },
        ANY_NEURO,
      ],
    },
  },
  {
    kind: 'category',
    code: 'RED_RAPID_NEURO_DECLINE',
    label: 'Rapidly progressive neurological deterioration',
    category: 'URGENT',
    urgency: 'urgent',
    severity: 92,
    pathway: CATEGORY_INFO.URGENT.action,
    explain:
      'Weakness (Q2) and walking/balance (Q3) are both getting progressively worse.',
    when: {
      all: [
        { q: 'weakness', op: 'eq', value: 'progressive' },
        { q: 'walking_balance', op: 'eq', value: 'progressive' },
      ],
    },
  },

  /* ========= 🟢 A — HIGH PRIORITY SURGICAL EVALUATION (features) ========= */
  surgical({
    code: 'A_PROGRESSIVE_WEAKNESS',
    label: 'Progressive weakness',
    severity: 75,
    explain: 'Arm or leg weakness that is progressively increasing (Q2).',
    when: { q: 'weakness', op: 'eq', value: 'progressive' },
  }),
  surgical({
    code: 'A_WALKING_DETERIORATION',
    label: 'Significant walking deterioration',
    severity: 74,
    explain: 'Walking/balance getting progressively worse (Q3).',
    when: { q: 'walking_balance', op: 'eq', value: 'progressive' },
  }),
  surgical({
    code: 'A_SURGERY_ADVISED',
    label: 'Surgery already advised',
    severity: 73,
    explain: 'A doctor has already advised spine surgery (Q9).',
    when: { q: 'surgery_advised', op: 'eq', value: 'yes' },
  }),
  surgical({
    code: 'A_RADICULOPATHY_DEFICIT',
    label: 'Radiculopathy with neurological deficit',
    severity: 72,
    explain:
      'Pain going to the arm/leg (Q1) together with weakness (Q2) or walking difficulty (Q3).',
    when: { all: [RADIATING_PAIN, { any: [ANY_WEAKNESS, ANY_WALKING] }] },
  }),
  surgical({
    code: 'A_STRUCTURAL_SIGNIFICANT',
    label:
      'Known stenosis/spondylolisthesis/myelopathy with significant symptoms',
    severity: 71,
    explain:
      'A doctor has mentioned canal stenosis, spondylolisthesis or cervical myelopathy (Q8), with weakness, walking difficulty, or radiating pain that has lasted over three months or not improved with treatment.',
    when: {
      all: [
        {
          q: 'diagnosis',
          op: 'includes',
          value: ['canal_stenosis', 'spondylolisthesis', 'cervical_myelopathy'],
        },
        {
          any: [
            ANY_WEAKNESS,
            ANY_WALKING,
            {
              all: [
                RADIATING_PAIN,
                {
                  any: [
                    { q: 'duration', op: 'in', value: DURATION_3M_PLUS },
                    { q: 'treatment_response', op: 'in', value: NOT_IMPROVING },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  }),

  /* =================== Score bands =================== */
  surgical({
    code: 'A_SCORE',
    label: 'Score 8 or more',
    severity: 60,
    explain: 'Total score of 8 or more on the screening table.',
    when: { q: 'score', op: 'gte', value: 8 },
  }),
  {
    kind: 'category',
    code: 'B_SCORE',
    label: 'Score 4–7',
    category: 'REVIEW',
    urgency: 'routine',
    severity: 30,
    pathway: CATEGORY_INFO.REVIEW.action,
    explain: 'Total score of 4 to 7 on the screening table.',
    when: {
      all: [
        { q: 'score', op: 'gte', value: 4 },
        { q: 'score', op: 'lte', value: 7 },
      ],
    },
  },
  {
    kind: 'category',
    code: 'C_SCORE',
    label: 'Score 0–3',
    category: 'ROUTINE',
    urgency: 'non_urgent',
    severity: 20,
    pathway: CATEGORY_INFO.ROUTINE.action,
    explain: 'Total score of 3 or less on the screening table.',
    when: { q: 'score', op: 'lte', value: 3 },
  },

  /* ========= ⚫ D — REPORT-ONLY / SECOND-OPINION REQUEST ========= */
  {
    kind: 'category',
    code: 'D_REPORT_ONLY',
    label: 'Report-only review requested',
    category: 'REPORT_ONLY',
    urgency: 'routine',
    severity: 45,
    pathway: CATEGORY_INFO.REPORT_ONLY.action,
    explain: 'Only wants the MRI/report reviewed (Q10).',
    when: { q: 'consult_reason', op: 'eq', value: 'report_review' },
  },
  {
    kind: 'category',
    code: 'D_SECOND_OPINION_NO_ADVICE',
    label: 'Second opinion, but no surgery has been advised',
    category: 'REPORT_ONLY',
    urgency: 'routine',
    severity: 44,
    pathway: CATEGORY_INFO.REPORT_ONLY.action,
    // The SOP's carve-out: a second opinion AFTER surgery was advised is a
    // potentially appropriate surgical consultation and must not be rejected.
    // That case never reaches here — A_SURGERY_ADVISED outranks it.
    explain:
      'Wants a second opinion regarding surgery (Q10) but says no doctor has advised surgery (Q9) — in effect a report-review request.',
    when: {
      all: [
        { q: 'consult_reason', op: 'eq', value: 'second_opinion' },
        { q: 'surgery_advised', op: 'eq', value: 'no' },
      ],
    },
  },

  /* =================== Advisory =================== */
  {
    kind: 'advisory',
    code: 'ADVISORY_SECOND_OPINION_AFTER_ADVICE',
    label: 'Second opinion after surgery was advised',
    explain: 'Second opinion requested and surgery has been advised elsewhere.',
    secondaryNote:
      'Second opinion requested after surgery was advised elsewhere — a potentially appropriate surgical consultation, not a report-only request.',
    when: {
      all: [
        { q: 'consult_reason', op: 'eq', value: 'second_opinion' },
        { q: 'surgery_advised', op: 'eq', value: 'yes' },
      ],
    },
  },
  {
    kind: 'advisory',
    code: 'ADVISORY_IMAGING_AVAILABLE',
    label: 'Imaging available',
    explain: 'Patient has spine imaging.',
    secondaryNote:
      'Patient has an MRI/CT/X-ray — ask them to bring or upload the latest report and images.',
    when: { q: 'has_imaging', op: 'eq', value: 'yes' },
  },
  {
    kind: 'advisory',
    code: 'ADVISORY_SURGERY_DETAIL',
    label: 'Advised surgery named',
    explain: 'Patient wrote down which surgery was advised.',
    secondaryNote:
      'Patient named the surgery that was advised — see their note.',
    when: { q: 'surgery_advised_detail', op: 'answered' },
  },
  {
    kind: 'advisory',
    code: 'ADVISORY_STABLE_WEAKNESS',
    label: 'Stable weakness',
    explain: 'Reports stable arm/leg weakness.',
    // The points table scores progressive weakness only. Stable weakness is
    // still a neurological finding, so it is surfaced for the reviewer.
    secondaryNote:
      'Reports stable arm/leg weakness (Q2) — not scored by the table; verify on review.',
    when: { q: 'weakness', op: 'eq', value: 'stable' },
  },
  {
    kind: 'advisory',
    code: 'ADVISORY_INJURY_NO_NEURO',
    label: 'Spine injury without neurological symptoms',
    explain: 'Reports a spine injury/fracture but no neurological symptoms.',
    secondaryNote:
      'Reports a spine injury/fracture (Q1) without neurological symptoms — check how recent the injury is.',
    when: {
      all: [
        { q: 'main_problem', op: 'includes', value: ['injury'] },
        { not: ANY_NEURO },
      ],
    },
  },
  {
    kind: 'advisory',
    code: 'ADVISORY_PREVIOUS_PATIENT',
    label: 'Previous patient',
    explain: 'Has consulted Dr. Acharya before.',
    secondaryNote:
      'Previous patient of Dr. Acharya — look up the existing file.',
    when: { q: 'previous_patient', op: 'eq', value: 'yes' },
  },
];

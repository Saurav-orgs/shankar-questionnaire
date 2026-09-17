import { evaluateRules, redFlagsFromSchema } from './rules-engine';
import type { EvaluationContext } from '../questionnaire/types';
import { questionnaireV1, rulesV1 } from '../questionnaire/v1';

/**
 * Fixture-driven tests for the triage rule set (plan.md §8, §13 Phase 4).
 *
 * The rules ARE the product, so each one gets a named patient whose answers
 * should fire it, and we assert both the resulting category and that the rule
 * appears in the matched list. Plus: precedence (RED > AMBER > GREY > GREEN),
 * the unmatched fallback, the advisory notes, and red-flag reporting.
 *
 * evaluateRules reads raw answer keys directly (branching visibility does not
 * apply here), so each fixture sets only the keys its rule needs, plus enough
 * to keep a higher-severity rule from stealing the verdict.
 */

const base: EvaluationContext = {
  name: 'Test Patient',
  age: 45,
  gender: 'male',
  mobile: '9999999999',
  occupation: 'driver',
};

/** No red flags — spread into scenarios that must stay out of the RED band. */
const noRedFlags: EvaluationContext = {
  rf_bladder: 'no',
  rf_bowel: 'no',
  rf_saddle: 'no',
  rf_progressive_weakness: 'no',
  rf_trauma: 'no',
  rf_fever: 'no',
  rf_cancer: 'no',
  rf_weight_loss: 'no',
  rf_night_pain: 'no',
  rf_immuno: 'no',
};

function run(overrides: EvaluationContext) {
  return evaluateRules(rulesV1, { ...base, ...overrides });
}

interface Scenario {
  name: string;
  answers: EvaluationContext;
  category: 'RED' | 'AMBER' | 'GREY' | 'GREEN';
  expectRule: string;
}

const scenarios: Scenario[] = [
  /* ---------------- RED ---------------- */
  {
    name: 'Cauda equina — saddle numbness',
    answers: {
      ...noRedFlags,
      rf_saddle: 'yes',
      chief_complaint: ['low_back_pain'],
    },
    category: 'RED',
    expectRule: 'RED_CAUDA_EQUINA',
  },
  {
    name: 'Progressive motor deficit — foot drop',
    answers: {
      ...noRedFlags,
      rf_progressive_weakness: 'yes',
      chief_complaint: ['leg_pain'],
    },
    category: 'RED',
    expectRule: 'RED_PROGRESSIVE_DEFICIT',
  },
  {
    name: 'Cervical myelopathy — clumsy hands + unsteady gait',
    answers: {
      ...noRedFlags,
      chief_complaint: ['neck_pain'],
      neck_radiate: 'none',
      myelo_buttons: 'yes',
      myelo_gait: 'yes',
      myelo_both_hands: 'yes',
      myelo_urinary: 'yes',
    },
    category: 'RED',
    expectRule: 'RED_MYELOPATHY',
  },
  {
    name: 'Spinal infection — fever + night pain',
    answers: {
      ...noRedFlags,
      rf_fever: 'yes',
      rf_night_pain: 'yes',
      chief_complaint: ['low_back_pain'],
    },
    category: 'RED',
    expectRule: 'RED_INFECTION',
  },
  {
    name: 'Malignancy — cancer history + weight loss',
    answers: {
      ...noRedFlags,
      rf_cancer: 'yes',
      rf_weight_loss: 'yes',
      chief_complaint: ['low_back_pain'],
    },
    category: 'RED',
    expectRule: 'RED_MALIGNANCY',
  },
  {
    name: 'Traumatic fracture — fall at 60',
    answers: {
      ...noRedFlags,
      rf_trauma: 'yes',
      age: 60,
      chief_complaint: ['low_back_pain'],
    },
    category: 'RED',
    expectRule: 'RED_FRACTURE_TRAUMA',
  },
  {
    name: 'Fragility fracture — sudden severe pain at 75, no trauma',
    answers: {
      ...noRedFlags,
      age: 75,
      chief_complaint: ['low_back_pain'],
      lbp_onset: 'sudden_lift',
      lbp_duration: 'lt_2w',
      lbp_severity: 8,
    },
    category: 'RED',
    expectRule: 'RED_FRAGILITY_FRACTURE',
  },

  /* ---------------- AMBER ---------------- */
  {
    name: 'Lumbar radiculopathy — below-knee pain + numbness, chronic',
    answers: {
      ...noRedFlags,
      chief_complaint: ['low_back_pain', 'leg_pain'],
      lbp_radiate: 'below_knee',
      lbp_numbness: 'yes',
      lbp_duration: '3_12m',
    },
    category: 'AMBER',
    expectRule: 'AMBER_LUMBAR_RADICULOPATHY',
  },
  {
    name: 'Motor deficit — leg weakness, not progressing',
    answers: {
      ...noRedFlags,
      chief_complaint: ['leg_pain'],
      lbp_radiate: 'none',
      lbp_numbness: 'no',
      lbp_weakness: 'yes',
    },
    category: 'AMBER',
    expectRule: 'AMBER_MOTOR_DEFICIT',
  },
  {
    name: 'Lumbar stenosis — limited walking, relief on bending, age 65',
    answers: {
      ...noRedFlags,
      age: 65,
      chief_complaint: ['leg_pain', 'walking_difficulty'],
      lbp_radiate: 'none',
      lbp_numbness: 'no',
      lbp_weakness: 'no',
      lbp_walk_distance: 'lt_100m',
      lbp_bend_relief: 'yes',
      vasc_claudication: 'sit_bend',
    },
    category: 'AMBER',
    expectRule: 'AMBER_STENOSIS',
  },
  {
    name: 'Cervical radiculopathy — below-elbow arm pain + hand numbness',
    answers: {
      ...noRedFlags,
      chief_complaint: ['neck_pain', 'arm_pain'],
      neck_radiate: 'below_elbow',
      neck_numbness_hand: 'yes',
      neck_duration: '3_12m',
      myelo_buttons: 'no',
      myelo_gait: 'no',
    },
    category: 'AMBER',
    expectRule: 'AMBER_CERVICAL_RADICULOPATHY',
  },
  {
    name: 'Failed conservative care — 6+ weeks physio, no benefit',
    answers: {
      ...noRedFlags,
      chief_complaint: ['low_back_pain'],
      lbp_radiate: 'none',
      lbp_numbness: 'no',
      lbp_weakness: 'no',
      lbp_duration: '3_12m',
      tx_tried: ['physio'],
      tx_physio_duration: 'gt_6w',
      tx_response: 'not_at_all',
      func_work: 'difficulty',
    },
    category: 'AMBER',
    expectRule: 'AMBER_FAILED_CONSERVATIVE',
  },
  {
    name: 'Post-surgical — previous spine surgery',
    answers: {
      ...noRedFlags,
      chief_complaint: ['low_back_pain'],
      lbp_radiate: 'none',
      lbp_numbness: 'no',
      lbp_weakness: 'no',
      tx_tried: ['surgery'],
      tx_response: 'partly',
    },
    category: 'AMBER',
    expectRule: 'AMBER_POST_SURGICAL',
  },
  {
    name: 'Functional collapse — stopped working, worsening, chronic',
    answers: {
      ...noRedFlags,
      chief_complaint: ['low_back_pain'],
      lbp_radiate: 'none',
      lbp_numbness: 'no',
      lbp_weakness: 'no',
      lbp_duration: '3_12m',
      func_work: 'stopped',
      func_worsening: 'worse',
      tx_tried: ['painkillers'],
      tx_response: 'partly',
    },
    category: 'AMBER',
    expectRule: 'AMBER_FUNCTIONAL_COLLAPSE',
  },

  /* ---------------- GREY ---------------- */
  {
    name: 'Hip, not spine — groin pain + stiffness, no radiation',
    answers: {
      ...noRedFlags,
      age: 66,
      chief_complaint: ['low_back_pain'],
      lbp_radiate: 'buttock',
      lbp_numbness: 'no',
      lbp_weakness: 'no',
      hip_groin: 'yes',
      hip_socks: 'yes',
    },
    category: 'GREY',
    expectRule: 'GREY_HIP',
  },
  {
    name: 'Shoulder, not neck — overhead pain above elbow',
    answers: {
      ...noRedFlags,
      chief_complaint: ['arm_pain'],
      neck_radiate: 'shoulder',
      neck_numbness_hand: 'no',
      myelo_buttons: 'no',
      myelo_gait: 'no',
      shoulder_overhead: 'yes',
    },
    category: 'GREY',
    expectRule: 'GREY_SHOULDER',
  },
  {
    name: 'Vascular claudication — relief on standing, smoker/diabetic',
    answers: {
      ...noRedFlags,
      age: 64,
      chief_complaint: ['leg_pain', 'walking_difficulty'],
      lbp_radiate: 'buttock',
      lbp_numbness: 'no',
      lbp_weakness: 'no',
      lbp_walk_distance: '100_500m',
      lbp_bend_relief: 'no',
      vasc_claudication: 'stand_still',
      comorbidities: ['diabetes', 'smoking'],
    },
    category: 'GREY',
    expectRule: 'GREY_VASCULAR',
  },
  {
    name: 'Inflammatory back pain — young, morning stiffness, better with movement',
    answers: {
      ...noRedFlags,
      age: 30,
      chief_complaint: ['low_back_pain'],
      lbp_radiate: 'none',
      lbp_numbness: 'no',
      lbp_weakness: 'no',
      lbp_duration: '3_12m',
      inflam_morning_stiffness: 'yes',
      inflam_exercise_better: 'yes',
    },
    category: 'GREY',
    expectRule: 'GREY_INFLAMMATORY',
  },
  {
    name: 'Widespread pain — many sites + fatigue',
    answers: {
      ...noRedFlags,
      chief_complaint: ['low_back_pain'],
      lbp_radiate: 'none',
      lbp_numbness: 'no',
      lbp_weakness: 'no',
      widespread_pain: 'yes',
    },
    category: 'GREY',
    expectRule: 'GREY_WIDESPREAD',
  },
  {
    name: 'Unclear — none of these',
    answers: {
      ...noRedFlags,
      chief_complaint: ['none_of_these'],
    },
    category: 'GREY',
    expectRule: 'GREY_UNCLEAR',
  },

  /* ---------------- GREEN ---------------- */
  {
    name: 'Acute mechanical — under 6 weeks, no radiation, no red flags',
    answers: {
      ...noRedFlags,
      age: 40,
      chief_complaint: ['low_back_pain'],
      lbp_duration: '2_6w',
      lbp_radiate: 'none',
      lbp_numbness: 'no',
      lbp_weakness: 'no',
      lbp_severity: 4,
    },
    category: 'GREEN',
    expectRule: 'GREEN_ACUTE_MECHANICAL',
  },
  {
    name: 'Chronic untreated — 1 year, nothing tried but rest',
    answers: {
      ...noRedFlags,
      chief_complaint: ['low_back_pain'],
      lbp_duration: 'gt_1y',
      lbp_radiate: 'none',
      lbp_numbness: 'no',
      lbp_weakness: 'no',
      tx_tried: ['rest'],
    },
    category: 'GREEN',
    expectRule: 'GREEN_UNTREATED_CHRONIC',
  },
];

describe('triage rules — one scenario per rule', () => {
  it.each(scenarios)(
    '$name -> $category ($expectRule)',
    ({ answers, category, expectRule }) => {
      const result = run(answers);
      const codes = result.matchedRules.map((r) => r.code);
      expect(codes).toContain(expectRule);
      expect(result.category).toBe(category);
    },
  );

  it('covers every non-advisory rule at least once', () => {
    const covered = new Set(scenarios.map((s) => s.expectRule));
    const uncovered = rulesV1
      .filter((r) => !r.advisory)
      .map((r) => r.code)
      .filter((code) => !covered.has(code));
    expect(uncovered).toEqual([]);
  });
});

describe('precedence', () => {
  it('RED beats AMBER when both fire (myelopathy + cervical radiculopathy)', () => {
    const result = run({
      ...noRedFlags,
      chief_complaint: ['neck_pain', 'arm_pain'],
      neck_radiate: 'below_elbow',
      neck_numbness_hand: 'yes',
      neck_duration: '3_12m',
      myelo_buttons: 'yes',
      myelo_gait: 'yes',
      myelo_both_hands: 'yes',
      myelo_urinary: 'yes',
    });
    const codes = result.matchedRules.map((r) => r.code);
    expect(codes).toContain('RED_MYELOPATHY');
    expect(codes).toContain('AMBER_CERVICAL_RADICULOPATHY');
    expect(result.category).toBe('RED');
  });

  it('GREY beats GREEN when both fire (hip pattern + chronic untreated)', () => {
    const result = run({
      ...noRedFlags,
      age: 66,
      chief_complaint: ['low_back_pain'],
      lbp_radiate: 'buttock',
      lbp_numbness: 'no',
      lbp_weakness: 'no',
      lbp_duration: 'gt_1y',
      hip_groin: 'yes',
      hip_socks: 'yes',
      tx_tried: ['rest'],
    });
    const codes = result.matchedRules.map((r) => r.code);
    expect(codes).toContain('GREY_HIP');
    expect(codes).toContain('GREEN_UNTREATED_CHRONIC');
    expect(result.category).toBe('GREY');
  });
});

describe('unmatched fallback', () => {
  it('flags a case that fires no rule and defaults to GREEN', () => {
    const result = run({
      ...noRedFlags,
      chief_complaint: ['low_back_pain'],
      lbp_duration: '3_12m',
      lbp_radiate: 'none',
      lbp_numbness: 'no',
      lbp_weakness: 'no',
      lbp_walk_distance: 'unlimited',
      // Physio tried, so GREEN_UNTREATED is excluded; response only partial and
      // work unaffected, so AMBER_FAILED_CONSERVATIVE does not fire either.
      tx_tried: ['physio'],
      tx_physio_duration: '2_6w',
      tx_response: 'partly',
      func_work: 'fully',
      func_worsening: 'same',
      hip_groin: 'no',
      inflam_morning_stiffness: 'no',
      inflam_exercise_better: 'no',
      widespread_pain: 'no',
    });
    expect(result.matchedRules).toEqual([]);
    expect(result.unmatched).toBe(true);
    expect(result.category).toBe('GREEN');
    expect(result.pathway).toMatch(/no rule pattern matched/i);
  });
});

describe('advisory notes', () => {
  it('adds a pregnancy note without changing the category', () => {
    const result = run({
      ...noRedFlags,
      gender: 'female',
      age: 30,
      chief_complaint: ['low_back_pain'],
      lbp_duration: '2_6w',
      lbp_radiate: 'none',
      lbp_numbness: 'no',
      lbp_weakness: 'no',
      is_pregnant: 'yes',
    });
    expect(result.matchedRules.map((r) => r.code)).not.toContain(
      'ADVISORY_PREGNANCY',
    );
    expect(result.secondaryNotes.join(' ')).toMatch(/pregnant/i);
  });

  it('adds a hip-overlap note', () => {
    const result = run({
      ...noRedFlags,
      chief_complaint: ['low_back_pain'],
      hip_groin: 'yes',
      hip_socks: 'yes',
    });
    expect(result.secondaryNotes.join(' ')).toMatch(/hip/i);
  });

  it('adds a recent-imaging note', () => {
    const result = run({
      ...noRedFlags,
      chief_complaint: ['low_back_pain'],
      img_done: ['mri'],
      img_when: 'lt_3m',
    });
    expect(result.secondaryNotes.join(' ')).toMatch(/scan|film|report/i);
  });

  it('adds a free-text note', () => {
    const result = run({
      ...noRedFlags,
      chief_complaint: ['low_back_pain'],
      free_text: 'Pain worse after driving.',
    });
    expect(result.secondaryNotes.join(' ')).toMatch(/free-text note/i);
  });
});

describe('red-flag reporting', () => {
  it('reports a positive red flag with its answer', () => {
    const flags = redFlagsFromSchema(questionnaireV1, {
      ...base,
      ...noRedFlags,
      rf_saddle: 'yes',
    });
    const saddle = flags.find((f) => f.key === 'rf_saddle');
    expect(saddle?.answer).toBe('Yes');
    const positives = flags.filter(
      (f) => f.answer !== 'No' && f.answer !== 'Not answered',
    );
    expect(positives.map((f) => f.key)).toEqual(['rf_saddle']);
  });

  it('reports all red flags as No for a clean patient', () => {
    const flags = redFlagsFromSchema(questionnaireV1, { ...base, ...noRedFlags });
    expect(flags.length).toBeGreaterThanOrEqual(10);
    expect(flags.every((f) => f.answer === 'No')).toBe(true);
  });
});

import type { EvaluationContext } from '../questionnaire/types';

/**
 * One seed case per triage rule — plan.md §9, Phase 5a.
 *
 * Each case is a patient constructed to fire exactly one target rule. Higher
 * severity rules are allowed to win the verdict on top (that is realistic and
 * the generator records it), but the target rule must appear in the matched
 * list or the case is broken and the generator fails loudly.
 *
 * These are seeds, not the dataset. `generate-dataset.ts` expands each one
 * across demographics, form language and free text.
 */

export interface SeedCase {
  /** Rule code this case must fire. */
  rule: string;
  /** Id prefix, when several cases target the same rule. Defaults to `rule`. */
  name?: string;
  language: 'en' | 'hi';
  answers: EvaluationContext;
  /**
   * Age range safe to vary within. Omit when the rule depends on age — the
   * generator then holds `age` at whatever the case set.
   */
  ageBand?: [number, number];
}

const NO_RF: EvaluationContext = {
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

/** Non-specific mechanical low back pain. No red flags, no neurology. */
const LUMBAR: EvaluationContext = {
  age: 44,
  gender: 'male',
  city: 'Pune',
  occupation: 'desk_job',
  ...NO_RF,
  chief_complaint: ['low_back_pain'],
  primary_complaint: 'low_back_pain',
  lbp_duration: '6w_3m',
  lbp_onset: 'gradual',
  lbp_severity: 5,
  lbp_radiate: 'none',
  lbp_cough: 'no',
  lbp_sitting: 'yes',
  lbp_walking: 'no',
  lbp_walk_distance: 'unlimited',
  lbp_bend_relief: 'no',
  lbp_numbness: 'no',
  lbp_weakness: 'no',
  lbp_rest_relief: 'yes',
  hip_groin: 'no',
  hip_socks: 'no',
  shoulder_overhead: 'no',
  vasc_claudication: 'na',
  inflam_morning_stiffness: 'no',
  inflam_exercise_better: 'no',
  widespread_pain: 'no',
  func_work: 'difficulty',
  func_sleep: 'never',
  func_daily: 'independent',
  func_worsening: 'same',
  tx_tried: ['painkillers'],
  tx_response: 'partly',
  img_done: ['none'],
  comorbidities: ['none'],
  is_pregnant: 'no',
};

/** Non-specific neck pain. No red flags, no neurology. */
const NECK: EvaluationContext = {
  age: 46,
  gender: 'female',
  city: 'Kochi',
  occupation: 'teacher',
  ...NO_RF,
  chief_complaint: ['neck_pain'],
  primary_complaint: 'neck_pain',
  neck_duration: '6w_3m',
  neck_severity: 5,
  neck_radiate: 'none',
  neck_numbness_hand: 'no',
  neck_grip: 'no',
  myelo_buttons: 'no',
  myelo_gait: 'no',
  myelo_both_hands: 'no',
  myelo_urinary: 'no',
  neck_headache: 'no',
  hip_groin: 'no',
  hip_socks: 'no',
  shoulder_overhead: 'no',
  vasc_claudication: 'na',
  inflam_morning_stiffness: 'no',
  inflam_exercise_better: 'no',
  widespread_pain: 'no',
  func_work: 'difficulty',
  func_sleep: 'never',
  func_daily: 'independent',
  func_worsening: 'same',
  tx_tried: ['painkillers'],
  tx_response: 'partly',
  img_done: ['none'],
  comorbidities: ['none'],
  is_pregnant: 'no',
};

export const SEED_CASES: SeedCase[] = [
  /* ---------------- RED ---------------- */
  {
    rule: 'RED_CAUDA_EQUINA',
    language: 'hi',
    ageBand: [28, 75],
    answers: {
      ...LUMBAR,
      chief_complaint: ['low_back_pain', 'leg_pain', 'numbness'],
      lbp_radiate: 'below_knee',
      rf_saddle: 'yes',
    },
  },
  {
    rule: 'RED_PROGRESSIVE_DEFICIT',
    language: 'en',
    ageBand: [30, 78],
    answers: {
      ...LUMBAR,
      chief_complaint: ['low_back_pain', 'leg_pain', 'weakness'],
      lbp_radiate: 'below_knee',
      lbp_weakness: 'yes',
      rf_progressive_weakness: 'yes',
      func_worsening: 'worse',
    },
  },
  {
    rule: 'RED_MYELOPATHY',
    language: 'en',
    ageBand: [45, 80],
    answers: {
      ...NECK,
      chief_complaint: ['neck_pain', 'arm_pain', 'numbness'],
      neck_duration: '3_12m',
      neck_radiate: 'below_elbow',
      neck_numbness_hand: 'yes',
      neck_grip: 'yes',
      myelo_buttons: 'yes',
      myelo_both_hands: 'yes',
      func_daily: 'some_help',
      func_worsening: 'worse',
    },
  },
  {
    rule: 'RED_INFECTION',
    language: 'en',
    ageBand: [35, 78],
    answers: {
      ...LUMBAR,
      rf_fever: 'yes',
      rf_night_pain: 'yes',
      comorbidities: ['diabetes'],
      lbp_duration: '2_6w',
      lbp_severity: 8,
      func_sleep: 'most_nights',
    },
  },
  {
    rule: 'RED_MALIGNANCY',
    language: 'en',
    ageBand: [48, 82],
    answers: {
      ...LUMBAR,
      rf_cancer: 'yes',
      rf_night_pain: 'yes',
      rf_weight_loss: 'yes',
      lbp_duration: '6w_3m',
      lbp_severity: 7,
      func_sleep: 'most_nights',
    },
  },
  {
    rule: 'RED_FRACTURE_TRAUMA',
    language: 'hi',
    answers: {
      ...LUMBAR,
      age: 68,
      occupation: 'retired',
      rf_trauma: 'yes',
      lbp_onset: 'sudden_injury',
      lbp_duration: 'lt_2w',
      lbp_severity: 8,
    },
  },
  {
    rule: 'RED_FRAGILITY_FRACTURE',
    language: 'hi',
    answers: {
      ...LUMBAR,
      age: 74,
      gender: 'female',
      occupation: 'homemaker',
      rf_trauma: 'no',
      lbp_onset: 'no_cause',
      lbp_duration: '2_6w',
      lbp_severity: 8,
      comorbidities: ['osteoporosis'],
    },
  },

  /* ---------------- AMBER ---------------- */
  {
    rule: 'AMBER_LUMBAR_RADICULOPATHY',
    language: 'en',
    ageBand: [26, 68],
    answers: {
      ...LUMBAR,
      chief_complaint: ['low_back_pain', 'leg_pain', 'numbness'],
      lbp_duration: '3_12m',
      lbp_severity: 7,
      lbp_radiate: 'below_knee',
      lbp_side: 'right',
      lbp_cough: 'yes',
      lbp_numbness: 'yes',
    },
  },
  {
    rule: 'AMBER_MOTOR_DEFICIT',
    language: 'en',
    ageBand: [30, 70],
    answers: {
      ...LUMBAR,
      chief_complaint: ['low_back_pain', 'weakness'],
      lbp_duration: '6w_3m',
      lbp_radiate: 'above_knee',
      lbp_weakness: 'yes',
      rf_progressive_weakness: 'no',
    },
  },
  {
    rule: 'AMBER_STENOSIS',
    language: 'hi',
    ageBand: [55, 80],
    answers: {
      ...LUMBAR,
      age: 62,
      occupation: 'retired',
      chief_complaint: ['low_back_pain', 'leg_pain', 'walking_difficulty'],
      lbp_duration: 'gt_1y',
      lbp_radiate: 'buttock',
      lbp_side: 'both',
      lbp_walking: 'yes',
      lbp_walk_distance: '100_500m',
      lbp_bend_relief: 'yes',
      vasc_claudication: 'sit_bend',
    },
  },
  {
    rule: 'AMBER_CERVICAL_RADICULOPATHY',
    language: 'en',
    ageBand: [30, 68],
    answers: {
      ...NECK,
      chief_complaint: ['neck_pain', 'arm_pain', 'numbness'],
      neck_duration: '3_12m',
      neck_severity: 7,
      neck_radiate: 'below_elbow',
      neck_side: 'left',
      neck_numbness_hand: 'yes',
    },
  },
  {
    rule: 'AMBER_FAILED_CONSERVATIVE',
    language: 'en',
    ageBand: [28, 70],
    answers: {
      ...LUMBAR,
      lbp_duration: 'gt_1y',
      lbp_severity: 6,
      tx_tried: ['painkillers', 'physio'],
      tx_physio_duration: 'gt_6w',
      tx_response: 'not_at_all',
      func_work: 'difficulty',
    },
  },
  {
    rule: 'AMBER_POST_SURGICAL',
    language: 'en',
    ageBand: [35, 72],
    answers: {
      ...LUMBAR,
      lbp_duration: 'gt_1y',
      tx_tried: ['painkillers', 'physio', 'surgery'],
      tx_physio_duration: '2_6w',
      tx_response: 'partly',
      tx_prior_surgery_detail: 'L4-L5 discectomy in 2019 at a hospital in Mumbai.',
    },
  },
  {
    rule: 'AMBER_FUNCTIONAL_COLLAPSE',
    language: 'hi',
    ageBand: [30, 68],
    answers: {
      ...LUMBAR,
      lbp_duration: '3_12m',
      lbp_severity: 8,
      func_work: 'stopped',
      func_worsening: 'worse',
      func_daily: 'some_help',
      func_sleep: 'most_nights',
    },
  },

  /* ---------------- GREY ---------------- */
  {
    rule: 'GREY_HIP',
    language: 'hi',
    ageBand: [52, 82],
    answers: {
      ...LUMBAR,
      age: 66,
      gender: 'female',
      occupation: 'homemaker',
      lbp_duration: 'gt_1y',
      lbp_radiate: 'buttock',
      lbp_side: 'left',
      hip_groin: 'yes',
      hip_socks: 'yes',
      vasc_claudication: 'neither',
    },
  },
  {
    rule: 'GREY_SHOULDER',
    language: 'en',
    ageBand: [38, 72],
    answers: {
      ...NECK,
      chief_complaint: ['neck_pain', 'arm_pain'],
      neck_duration: '3_12m',
      neck_radiate: 'shoulder',
      neck_side: 'right',
      shoulder_overhead: 'yes',
    },
  },
  {
    rule: 'GREY_VASCULAR',
    language: 'en',
    ageBand: [55, 80],
    answers: {
      ...LUMBAR,
      age: 64,
      occupation: 'shop_business',
      chief_complaint: ['leg_pain', 'walking_difficulty'],
      primary_complaint: 'leg_pain',
      lbp_duration: '3_12m',
      lbp_radiate: 'buttock',
      lbp_side: 'both',
      lbp_walking: 'yes',
      lbp_walk_distance: '100_500m',
      vasc_claudication: 'stand_still',
      comorbidities: ['diabetes', 'smoking'],
    },
  },
  {
    rule: 'GREY_INFLAMMATORY',
    language: 'en',
    answers: {
      ...LUMBAR,
      age: 31,
      occupation: 'student',
      lbp_duration: '3_12m',
      lbp_onset: 'gradual',
      inflam_morning_stiffness: 'yes',
      inflam_exercise_better: 'yes',
      func_sleep: 'sometimes',
    },
  },
  {
    rule: 'GREY_WIDESPREAD',
    language: 'hi',
    ageBand: [28, 62],
    answers: {
      ...LUMBAR,
      gender: 'female',
      lbp_duration: 'gt_1y',
      widespread_pain: 'yes',
      func_sleep: 'most_nights',
    },
  },
  {
    rule: 'GREY_UNCLEAR',
    language: 'en',
    ageBand: [25, 70],
    answers: {
      ...LUMBAR,
      chief_complaint: ['none_of_these'],
      primary_complaint: 'none_of_these',
    },
  },

  /* ---------------- GREEN ---------------- */
  {
    rule: 'GREEN_ACUTE_MECHANICAL',
    language: 'en',
    ageBand: [22, 55],
    answers: {
      ...LUMBAR,
      lbp_duration: '2_6w',
      lbp_onset: 'sudden_lift',
      lbp_severity: 5,
      lbp_radiate: 'none',
      tx_tried: ['rest'],
    },
  },
  {
    rule: 'GREEN_UNTREATED_CHRONIC',
    language: 'hi',
    ageBand: [24, 58],
    answers: {
      ...LUMBAR,
      lbp_duration: '6w_3m',
      lbp_radiate: 'none',
      tx_tried: ['painkillers'],
      tx_response: 'partly',
    },
  },

  /* ---------------- Advisory ---------------- */
  {
    // Hip signs alongside a genuine radiculopathy — the advisory fires but
    // GREY_HIP is correctly blocked by the neurological finding.
    rule: 'ADVISORY_HIP_OVERLAP',
    language: 'en',
    ageBand: [50, 75],
    answers: {
      ...LUMBAR,
      age: 61,
      chief_complaint: ['low_back_pain', 'leg_pain', 'numbness'],
      lbp_duration: '3_12m',
      lbp_radiate: 'below_knee',
      lbp_side: 'left',
      lbp_numbness: 'yes',
      hip_groin: 'yes',
      hip_socks: 'yes',
    },
  },
  {
    rule: 'ADVISORY_PREGNANCY',
    language: 'hi',
    ageBand: [22, 38],
    answers: {
      ...LUMBAR,
      gender: 'female',
      occupation: 'homemaker',
      lbp_duration: '6w_3m',
      is_pregnant: 'yes',
    },
  },
  {
    rule: 'ADVISORY_RECENT_IMAGING',
    language: 'en',
    ageBand: [30, 70],
    answers: {
      ...LUMBAR,
      lbp_duration: '3_12m',
      img_done: ['mri'],
      img_when: 'lt_3m',
    },
  },
  {
    rule: 'ADVISORY_FREE_TEXT',
    language: 'en',
    ageBand: [25, 65],
    answers: {
      ...LUMBAR,
      free_text: 'The pain is worst first thing in the morning and eases once I start moving around.',
    },
  },

  /* ---------------- Inconsistent intake ---------------- *
   * The validator flags answers that disagree with each other, and the doctor
   * panel shows them. Without these cases the model would meet the
   * INCONSISTENCIES block for the first time in production.
   *
   * Only contradictions that survive branch cleaning are reachable: an answer
   * from a hidden branch is stripped before evaluation, in the generator and
   * in the answers endpoint alike. That leaves the multi-select conflicts and
   * red-flag over-reporting.
   */
  {
    // "Nothing yet" ticked alongside real treatments, and the same pattern on
    // comorbidities and imaging. Common on a phone: patients tick the first
    // option, then keep going.
    rule: 'GREEN_UNTREATED_CHRONIC',
    name: 'CONTRA_MULTISELECT',
    language: 'hi',
    ageBand: [26, 64],
    answers: {
      ...LUMBAR,
      lbp_duration: '6w_3m',
      tx_tried: ['nothing', 'painkillers', 'rest'],
      tx_response: 'partly',
      comorbidities: ['none', 'diabetes'],
      img_done: ['none', 'xray'],
      img_when: 'gt_1y',
    },
  },
  {
    // Yes to nearly every red flag. Clinically this reads as an anxious or
    // rushed intake rather than a patient with eight separate emergencies —
    // the verdict still routes on the answers, and the note tells the doctor
    // to verify in person.
    rule: 'RED_CAUDA_EQUINA',
    name: 'CONTRA_ALL_RED_FLAGS',
    language: 'hi',
    ageBand: [30, 72],
    answers: {
      ...LUMBAR,
      rf_bladder: 'yes',
      rf_bowel: 'yes',
      rf_saddle: 'yes',
      rf_progressive_weakness: 'yes',
      rf_trauma: 'yes',
      rf_fever: 'yes',
      rf_cancer: 'yes',
      rf_weight_loss: 'yes',
      rf_night_pain: 'yes',
      lbp_severity: 9,
      func_work: 'stopped',
    },
  },
];

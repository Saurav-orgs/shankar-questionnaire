import type { Condition, TriageRule } from '../types';

/**
 * DRAFT CLINICAL LOGIC — NOT REVIEWED BY A CLINICIAN.
 *
 * Modelled on widely published red-flag and referral guidance. Every rule is
 * data, not code, so the doctor can read and correct this table without
 * touching the application. See plan.md §2 and §14.
 *
 * Severity bands: RED 85-100, AMBER 55-75, GREY 30-45, GREEN 15-25,
 * advisory 1. The highest-severity non-advisory match sets the category.
 */

const DURATION_6W_PLUS = ['6w_3m', '3_12m', 'gt_1y'];
const DURATION_UNDER_6W = ['lt_2w', '2_6w'];
const DURATION_3M_PLUS = ['3_12m', 'gt_1y'];

/** No lumbar nerve-root signal. Passes when the lumbar branch was never shown. */
const NO_LUMBAR_NEURO: Condition = {
  all: [
    { not: { q: 'lbp_radiate', op: 'eq', value: 'below_knee' } },
    { not: { q: 'lbp_weakness', op: 'eq', value: 'yes' } },
    { not: { q: 'lbp_numbness', op: 'eq', value: 'yes' } },
  ],
};

/** No cervical nerve-root or cord signal. */
const NO_CERVICAL_NEURO: Condition = {
  all: [
    { not: { q: 'neck_radiate', op: 'eq', value: 'below_elbow' } },
    { not: { q: 'neck_numbness_hand', op: 'eq', value: 'yes' } },
    { not: { q: 'myelo_buttons', op: 'eq', value: 'yes' } },
    { not: { q: 'myelo_gait', op: 'eq', value: 'yes' } },
  ],
};

const NO_RED_FLAGS: Condition = {
  all: [
    { not: { q: 'rf_bladder', op: 'in', value: ['yes', 'unsure'] } },
    { not: { q: 'rf_bowel', op: 'in', value: ['yes', 'unsure'] } },
    { not: { q: 'rf_saddle', op: 'in', value: ['yes', 'unsure'] } },
    { not: { q: 'rf_progressive_weakness', op: 'eq', value: 'yes' } },
    { not: { q: 'rf_fever', op: 'eq', value: 'yes' } },
    { not: { q: 'rf_cancer', op: 'eq', value: 'yes' } },
    { not: { q: 'rf_weight_loss', op: 'eq', value: 'yes' } },
    { not: { q: 'rf_trauma', op: 'eq', value: 'yes' } },
  ],
};

const NO_NEURO: Condition = { all: [NO_LUMBAR_NEURO, NO_CERVICAL_NEURO] };

/** Shared precondition for every GREY rule. */
const GREY_GUARD: Condition = { all: [NO_RED_FLAGS, NO_NEURO] };

export const rules: TriageRule[] = [
  /* =================== RED =================== */
  {
    code: 'RED_CAUDA_EQUINA',
    label: 'Suspected cauda equina syndrome',
    category: 'RED',
    urgency: 'emergency',
    severity: 100,
    pathway: 'Emergency department today — do not wait for OPD',
    explain:
      'Bladder, bowel, or saddle sensory symptoms reported. "Not sure" is treated as yes on these three questions.',
    when: {
      any: [
        { q: 'rf_bladder', op: 'in', value: ['yes', 'unsure'] },
        { q: 'rf_bowel', op: 'in', value: ['yes', 'unsure'] },
        { q: 'rf_saddle', op: 'in', value: ['yes', 'unsure'] },
      ],
    },
  },
  {
    code: 'RED_PROGRESSIVE_DEFICIT',
    label: 'Rapidly progressive motor deficit',
    category: 'RED',
    urgency: 'urgent',
    severity: 98,
    pathway: 'Same-day review',
    explain:
      'Reports leg or foot weakness that is worsening quickly, or a foot that drags.',
    when: { q: 'rf_progressive_weakness', op: 'eq', value: 'yes' },
  },
  {
    code: 'RED_MYELOPATHY',
    label: 'Possible cervical myelopathy',
    category: 'RED',
    urgency: 'urgent',
    severity: 95,
    pathway: 'Urgent spine consult — query cervical myelopathy',
    explain:
      'Loss of hand dexterity or unsteady gait, together with bilateral hand involvement or new urinary urgency.',
    when: {
      all: [
        {
          any: [
            { q: 'myelo_buttons', op: 'eq', value: 'yes' },
            { q: 'myelo_gait', op: 'eq', value: 'yes' },
          ],
        },
        {
          any: [
            { q: 'myelo_both_hands', op: 'eq', value: 'yes' },
            { q: 'myelo_urinary', op: 'eq', value: 'yes' },
          ],
        },
      ],
    },
  },
  {
    code: 'RED_INFECTION',
    label: 'Query spinal infection',
    category: 'RED',
    urgency: 'urgent',
    severity: 92,
    pathway: 'Urgent review — rule out spinal infection',
    explain:
      'Fever with spinal pain, alongside diabetes, immunosuppression, or pain that wakes the patient at night.',
    when: {
      all: [
        { q: 'rf_fever', op: 'eq', value: 'yes' },
        {
          any: [
            { q: 'comorbidities', op: 'includes', value: ['diabetes'] },
            { q: 'rf_immuno', op: 'eq', value: 'yes' },
            { q: 'rf_night_pain', op: 'eq', value: 'yes' },
          ],
        },
      ],
    },
  },
  {
    code: 'RED_MALIGNANCY',
    label: 'Query metastatic disease',
    category: 'RED',
    urgency: 'urgent',
    severity: 90,
    pathway: 'Urgent review — rule out metastatic disease',
    explain:
      'History of cancer with night pain or unexplained weight loss.',
    when: {
      all: [
        { q: 'rf_cancer', op: 'eq', value: 'yes' },
        {
          any: [
            { q: 'rf_night_pain', op: 'eq', value: 'yes' },
            { q: 'rf_weight_loss', op: 'eq', value: 'yes' },
          ],
        },
      ],
    },
  },
  {
    code: 'RED_FRACTURE_TRAUMA',
    label: 'Query traumatic fracture',
    category: 'RED',
    urgency: 'urgent',
    severity: 88,
    pathway: 'Urgent imaging before OPD',
    explain:
      'Recent fall or accident in a patient aged 50 or over, or with known brittle bones.',
    when: {
      all: [
        { q: 'rf_trauma', op: 'eq', value: 'yes' },
        {
          any: [
            { q: 'age', op: 'gte', value: 50 },
            { q: 'comorbidities', op: 'includes', value: ['osteoporosis'] },
          ],
        },
      ],
    },
  },
  {
    // Osteoporotic vertebral collapse often has no trauma at all — the patient
    // bends, coughs, or simply stands up. RED_FRACTURE_TRAUMA would miss it.
    code: 'RED_FRAGILITY_FRACTURE',
    label: 'Query osteoporotic vertebral fracture',
    category: 'RED',
    urgency: 'urgent',
    severity: 86,
    pathway: 'Urgent imaging — query fragility fracture',
    explain:
      'Sudden severe back pain of recent onset in an older patient without any injury.',
    when: {
      all: [
        { q: 'rf_trauma', op: 'eq', value: 'no' },
        { q: 'lbp_onset', op: 'in', value: ['sudden_lift', 'no_cause'] },
        { q: 'lbp_duration', op: 'in', value: DURATION_UNDER_6W },
        { q: 'lbp_severity', op: 'gte', value: 7 },
        {
          any: [
            { q: 'age', op: 'gte', value: 70 },
            {
              all: [
                { q: 'age', op: 'gte', value: 55 },
                { q: 'comorbidities', op: 'includes', value: ['osteoporosis'] },
              ],
            },
          ],
        },
      ],
    },
  },

  /* =================== AMBER =================== */
  {
    code: 'AMBER_LUMBAR_RADICULOPATHY',
    label: 'Lumbar radiculopathy pattern',
    category: 'AMBER',
    urgency: 'routine',
    severity: 70,
    pathway: 'Spine consult — likely nerve root involvement',
    explain:
      'Pain radiating below the knee for six weeks or more, with numbness or worsening on coughing and straining.',
    when: {
      all: [
        { q: 'lbp_radiate', op: 'eq', value: 'below_knee' },
        {
          any: [
            { q: 'lbp_numbness', op: 'eq', value: 'yes' },
            { q: 'lbp_cough', op: 'eq', value: 'yes' },
          ],
        },
        { q: 'lbp_duration', op: 'in', value: DURATION_6W_PLUS },
      ],
    },
  },
  {
    code: 'AMBER_MOTOR_DEFICIT',
    label: 'Lumbar motor involvement',
    category: 'AMBER',
    urgency: 'routine',
    severity: 68,
    pathway: 'Spine consult — examine for motor deficit',
    explain:
      'Reports leg weakness or difficulty on toes and heels, without rapid progression.',
    when: {
      all: [
        { q: 'lbp_weakness', op: 'eq', value: 'yes' },
        { not: { q: 'rf_progressive_weakness', op: 'eq', value: 'yes' } },
      ],
    },
  },
  {
    code: 'AMBER_STENOSIS',
    label: 'Neurogenic claudication pattern',
    category: 'AMBER',
    urgency: 'routine',
    severity: 66,
    pathway: 'Spine consult — query lumbar canal stenosis',
    explain:
      'Walking distance limited to 500 metres or less, with relief on bending forward or sitting, aged 50 or over.',
    when: {
      all: [
        { q: 'lbp_walk_distance', op: 'in', value: ['lt_100m', '100_500m'] },
        {
          any: [
            { q: 'lbp_bend_relief', op: 'eq', value: 'yes' },
            { q: 'vasc_claudication', op: 'eq', value: 'sit_bend' },
          ],
        },
        { q: 'age', op: 'gte', value: 50 },
      ],
    },
  },
  {
    code: 'AMBER_CERVICAL_RADICULOPATHY',
    label: 'Cervical radiculopathy pattern',
    category: 'AMBER',
    urgency: 'routine',
    severity: 64,
    pathway: 'Spine consult — cervical radiculopathy',
    explain:
      'Arm pain below the elbow with hand numbness, present for six weeks or more.',
    when: {
      all: [
        { q: 'neck_radiate', op: 'eq', value: 'below_elbow' },
        { q: 'neck_numbness_hand', op: 'eq', value: 'yes' },
        { q: 'neck_duration', op: 'in', value: DURATION_6W_PLUS },
      ],
    },
  },
  {
    code: 'AMBER_FAILED_CONSERVATIVE',
    label: 'Conservative care exhausted',
    category: 'AMBER',
    urgency: 'routine',
    severity: 60,
    pathway: 'Spine consult — conservative care has failed',
    explain:
      'More than six weeks of physiotherapy with no benefit, and work is still affected.',
    when: {
      all: [
        { q: 'tx_physio_duration', op: 'eq', value: 'gt_6w' },
        { q: 'tx_response', op: 'eq', value: 'not_at_all' },
        { q: 'func_work', op: 'in', value: ['difficulty', 'stopped'] },
      ],
    },
  },
  {
    code: 'AMBER_POST_SURGICAL',
    label: 'Previous spine surgery',
    category: 'AMBER',
    urgency: 'routine',
    severity: 58,
    pathway: 'Spine consult — previous spine surgery',
    explain:
      'Has had spine surgery before, so this is not a first-presentation case.',
    when: { q: 'tx_tried', op: 'includes', value: ['surgery'] },
  },
  {
    code: 'AMBER_FUNCTIONAL_COLLAPSE',
    label: 'Significant functional loss',
    category: 'AMBER',
    urgency: 'routine',
    severity: 56,
    pathway: 'Spine consult — significant loss of function',
    explain:
      'Has stopped working, and reports the problem is still getting worse after six weeks or more.',
    when: {
      all: [
        { q: 'func_work', op: 'eq', value: 'stopped' },
        { q: 'func_worsening', op: 'eq', value: 'worse' },
        {
          any: [
            { q: 'lbp_duration', op: 'in', value: DURATION_6W_PLUS },
            { q: 'neck_duration', op: 'in', value: DURATION_6W_PLUS },
          ],
        },
      ],
    },
  },

  /* =================== GREY =================== */
  {
    code: 'GREY_HIP',
    label: 'Pattern suggests hip, not spine',
    category: 'GREY',
    urgency: 'non_urgent',
    severity: 40,
    pathway: 'Orthopaedics — hip',
    explain:
      'Groin-dominant pain with hip stiffness on dressing or getting out of a car, and no radiation past the buttock.',
    when: {
      all: [
        GREY_GUARD,
        { q: 'hip_groin', op: 'eq', value: 'yes' },
        { q: 'hip_socks', op: 'eq', value: 'yes' },
        { q: 'lbp_radiate', op: 'in', value: ['none', 'buttock'] },
      ],
    },
  },
  {
    code: 'GREY_SHOULDER',
    label: 'Pattern suggests shoulder, not neck',
    category: 'GREY',
    urgency: 'non_urgent',
    severity: 38,
    pathway: 'Orthopaedics — shoulder',
    explain:
      'Arm pain worse on overhead reach, staying above the elbow, with no hand symptoms.',
    when: {
      all: [
        GREY_GUARD,
        { q: 'shoulder_overhead', op: 'eq', value: 'yes' },
        { q: 'neck_radiate', op: 'in', value: ['none', 'shoulder'] },
      ],
    },
  },
  {
    code: 'GREY_VASCULAR',
    label: 'Pattern suggests vascular claudication',
    category: 'GREY',
    urgency: 'non_urgent',
    severity: 36,
    pathway: 'Vascular surgery — query peripheral arterial disease',
    explain:
      'Walking-induced leg pain that settles on standing still alone, in a smoker or diabetic. Spinal claudication normally needs sitting or bending forward.',
    when: {
      all: [
        GREY_GUARD,
        { q: 'vasc_claudication', op: 'eq', value: 'stand_still' },
        {
          q: 'comorbidities',
          op: 'includes',
          value: ['smoking', 'diabetes'],
        },
      ],
    },
  },
  {
    code: 'GREY_INFLAMMATORY',
    label: 'Inflammatory back pain pattern',
    category: 'GREY',
    urgency: 'non_urgent',
    severity: 34,
    pathway: 'Rheumatology — query axial spondyloarthritis',
    explain:
      'Under 45, morning stiffness beyond 30 minutes, pain eased by movement and worsened by rest, for more than three months.',
    when: {
      all: [
        GREY_GUARD,
        { q: 'age', op: 'lte', value: 44 },
        { q: 'inflam_morning_stiffness', op: 'eq', value: 'yes' },
        { q: 'inflam_exercise_better', op: 'eq', value: 'yes' },
        { q: 'lbp_duration', op: 'in', value: DURATION_3M_PLUS },
      ],
    },
  },
  {
    code: 'GREY_WIDESPREAD',
    label: 'Widespread pain pattern',
    category: 'GREY',
    urgency: 'non_urgent',
    severity: 32,
    pathway: 'Pain medicine or rheumatology',
    explain:
      'Pain in many body regions with persistent fatigue, and no localising spinal findings.',
    when: {
      all: [GREY_GUARD, { q: 'widespread_pain', op: 'eq', value: 'yes' }],
    },
  },
  {
    code: 'GREY_UNCLEAR',
    label: 'Complaint not spine-patterned',
    category: 'GREY',
    urgency: 'non_urgent',
    severity: 30,
    pathway: 'Clinical triage — complaint does not match a spine pattern',
    explain:
      'Patient selected "none of these" for the main complaint, or located the problem outside the spine.',
    when: {
      any: [
        { q: 'chief_complaint', op: 'includes', value: ['none_of_these'] },
        { q: 'symptom_area', op: 'eq', value: 'elsewhere' },
      ],
    },
  },

  /* =================== GREEN =================== */
  {
    code: 'GREEN_ACUTE_MECHANICAL',
    label: 'Acute mechanical spinal pain',
    category: 'GREEN',
    urgency: 'non_urgent',
    severity: 20,
    pathway: 'Conservative care, review at 6 weeks',
    explain:
      'Under six weeks, no radiation past the thigh, no neurological findings, no red flags.',
    when: {
      all: [
        NO_RED_FLAGS,
        NO_NEURO,
        { q: 'lbp_duration', op: 'in', value: DURATION_UNDER_6W },
        { q: 'lbp_radiate', op: 'in', value: ['none', 'buttock', 'above_knee'] },
      ],
    },
  },
  {
    // Expected to be the largest bucket, and the main mechanism by which the
    // clinic reclaims consultation slots.
    code: 'GREEN_UNTREATED_CHRONIC',
    label: 'Chronic pain, conservative care not yet tried',
    category: 'GREEN',
    urgency: 'non_urgent',
    severity: 18,
    pathway: 'Structured physiotherapy first, review at 6 weeks',
    explain:
      'Six weeks or more of pain with no neurological findings, and no physiotherapy, injections or surgery attempted yet.',
    when: {
      all: [
        NO_RED_FLAGS,
        NO_NEURO,
        {
          any: [
            { q: 'lbp_duration', op: 'in', value: DURATION_6W_PLUS },
            { q: 'neck_duration', op: 'in', value: DURATION_6W_PLUS },
          ],
        },
        { q: 'tx_tried', op: 'excludes', value: ['physio', 'injection', 'surgery'] },
      ],
    },
  },

  /* =================== Advisory =================== */
  {
    code: 'ADVISORY_HIP_OVERLAP',
    label: 'Hip symptoms alongside spinal symptoms',
    category: 'GREY',
    urgency: 'non_urgent',
    severity: 1,
    advisory: true,
    pathway: '',
    explain: 'Groin pain with hip stiffness reported.',
    secondaryNote:
      'Groin pain and hip stiffness also reported — consider screening the hip alongside the spine.',
    when: {
      all: [
        { q: 'hip_groin', op: 'eq', value: 'yes' },
        { q: 'hip_socks', op: 'eq', value: 'yes' },
      ],
    },
  },
  {
    code: 'ADVISORY_PREGNANCY',
    label: 'Pregnancy reported',
    category: 'GREY',
    urgency: 'non_urgent',
    severity: 1,
    advisory: true,
    pathway: '',
    explain: 'Patient reports being pregnant.',
    secondaryNote:
      'Patient reports being pregnant — imaging and medication options are restricted.',
    when: { q: 'is_pregnant', op: 'eq', value: 'yes' },
  },
  {
    code: 'ADVISORY_RECENT_IMAGING',
    label: 'Recent imaging available',
    category: 'GREY',
    urgency: 'non_urgent',
    severity: 1,
    advisory: true,
    pathway: '',
    explain: 'Imaging performed within the last three months.',
    secondaryNote:
      'Patient reports a scan within the last 3 months — ask them to bring the films and report.',
    when: {
      all: [
        { q: 'img_done', op: 'includes', value: ['mri', 'ct', 'xray'] },
        { q: 'img_when', op: 'eq', value: 'lt_3m' },
      ],
    },
  },
  {
    code: 'ADVISORY_FREE_TEXT',
    label: 'Free-text note present',
    category: 'GREY',
    urgency: 'non_urgent',
    severity: 1,
    advisory: true,
    pathway: '',
    explain: 'Patient wrote a free-text note.',
    secondaryNote: 'Patient added a free-text note — read it before the consult.',
    when: { q: 'free_text', op: 'answered' },
  },
];

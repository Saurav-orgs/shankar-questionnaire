import type { Condition, Question, Section } from '../types';
import { t } from './copy';
import * as O from './options';

export const sections: Section[] = [
  { key: 'details', order: 1, title: t('About you', 'आपके बारे में') },
  { key: 'complaint', order: 2, title: t('Your problem', 'आपकी तकलीफ़') },
  { key: 'red_flags', order: 3, title: t('Important checks', 'ज़रूरी जाँच') },
  { key: 'low_back', order: 4, title: t('Back and leg', 'कमर और पैर') },
  { key: 'neck', order: 5, title: t('Neck and arm', 'गर्दन और बांह') },
  { key: 'discriminators', order: 6, title: t('More about the pain', 'दर्द के बारे में और') },
  { key: 'function', order: 7, title: t('Daily life', 'रोज़मर्रा की ज़िंदगी') },
  { key: 'treatment', order: 8, title: t('Treatment so far', 'अब तक का इलाज') },
  { key: 'imaging', order: 9, title: t('Scans and reports', 'जाँच और रिपोर्ट') },
  { key: 'other', order: 10, title: t('Other health', 'अन्य स्वास्थ्य') },
  { key: 'free_text', order: 11, title: t('Anything else', 'और कुछ') },
];

const REGION_CODES = [
  'neck_pain',
  'upper_back_pain',
  'low_back_pain',
  'leg_pain',
  'arm_pain',
  'walking_difficulty',
];

/**
 * Someone who ticks only "numbness" or "weakness" names no region, so neither
 * branch would open and they would fall through the questionnaire answering
 * almost nothing. `symptom_area` catches them.
 */
const LOWER_BRANCH: Condition = {
  any: [
    {
      q: 'chief_complaint',
      op: 'includes',
      value: ['low_back_pain', 'leg_pain', 'walking_difficulty'],
    },
    { q: 'symptom_area', op: 'in', value: ['back_leg', 'both'] },
  ],
};

const NECK_BRANCH: Condition = {
  any: [
    {
      q: 'chief_complaint',
      op: 'includes',
      value: ['neck_pain', 'arm_pain', 'upper_back_pain'],
    },
    { q: 'symptom_area', op: 'in', value: ['neck_arm', 'both'] },
  ],
};

const ANY_COMPLAINT: Condition = {
  not: { q: 'chief_complaint', op: 'includes', value: ['none_of_these'] },
};

export const questions: Question[] = [
  /* ---------------- Section: details ---------------- */
  {
    key: 'name',
    section: 'details',
    type: 'text',
    required: true,
    maxLength: 120,
    text: t('Your full name', 'आपका पूरा नाम'),
  },
  {
    key: 'age',
    section: 'details',
    type: 'number',
    required: true,
    min: 1,
    max: 120,
    text: t('Your age', 'आपकी उम्र'),
  },
  {
    key: 'gender',
    section: 'details',
    type: 'single_choice',
    required: true,
    options: O.GENDER,
    text: t('Gender', 'लिंग'),
  },
  {
    key: 'mobile',
    section: 'details',
    type: 'tel',
    required: true,
    maxLength: 10,
    text: t('Mobile number', 'मोबाइल नंबर'),
    help: t(
      'The clinic will use this to contact you about your appointment.',
      'क्लिनिक इसी नंबर पर अपॉइंटमेंट के बारे में संपर्क करेगा।',
    ),
  },
  {
    key: 'city',
    section: 'details',
    type: 'text',
    required: false,
    maxLength: 80,
    text: t('Which city or town do you live in?', 'आप किस शहर या कस्बे में रहते हैं?'),
  },
  {
    key: 'occupation',
    section: 'details',
    type: 'single_choice',
    required: true,
    options: O.OCCUPATION,
    text: t('What work do you do?', 'आप क्या काम करते हैं?'),
  },

  /* ---------------- Section: complaint ---------------- */
  {
    key: 'chief_complaint',
    section: 'complaint',
    type: 'multi_choice',
    required: true,
    minSelections: 1,
    options: O.CHIEF_COMPLAINT,
    text: t(
      'What is troubling you? Select all that apply.',
      'आपको क्या तकलीफ़ है? जो भी लागू हो सब चुनें।',
    ),
  },
  {
    key: 'primary_complaint',
    section: 'complaint',
    type: 'single_choice',
    required: true,
    options: O.CHIEF_COMPLAINT,
    optionsFromKey: 'chief_complaint',
    showIf: {
      all: [{ q: 'chief_complaint', op: 'answered' }, ANY_COMPLAINT],
    },
    text: t(
      'Which one troubles you the most?',
      'इनमें से सबसे ज़्यादा परेशानी किससे है?',
    ),
  },
  {
    key: 'symptom_area',
    section: 'complaint',
    type: 'single_choice',
    required: true,
    options: [
      { code: 'neck_arm', label: t('Neck, shoulder or arm', 'गर्दन, कंधा या बांह') },
      { code: 'back_leg', label: t('Back, hip or leg', 'पीठ, कूल्हा या पैर') },
      { code: 'both', label: t('Both areas', 'दोनों जगह') },
      { code: 'elsewhere', label: t('Somewhere else', 'कहीं और') },
    ],
    showIf: {
      all: [
        { q: 'chief_complaint', op: 'answered' },
        { q: 'chief_complaint', op: 'excludes', value: [...REGION_CODES, 'none_of_these'] },
      ],
    },
    text: t(
      'Where in your body is this problem?',
      'यह तकलीफ़ शरीर के किस हिस्से में है?',
    ),
  },

  /* ---------------- Section: red_flags ----------------
   * Asked before the detailed branches on purpose. Spending four more minutes
   * on pain scores before finding out about bladder symptoms is a safety bug.
   */
  {
    key: 'rf_bladder',
    section: 'red_flags',
    type: 'single_choice',
    required: true,
    options: O.YES_NO_UNSURE,
    isRedFlag: true,
    isEmergencyTrigger: true,
    emergencyValues: ['yes', 'unsure'],
    text: t(
      'Have you recently lost control of your urine, or been unable to pass urine?',
      'क्या हाल ही में आपका पेशाब पर काबू नहीं रहा, या पेशाब आना बंद हो गया?',
    ),
  },
  {
    key: 'rf_bowel',
    section: 'red_flags',
    type: 'single_choice',
    required: true,
    options: O.YES_NO_UNSURE,
    isRedFlag: true,
    isEmergencyTrigger: true,
    emergencyValues: ['yes', 'unsure'],
    text: t(
      'Have you recently lost control of your bowels?',
      'क्या हाल ही में आपका मल (शौच) पर काबू नहीं रहा?',
    ),
  },
  {
    key: 'rf_saddle',
    section: 'red_flags',
    type: 'single_choice',
    required: true,
    options: O.YES_NO_UNSURE,
    isRedFlag: true,
    isEmergencyTrigger: true,
    emergencyValues: ['yes', 'unsure'],
    text: t(
      'Is there numbness around your private parts, inner thighs, or the area you sit on?',
      'क्या आपके गुप्तांगों, जाँघों के अंदरूनी हिस्से, या बैठने वाले हिस्से के आसपास सुन्नपन है?',
    ),
  },
  {
    key: 'rf_progressive_weakness',
    section: 'red_flags',
    type: 'single_choice',
    required: true,
    options: O.YES_NO_UNSURE,
    isRedFlag: true,
    isEmergencyTrigger: true,
    emergencyValues: ['yes'],
    text: t(
      'Is weakness in your leg or foot getting worse quickly, or does your foot drag on the ground?',
      'क्या पैर या पंजे की कमज़ोरी तेज़ी से बढ़ रही है, या पैर ज़मीन पर घिसटता है?',
    ),
  },
  {
    key: 'rf_trauma',
    section: 'red_flags',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    isRedFlag: true,
    text: t(
      'Have you had a fall or accident recently?',
      'क्या हाल में आपको कोई चोट, गिरना या दुर्घटना हुई है?',
    ),
  },
  {
    key: 'rf_fever',
    section: 'red_flags',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    isRedFlag: true,
    text: t(
      'Do you have fever along with the pain?',
      'क्या दर्द के साथ बुखार भी रहता है?',
    ),
  },
  {
    key: 'rf_cancer',
    section: 'red_flags',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    isRedFlag: true,
    text: t(
      'Have you ever been treated for cancer?',
      'क्या आपका कभी कैंसर का इलाज हुआ है?',
    ),
  },
  {
    key: 'rf_weight_loss',
    section: 'red_flags',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    isRedFlag: true,
    text: t(
      'Have you lost weight without trying?',
      'क्या बिना कोशिश किए आपका वज़न घट रहा है?',
    ),
  },
  {
    key: 'rf_night_pain',
    section: 'red_flags',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    isRedFlag: true,
    text: t(
      'Does the pain wake you from sleep at night?',
      'क्या दर्द रात में आपकी नींद तोड़ देता है?',
    ),
  },
  {
    key: 'rf_immuno',
    section: 'red_flags',
    type: 'single_choice',
    required: true,
    options: O.YES_NO_UNSURE,
    isRedFlag: true,
    text: t(
      'Do you take steroid medicines long-term, or have low immunity?',
      'क्या आप लंबे समय से स्टेरॉयड दवाइयाँ लेते हैं, या आपकी रोग-प्रतिरोधक क्षमता कमज़ोर है?',
    ),
  },

  /* ---------------- Section: low_back ---------------- */
  {
    key: 'lbp_duration',
    section: 'low_back',
    type: 'single_choice',
    required: true,
    options: O.DURATION,
    showIf: LOWER_BRANCH,
    text: t('How long have you had this pain?', 'यह दर्द आपको कब से है?'),
  },
  {
    key: 'lbp_onset',
    section: 'low_back',
    type: 'single_choice',
    required: true,
    options: O.ONSET,
    showIf: LOWER_BRANCH,
    text: t('How did it start?', 'यह कैसे शुरू हुआ?'),
  },
  {
    key: 'lbp_severity',
    section: 'low_back',
    type: 'scale',
    required: true,
    min: 0,
    max: 10,
    minLabel: t('No pain', 'कोई दर्द नहीं'),
    maxLabel: t('Worst pain', 'सबसे ज़्यादा दर्द'),
    showIf: LOWER_BRANCH,
    text: t('How bad is the pain right now?', 'अभी दर्द कितना है?'),
  },
  {
    key: 'lbp_radiate',
    section: 'low_back',
    type: 'single_choice',
    required: true,
    options: O.RADIATE_LEG,
    showIf: LOWER_BRANCH,
    text: t('How far down does the pain travel?', 'दर्द कहाँ तक जाता है?'),
  },
  {
    key: 'lbp_side',
    section: 'low_back',
    type: 'single_choice',
    required: true,
    options: O.SIDE,
    showIf: {
      all: [LOWER_BRANCH, { q: 'lbp_radiate', op: 'not_in', value: ['none'] }],
    },
    text: t('Which side?', 'किस तरफ़?'),
  },
  {
    key: 'lbp_cough',
    section: 'low_back',
    type: 'single_choice',
    required: true,
    options: O.YES_NO_UNSURE,
    showIf: {
      all: [LOWER_BRANCH, { q: 'lbp_radiate', op: 'not_in', value: ['none'] }],
    },
    text: t(
      'Does coughing, sneezing or straining make the leg pain worse?',
      'क्या खाँसने, छींकने या ज़ोर लगाने पर पैर का दर्द बढ़ता है?',
    ),
  },
  {
    key: 'lbp_sitting',
    section: 'low_back',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    showIf: LOWER_BRANCH,
    text: t(
      'Is it worse when you sit for a long time?',
      'क्या देर तक बैठने पर दर्द बढ़ता है?',
    ),
  },
  {
    key: 'lbp_walking',
    section: 'low_back',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    showIf: LOWER_BRANCH,
    text: t(
      'Is it worse when you stand or walk?',
      'क्या खड़े होने या चलने पर दर्द बढ़ता है?',
    ),
  },
  {
    key: 'lbp_walk_distance',
    section: 'low_back',
    type: 'single_choice',
    required: true,
    options: O.WALK_DISTANCE,
    showIf: LOWER_BRANCH,
    text: t(
      'How far can you walk before the pain stops you?',
      'दर्द रोकने से पहले आप कितनी दूर चल पाते हैं?',
    ),
  },
  {
    key: 'lbp_bend_relief',
    section: 'low_back',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    showIf: {
      all: [
        LOWER_BRANCH,
        { q: 'lbp_walk_distance', op: 'not_in', value: ['unlimited'] },
      ],
    },
    text: t(
      'When walking becomes painful, does bending forward or sitting down give relief?',
      'जब चलने पर दर्द बढ़ जाता है, तो क्या आगे झुकने या बैठ जाने से आराम मिलता है?',
    ),
  },
  {
    key: 'lbp_numbness',
    section: 'low_back',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    showIf: LOWER_BRANCH,
    text: t(
      'Is there numbness or tingling in your leg or foot?',
      'क्या आपके पैर या पंजे में सुन्नपन या झुनझुनी है?',
    ),
  },
  {
    key: 'lbp_weakness',
    section: 'low_back',
    type: 'single_choice',
    required: true,
    options: O.YES_NO_UNSURE,
    showIf: LOWER_BRANCH,
    text: t(
      'Is it hard to stand on your toes or heels, or does your leg feel weak?',
      'क्या पंजों या एड़ी के बल खड़े होने में दिक्कत है, या पैर कमज़ोर लगता है?',
    ),
  },
  {
    key: 'lbp_rest_relief',
    section: 'low_back',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    showIf: LOWER_BRANCH,
    text: t('Does lying down give relief?', 'क्या लेटने पर आराम मिलता है?'),
  },

  /* ---------------- Section: neck ---------------- */
  {
    key: 'neck_duration',
    section: 'neck',
    type: 'single_choice',
    required: true,
    options: O.DURATION,
    showIf: NECK_BRANCH,
    text: t('How long have you had this pain?', 'यह दर्द आपको कब से है?'),
  },
  {
    key: 'neck_severity',
    section: 'neck',
    type: 'scale',
    required: true,
    min: 0,
    max: 10,
    minLabel: t('No pain', 'कोई दर्द नहीं'),
    maxLabel: t('Worst pain', 'सबसे ज़्यादा दर्द'),
    showIf: NECK_BRANCH,
    text: t('How bad is the pain right now?', 'अभी दर्द कितना है?'),
  },
  {
    key: 'neck_radiate',
    section: 'neck',
    type: 'single_choice',
    required: true,
    options: O.RADIATE_ARM,
    showIf: NECK_BRANCH,
    text: t('How far down the arm does the pain go?', 'दर्द बांह में कहाँ तक जाता है?'),
  },
  {
    key: 'neck_side',
    section: 'neck',
    type: 'single_choice',
    required: true,
    options: O.SIDE,
    showIf: {
      all: [NECK_BRANCH, { q: 'neck_radiate', op: 'not_in', value: ['none'] }],
    },
    text: t('Which side?', 'किस तरफ़?'),
  },
  {
    key: 'neck_numbness_hand',
    section: 'neck',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    showIf: NECK_BRANCH,
    text: t(
      'Is there numbness or tingling in your hand or fingers?',
      'क्या हाथ या उँगलियों में सुन्नपन या झुनझुनी है?',
    ),
  },
  {
    key: 'neck_grip',
    section: 'neck',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    showIf: NECK_BRANCH,
    text: t(
      'Do things slip from your hand, or is it hard to grip them?',
      'क्या आपके हाथ से चीज़ें फिसल जाती हैं, या पकड़ने में दिक्कत होती है?',
    ),
  },
  // The four myelopathy questions below are the highest-consequence items in
  // the neck branch. Cervical myelopathy is progressive and easily missed.
  {
    key: 'myelo_buttons',
    section: 'neck',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    showIf: NECK_BRANCH,
    text: t(
      'Is fine work harder than before — buttoning a shirt, picking up a coin, writing?',
      'क्या बारीक काम पहले से मुश्किल हो गए हैं — शर्ट के बटन लगाना, सिक्का उठाना, लिखना?',
    ),
  },
  {
    key: 'myelo_gait',
    section: 'neck',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    showIf: NECK_BRANCH,
    text: t(
      'Do you feel unsteady on your feet, or lose balance while walking?',
      'क्या चलते समय लड़खड़ाहट होती है या संतुलन बिगड़ता है?',
    ),
  },
  {
    key: 'myelo_both_hands',
    section: 'neck',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    showIf: {
      all: [
        NECK_BRANCH,
        {
          any: [
            { q: 'myelo_buttons', op: 'eq', value: 'yes' },
            { q: 'neck_grip', op: 'eq', value: 'yes' },
            { q: 'neck_numbness_hand', op: 'eq', value: 'yes' },
          ],
        },
      ],
    },
    text: t('Are both hands affected?', 'क्या दोनों हाथ प्रभावित हैं?'),
  },
  {
    key: 'myelo_urinary',
    section: 'neck',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    showIf: {
      all: [
        NECK_BRANCH,
        {
          any: [
            { q: 'myelo_buttons', op: 'eq', value: 'yes' },
            { q: 'myelo_gait', op: 'eq', value: 'yes' },
          ],
        },
      ],
    },
    text: t(
      'Have you recently started needing to pass urine urgently or more often?',
      'क्या हाल में पेशाब की जल्दी लगने या बार-बार जाने की समस्या शुरू हुई है?',
    ),
  },
  {
    key: 'neck_headache',
    section: 'neck',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    showIf: NECK_BRANCH,
    text: t(
      'Do you get headaches along with the neck pain?',
      'क्या गर्दन के दर्द के साथ सिरदर्द भी होता है?',
    ),
  },

  /* ---------------- Section: discriminators ----------------
   * These separate spine from not-spine. Without them the system cannot
   * produce a GREY verdict, and GREY is the point of the project.
   */
  {
    key: 'hip_groin',
    section: 'discriminators',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    showIf: LOWER_BRANCH,
    text: t(
      'Is the pain mainly in the groin or the front of the hip, rather than in the back?',
      'क्या दर्द मुख्य रूप से जाँघ के जोड़ या कूल्हे के अगले हिस्से में है, न कि पीठ में?',
    ),
  },
  {
    key: 'hip_socks',
    section: 'discriminators',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    showIf: { all: [LOWER_BRANCH, { q: 'hip_groin', op: 'eq', value: 'yes' }] },
    text: t(
      'Is it hard to put on socks or shoes, or to get out of a car, because the hip feels stiff?',
      'क्या जुर्राब या जूते पहनने में, या गाड़ी से उतरने में दिक्कत होती है क्योंकि कूल्हा जकड़ा लगता है?',
    ),
  },
  {
    key: 'shoulder_overhead',
    section: 'discriminators',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    showIf: NECK_BRANCH,
    text: t(
      'Is the arm pain worse when you reach overhead, and does it stay above the elbow?',
      'क्या हाथ ऊपर उठाने पर बांह का दर्द बढ़ता है, और दर्द कोहनी से ऊपर ही रहता है?',
    ),
  },
  {
    key: 'vasc_claudication',
    section: 'discriminators',
    type: 'single_choice',
    required: true,
    options: O.CLAUDICATION_RELIEF,
    showIf: {
      all: [
        LOWER_BRANCH,
        { q: 'lbp_walk_distance', op: 'not_in', value: ['unlimited'] },
      ],
    },
    text: t(
      'When leg pain stops you walking, what makes it settle?',
      'जब पैर का दर्द चलना रोक देता है, तो किससे आराम मिलता है?',
    ),
  },
  {
    key: 'inflam_morning_stiffness',
    section: 'discriminators',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    showIf: LOWER_BRANCH,
    text: t(
      'After waking, does your back stay stiff for more than 30 minutes?',
      'सुबह उठने के बाद क्या आपकी पीठ आधे घंटे से ज़्यादा जकड़ी रहती है?',
    ),
  },
  {
    key: 'inflam_exercise_better',
    section: 'discriminators',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    showIf: LOWER_BRANCH,
    text: t(
      'Does the pain get better with movement and worse with rest?',
      'क्या चलने-फिरने से दर्द कम होता है और आराम करने से बढ़ता है?',
    ),
  },
  {
    key: 'widespread_pain',
    section: 'discriminators',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    showIf: ANY_COMPLAINT,
    text: t(
      'Do you have pain in many parts of the body along with constant tiredness?',
      'क्या शरीर के कई हिस्सों में दर्द रहता है, साथ में हमेशा थकान भी?',
    ),
  },

  /* ---------------- Section: function ---------------- */
  {
    key: 'func_work',
    section: 'function',
    type: 'single_choice',
    required: true,
    options: O.FUNC_WORK,
    showIf: ANY_COMPLAINT,
    text: t('Can you do your normal work?', 'क्या आप अपना रोज़ का काम कर पाते हैं?'),
  },
  {
    key: 'func_sleep',
    section: 'function',
    type: 'single_choice',
    required: true,
    options: O.FUNC_SLEEP,
    showIf: ANY_COMPLAINT,
    text: t('Does the pain disturb your sleep?', 'क्या दर्द से आपकी नींद खराब होती है?'),
  },
  {
    key: 'func_daily',
    section: 'function',
    type: 'single_choice',
    required: true,
    options: O.FUNC_DAILY,
    showIf: ANY_COMPLAINT,
    text: t(
      'Do you need help with daily tasks such as dressing or bathing?',
      'क्या कपड़े पहनने या नहाने जैसे रोज़ के कामों में मदद चाहिए?',
    ),
  },
  {
    key: 'func_worsening',
    section: 'function',
    type: 'single_choice',
    required: true,
    options: O.TREND,
    showIf: ANY_COMPLAINT,
    text: t(
      'Over the last month, how has it changed?',
      'पिछले एक महीने में इसमें क्या बदलाव आया?',
    ),
  },

  /* ---------------- Section: treatment ---------------- */
  {
    key: 'tx_tried',
    section: 'treatment',
    type: 'multi_choice',
    required: true,
    minSelections: 1,
    options: O.TREATMENTS,
    showIf: ANY_COMPLAINT,
    text: t(
      'What have you already tried? Select all that apply.',
      'आपने अब तक क्या-क्या आज़माया है? जो भी लागू हो सब चुनें।',
    ),
  },
  {
    key: 'tx_physio_duration',
    section: 'treatment',
    type: 'single_choice',
    required: true,
    options: O.PHYSIO_DURATION,
    showIf: { q: 'tx_tried', op: 'includes', value: ['physio'] },
    text: t(
      'How long did you do physiotherapy?',
      'आपने फ़िज़ियोथेरेपी कितने समय तक की?',
    ),
  },
  {
    key: 'tx_response',
    section: 'treatment',
    type: 'single_choice',
    required: true,
    options: O.TREATMENT_RESPONSE,
    showIf: {
      all: [
        { q: 'tx_tried', op: 'answered' },
        { q: 'tx_tried', op: 'excludes', value: ['nothing'] },
      ],
    },
    text: t('Did the treatment help?', 'क्या इलाज से आराम मिला?'),
  },
  {
    key: 'tx_prior_surgery_detail',
    section: 'treatment',
    type: 'textarea',
    required: false,
    maxLength: 300,
    showIf: { q: 'tx_tried', op: 'includes', value: ['surgery'] },
    text: t(
      'When and where was your spine surgery?',
      'आपकी रीढ़ की सर्जरी कब और कहाँ हुई थी?',
    ),
  },

  /* ---------------- Section: imaging ---------------- */
  {
    key: 'img_done',
    section: 'imaging',
    type: 'multi_choice',
    required: true,
    minSelections: 1,
    options: O.IMAGING,
    showIf: ANY_COMPLAINT,
    text: t(
      'Have you had any scans for this problem?',
      'क्या इस समस्या के लिए कोई जाँच हुई है?',
    ),
  },
  {
    key: 'img_when',
    section: 'imaging',
    type: 'single_choice',
    required: true,
    options: O.IMAGING_WHEN,
    showIf: {
      all: [
        { q: 'img_done', op: 'answered' },
        { q: 'img_done', op: 'excludes', value: ['none'] },
      ],
    },
    text: t('When was the most recent one?', 'सबसे हाल की जाँच कब हुई थी?'),
  },

  /* ---------------- Section: other ---------------- */
  {
    key: 'comorbidities',
    section: 'other',
    type: 'multi_choice',
    required: true,
    minSelections: 1,
    options: O.COMORBIDITIES,
    text: t(
      'Do you have any of these? Select all that apply.',
      'क्या आपको इनमें से कुछ है? जो भी लागू हो सब चुनें।',
    ),
  },
  {
    key: 'is_pregnant',
    section: 'other',
    type: 'single_choice',
    required: true,
    options: O.YES_NO_UNSURE,
    // Back pain in pregnancy is common and routes differently. Asking every
    // woman regardless of age would be needlessly intrusive.
    showIf: {
      all: [
        { q: 'gender', op: 'eq', value: 'female' },
        { q: 'age', op: 'gte', value: 15 },
        { q: 'age', op: 'lte', value: 50 },
      ],
    },
    text: t('Are you pregnant?', 'क्या आप गर्भवती हैं?'),
  },

  /* ---------------- Section: free_text ---------------- */
  {
    key: 'free_text',
    section: 'free_text',
    type: 'textarea',
    required: false,
    maxLength: 500,
    text: t(
      'Is there anything else you want the doctor to know?',
      'क्या आप डॉक्टर को कुछ और बताना चाहते हैं?',
    ),
    help: t(
      'You can write in Hindi or English.',
      'आप हिंदी या अंग्रेज़ी में लिख सकते हैं।',
    ),
  },
];

import type { Question, Section } from '../types';
import { t } from './copy';
import * as O from './options';

/**
 * Questionnaire v2 — Dr. Acharya's pre-screening form (SCREENING §1): the
 * patient details in Section A, then his ten questions in Sections B–E, in
 * his order and with his answer lists, and nothing else.
 *
 * Sections are his form's sections and the doctor-panel groupings. They are
 * not screens: the patient app decides which sections share a page
 * (patient-web/src/lib/flow.ts).
 */

export const sections: Section[] = [
  { key: 'details', order: 1, title: t('Patient details', 'मरीज़ का विवरण') },
  { key: 'problem', order: 2, title: t('Main problem', 'मुख्य तकलीफ़') },
  {
    key: 'treatment',
    order: 3,
    title: t('Previous treatment', 'अब तक का इलाज'),
  },
  {
    key: 'imaging',
    order: 4,
    title: t('Imaging and previous opinion', 'जाँच और पिछली राय'),
  },
  { key: 'reason', order: 5, title: t('Purpose of visit', 'आने का उद्देश्य') },
];

export const questions: Question[] = [
  /* ---------------- Section A: details ---------------- */
  {
    key: 'name',
    section: 'details',
    type: 'text',
    required: true,
    maxLength: 120,
    text: t('Name', 'नाम'),
  },
  {
    key: 'age',
    section: 'details',
    type: 'number',
    required: true,
    min: 1,
    max: 120,
    text: t('Age', 'उम्र'),
  },
  // Not on the paper form, but the team's WhatsApp summary addresses the
  // patient as Mr./Mrs. (SCREENING §6), so it has to be asked.
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
    text: t('Mobile/WhatsApp number', 'मोबाइल / व्हाट्सऐप नंबर'),
    help: t(
      'The clinic will use this to contact you about your appointment.',
      'क्लिनिक इसी नंबर पर अपॉइंटमेंट के बारे में संपर्क करेगा।',
    ),
  },
  {
    key: 'city',
    section: 'details',
    type: 'text',
    required: true,
    maxLength: 80,
    text: t('City', 'शहर'),
  },
  {
    key: 'previous_patient',
    section: 'details',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    text: t(
      'Have you consulted Dr. Acharya before?',
      'क्या आप पहले डॉ. आचार्य से मिल चुके हैं?',
    ),
  },

  /* ---------------- Section B: main problem (Q1–Q4) ---------------- */
  {
    key: 'main_problem',
    section: 'problem',
    type: 'multi_choice',
    required: true,
    minSelections: 1,
    options: O.MAIN_PROBLEM,
    text: t(
      '1. What is your main problem? Select all that apply.',
      '1. आपकी मुख्य तकलीफ़ क्या है? जो भी लागू हो सब चुनें।',
    ),
  },
  {
    key: 'main_problem_other',
    section: 'problem',
    type: 'textarea',
    required: true,
    maxLength: 200,
    showIf: { q: 'main_problem', op: 'includes', value: ['other'] },
    text: t('Please describe the problem', 'कृपया तकलीफ़ बताएँ'),
    help: t(
      'You can write in Hindi or English.',
      'आप हिंदी या अंग्रेज़ी में लिख सकते हैं।',
    ),
  },
  // Q2 and Q3 are flagged isRedFlag so the doctor panel's red-flag panel
  // shows the neurological screen explicitly, whatever the answer.
  {
    key: 'weakness',
    section: 'problem',
    type: 'single_choice',
    required: true,
    options: O.WEAKNESS,
    isRedFlag: true,
    text: t(
      '2. Do you have weakness of your arm or leg?',
      '2. क्या आपकी बांह या पैर में कमज़ोरी है?',
    ),
  },
  {
    key: 'walking_balance',
    section: 'problem',
    type: 'single_choice',
    required: true,
    options: O.WALKING,
    isRedFlag: true,
    text: t(
      '3. Do you have difficulty walking or keeping your balance?',
      '3. क्या आपको चलने या संतुलन बनाए रखने में कठिनाई होती है?',
    ),
  },
  {
    key: 'duration',
    section: 'problem',
    type: 'single_choice',
    required: true,
    options: O.DURATION,
    text: t(
      '4. How long have you had the problem?',
      '4. यह तकलीफ़ आपको कब से है?',
    ),
  },

  /* ---------------- Section C: previous treatment (Q5–Q6) ---------------- */
  {
    key: 'treatment',
    section: 'treatment',
    type: 'multi_choice',
    required: true,
    minSelections: 1,
    options: O.TREATMENTS,
    text: t(
      '5. What treatment have you already taken? Select all that apply.',
      '5. आपने अब तक क्या इलाज लिया है? जो भी लागू हो सब चुनें।',
    ),
  },
  {
    key: 'treatment_response',
    section: 'treatment',
    type: 'single_choice',
    required: true,
    options: O.TREATMENT_RESPONSE,
    showIf: {
      all: [
        { q: 'treatment', op: 'answered' },
        { q: 'treatment', op: 'excludes', value: ['none'] },
      ],
    },
    text: t('6. Has treatment helped?', '6. क्या इलाज से फ़ायदा हुआ है?'),
  },

  /* ------------ Section D: imaging and previous opinion (Q7–Q9) ------------ */
  {
    key: 'has_imaging',
    section: 'imaging',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    text: t(
      '7. Do you have an MRI, CT or X-ray of your spine?',
      '7. क्या आपके पास रीढ़ की एमआरआई, सीटी या एक्स-रे है?',
    ),
    help: t(
      'If yes, please bring the latest report and images to your appointment.',
      'अगर हाँ, तो कृपया सबसे नई रिपोर्ट और फ़िल्में अपॉइंटमेंट पर साथ लाएँ।',
    ),
  },
  {
    key: 'diagnosis',
    section: 'imaging',
    type: 'multi_choice',
    required: true,
    minSelections: 1,
    options: O.DIAGNOSIS,
    text: t(
      '8. Has a doctor diagnosed or mentioned any of these? Select all that apply.',
      '8. क्या किसी डॉक्टर ने इनमें से कुछ बताया है? जो भी लागू हो सब चुनें।',
    ),
  },
  {
    key: 'diagnosis_other',
    section: 'imaging',
    type: 'textarea',
    required: false,
    maxLength: 200,
    showIf: { q: 'diagnosis', op: 'includes', value: ['other'] },
    text: t(
      'What did the doctor say? (if you remember)',
      'डॉक्टर ने क्या बताया? (अगर याद हो)',
    ),
  },
  {
    key: 'surgery_advised',
    section: 'imaging',
    type: 'single_choice',
    required: true,
    options: O.YES_NO,
    text: t(
      '9. Has any doctor advised spine surgery?',
      '9. क्या किसी डॉक्टर ने रीढ़ की सर्जरी की सलाह दी है?',
    ),
  },
  {
    key: 'surgery_advised_detail',
    section: 'imaging',
    type: 'textarea',
    required: false,
    maxLength: 300,
    showIf: { q: 'surgery_advised', op: 'eq', value: 'yes' },
    text: t(
      'Name of surgery advised (if you know)',
      'कौन सी सर्जरी की सलाह दी गई? (अगर पता हो)',
    ),
  },

  /* ---------------- Section E: purpose of visit (Q10) ---------------- */
  {
    key: 'consult_reason',
    section: 'reason',
    type: 'single_choice',
    required: true,
    options: O.CONSULT_REASON,
    text: t(
      '10. What is the main reason for consultation?',
      '10. परामर्श का मुख्य कारण क्या है?',
    ),
  },
];

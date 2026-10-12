import type { QuestionOption } from '../types';
import { t } from './copy';

const opt = (code: string, en: string, hi: string): QuestionOption => ({
  code,
  label: t(en, hi),
});

export const YES_NO: QuestionOption[] = [
  opt('yes', 'Yes', 'हाँ'),
  opt('no', 'No', 'नहीं'),
];

export const GENDER: QuestionOption[] = [
  opt('male', 'Male', 'पुरुष'),
  opt('female', 'Female', 'महिला'),
  opt('other', 'Other', 'अन्य'),
];

/** Q1 — codes are the doctor's own list, in the doctor's order. */
export const MAIN_PROBLEM: QuestionOption[] = [
  opt('neck_pain', 'Neck pain', 'गर्दन में दर्द'),
  opt('back_pain', 'Back pain', 'कमर / पीठ में दर्द'),
  opt('arm_pain', 'Pain going to arm/hand', 'दर्द बांह / हाथ तक जाता है'),
  opt('leg_pain', 'Pain going to leg/foot', 'दर्द पैर / पंजे तक जाता है'),
  opt('numbness_tingling', 'Numbness/tingling', 'सुन्नपन / झुनझुनी'),
  opt('weakness', 'Weakness in arm/leg', 'बांह या पैर में कमज़ोरी'),
  opt(
    'walking_balance',
    'Difficulty walking/balance',
    'चलने या संतुलन में कठिनाई',
  ),
  opt('deformity', 'Spine deformity', 'रीढ़ का टेढ़ापन'),
  opt('injury', 'Spine injury/fracture', 'रीढ़ में चोट / फ्रैक्चर'),
  opt('other', 'Other', 'अन्य'),
];

/** Q2 — the doctor's three-way answer; "progressive" is what the score keys on. */
export const WEAKNESS: QuestionOption[] = [
  opt('no', 'No', 'नहीं'),
  opt('stable', 'Yes – stable', 'हाँ – स्थिर है'),
  opt(
    'progressive',
    'Yes – progressively increasing',
    'हाँ – धीरे-धीरे बढ़ रही है',
  ),
];

/** Q3. */
export const WALKING: QuestionOption[] = [
  opt('no', 'No', 'नहीं'),
  opt('yes', 'Yes', 'हाँ'),
  opt(
    'progressive',
    'Getting progressively worse',
    'धीरे-धीरे और बिगड़ रही है',
  ),
];

/** Q4. */
export const DURATION: QuestionOption[] = [
  opt('lt_6w', 'Less than 6 weeks', '6 हफ़्ते से कम'),
  opt('6w_3m', '6 weeks to 3 months', '6 हफ़्ते से 3 महीने'),
  opt('3_6m', '3 to 6 months', '3 से 6 महीने'),
  opt('gt_6m', 'More than 6 months', '6 महीने से ज़्यादा'),
];

/** Q5. */
export const TREATMENTS: QuestionOption[] = [
  opt('medicines', 'Medicines', 'दवाइयाँ'),
  opt('physio', 'Physiotherapy/exercises', 'फ़िज़ियोथेरेपी / व्यायाम'),
  opt('injections', 'Injection', 'इंजेक्शन'),
  opt('previous_surgery', 'Previous spine surgery', 'पहले रीढ़ की सर्जरी हो चुकी है'),
  opt('other', 'Other', 'अन्य'),
  opt('none', 'No treatment', 'कोई इलाज नहीं'),
];

/** Q6. */
export const TREATMENT_RESPONSE: QuestionOption[] = [
  opt('improved', 'Significant improvement', 'काफ़ी सुधार'),
  opt('partial', 'Partial improvement', 'थोड़ा सुधार'),
  opt('no_improvement', 'No improvement', 'कोई सुधार नहीं'),
  opt('worse', 'Symptoms getting worse', 'तकलीफ़ बढ़ रही है'),
];

/**
 * Q8 — what a doctor has already told the patient. The first six are the
 * "structural spine diagnosis" the score counts; `other` and `dont_know`
 * are not.
 */
export const DIAGNOSIS: QuestionOption[] = [
  opt('disc_prolapse', 'Disc prolapse', 'डिस्क प्रोलैप्स (डिस्क खिसकना)'),
  opt('canal_stenosis', 'Canal stenosis', 'कैनाल स्टेनोसिस (नस की नली सिकुड़ना)'),
  opt('spondylolisthesis', 'Spondylolisthesis', 'स्पॉन्डिलोलिस्थीसिस (मनका खिसकना)'),
  opt('cervical_myelopathy', 'Cervical myelopathy', 'सर्वाइकल मायलोपैथी'),
  opt('deformity_scoliosis', 'Deformity/scoliosis', 'टेढ़ापन / स्कोलियोसिस'),
  opt('fracture', 'Fracture', 'फ्रैक्चर'),
  opt('other', 'Other', 'अन्य'),
  opt('dont_know', "Don't know", 'पता नहीं'),
];

export const STRUCTURAL_DIAGNOSES = [
  'disc_prolapse',
  'canal_stenosis',
  'spondylolisthesis',
  'cervical_myelopathy',
  'deformity_scoliosis',
  'fracture',
];

/** Q10 — codes follow the doctor's list order. */
export const CONSULT_REASON: QuestionOption[] = [
  opt(
    'evaluate_surgery',
    'I want evaluation for possible spine surgery',
    'मुझे रीढ़ की संभावित सर्जरी के लिए जाँच चाहिए',
  ),
  opt(
    'surgery_advised',
    'Surgery has already been advised',
    'सर्जरी की सलाह पहले ही दी जा चुकी है',
  ),
  opt(
    'worsening_despite_treatment',
    'My symptoms are worsening despite treatment',
    'इलाज के बावजूद मेरी तकलीफ़ बढ़ रही है',
  ),
  opt(
    'second_opinion',
    'I want a second opinion regarding surgery',
    'मुझे सर्जरी के बारे में दूसरी राय चाहिए',
  ),
  opt(
    'routine_advice',
    'Routine back/neck pain advice',
    'कमर / गर्दन दर्द की सामान्य सलाह',
  ),
  opt(
    'report_review',
    'I only want my MRI/report reviewed',
    'मैं सिर्फ़ अपनी एमआरआई / रिपोर्ट दिखाना चाहता/चाहती हूँ',
  ),
];

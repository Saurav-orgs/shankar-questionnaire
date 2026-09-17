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

/**
 * `unsure` is a real clinical answer, not a cop-out. On the cauda equina
 * questions it is treated as `yes` — see rules.ts.
 */
export const YES_NO_UNSURE: QuestionOption[] = [
  opt('yes', 'Yes', 'हाँ'),
  opt('no', 'No', 'नहीं'),
  opt('unsure', 'Not sure', 'पता नहीं'),
];

export const SIDE: QuestionOption[] = [
  opt('left', 'Left', 'बायाँ'),
  opt('right', 'Right', 'दायाँ'),
  opt('both', 'Both sides', 'दोनों तरफ़'),
];

export const DURATION: QuestionOption[] = [
  opt('lt_2w', 'Less than 2 weeks', '2 हफ़्ते से कम'),
  opt('2_6w', '2 to 6 weeks', '2 से 6 हफ़्ते'),
  opt('6w_3m', '6 weeks to 3 months', '6 हफ़्ते से 3 महीने'),
  opt('3_12m', '3 to 12 months', '3 से 12 महीने'),
  opt('gt_1y', 'More than a year', 'एक साल से ज़्यादा'),
];

export const GENDER: QuestionOption[] = [
  opt('male', 'Male', 'पुरुष'),
  opt('female', 'Female', 'महिला'),
  opt('other', 'Other', 'अन्य'),
];

export const OCCUPATION: QuestionOption[] = [
  opt('driver', 'Driver', 'ड्राइवर'),
  opt('farm_labour', 'Farming or labour work', 'खेती या मज़दूरी'),
  opt('desk_job', 'Office or desk job', 'ऑफ़िस या डेस्क का काम'),
  opt('homemaker', 'Homemaker', 'गृहिणी'),
  opt('teacher', 'Teacher', 'शिक्षक'),
  opt('shop_business', 'Shop or business', 'दुकान या व्यापार'),
  opt('retired', 'Retired', 'सेवानिवृत्त'),
  opt('student', 'Student', 'छात्र'),
  opt('other', 'Other', 'अन्य'),
];

export const CHIEF_COMPLAINT: QuestionOption[] = [
  opt('neck_pain', 'Neck pain', 'गर्दन में दर्द'),
  opt('upper_back_pain', 'Upper back pain', 'ऊपरी पीठ में दर्द'),
  opt('low_back_pain', 'Lower back pain', 'कमर में दर्द'),
  opt('leg_pain', 'Leg pain', 'पैर में दर्द'),
  opt('arm_pain', 'Arm or hand pain', 'बांह या हाथ में दर्द'),
  opt('numbness', 'Numbness', 'सुन्नपन'),
  opt('tingling', 'Tingling, pins and needles', 'झुनझुनी या चींटियाँ चलना'),
  opt('weakness', 'Weakness', 'कमज़ोरी'),
  opt('walking_difficulty', 'Difficulty walking', 'चलने में कठिनाई'),
  opt('none_of_these', 'None of these', 'इनमें से कोई नहीं'),
];

export const RADIATE_LEG: QuestionOption[] = [
  opt('none', 'It stays in my back', 'दर्द पीठ में ही रहता है'),
  opt('buttock', 'Down to the buttock', 'कूल्हे तक'),
  opt('above_knee', 'To the thigh, above the knee', 'जाँघ तक, घुटने से ऊपर'),
  opt(
    'below_knee',
    'Below the knee, to the calf or foot',
    'घुटने से नीचे, पिंडली या पंजे तक',
  ),
];

export const RADIATE_ARM: QuestionOption[] = [
  opt('none', 'It stays in my neck', 'दर्द गर्दन में ही रहता है'),
  opt('shoulder', 'To the shoulder only', 'सिर्फ़ कंधे तक'),
  opt('above_elbow', 'To the upper arm', 'बांह के ऊपरी हिस्से तक'),
  opt(
    'below_elbow',
    'Below the elbow, to the hand or fingers',
    'कोहनी से नीचे, हाथ या उँगलियों तक',
  ),
];

export const ONSET: QuestionOption[] = [
  opt(
    'sudden_lift',
    'Suddenly, after lifting or bending',
    'अचानक, कुछ उठाने या झुकने के बाद',
  ),
  opt('sudden_injury', 'After an injury or fall', 'चोट लगने या गिरने के बाद'),
  opt('gradual', 'Slowly, over time', 'धीरे-धीरे, समय के साथ'),
  opt('no_cause', 'No clear reason', 'बिना किसी साफ़ कारण के'),
];

export const WALK_DISTANCE: QuestionOption[] = [
  opt('unlimited', 'I can walk as far as I want', 'जितना चाहूँ चल सकता/सकती हूँ'),
  opt('gt_500m', 'More than 500 metres', '500 मीटर से ज़्यादा'),
  opt('100_500m', 'Between 100 and 500 metres', '100 से 500 मीटर'),
  opt('lt_100m', 'Less than 100 metres', '100 मीटर से कम'),
];

/**
 * The single most discriminating question in the instrument. Relief on simply
 * standing still points away from the spine; relief only on sitting or bending
 * forward points towards it.
 */
export const CLAUDICATION_RELIEF: QuestionOption[] = [
  opt('stand_still', 'Just standing still is enough', 'बस खड़े रहने से आराम मिल जाता है'),
  opt(
    'sit_bend',
    'I have to sit down or bend forward',
    'मुझे बैठना पड़ता है या आगे झुकना पड़ता है',
  ),
  opt('neither', 'Neither helps', 'किसी से आराम नहीं मिलता'),
  opt('na', 'Pain does not stop me walking', 'दर्द से मेरा चलना नहीं रुकता'),
];

export const FUNC_WORK: QuestionOption[] = [
  opt('fully', 'Yes, normally', 'हाँ, सामान्य रूप से'),
  opt('difficulty', 'Yes, but with difficulty', 'हाँ, लेकिन मुश्किल से'),
  opt('stopped', 'No, I have had to stop', 'नहीं, मुझे काम बंद करना पड़ा'),
];

export const FUNC_SLEEP: QuestionOption[] = [
  opt('never', 'Never', 'कभी नहीं'),
  opt('sometimes', 'Sometimes', 'कभी-कभी'),
  opt('most_nights', 'Most nights', 'ज़्यादातर रातों में'),
];

export const FUNC_DAILY: QuestionOption[] = [
  opt('independent', 'I manage on my own', 'मैं खुद कर लेता/लेती हूँ'),
  opt('some_help', 'I need a little help', 'थोड़ी मदद चाहिए'),
  opt('needs_help', 'I need help for most things', 'ज़्यादातर कामों में मदद चाहिए'),
];

export const TREND: QuestionOption[] = [
  opt('better', 'Getting better', 'बेहतर हो रहा है'),
  opt('same', 'About the same', 'लगभग वैसा ही है'),
  opt('worse', 'Getting worse', 'बिगड़ रहा है'),
];

export const TREATMENTS: QuestionOption[] = [
  opt('nothing', 'Nothing yet', 'अभी तक कुछ नहीं'),
  opt('rest', 'Rest only', 'सिर्फ़ आराम'),
  opt('painkillers', 'Painkiller medicines', 'दर्द की दवाइयाँ'),
  opt('physio', 'Physiotherapy', 'फ़िज़ियोथेरेपी'),
  opt('injection', 'Injections', 'इंजेक्शन'),
  opt(
    'alt_medicine',
    'Ayurvedic, homeopathic or home remedies',
    'आयुर्वेदिक, होम्योपैथिक या घरेलू इलाज',
  ),
  opt('surgery', 'Spine surgery', 'रीढ़ की सर्जरी'),
];

export const PHYSIO_DURATION: QuestionOption[] = [
  opt('lt_2w', 'Less than 2 weeks', '2 हफ़्ते से कम'),
  opt('2_6w', '2 to 6 weeks', '2 से 6 हफ़्ते'),
  opt('gt_6w', 'More than 6 weeks', '6 हफ़्ते से ज़्यादा'),
];

export const TREATMENT_RESPONSE: QuestionOption[] = [
  opt('fully', 'Yes, it helped fully', 'हाँ, पूरी तरह आराम मिला'),
  opt('partly', 'It helped a little', 'थोड़ा आराम मिला'),
  opt('not_at_all', 'It did not help at all', 'बिल्कुल आराम नहीं मिला'),
];

export const IMAGING: QuestionOption[] = [
  opt('none', 'No scans done', 'कोई जाँच नहीं हुई'),
  opt('xray', 'X-ray', 'एक्स-रे'),
  opt('mri', 'MRI', 'एमआरआई'),
  opt('ct', 'CT scan', 'सीटी स्कैन'),
];

export const IMAGING_WHEN: QuestionOption[] = [
  opt('lt_3m', 'Within the last 3 months', 'पिछले 3 महीनों में'),
  opt('3_12m', '3 to 12 months ago', '3 से 12 महीने पहले'),
  opt('gt_1y', 'More than a year ago', 'एक साल से ज़्यादा पहले'),
];

export const COMORBIDITIES: QuestionOption[] = [
  opt('none', 'None of these', 'इनमें से कोई नहीं'),
  opt('diabetes', 'Diabetes (sugar)', 'मधुमेह (शुगर)'),
  opt('smoking', 'I smoke or use tobacco', 'मैं धूम्रपान या तंबाकू लेता/लेती हूँ'),
  opt('hypertension', 'High blood pressure', 'उच्च रक्तचाप'),
  opt('osteoporosis', 'Weak or brittle bones', 'हड्डियों का कमज़ोर होना'),
  opt('thyroid', 'Thyroid problem', 'थायरॉयड की समस्या'),
  opt('heart', 'Heart disease', 'हृदय रोग'),
];

import type { Localized } from '../types';

export const t = (en: string, hi: string): Localized => ({ en, hi });

/**
 * `{{clinicPhone}}` and `{{doctorName}}` are substituted at render time from
 * the doctors row, so the copy stays versioned with the questionnaire while the
 * contact details stay editable.
 */
export const consent = {
  body: t(
    'I agree that my answers and contact details will be shared with {{doctorName}} and their clinic to help prepare for my visit. This form does not give a diagnosis and is not a substitute for seeing a doctor.',
    'मैं सहमत हूँ कि मेरे उत्तर और संपर्क विवरण {{doctorName}} और उनके क्लिनिक के साथ साझा किए जाएँगे, ताकि मेरी विज़िट की तैयारी हो सके। यह फ़ॉर्म कोई निदान नहीं देता और डॉक्टर से मिलने का विकल्प नहीं है।',
  ),
  checkboxLabel: t('I agree', 'मैं सहमत हूँ'),
};

/**
 * The one screen where the system speaks to the patient at all.
 *
 * It deliberately does not say what the answers suggest, name a condition, or
 * imply a severity — it routes the patient to a human and stops. Without it, a
 * patient reporting bladder, bowel or saddle symptoms would go home and wait
 * for a callback, which is the one delay in this whole flow that causes
 * permanent harm. Disable with EMERGENCY_INTERRUPT_ENABLED=false.
 */
export const emergencyScreen = {
  heading: t(
    'Please contact the clinic today',
    'कृपया आज ही क्लिनिक से संपर्क करें',
  ),
  body: t(
    'Some of your answers need to be reviewed by the doctor urgently. Please call {{clinicPhone}} now. If you cannot reach the clinic, go to your nearest hospital emergency department. Your answers have been saved.',
    'आपके कुछ उत्तरों को डॉक्टर द्वारा तुरंत देखा जाना ज़रूरी है। कृपया अभी {{clinicPhone}} पर कॉल करें। अगर क्लिनिक से संपर्क न हो पाए, तो नज़दीकी अस्पताल के इमरजेंसी विभाग में जाएँ। आपके उत्तर सुरक्षित रख लिए गए हैं।',
  ),
};

/**
 * The single screen every patient sees after submitting — the same for a RED
 * patient and a routine one. It says exactly what the team is allowed to say
 * (SCREENING §7) and nothing more: the form categorises the appointment, and
 * only the doctor decides about surgery, after examining the patient. It never
 * names a category, a score, or a likely outcome.
 *
 * The request to bring reports exists because it saves the doctor time in the
 * room, which is the point of the whole system.
 */
export const completionScreen = {
  heading: t(
    'Thank you — your form has been sent to the clinic.',
    'धन्यवाद — आपका फ़ॉर्म क्लिनिक को भेज दिया गया है।',
  ),
  body: t(
    'Based on the information provided, your appointment has been categorized for appropriate consultation priority. The need for surgery can only be decided by Dr. Shankar Acharya after examining you and reviewing the relevant investigations. The clinic will contact you on your mobile/WhatsApp number. When you visit, please bring your MRI, CT or X-ray reports and films.',
    'दी गई जानकारी के आधार पर, आपके अपॉइंटमेंट को उचित परामर्श प्राथमिकता के लिए वर्गीकृत कर दिया गया है। सर्जरी की ज़रूरत है या नहीं, यह केवल डॉ. शंकर आचार्य आपकी जाँच करने और संबंधित रिपोर्ट देखने के बाद ही तय कर सकते हैं। क्लिनिक आपके मोबाइल / व्हाट्सऐप नंबर पर संपर्क करेगा। आते समय कृपया अपनी एमआरआई, सीटी या एक्स-रे की रिपोर्ट और फ़िल्में साथ लाएँ।',
  ),
};

export const disclaimer = t(
  'This form does not give a diagnosis. It helps the doctor prepare for your visit.',
  'यह फ़ॉर्म कोई निदान नहीं देता। यह डॉक्टर को आपकी विज़िट की तैयारी में मदद करता है।',
);

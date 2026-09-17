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
 * The single screen every patient sees after submitting — including someone
 * who answered a red flag. It is deliberately calm and identical for everyone:
 * it never tells the patient anything is wrong, because that is the doctor's
 * call, not the software's (see plan.md §2). The doctor still receives red-flag
 * cases immediately and at the top of their dashboard; the patient just sees a
 * reassuring "the doctor will connect with you".
 *
 * The two requests it makes — bring your reports, bring your medicines — exist
 * because they save the doctor time in the room, which is the point of the
 * whole system.
 */
export const completionScreen = {
  heading: t(
    'Thank you — your answers have been sent to the doctor.',
    'धन्यवाद — आपके उत्तर डॉक्टर को भेज दिए गए हैं।',
  ),
  body: t(
    'The doctor will review your answers and the clinic will connect with you soon. When you visit, please bring any scan reports (X-ray, MRI, CT) and a list of the medicines you take.',
    'डॉक्टर आपके उत्तरों की समीक्षा करेंगे और क्लिनिक जल्द ही आपसे संपर्क करेगा। आते समय कृपया अपनी जाँच रिपोर्ट (एक्स-रे, एमआरआई, सीटी) और जो दवाइयाँ आप लेते हैं उनकी सूची साथ लाएँ।',
  ),
};

export const disclaimer = t(
  'This form does not give a diagnosis. It helps the doctor prepare for your visit.',
  'यह फ़ॉर्म कोई निदान नहीं देता। यह डॉक्टर को आपकी विज़िट की तैयारी में मदद करता है।',
);

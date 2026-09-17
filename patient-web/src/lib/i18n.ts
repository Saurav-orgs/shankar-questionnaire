import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

/**
 * UI chrome only — buttons, labels, validation errors. Question text, options
 * and consent copy come from the API already localized (see plan.md §7); this
 * file never duplicates that content.
 */
const resources = {
  en: {
    translation: {
      appName: 'Spine Assessment',
      startAssessment: 'Start Assessment',
      continue: 'Continue',
      back: 'Back',
      next: 'Next',
      skip: 'Skip',
      submit: 'Submit',
      submitting: 'Submitting…',
      loading: 'Loading…',
      retry: 'Try again',
      somethingWentWrong: 'Something went wrong. Please try again.',
      cannotReachServer: 'Cannot reach the server. Check your connection and try again.',
      required: 'This question is required.',
      questionOf: 'Question {{answered}} of about {{total}}',
      agree: 'I agree',
      mustAgree: 'Please agree to continue.',
      yourDetails: 'Your details',
      importantChecks: 'A few important checks',
      dailyLife: 'Your daily life',
      reviewTitle: "You're done",
      reviewBody: 'You have answered every question. Submit when ready.',
      selectAtLeastOne: 'Select at least one option.',
      enterMobile: 'Enter a valid 10-digit mobile number.',
      resumeError: 'We could not find this assessment. Please start again.',
      startOver: 'Start again',
      call: 'Call {{phone}}',
      language: 'Language',
    },
  },
  hi: {
    translation: {
      appName: 'रीढ़ की जाँच',
      startAssessment: 'जाँच शुरू करें',
      continue: 'आगे बढ़ें',
      back: 'पीछे',
      next: 'आगे',
      skip: 'छोड़ें',
      submit: 'जमा करें',
      submitting: 'जमा हो रहा है…',
      loading: 'लोड हो रहा है…',
      retry: 'फिर से कोशिश करें',
      somethingWentWrong: 'कुछ गड़बड़ हो गई। कृपया फिर से कोशिश करें।',
      cannotReachServer: 'सर्वर से संपर्क नहीं हो पा रहा। कृपया अपना कनेक्शन जाँचें।',
      required: 'यह प्रश्न ज़रूरी है।',
      questionOf: 'प्रश्न {{answered}} / लगभग {{total}}',
      agree: 'मैं सहमत हूँ',
      mustAgree: 'आगे बढ़ने के लिए कृपया सहमति दें।',
      yourDetails: 'आपकी जानकारी',
      importantChecks: 'कुछ ज़रूरी सवाल',
      dailyLife: 'आपकी रोज़मर्रा की ज़िंदगी',
      reviewTitle: 'आपका फ़ॉर्म तैयार है',
      reviewBody: 'आपने सभी सवालों के जवाब दे दिए हैं। तैयार होने पर जमा करें।',
      selectAtLeastOne: 'कम से कम एक विकल्प चुनें।',
      enterMobile: 'सही 10 अंकों का मोबाइल नंबर डालें।',
      resumeError: 'यह फ़ॉर्म नहीं मिला। कृपया फिर से शुरू करें।',
      startOver: 'फिर से शुरू करें',
      call: '{{phone}} पर कॉल करें',
      language: 'भाषा',
    },
  },
}

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n

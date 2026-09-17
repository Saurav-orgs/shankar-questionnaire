import type { EvaluationContext } from '../questionnaire/types';

/**
 * Free-text pools for the training set — plan.md §9, constraint 4.
 *
 * Only two questions in the whole instrument accept prose (`free_text` and
 * `tx_prior_surgery_detail`); everything else is an option code and needs no
 * translation. So this is the entire surface the model has to read, and the
 * Hinglish entries are the reason it has to be trained rather than prompted.
 *
 * Hinglish here is Roman-script code-mixed Hindi and English, which is how
 * patients on a phone keyboard actually type — not Devanagari. Both are
 * represented because both arrive in practice, and the form language does not
 * predict which: patients switch scripts freely.
 *
 * `requires` exists because a randomly paired note can contradict the
 * structured answers — "MRI karaya tha" attached to a patient who ticked "no
 * scans done" would teach the model to reconcile a conflict that the data
 * never actually contains. Notes that assert a fact the form also records are
 * gated on that fact agreeing.
 */

export interface FreeTextSample {
  text: string;
  /** For dataset inspection — not shown to the model. */
  script: 'english' | 'hinglish' | 'devanagari';
  /** Only attach this note to a patient whose answers are consistent with it. */
  requires?: (context: EvaluationContext) => boolean;
}

const has = (value: unknown, code: string) =>
  Array.isArray(value) && value.map(String).includes(code);

const radiates = (c: EvaluationContext) =>
  c.lbp_radiate !== undefined && c.lbp_radiate !== 'none';

export const FREE_TEXT_SAMPLES: FreeTextSample[] = [
  /* ---------------- English ---------------- */
  {
    script: 'english',
    text: 'The pain is much worse after long driving shifts, sometimes I cannot get out of the car.',
    requires: (c) => c.occupation === 'driver',
  },
  {
    script: 'english',
    text: 'I have been managing with painkillers but they are not working like before.',
    requires: (c) => has(c.tx_tried, 'painkillers'),
  },
  {
    script: 'english',
    text: 'My mother had the same problem and needed an operation. I am worried it is the same thing.',
  },
  {
    script: 'english',
    text: 'It started after I lifted a heavy gas cylinder about two months ago.',
    requires: (c) =>
      c.lbp_onset === 'sudden_lift' && c.lbp_duration === '6w_3m',
  },
  {
    script: 'english',
    text: 'Please can the doctor see me early, I am the only earning member at home.',
  },
  {
    script: 'english',
    text: 'I am not able to sit through a full working day any more.',
    requires: (c) => c.lbp_sitting === 'yes' && c.func_work !== 'fully',
  },

  /* ---------------- Hinglish (Roman script, code-mixed) ---------------- */
  {
    script: 'hinglish',
    text: '2 saal se lower back mein dard hai, bending karne pe zyada hota hai.',
    requires: (c) => c.lbp_duration === 'gt_1y',
  },
  {
    script: 'hinglish',
    text: 'Subah uthne ke baad bahut stiffness rehti hai, thoda chalne ke baad theek ho jata hai.',
    requires: (c) => c.inflam_morning_stiffness === 'yes',
  },
  {
    script: 'hinglish',
    text: 'Pair mein jhunjhuni hoti hai aur raat ko neend nahi aati. Painkiller se thoda aaram milta hai.',
    requires: (c) =>
      c.lbp_numbness === 'yes' &&
      c.func_sleep !== 'never' &&
      has(c.tx_tried, 'painkillers'),
  },
  {
    script: 'hinglish',
    text: 'Doctor sahab, mujhe operation nahi karana hai. Koi dusra ilaaj bataiye please.',
  },
  {
    script: 'hinglish',
    text: 'Kaam pe baithne mein problem hoti hai, 10-15 minute se zyada nahi baith pata hoon.',
    requires: (c) => c.lbp_sitting === 'yes',
  },
  {
    script: 'hinglish',
    text: 'MRI karaya tha 3 mahine pehle, report saath la raha hoon. Disc ka problem bataya tha.',
    requires: (c) => has(c.img_done, 'mri'),
  },
  {
    script: 'hinglish',
    text: 'Ghar ka kaam karne mein bahut dikkat hoti hai, jhaadu poocha bilkul nahi kar pati.',
    requires: (c) => c.occupation === 'homemaker' && c.gender === 'female',
  },
  {
    script: 'hinglish',
    text: 'Pehle sirf kamar mein tha, ab leg mein bhi jaa raha hai. Din pe din badh raha hai.',
    requires: (c) => radiates(c) && c.func_worsening === 'worse',
  },
  {
    script: 'hinglish',
    text: 'Bahut dard hai, kaam bilkul band karna pada hai. Ghar walo ki madad leni padti hai.',
    requires: (c) => c.func_work === 'stopped',
  },
  {
    script: 'hinglish',
    text: 'Chalne mein dikkat hoti hai, thodi der baad rukna padta hai.',
    requires: (c) => c.lbp_walking === 'yes',
  },
  // Ungated Hinglish. The pool needs enough of these or the two samples that
  // pass every compatibility check end up on most Hinglish records, and the
  // model learns those two sentences instead of the language.
  {
    script: 'hinglish',
    text: 'Kaafi time se pareshan hoon. Kaam bhi karna hai aur dard bhi bardaasht nahi hota.',
  },
  {
    script: 'hinglish',
    text: 'Pehle bhi doctor ko dikhaya tha, unhone bola tha exercise karo. Kuch fayda nahi hua.',
  },
  {
    script: 'hinglish',
    text: 'Family mein sabko yahi problem hai. Papa ko bhi kamar ka dard rehta tha.',
  },
  {
    script: 'hinglish',
    text: 'Mujhe samajh nahi aa raha kya karna chahiye. Aap jo bolenge wahi karunga.',
  },
  {
    script: 'hinglish',
    text: 'Sirf ek baar mein pura checkup ho jaye to accha rahega, baar baar aana mushkil hai.',
  },
  {
    script: 'hinglish',
    text: 'Dard ki wajah se chidchidapan ho gaya hai, mood theek nahi rehta.',
  },
  {
    script: 'hinglish',
    text: 'Bahar ka koi ilaaj nahi karaya hai, seedha aapke paas aaya hoon.',
    requires: (c) => !has(c.tx_tried, 'physio') && !has(c.tx_tried, 'surgery'),
  },
  {
    script: 'hinglish',
    text: 'Garam sikai se thoda aaram milta hai lekin thodi der ke liye hi.',
  },
  {
    script: 'hinglish',
    text: 'Travel karne mein bahut dikkat hoti hai, bus ya auto mein baithna mushkil hai.',
  },
  {
    script: 'hinglish',
    text: 'Raat ko karvat badalne mein dard hota hai, subah uthke akadan rehti hai.',
  },
  {
    script: 'hinglish',
    text: 'Dawai roz leni padti hai warna kaam nahi kar pata. Iska koi permanent ilaaj hai kya?',
    requires: (c) => has(c.tx_tried, 'painkillers'),
  },
  {
    script: 'hinglish',
    text: 'Bacchon ko uthane mein dard badh jata hai, ghar ke kaam mein dikkat hoti hai.',
  },

  /* ---------------- Devanagari ---------------- */
  {
    script: 'devanagari',
    text: 'सुबह उठते समय कमर में बहुत दर्द रहता है, थोड़ा चलने के बाद ठीक हो जाता है।',
    requires: (c) => c.inflam_morning_stiffness === 'yes',
  },
  {
    script: 'devanagari',
    text: 'पैर में झुनझुनी होती है और रात को नींद नहीं आती।',
    requires: (c) => c.lbp_numbness === 'yes' && c.func_sleep !== 'never',
  },
  {
    script: 'devanagari',
    text: 'दवा से थोड़ा आराम मिलता है लेकिन दर्द पूरी तरह जाता नहीं है।',
    requires: (c) => c.tx_response === 'partly',
  },
  {
    script: 'devanagari',
    text: 'डॉक्टर साहब, कृपया जल्दी देख लीजिए। बहुत परेशानी हो रही है।',
  },
];

/** Prior-surgery detail, same three scripts. */
export const SURGERY_DETAIL_SAMPLES: FreeTextSample[] = [
  {
    script: 'english',
    text: 'L4-L5 discectomy in 2019 at a hospital in Mumbai.',
  },
  {
    script: 'english',
    text: 'Spine surgery about six years ago, I do not remember the level.',
  },
  {
    script: 'hinglish',
    text: '2018 mein Delhi mein operation hua tha, disc nikala tha. 2 saal theek raha phir dobara shuru ho gaya.',
  },
  {
    script: 'hinglish',
    text: 'Pichle saal hi surgery hui thi local hospital mein, par aaram nahi mila.',
  },
  {
    script: 'devanagari',
    text: '2017 में रीढ़ का ऑपरेशन हुआ था, उसके बाद कुछ साल ठीक रहा।',
  },
];

/** Samples whose stated facts are consistent with this patient's answers. */
export function compatibleSamples(
  samples: FreeTextSample[],
  context: EvaluationContext,
): FreeTextSample[] {
  return samples.filter((s) => !s.requires || s.requires(context));
}

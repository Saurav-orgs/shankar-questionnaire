/**
 * Classify a free-text answer's script — plan.md §9, constraint 4.
 *
 * The training set tags every sample with its script (`FreeTextSample.script`
 * in `training/free-text.ts`) because that was authored data — the label was
 * free. A real patient's answer carries no such label, so this infers it, for
 * exactly one purpose: deciding whether the produced summary is required to
 * mark a quoted excerpt `(translated)` before it can be trusted.
 *
 * Deliberately conservative. A false "hinglish" call on genuine English text
 * would fail a correct summary for a missing marker it never needed; a missed
 * "hinglish" call just skips one check on one field. The second failure mode
 * is cheaper, so this only calls Hinglish on multiple independent hits.
 */
export type FreeTextScript = 'english' | 'hinglish' | 'devanagari' | null;

const DEVANAGARI = /[ऀ-ॿ]/;

/**
 * Common Romanised Hindi function words — the closed-class words (pronouns,
 * negation, postpositions, copulas) that show up regardless of topic, rather
 * than content words that could just as easily be an English medical term.
 */
const HINGLISH_MARKERS =
  /\b(hai|hain|tha|thi|the|nahi|nahin|mein|hoti|hota|hoga|karna|kar|kya|kaise|kab|kahan|kyun|bhi|bahut|thoda|kuch|accha|acha|se|liye|raha|rahi|rahe|wala|wali|gaya|gayi|paas|sakta|sakti|padta|padti|milta|milti|jata|jati)\b/gi;

export function classifyFreeTextScript(text: string | null | undefined): FreeTextScript {
  if (!text || !text.trim()) return null;
  if (DEVANAGARI.test(text)) return 'devanagari';

  const hits = text.match(HINGLISH_MARKERS);
  // Require two distinct marker words, not one repeated — "hai" appearing
  // twice in an English sentence about "Hai Terrace Road" is unlikely, but
  // cheap to guard against anyway; two *different* function words firing is
  // a stronger signal that this is actually Hindi grammar, not a coincidence.
  if (hits && new Set(hits.map((h) => h.toLowerCase())).size >= 2) return 'hinglish';

  return 'english';
}

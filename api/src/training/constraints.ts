/**
 * The five §9 constraints, as checkable rules — plan.md §9, Phase 5b.
 *
 * Shared by the merge step (checking authored targets) and the evaluator
 * (checking model output), so the bar the model is held to is exactly the bar
 * the training data was written to.
 *
 * Constraint 2 — "never introduce a symptom, finding or history item not
 * present in the input" — is the one that matters and the one usually written
 * off as unmachine-checkable. It is checkable *here* because the input is not
 * free prose: it is rendered from a fixed question bank, so a claim in the
 * output can be mapped back to the question that would have to support it, and
 * that question's answer is right there in the input. If the output asserts leg
 * weakness while the form records "no", that is a hallucination, mechanically.
 */

export type ConstraintId =
  | 'verdict_leak'
  | 'unsupported_claim'
  | 'diagnosis_as_fact'
  | 'unmarked_translation'
  | 'length'
  | 'structure';

export interface Violation {
  constraint: ConstraintId;
  detail: string;
}

export interface CheckInput {
  output: string;
  /** The rendered model input this output was produced from. */
  input: string;
  freeTextScript: string | null;
  surgeryDetailScript: string | null;
}

const MAX_WORDS = 150;

const REQUIRED_SECTIONS = [
  'Snapshot',
  'Key findings',
  'Supporting the triage verdict',
  'What the doctor may want to ask',
];

/** The banner renders the band; the prose never should. */
const BAND_WORDS = /\b(RED|AMBER|GREY|GRAY|GREEN)\b/;

/* ------------------------------------------------------------------ *
 * Constraint 2 — claims that must be supported by the input
 * ------------------------------------------------------------------ */

interface Claim {
  /** Phrase in the output that asserts this finding. */
  pattern: RegExp;
  /** Question text as it appears in the rendered input. */
  question: string;
  /** Answers that support the claim. Anything else contradicts it. */
  supportedBy: RegExp;
  label: string;
}

const CLAIMS: Claim[] = [
  {
    label: 'saddle numbness',
    pattern: /saddle (numbness|sensory|anaesthesia)/i,
    question: 'Is there numbness around your private parts',
    supportedBy: /\b(Yes|Not sure)\b/,
  },
  {
    label: 'bladder involvement',
    pattern: /\bbladder (symptoms|involvement|dysfunction)\b|lost control of (?:his|her|their) urine/i,
    question: 'Have you recently lost control of your urine',
    supportedBy: /\b(Yes|Not sure)\b/,
  },
  {
    label: 'fever',
    pattern: /\bfever(?:ish)?\b/i,
    question: 'Do you have fever along with the pain',
    supportedBy: /\bYes\b/,
  },
  {
    label: 'cancer history',
    pattern: /\b(cancer|malignan\w+|metasta\w+) (history|treated|diagnosis)|history of cancer|previously treated for cancer/i,
    question: 'Have you ever been treated for cancer',
    supportedBy: /\bYes\b/,
  },
  {
    label: 'weight loss',
    pattern: /weight loss|lost weight/i,
    question: 'Have you lost weight without trying',
    supportedBy: /\bYes\b/,
  },
  {
    label: 'night pain',
    pattern: /\bnight pain\b|wakes? (?:him|her|them) at night/i,
    question: 'Does the pain wake you from sleep at night',
    supportedBy: /\bYes\b/,
  },
  {
    label: 'recent trauma',
    pattern: /\b(recent )?fall\b|\baccident\b|\btrauma\b/i,
    question: 'Have you had a fall or accident recently',
    supportedBy: /\bYes\b/,
  },
  {
    label: 'progressive weakness',
    pattern: /progressiv\w+ weakness|weakness .{0,20}(worsening|progressing)|foot drag/i,
    question: 'Is weakness in your leg or foot getting worse quickly',
    supportedBy: /\bYes\b/,
  },
  {
    label: 'leg weakness',
    pattern: /leg (feels )?weak|weakness in the leg|toes and heels/i,
    question: 'Is it hard to stand on your toes or heels',
    supportedBy: /\bYes\b/,
  },
  {
    label: 'leg numbness',
    pattern: /numbness (and tingling )?in the leg|leg numbness/i,
    question: 'Is there numbness or tingling in your leg or foot',
    supportedBy: /\bYes\b/,
  },
  {
    label: 'hip/groin involvement',
    pattern: /groin[- ]dominant|groin pain|hip stiffness/i,
    question: 'Is the pain mainly in the groin or the front of the hip',
    supportedBy: /\bYes\b/,
  },
  {
    label: 'morning stiffness',
    pattern: /morning stiffness|stiff(?:ness)? (?:on|after) waking/i,
    question: 'After waking, does your back stay stiff for more than 30 minutes',
    supportedBy: /\bYes\b/,
  },
  {
    label: 'widespread pain',
    pattern: /widespread pain|pain in many parts/i,
    question: 'Do you have pain in many parts of the body',
    supportedBy: /\bYes\b/,
  },
  {
    label: 'pregnancy',
    pattern: /\bpregnan\w+/i,
    question: 'Are you pregnant',
    supportedBy: /\bYes\b/,
  },
  {
    label: 'previous spine surgery',
    pattern: /previous spine surgery|discectomy|prior surgery|spine surgery/i,
    question: 'What have you already tried',
    supportedBy: /Spine surgery/,
  },
  {
    label: 'physiotherapy tried',
    pattern: /physiotherapy (?:for|tried|since)|weeks of physiotherapy/i,
    question: 'What have you already tried',
    supportedBy: /Physiotherapy/,
  },
];

/**
 * Constraints 2 and 3 apply to what the summary *asserts*, which is the three
 * sections before the questions. The questions section is interrogative: "any
 * rest pain, night pain in the foot, or slow-healing ulcers" asks whether those
 * exist, and asking about a symptom the form does not record is the entire
 * point of that section — it is where the unknowns go.
 *
 * Scoring the questions section as assertion inverts the constraint: it would
 * penalise exactly the behaviour the summary exists to produce, and reward a
 * model that only ever asks about things already answered.
 */
function assertivePart(output: string): string {
  const idx = output.indexOf('What the doctor may want to ask');
  return idx === -1 ? output : output.slice(0, idx);
}

/**
 * Quoted patient words are input, not assertion. When the summary renders a
 * free-text note — "Turning over at night hurts" — it is reporting what the
 * patient wrote, not claiming a finding the form should corroborate. Those two
 * can legitimately disagree, and saying so is the job.
 */
function stripQuotes(text: string): string {
  return text.replace(/["“][^"”]*["”]/g, ' ');
}

/**
 * Words that flip a mention into a denial. "no leg weakness" mentions weakness
 * but asserts its absence, and must not count as a claim — otherwise every
 * accurate "no red flags" line would be scored as a hallucination.
 */
const NEGATORS =
  /\b(no|not|never|without|denies|denied|absent|nil|none|neither|nor|normal|reported normal|unremarkable)\b/i;

/** Characters of context before a match to search for a negator. */
const NEGATION_WINDOW = 45;

function isNegated(text: string, index: number): boolean {
  const start = Math.max(0, index - NEGATION_WINDOW);
  const before = text.slice(start, index);
  // Stop at a sentence or bullet boundary — a negator in the previous clause
  // does not negate this one.
  const clause = before.split(/[.;\n]|\s-\s/).pop() ?? before;
  return NEGATORS.test(clause);
}

function checkClaims(rawOutput: string, input: string): Violation[] {
  const violations: Violation[] = [];
  const output = stripQuotes(assertivePart(rawOutput));

  for (const claim of CLAIMS) {
    const match = claim.pattern.exec(output);
    if (!match) continue;
    if (isNegated(output, match.index)) continue;

    // Find the question line in the rendered input.
    const line = input
      .split('\n')
      .find((l) => l.trim().startsWith(claim.question));

    if (!line) {
      // The question was never shown to this patient, so nothing in the form
      // supports the claim.
      violations.push({
        constraint: 'unsupported_claim',
        detail: `asserts "${claim.label}" but the form never asked (matched: "${match[0]}")`,
      });
      continue;
    }

    if (!claim.supportedBy.test(line)) {
      violations.push({
        constraint: 'unsupported_claim',
        detail: `asserts "${claim.label}" but the form records: ${line.trim()}`,
      });
    }
  }

  return violations;
}

/* ------------------------------------------------------------------ *
 * Constraint 3 — no diagnosis stated as fact
 * ------------------------------------------------------------------ */

const DIAGNOSES =
  /\b(stenosis|radiculopathy|myelopathy|cauda equina|spondyloarthritis|fibromyalgia|osteoarthritis|metasta\w+|discitis|osteomyelitis|fracture|prolapse|herniation)\b/gi;

/** Hedges that make a diagnostic mention acceptable. */
const HEDGES =
  /\b(query|queries|suggest\w*|consistent with|pattern|possible|possibly|likely|may|might|could|raises?|screen\w*|rule out|exclude|question of|fits)\b/i;

/** Characters either side of a diagnosis to search for a hedge. */
const HEDGE_WINDOW = 90;

function checkDiagnoses(rawOutput: string): Violation[] {
  const violations: Violation[] = [];
  const output = stripQuotes(assertivePart(rawOutput));

  for (const match of output.matchAll(DIAGNOSES)) {
    const index = match.index ?? 0;
    const from = Math.max(0, index - HEDGE_WINDOW);
    const context = output.slice(from, index + match[0].length + HEDGE_WINDOW);
    if (HEDGES.test(context)) continue;
    // A negated mention is not a diagnosis stated as fact.
    if (isNegated(output, index)) continue;

    violations.push({
      constraint: 'diagnosis_as_fact',
      detail: `"${match[0]}" stated without hedging — use query / suggests / pattern consistent with`,
    });
  }

  return violations;
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

export function checkConstraints(check: CheckInput): Violation[] {
  const { output, input } = check;
  const violations: Violation[] = [];

  const words = output.replace(/[*_#-]/g, ' ').split(/\s+/).filter(Boolean).length;
  if (words > MAX_WORDS) {
    violations.push({
      constraint: 'length',
      detail: `${words} words, over the ${MAX_WORDS} cap`,
    });
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!output.includes(section)) {
      violations.push({ constraint: 'structure', detail: `missing "${section}"` });
    }
  }

  const band = BAND_WORDS.exec(output);
  if (band) {
    violations.push({
      constraint: 'verdict_leak',
      detail: `names the band ("${band[0]}") — the banner renders that`,
    });
  }

  const nonEnglish = (s: string | null) => s === 'hinglish' || s === 'devanagari';
  const wasTranslated =
    nonEnglish(check.freeTextScript) || nonEnglish(check.surgeryDetailScript);
  if (wasTranslated && /["“]/.test(output) && !output.includes('(translated)')) {
    violations.push({
      constraint: 'unmarked_translation',
      detail: 'quotes translated free text without marking it (translated)',
    });
  }

  violations.push(...checkClaims(output, input));
  violations.push(...checkDiagnoses(output));

  return violations;
}

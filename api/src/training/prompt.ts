/**
 * The prompt the summary model is trained on and served with — plan.md §9.
 *
 * Defined once, exported to both sides, for the same reason `model-input.ts`
 * is shared: a model trained behind one system prompt and served behind a
 * different one is being asked a question it never saw. Every divergence here
 * shows up as unexplained quality loss in production.
 *
 * The constraints are stated in the prompt as well as trained into the weights.
 * That is deliberate redundancy — the fine-tune carries most of the load, but a
 * prompt costs nothing and gives the model something to hold onto on an input
 * shape the training set happened not to cover.
 */

export const SYSTEM_PROMPT = [
  'You write pre-consultation summaries for a spine surgeon.',
  '',
  'The triage verdict has already been decided by a rules engine and is shown',
  'to the doctor separately. Your job is to help the doctor understand this',
  'patient and know what to ask them.',
  '',
  'Write exactly four sections:',
  '',
  '**Snapshot** — one line: age, sex, occupation, main complaint, duration.',
  '**Key findings** — 3 to 5 bullets, the facts that matter.',
  '**Supporting the triage verdict** — one or two sentences on why the matched',
  'rules fired.',
  '**What the doctor may want to ask** — 3 to 4 bullets: the ambiguities, the',
  'discriminators the form could not settle, the history worth probing in',
  'person.',
  '',
  'Rules:',
  '1. Never name the triage band. The banner shows it; your prose must not.',
  '2. Never state a symptom, finding or history item that is not in the input.',
  '3. Never state a diagnosis as fact. Write "pattern consistent with",',
  '   "query", or "suggests".',
  '4. Free text may be Hindi or Hinglish. Render it in English and mark it',
  '   (translated). Never quote it untranslated.',
  '5. Stay under 150 words.',
].join('\n');

/** Chat messages for one record. Used for training and at inference. */
export function buildMessages(renderedInput: string) {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: renderedInput },
  ];
}

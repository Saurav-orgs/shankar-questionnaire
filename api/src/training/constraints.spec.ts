import { checkConstraints, type ConstraintId } from './constraints';

/**
 * Negative tests for the constraint checker — plan.md §9, Phase 5b.
 *
 * The self-check (`npm run evaluate -- --self`) reports 150/150 clean on the
 * authored set. That number is only meaningful if the checker can fail, so
 * every constraint gets a summary built to break it, and the false-positive
 * cases that the checker was corrected for get pinned so they cannot regress.
 */

/** Minimal rendered input, matching the shape `renderModelInput` produces. */
function input(overrides: Record<string, string> = {}): string {
  const answers: Record<string, string> = {
    'Is there numbness around your private parts, inner thighs, or the area you sit on?': 'No',
    'Do you have fever along with the pain?': 'No',
    'Have you ever been treated for cancer?': 'No',
    'Have you lost weight without trying?': 'No',
    'Does the pain wake you from sleep at night?': 'No',
    'Have you had a fall or accident recently?': 'No',
    'Is weakness in your leg or foot getting worse quickly, or does your foot drag on the ground?': 'No',
    'Is it hard to stand on your toes or heels, or does your leg feel weak?': 'No',
    'Is there numbness or tingling in your leg or foot?': 'No',
    'Is the pain mainly in the groin or the front of the hip, rather than in the back?': 'No',
    'After waking, does your back stay stiff for more than 30 minutes?': 'No',
    'Do you have pain in many parts of the body along with constant tiredness?': 'No',
    'What have you already tried? Select all that apply.': 'Painkiller medicines',
    ...overrides,
  };

  return [
    'PATIENT',
    '44y, male, Office or desk job, Pune. Form completed in English.',
    '',
    'ANSWERS',
    '[Important checks]',
    ...Object.entries(answers).map(([q, a]) => `  ${q} ${a}`),
    '',
    'TRIAGE — decided by the rules engine, do not contradict',
    'Category: GREEN',
  ].join('\n');
}

const SECTIONS =
  '**Snapshot** — 44y man.\n\n**Key findings**\n- BODY\n\n' +
  '**Supporting the triage verdict** — VERDICT\n\n' +
  '**What the doctor may want to ask**\n- ASK';

/** Build a well-formed summary with a given assertive body. */
function summary(body: string, ask = 'Whether anything helps'): string {
  return SECTIONS.replace('BODY', body)
    .replace('VERDICT', 'Nothing of note.')
    .replace('ASK', ask);
}

function check(output: string, over: Record<string, string> = {}) {
  return checkConstraints({
    output,
    input: input(over),
    freeTextScript: null,
    surgeryDetailScript: null,
  });
}

const ids = (v: { constraint: ConstraintId }[]) => v.map((x) => x.constraint);

describe('constraint checker — catches violations', () => {
  it('flags a claim the form contradicts', () => {
    const v = check(summary('- Saddle numbness reported'));
    expect(ids(v)).toContain('unsupported_claim');
  });

  it('flags several unsupported claims independently', () => {
    const v = check(summary('- Fever, weight loss, and saddle numbness'));
    expect(v.filter((x) => x.constraint === 'unsupported_claim').length).toBeGreaterThanOrEqual(3);
  });

  it('flags a claim whose question was never asked', () => {
    const bare = ['PATIENT', '44y male.', '', 'TRIAGE — decided by the rules engine', 'Category: GREY'].join('\n');
    const v = checkConstraints({
      output: summary('- Groin pain and hip stiffness'),
      input: bare,
      freeTextScript: null,
      surgeryDetailScript: null,
    });
    expect(ids(v)).toContain('unsupported_claim');
  });

  it('flags a diagnosis stated as fact', () => {
    const v = check(summary('- He has lumbar canal stenosis'));
    expect(ids(v)).toContain('diagnosis_as_fact');
  });

  it('flags the triage band appearing in the prose', () => {
    const v = check(summary('- This is a GREEN case'));
    expect(ids(v)).toContain('verdict_leak');
  });

  it('flags a missing section', () => {
    const v = check('**Snapshot** — 44y man.\n\n**Key findings**\n- Nothing');
    expect(ids(v)).toContain('structure');
  });

  it('flags going over the word cap', () => {
    const v = check(summary(`- ${'word '.repeat(200)}`));
    expect(ids(v)).toContain('length');
  });

  it('flags an unmarked translation', () => {
    const v = checkConstraints({
      output: summary('- He wrote: "kamar mein dard hai"'),
      input: input(),
      freeTextScript: 'hinglish',
      surgeryDetailScript: null,
    });
    expect(ids(v)).toContain('unmarked_translation');
  });

  it('flags a Hinglish surgery note quoted without marking, even when the free-text note is English', () => {
    const v = checkConstraints({
      output: summary('- She wrote: "operation hua tha"'),
      input: input(),
      freeTextScript: 'english',
      surgeryDetailScript: 'hinglish',
    });
    expect(ids(v)).toContain('unmarked_translation');
  });
});

describe('constraint checker — does not fire on correct summaries', () => {
  it('accepts a claim the form supports', () => {
    const v = check(summary('- Saddle numbness reported'), {
      'Is there numbness around your private parts, inner thighs, or the area you sit on?': 'Yes',
    });
    expect(ids(v)).not.toContain('unsupported_claim');
  });

  it('treats "Not sure" as supporting a cauda equina claim, as the rules do', () => {
    const v = check(summary('- Saddle numbness reported'), {
      'Is there numbness around your private parts, inner thighs, or the area you sit on?': 'Not sure',
    });
    expect(ids(v)).not.toContain('unsupported_claim');
  });

  it('accepts a negated mention — reporting an absent finding is not a claim', () => {
    const v = check(summary('- No saddle numbness, no fever, no weight loss'));
    expect(ids(v)).not.toContain('unsupported_claim');
  });

  it('accepts a symptom named in the questions section — that section asks, it does not assert', () => {
    // The regression that made the checker fail five correct GREY summaries.
    const v = check(summary('- Nothing of note', 'Any rest pain, night pain in the foot, or ulcers'));
    expect(ids(v)).not.toContain('unsupported_claim');
  });

  it('accepts a diagnosis named in the questions section', () => {
    const v = check(summary('- Nothing of note', 'Steroid use and any previous fragility fracture'));
    expect(ids(v)).not.toContain('diagnosis_as_fact');
  });

  it('accepts a hedged diagnosis', () => {
    const v = check(summary('- A pattern consistent with lumbar canal stenosis'));
    expect(ids(v)).not.toContain('diagnosis_as_fact');
  });

  it('accepts a quoted patient claim the form contradicts — that disagreement is the point', () => {
    // The regression that made the checker fail amber_stenosis-003, where the
    // summary correctly surfaced a note disagreeing with a tick-box answer.
    const v = check(summary('- She wrote (translated): "there is stiffness on waking"'));
    expect(ids(v)).not.toContain('unsupported_claim');
  });

  it('passes a fully correct summary with no violations at all', () => {
    expect(check(summary('- Pain stays in the back; no red flags'))).toEqual([]);
  });
});

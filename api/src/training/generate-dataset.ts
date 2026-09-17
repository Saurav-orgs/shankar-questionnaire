/**
 * Training-set generator — plan.md §9, Phase 5a.
 *
 * Expands the seed cases across demographics, form language and free text,
 * runs each through the real rules engine, and writes one JSONL record per
 * patient with the model input rendered exactly as production will render it.
 *
 * The `output` field is left null. Authoring fills it in; that is the target
 * the model is trained to produce.
 *
 * Deliberately offline. Driving the live API would give the same answers at
 * roughly a hundred times the cost, because the branching evaluator, the rules
 * and the schema imported here are the same modules the server runs.
 *
 * Usage:  npm --prefix api run generate:dataset -- [--per-case N] [--out PATH]
 */

import { createHash } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { isQuestionVisible, progress } from '../questionnaire/evaluator';
import { questionnaireV1, rulesV1 } from '../questionnaire/v1';
import type { EvaluationContext, Lang } from '../questionnaire/types';
import { evaluateRules, redFlagsFromSchema } from '../triage/rules-engine';
import { renderModelInput } from '../triage/model-input';
import { buildTemplateSummary, computeCompleteness } from '../triage/summary';
import { SEED_CASES, type SeedCase } from './cases';
import {
  compatibleSamples,
  FREE_TEXT_SAMPLES,
  SURGERY_DETAIL_SAMPLES,
  type FreeTextSample,
} from './free-text';
import { findContradictions } from '../questionnaire/answer-validation';

/* ------------------------------------------------------------------ *
 * Deterministic RNG — a fixed seed keeps regenerated datasets stable,
 * so a diff between two runs shows real changes and not reshuffling.
 * ------------------------------------------------------------------ */

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/**
 * Each case draws from its own stream, seeded by name.
 *
 * A single shared stream would be simpler but brittle: inserting one seed case
 * shifts every later case's draws, so all their variants change and their ids
 * point at different patients. Authored outputs are keyed by id, so that would
 * silently invalidate the authoring done so far. Per-case streams keep a case's
 * variants stable no matter what happens around it.
 */
function seedFromName(name: string): number {
  let hash = 2166136261;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

/* ------------------------------------------------------------------ *
 * Variation axes
 * ------------------------------------------------------------------ */

const CITIES = [
  'Pune', 'Nagpur', 'Jaipur', 'Lucknow', 'Kochi', 'Indore',
  'Patna', 'Surat', 'Bhopal', 'Ludhiana', 'Nashik', 'Ranchi',
];

/** Occupations that do not imply an age the case may not have varied to. */
const WORKING_OCCUPATIONS = [
  'driver', 'farm_labour', 'desk_job', 'homemaker',
  'teacher', 'shop_business', 'other',
];

interface Variant {
  language: Lang;
  context: EvaluationContext;
  freeTextScript: FreeTextSample['script'] | null;
  /**
   * Tracked separately from `freeTextScript` because the two fields can differ
   * — a patient may write an English note and a Hinglish surgery detail. The
   * merge validator keys the "(translated)" requirement off these, so a script
   * that goes untracked is a translated quote that never gets checked.
   */
  surgeryDetailScript: FreeTextSample['script'] | null;
}

/**
 * Script mix among patients who wrote something. Weighted rather than uniform:
 * Hinglish is the capability the fine-tune exists to add, so it needs the most
 * examples. Uniform sampling over the pool gives it far less, because the
 * compatibility gate rejects more Hinglish notes than English ones — most of
 * them assert a specific symptom.
 */
const SCRIPT_WEIGHTS: [FreeTextSample['script'], number][] = [
  ['hinglish', 0.5],
  ['english', 0.3],
  ['devanagari', 0.2],
];

function pickByScript(
  rng: () => number,
  usable: FreeTextSample[],
): FreeTextSample {
  let roll = rng();
  for (const [script, weight] of SCRIPT_WEIGHTS) {
    roll -= weight;
    if (roll > 0) continue;
    const ofScript = usable.filter((s) => s.script === script);
    if (ofScript.length) return pick(rng, ofScript);
    break; // nothing compatible in this script — fall through to any
  }
  return pick(rng, usable);
}

function buildVariant(
  seedCase: SeedCase,
  index: number,
  rng: () => number,
): Variant {
  const context: EvaluationContext = { ...seedCase.answers };

  // The first variant of each case is the seed verbatim, so the dataset always
  // contains the exact patient the case was written and reviewed against.
  if (index === 0) {
    return {
      language: seedCase.language,
      context,
      freeTextScript: typeof context.free_text === 'string' ? 'english' : null,
      surgeryDetailScript:
        typeof context.tx_prior_surgery_detail === 'string' ? 'english' : null,
    };
  }

  if (seedCase.ageBand) {
    const [min, max] = seedCase.ageBand;
    context.age = min + Math.floor(rng() * (max - min + 1));
  }

  context.city = pick(rng, CITIES);

  // Never reassign occupation on a case that pinned it for clinical reasons
  // (a retired 68-year-old with a fragility fracture should stay retired).
  if (context.occupation !== 'retired' && context.occupation !== 'student') {
    context.occupation = pick(rng, WORKING_OCCUPATIONS);
  }

  // Gender is only varied where the case did not pin it: pregnancy and the
  // fragility-fracture case both depend on it.
  const genderPinned =
    seedCase.rule === 'ADVISORY_PREGNANCY' ||
    seedCase.rule === 'RED_FRAGILITY_FRACTURE';
  if (!genderPinned) {
    context.gender = rng() < 0.5 ? 'male' : 'female';
  }

  // `is_pregnant` is only offered to female patients of childbearing age;
  // clear a stale "no" that would otherwise render for a male patient.
  if (context.gender !== 'female') delete context.is_pregnant;

  const language: Lang = rng() < 0.45 ? 'hi' : 'en';

  // Roughly half of patients write something. Script is independent of form
  // language on purpose — a patient on the English form may still type
  // Hinglish, and that is exactly the case the model must handle.
  let freeTextScript: FreeTextSample['script'] | null = null;
  const wantsFreeText = seedCase.rule === 'ADVISORY_FREE_TEXT' || rng() < 0.5;
  const usable = wantsFreeText
    ? compatibleSamples(FREE_TEXT_SAMPLES, context)
    : [];

  if (usable.length) {
    const sample = pickByScript(rng, usable);
    context.free_text = sample.text;
    freeTextScript = sample.script;
  } else {
    // ADVISORY_FREE_TEXT must always carry a note or it cannot fire; the
    // unconditional samples are always compatible, so this cannot strand it.
    delete context.free_text;
  }

  let surgeryDetailScript: FreeTextSample['script'] | null = null;
  if (
    Array.isArray(context.tx_tried) &&
    context.tx_tried.includes('surgery')
  ) {
    const detail = pickByScript(rng, SURGERY_DETAIL_SAMPLES);
    context.tx_prior_surgery_detail = detail.text;
    surgeryDetailScript = detail.script;
  }

  return { language, context, freeTextScript, surgeryDetailScript };
}

/* ------------------------------------------------------------------ *
 * Record construction
 * ------------------------------------------------------------------ */

interface DatasetRecord {
  id: string;
  targetRule: string;
  language: Lang;
  freeTextScript: string | null;
  surgeryDetailScript: string | null;
  /** What actually fired — the target must be in here. */
  firedRules: string[];
  /** Highest-severity match; may outrank the target, which is realistic. */
  verdict: { category: string; urgency: string; pathway: string };
  completeness: number;
  /** Exactly what production will send the model. */
  input: string;
  /**
   * Fingerprint of `input`. Authoring is keyed by id, but a regenerated dataset
   * can hand the same id different content — a changed sampler, an edited seed
   * case. The summary would then describe a patient who no longer exists, and
   * no structural check would notice. The merge step compares this against the
   * hash recorded when the summary was authored.
   */
  inputHash: string;
  /** The deterministic summary — a starting point for authoring, not the target. */
  templateSummary: string;
  /** Authored during Phase 5a. */
  output: null;
}

function buildRecord(
  seedCase: SeedCase,
  variant: Variant,
  id: string,
): { record: DatasetRecord; targetFired: boolean } {
  const { context, language } = variant;

  // Strip answers the branching would have hidden. A variant that changed age
  // or gender can orphan an answer from a branch this patient no longer
  // reaches, and a stale answer must never reach the rules or the model.
  const cleaned: EvaluationContext = { ...context };
  for (const question of questionnaireV1.questions) {
    if (!isQuestionVisible(question, context) && question.key in cleaned) {
      delete cleaned[question.key];
    }
  }

  const evaluation = evaluateRules(rulesV1, cleaned);
  const redFlags = redFlagsFromSchema(questionnaireV1, cleaned);
  const contradictions = findContradictions(cleaned);
  const { answered, total } = progress(questionnaireV1, cleaned);

  const firedRules = [
    ...evaluation.matchedRules.map((r) => r.code),
    // Advisory rules never enter matchedRules, so recover them from the notes
    // they contributed — otherwise every advisory case looks like a failure.
    ...rulesV1
      .filter((r) => r.advisory)
      .filter((r) => evaluation.secondaryNotes.includes(r.secondaryNote ?? ''))
      .map((r) => r.code),
  ];

  const modelInput = renderModelInput(
    questionnaireV1,
    cleaned,
    evaluation,
    redFlags,
    contradictions,
    { language },
  );

  return {
    targetFired: firedRules.includes(seedCase.rule),
    record: {
      id,
      targetRule: seedCase.rule,
      language,
      freeTextScript: variant.freeTextScript,
      surgeryDetailScript: variant.surgeryDetailScript,
      firedRules,
      verdict: {
        category: evaluation.category,
        urgency: evaluation.urgency,
        pathway: evaluation.pathway,
      },
      completeness: computeCompleteness(answered, total),
      input: modelInput,
      inputHash: createHash('sha256').update(modelInput).digest('hex').slice(0, 12),
      templateSummary: buildTemplateSummary(
        questionnaireV1,
        cleaned,
        evaluation,
        redFlags,
      ),
      output: null,
    },
  };
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

function parseArgs(argv: string[]) {
  const perCaseArg = argv.indexOf('--per-case');
  const outArg = argv.indexOf('--out');
  return {
    perCase: perCaseArg >= 0 ? Number(argv[perCaseArg + 1]) : 16,
    out:
      outArg >= 0
        ? argv[outArg + 1]
        : resolve(__dirname, '../../../training-data/dataset.jsonl'),
  };
}

function main() {
  const { perCase, out } = parseArgs(process.argv.slice(2));

  if (!Number.isFinite(perCase) || perCase < 1) {
    throw new Error(`--per-case must be a positive number, got ${perCase}`);
  }

  const records: DatasetRecord[] = [];
  const broken: string[] = [];

  for (const seedCase of SEED_CASES) {
    const prefix = (seedCase.name ?? seedCase.rule).toLowerCase();
    const rng = makeRng(seedFromName(prefix));

    for (let i = 0; i < perCase; i++) {
      const variant = buildVariant(seedCase, i, rng);
      const id = `${prefix}-${String(i).padStart(3, '0')}`;
      const { record, targetFired } = buildRecord(seedCase, variant, id);

      if (!targetFired) {
        broken.push(
          `${id}: target ${seedCase.rule} did not fire ` +
            `(fired: ${record.firedRules.join(', ') || 'nothing'})`,
        );
        continue;
      }
      records.push(record);
    }
  }

  // A seed case that cannot fire its own rule is a bug in the case, not noise
  // to skip past — every rule must be represented or the model never learns it.
  if (broken.length) {
    console.error(`\n${broken.length} variant(s) failed to fire their target:\n`);
    for (const line of broken.slice(0, 20)) console.error(`  ${line}`);
    if (broken.length > 20) console.error(`  ... and ${broken.length - 20} more`);
    console.error('');
    process.exitCode = 1;
  }

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, records.map((r) => JSON.stringify(r)).join('\n') + '\n');

  report(records, out);
}

function report(records: DatasetRecord[], out: string) {
  const byCategory = new Map<string, number>();
  const byScript = new Map<string, number>();
  const byLanguage = new Map<string, number>();
  const rulesCovered = new Set<string>();

  for (const r of records) {
    byCategory.set(r.verdict.category, (byCategory.get(r.verdict.category) ?? 0) + 1);
    byLanguage.set(r.language, (byLanguage.get(r.language) ?? 0) + 1);
    const script = r.freeTextScript ?? 'none';
    byScript.set(script, (byScript.get(script) ?? 0) + 1);
    rulesCovered.add(r.targetRule);
  }

  const fmt = (m: Map<string, number>) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}=${v}`)
      .join('  ');

  // Distinct rules, not cases — several cases can target the same rule.
  const targetedRules = new Set(SEED_CASES.map((c) => c.rule));
  const missing = [...targetedRules].filter((r) => !rulesCovered.has(r));

  console.log(`\nWrote ${records.length} records to ${out}`);
  console.log(
    `Rules covered:  ${rulesCovered.size}/${targetedRules.size}` +
      (missing.length ? `  MISSING: ${missing.join(', ')}` : ''),
  );
  console.log(`Verdict:        ${fmt(byCategory)}`);
  console.log(`Form language:  ${fmt(byLanguage)}`);
  console.log(`Free text:      ${fmt(byScript)}`);
  console.log(`\nNext: author the \`output\` field on each record.\n`);
}

main();

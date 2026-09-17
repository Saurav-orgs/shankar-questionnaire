/**
 * Score a base model's Hinglish comprehension — plan.md §9, Phase 5b, step 3.
 *
 * Reads renderings produced by a candidate model and scores them against the
 * expected facts in `training-data/bakeoff/hinglish-comprehension.json`.
 *
 * Deliberately separate from the model runner. Producing the renderings needs
 * a Python/MLX environment and multi-gigabyte downloads; scoring them does
 * not. Keeping them apart means the bake-off can be scored from renderings
 * produced anywhere — another machine, a colleague, a hosted playground —
 * rather than being blocked on getting a runtime working locally.
 *
 * Input format: JSONL of {id, output} — one line per sample.
 *
 * Usage:
 *   npm --prefix api run score:bakeoff -- --renderings qwen3-4b.jsonl [--verbose]
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../..');
const SET = resolve(ROOT, 'training-data/bakeoff/hinglish-comprehension.json');

/**
 * `npm --prefix api run ...` executes with cwd set to `api/`, so a path the
 * user typed relative to the repo root resolves to the wrong place. Try cwd
 * first, then the repo root, so both forms work.
 */
function resolveInput(p: string): string {
  const fromCwd = resolve(p);
  if (existsSync(fromCwd)) return fromCwd;
  const fromRoot = resolve(ROOT, p);
  if (existsSync(fromRoot)) return fromRoot;
  throw new Error(`file not found: ${p} (tried ${fromCwd} and ${fromRoot})`);
}


interface Fact {
  key: string;
  expect: string[];
  note?: string;
}

interface Sample {
  id: string;
  text: string;
  facts: Fact[];
  /** Phrases that indicate the model inverted the meaning. */
  mustNotContain?: string[];
  note?: string;
}

interface Rendering {
  id: string;
  output: string;
}

/** Word overlap above which the output is judged to be the input echoed back. */
const PASSTHROUGH_RATIO = 0.6;

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function isPassthrough(source: string, output: string): boolean {
  const src = words(source);
  if (!src.length) return false;
  const out = new Set(words(output));
  const shared = src.filter((w) => out.has(w)).length;
  return shared / src.length >= PASSTHROUGH_RATIO;
}

function main() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--renderings');
  if (i < 0) throw new Error('pass --renderings <path.jsonl>');
  const path = resolveInput(argv[i + 1]);
  const verbose = argv.includes('--verbose');

  const set = JSON.parse(readFileSync(SET, 'utf8')) as { samples: Sample[] };
  const renderings = readFileSync(path, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Rendering);

  const byId = new Map(renderings.map((r) => [r.id, r.output]));

  const missingSamples = set.samples.filter((s) => !byId.has(s.id));
  if (missingSamples.length) {
    console.error(
      `\n${missingSamples.length} sample(s) have no rendering: ` +
        `${missingSamples.map((s) => s.id).join(', ')}\n` +
        'Scoring only what is present — the totals below are not comparable\n' +
        'against a model that rendered the full set.\n',
    );
  }

  let factsTotal = 0;
  let factsFound = 0;
  const inversions: string[] = [];
  const untranslated: string[] = [];
  const perSample: { id: string; found: number; total: number; missed: string[] }[] = [];

  for (const sample of set.samples) {
    const output = byId.get(sample.id);
    if (output === undefined) continue;

    const lower = output.toLowerCase();

    // Passthrough detection. A model that echoes the Hinglish back verbatim
    // scores near zero on facts and zero on inversions, which reads as "poor
    // but honest". It is neither: nothing was translated, so the doctor would
    // see raw Hinglish where English was promised. Worse, it hides in the
    // inversion check — untranslated text cannot contain "no urinary
    // symptoms", so the most dangerous sample in the set passes silently.
    if (isPassthrough(sample.text, output)) {
      untranslated.push(sample.id);
    }
    const missed: string[] = [];

    for (const fact of sample.facts) {
      factsTotal++;
      const hit = fact.expect.some((e) => lower.includes(e.toLowerCase()));
      if (hit) factsFound++;
      else missed.push(fact.key);
    }

    for (const phrase of sample.mustNotContain ?? []) {
      if (lower.includes(phrase.toLowerCase())) {
        inversions.push(`${sample.id}: rendered "${phrase}" — meaning inverted`);
      }
    }

    perSample.push({
      id: sample.id,
      found: sample.facts.length - missed.length,
      total: sample.facts.length,
      missed,
    });
  }

  const recall = factsTotal ? ((factsFound / factsTotal) * 100).toFixed(1) : '0.0';

  console.log(`\nHinglish comprehension — ${path.split('/').pop()}`);
  console.log(`  fact recall     ${factsFound}/${factsTotal}  (${recall}%)`);
  console.log(`  samples scored  ${perSample.length}/${set.samples.length}`);
  console.log(`  meaning inversions  ${inversions.length}`);
  console.log(`  untranslated        ${untranslated.length}`);

  if (untranslated.length) {
    console.log(
      '\n  UNTRANSLATED — the note was echoed back, not rendered in English:',
    );
    console.log(`    ${untranslated.join(', ')}`);
  }

  if (inversions.length) {
    // A model that turns "susu control nahi hota" into "no urinary symptoms"
    // is unusable regardless of recall — it converts the instrument's most
    // urgent red flag into a reassuring negative.
    console.log('\n  INVERSIONS — disqualifying regardless of recall:');
    for (const line of inversions) console.log(`    ${line}`);
  }

  const weak = perSample.filter((s) => s.found < s.total).sort((a, b) => a.found - b.found);
  if (weak.length && verbose) {
    console.log('\n  samples with missed facts:');
    for (const s of weak) {
      console.log(`    ${s.id}  ${s.found}/${s.total}  missed: ${s.missed.join(', ')}`);
    }
  } else if (weak.length) {
    console.log(`\n  ${weak.length} sample(s) with missed facts — pass --verbose to list`);
  }

  console.log('');
}

main();

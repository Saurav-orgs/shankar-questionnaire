/**
 * Merge authored summaries into the dataset and validate them — plan.md §9.
 *
 * Authoring lives in `training-data/authored/*.json`, keyed by record id, so
 * regenerating `dataset.jsonl` never destroys it. This joins the two and
 * checks every authored output against the constraints before writing.
 *
 * The checks here are the mechanical subset of §9 — length, structure, and
 * verdict leakage. They cannot catch an invented symptom or a diagnosis stated
 * as fact; those need reading. What they do catch is drift over hundreds of
 * examples, which is exactly what a human reviewer stops noticing.
 *
 * Usage:  npm --prefix api run merge:dataset [-- --write] [-- --relock]
 *         Without --write it reports and changes nothing.
 *         --relock accepts the current inputs as what the summaries were
 *         written against. Use it only after re-reading the drifted records:
 *         it silences the guard, it does not fix the prose.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../..');
const DATASET = resolve(ROOT, 'training-data/dataset.jsonl');
const AUTHORED_DIR = resolve(ROOT, 'training-data/authored');
const MERGED = resolve(ROOT, 'training-data/dataset-merged.jsonl');
/**
 * id -> inputHash at the time the summary was authored. Regenerating the
 * dataset can hand an id different content, which would leave the summary
 * describing a patient who no longer exists. Structural checks cannot see
 * that; this can.
 */
const LOCKFILE = resolve(ROOT, 'training-data/authored/input-hashes.json');

const MAX_WORDS = 150;

const REQUIRED_SECTIONS = [
  'Snapshot',
  'Key findings',
  'Supporting the triage verdict',
  'What the doctor may want to ask',
];

/** Band names belong to the verdict banner, which application code renders. */
const BAND_WORDS = /\b(RED|AMBER|GREY|GRAY|GREEN)\b/;

interface DatasetRecord {
  id: string;
  targetRule: string;
  freeTextScript: string | null;
  surgeryDetailScript: string | null;
  verdict: { category: string };
  input: string;
  inputHash: string;
  output: string | null;
}

interface Problem {
  id: string;
  issue: string;
}

function loadAuthored(): Map<string, string> {
  const authored = new Map<string, string>();

  for (const file of readdirSync(AUTHORED_DIR).filter((f) => f.endsWith('.json'))) {
    const parsed = JSON.parse(
      readFileSync(resolve(AUTHORED_DIR, file), 'utf8'),
    ) as Record<string, unknown>;

    for (const [id, output] of Object.entries(parsed)) {
      // Keys starting with `_` are batch metadata, not records.
      if (id.startsWith('_')) continue;
      if (file === 'input-hashes.json') continue;
      if (typeof output !== 'string') continue;
      if (authored.has(id)) {
        throw new Error(`${id} is authored in more than one batch file`);
      }
      authored.set(id, output);
    }
  }

  return authored;
}

function validate(id: string, output: string, record: DatasetRecord): Problem[] {
  const problems: Problem[] = [];

  const words = output
    .replace(/[*_#-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  if (words > MAX_WORDS) {
    problems.push({ id, issue: `${words} words, over the ${MAX_WORDS} cap` });
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!output.includes(section)) {
      problems.push({ id, issue: `missing section "${section}"` });
    }
  }

  // Constraint 1 is structural — the model never writes the band, so any band
  // word in the prose is a leak, whether or not it happens to be the right one.
  const band = BAND_WORDS.exec(output);
  if (band) {
    problems.push({
      id,
      issue: `names the triage band ("${band[0]}") — the banner renders that, the prose should not`,
    });
  }

  // A translated note must be marked, or the doctor cannot tell the patient's
  // words from the model's rendering of them. Only applies when the source was
  // not English — quoting an English note verbatim is not a translation, and
  // marking it as one would be false.
  const nonEnglish = (s: string | null) => s === 'hinglish' || s === 'devanagari';
  const wasTranslated =
    nonEnglish(record.freeTextScript) || nonEnglish(record.surgeryDetailScript);
  const quotesPatient = /["“]/.test(output);
  if (wasTranslated && quotesPatient && !output.includes('(translated)')) {
    problems.push({
      id,
      issue: 'quotes translated free text without marking it (translated)',
    });
  }

  return problems;
}

function main() {
  const write = process.argv.includes('--write');
  const relock = process.argv.includes('--relock');

  const records = readFileSync(DATASET, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as DatasetRecord);

  const authored = loadAuthored();
  const byId = new Map(records.map((r) => [r.id, r]));

  const locked: Record<string, string> = existsSync(LOCKFILE)
    ? (JSON.parse(readFileSync(LOCKFILE, 'utf8')) as Record<string, string>)
    : {};
  const drifted: string[] = [];

  const problems: Problem[] = [];
  const orphans: string[] = [];

  for (const [id, output] of authored) {
    const record = byId.get(id);
    if (!record) {
      // Usually means the dataset was regenerated with different seed cases.
      orphans.push(id);
      continue;
    }
    const wasAuthoredAgainst = locked[id];
    if (wasAuthoredAgainst && wasAuthoredAgainst !== record.inputHash) {
      drifted.push(id);
    }
    problems.push(...validate(id, output, record));
    record.output = output;
  }

  const merged = records.filter((r) => r.output !== null);

  if (orphans.length) {
    console.error(`\n${orphans.length} authored id(s) not in the dataset:`);
    for (const id of orphans) console.error(`  ${id}`);
  }

  if (drifted.length && !relock) {
    console.error(
      `\n${drifted.length} record(s) changed since the summary was written — ` +
        `re-read the input and re-author, the prose may describe a different patient:`,
    );
    for (const id of drifted) console.error(`  ${id}`);
    console.error('  (re-author, then re-run with --relock)');
  } else if (drifted.length) {
    console.log(`\nRe-locking ${drifted.length} drifted record(s) as reviewed.`);
  }

  if (problems.length) {
    console.error(`\n${problems.length} constraint problem(s):`);
    for (const p of problems) console.error(`  ${p.id}: ${p.issue}`);
  }

  const byBand = new Map<string, number>();
  for (const r of merged) {
    byBand.set(r.verdict.category, (byBand.get(r.verdict.category) ?? 0) + 1);
  }

  console.log(`\nAuthored:  ${merged.length}/${records.length} records`);
  console.log(
    `By band:   ${[...byBand.entries()].sort().map(([k, v]) => `${k}=${v}`).join('  ')}`,
  );
  console.log(`Rules:     ${new Set(merged.map((r) => r.targetRule)).size} covered`);

  if (problems.length || orphans.length || (drifted.length && !relock)) {
    console.error('\nNot writing — fix the problems above first.\n');
    process.exitCode = 1;
    return;
  }

  if (write || relock) {
    writeFileSync(MERGED, merged.map((r) => JSON.stringify(r)).join('\n') + '\n');
    const hashes = Object.fromEntries(merged.map((r) => [r.id, r.inputHash]));
    writeFileSync(LOCKFILE, JSON.stringify(hashes, null, 2) + '\n');
    console.log(`\nWrote ${MERGED}`);
    console.log(`Locked ${merged.length} input hashes\n`);
  } else {
    console.log('\nAll checks passed. Re-run with --write to emit the merged file.\n');
  }
}

main();

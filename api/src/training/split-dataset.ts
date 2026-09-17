/**
 * Split the authored set into train and held-out — plan.md §9, Phase 5a exit.
 *
 * Emits three files:
 *
 *   train.jsonl    authored records the model learns from
 *   holdout.jsonl  authored records it never sees, scored against their targets
 *   unseen.jsonl   *unauthored* records, for constraint-only checking
 *
 * On the split axis, and its honest limit
 * --------------------------------------
 * Variants of one seed case are near-duplicates: same clinical pattern, same
 * matched rules, different demographics and free text. Splitting purely at
 * random would put variant 3 in train and variant 7 in holdout, and the model
 * would effectively be scored on something it had already seen.
 *
 * Splitting by *seed case* instead — holding out whole cases — removes that
 * leak but replaces it with a worse problem: the holdout would consist of
 * rules the model was never trained on, so it would measure generalisation to
 * unseen clinical patterns. That is not the question. Every rule the product
 * will ever see is in the training set by construction, because the rule set
 * is fixed and enumerable.
 *
 * So this holds out the highest-index variants within each seed case: they are
 * the most demographically distant from the ones kept, while still belonging
 * to a pattern the model has learned. The resulting score measures adherence —
 * format, voice, constraint-following on a familiar pattern — and should be
 * read that way, not as evidence of generalisation.
 *
 * `unseen.jsonl` is the antidote. Those records have no authored target, so
 * nothing can be scored against a reference, but the five mechanical
 * constraints can be checked on genuinely novel inputs. That is the honest
 * generalisation signal.
 *
 * Usage:  npm --prefix api run split:dataset -- [--holdout-fraction 0.2]
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../..');
const MERGED = resolve(ROOT, 'training-data/dataset-merged.jsonl');
const DATASET = resolve(ROOT, 'training-data/dataset.jsonl');
const OUT_DIR = resolve(ROOT, 'training-data');

interface Rec {
  id: string;
  targetRule: string;
  language: string;
  freeTextScript: string | null;
  verdict: { category: string };
  input: string;
  output: string | null;
}

/** Trailing number in an id like `grey_hip-009`. */
function variantIndex(id: string): number {
  const match = /-(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

/** Seed-case prefix, e.g. `grey_hip` from `grey_hip-009`. */
function casePrefix(id: string): string {
  return id.replace(/-\d+$/, '');
}

function summarise(label: string, records: Rec[]) {
  const count = (key: (r: Rec) => string) => {
    const m = new Map<string, number>();
    for (const r of records) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
    return [...m.entries()]
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join('  ');
  };

  console.log(`\n${label}: ${records.length} records`);
  console.log(`  band    ${count((r) => r.verdict.category)}`);
  console.log(`  lang    ${count((r) => r.language)}`);
  console.log(`  script  ${count((r) => r.freeTextScript ?? 'none')}`);
  console.log(`  rules   ${new Set(records.map((r) => r.targetRule)).size}`);
}

function main() {
  const argv = process.argv.slice(2);
  const fracArg = argv.indexOf('--holdout-fraction');
  const fraction = fracArg >= 0 ? Number(argv[fracArg + 1]) : 0.2;

  if (!(fraction > 0 && fraction < 0.5)) {
    throw new Error(`--holdout-fraction must be between 0 and 0.5, got ${fraction}`);
  }

  const authored = readFileSync(MERGED, 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l) as Rec);

  // Group by seed case so the holdout is drawn evenly rather than concentrating
  // in whichever cases happen to have the most authored variants.
  const byCase = new Map<string, Rec[]>();
  for (const r of authored) {
    const key = casePrefix(r.id);
    const list = byCase.get(key) ?? [];
    list.push(r);
    byCase.set(key, list);
  }

  const train: Rec[] = [];
  const holdout: Rec[] = [];

  for (const [, records] of [...byCase.entries()].sort()) {
    records.sort((a, b) => variantIndex(a.id) - variantIndex(b.id));
    // At least one holdout per case where the case has enough records; a case
    // with a single authored variant contributes it to training rather than
    // being scored on the only example of its own pattern.
    const take = records.length >= 3 ? Math.max(1, Math.round(records.length * fraction)) : 0;
    holdout.push(...records.slice(records.length - take));
    train.push(...records.slice(0, records.length - take));
  }

  const authoredIds = new Set(authored.map((r) => r.id));
  const unseen = readFileSync(DATASET, 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l) as Rec)
    .filter((r) => !authoredIds.has(r.id));

  const write = (name: string, records: Rec[]) =>
    writeFileSync(
      resolve(OUT_DIR, name),
      records.map((r) => JSON.stringify(r)).join('\n') + '\n',
    );

  write('train.jsonl', train);
  write('holdout.jsonl', holdout);
  write('unseen.jsonl', unseen);

  summarise('train', train);
  summarise('holdout', holdout);
  summarise('unseen (no targets — constraint checks only)', unseen);

  const missing = [...new Set(train.map((r) => r.targetRule))].length;
  console.log(
    `\nEvery rule in training: ${missing}/26` +
      (missing < 26 ? '  ← a rule with no training example will never be learned' : ''),
  );
  console.log('');
}

main();

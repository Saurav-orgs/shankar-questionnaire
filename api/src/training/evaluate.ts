/**
 * Score summaries against the five §9 constraints — plan.md §9, Phase 5b.
 *
 * Two modes:
 *
 *   --self        Score the authored training set against itself. This is a
 *                 test of the *checker*, not the data: every violation is
 *                 either a real authoring mistake or a false positive in
 *                 constraints.ts, and both are worth knowing before the
 *                 checker is pointed at a model.
 *
 *   --predictions Score model output. Expects JSONL of {id, output}; each id
 *                 is looked up in the dataset for the input it was produced
 *                 from, so a prediction for an unknown id fails loudly rather
 *                 than being silently skipped.
 *
 * Usage:
 *   npm --prefix api run evaluate -- --self [--split holdout]
 *   npm --prefix api run evaluate -- --predictions path/to/preds.jsonl
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { checkConstraints, type ConstraintId, type Violation } from './constraints';

const ROOT = resolve(__dirname, '../../..');
const DATA = resolve(ROOT, 'training-data');

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


interface Rec {
  id: string;
  targetRule: string;
  freeTextScript: string | null;
  surgeryDetailScript: string | null;
  verdict: { category: string };
  input: string;
  output: string | null;
}

function loadJsonl<T>(path: string): T[] {
  return readFileSync(path, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

function flag(name: string, argv: string[]): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

interface Scored {
  id: string;
  targetRule: string;
  band: string;
  violations: Violation[];
}

function report(scored: Scored[], label: string) {
  const clean = scored.filter((s) => !s.violations.length);
  const byConstraint = new Map<ConstraintId, number>();
  for (const s of scored) {
    for (const v of s.violations) {
      byConstraint.set(v.constraint, (byConstraint.get(v.constraint) ?? 0) + 1);
    }
  }

  const pct = ((clean.length / scored.length) * 100).toFixed(1);
  console.log(`\n${label}`);
  console.log(`  ${clean.length}/${scored.length} clean (${pct}%)`);

  if (byConstraint.size) {
    console.log('\n  violations by constraint:');
    for (const [c, n] of [...byConstraint.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${c.padEnd(22)} ${n}`);
    }
  }

  const failing = scored.filter((s) => s.violations.length);
  if (failing.length) {
    console.log('\n  failing records:');
    for (const s of failing.slice(0, 25)) {
      console.log(`    ${s.id}  [${s.band}]`);
      for (const v of s.violations) console.log(`      ${v.constraint}: ${v.detail}`);
    }
    if (failing.length > 25) {
      console.log(`    ... and ${failing.length - 25} more`);
    }
  }

  // Per-band pass rate — a checker that only fails GREEN records is telling
  // you something different from one that fails evenly.
  const bands = new Map<string, { total: number; clean: number }>();
  for (const s of scored) {
    const entry = bands.get(s.band) ?? { total: 0, clean: 0 };
    entry.total++;
    if (!s.violations.length) entry.clean++;
    bands.set(s.band, entry);
  }
  console.log('\n  by band:');
  for (const [band, { total, clean: c }] of [...bands.entries()].sort()) {
    console.log(`    ${band.padEnd(6)} ${c}/${total}`);
  }
  console.log('');
}

function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('--self')) {
    const split = flag('--split', argv) ?? 'dataset-merged';
    const records = loadJsonl<Rec>(resolve(DATA, `${split}.jsonl`));

    const scored: Scored[] = records
      .filter((r) => r.output)
      .map((r) => ({
        id: r.id,
        targetRule: r.targetRule,
        band: r.verdict.category,
        violations: checkConstraints({
          output: r.output as string,
          input: r.input,
          freeTextScript: r.freeTextScript,
          surgeryDetailScript: r.surgeryDetailScript,
        }),
      }));

    report(scored, `Self-check: authored targets in ${split}.jsonl`);
    console.log(
      '  Every violation above is either an authoring mistake or a false\n' +
        '  positive in constraints.ts. Resolve both before trusting a model score.\n',
    );
    process.exitCode = scored.some((s) => s.violations.length) ? 1 : 0;
    return;
  }

  const predsPath = flag('--predictions', argv);
  if (!predsPath) {
    throw new Error('pass --self or --predictions <path>');
  }

  const preds = loadJsonl<{ id: string; output: string }>(resolveInput(predsPath));
  const all = loadJsonl<Rec>(resolve(DATA, 'dataset.jsonl'));
  const byId = new Map(all.map((r) => [r.id, r]));

  const unknown = preds.filter((p) => !byId.has(p.id)).map((p) => p.id);
  if (unknown.length) {
    throw new Error(
      `${unknown.length} prediction(s) reference unknown ids: ${unknown.slice(0, 5).join(', ')}`,
    );
  }

  const scored: Scored[] = preds.map((p) => {
    const rec = byId.get(p.id) as Rec;
    return {
      id: p.id,
      targetRule: rec.targetRule,
      band: rec.verdict.category,
      violations: checkConstraints({
        output: p.output,
        input: rec.input,
        freeTextScript: rec.freeTextScript,
        surgeryDetailScript: rec.surgeryDetailScript,
      }),
    };
  });

  report(scored, `Model output: ${predsPath}`);
  process.exitCode = scored.some((s) => s.violations.length) ? 1 : 0;
}

main();

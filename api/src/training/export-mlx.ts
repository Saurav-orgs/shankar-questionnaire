/**
 * Export the authored set in MLX LoRA format — plan.md §9, Phase 5b.
 *
 * `mlx_lm.lora` expects a directory containing `train.jsonl` and `valid.jsonl`,
 * one JSON object per line. Chat format is used because Gemma 3 is an
 * instruction-tuned model with a chat template; feeding it raw text would train
 * it on a shape it will never see at inference.
 *
 * Validation is carved out of the *training* split, not the holdout. MLX uses
 * valid.jsonl for loss monitoring and early stopping, which is a form of
 * selection — scoring the final model on the same records would report a number
 * the training run had already optimised towards. The holdout stays untouched
 * until the model is finished.
 *
 * Usage:  npm --prefix api run export:mlx -- [--valid-fraction 0.12]
 */

import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { buildMessages, SYSTEM_PROMPT } from './prompt';

const ROOT = resolve(__dirname, '../../..');
const DATA = resolve(ROOT, 'training-data');
const OUT = resolve(DATA, 'mlx');

interface Rec {
  id: string;
  targetRule: string;
  verdict: { category: string };
  input: string;
  output: string | null;
}

function loadJsonl(name: string): Rec[] {
  return readFileSync(resolve(DATA, name), 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Rec);
}

function toChat(rec: Rec) {
  return {
    messages: [
      ...buildMessages(rec.input),
      { role: 'assistant', content: rec.output as string },
    ],
  };
}

function main() {
  const argv = process.argv.slice(2);
  const fi = argv.indexOf('--valid-fraction');
  const fraction = fi >= 0 ? Number(argv[fi + 1]) : 0.12;

  if (!(fraction > 0 && fraction < 0.4)) {
    throw new Error(`--valid-fraction must be between 0 and 0.4, got ${fraction}`);
  }

  const train = loadJsonl('train.jsonl');
  const holdout = loadJsonl('holdout.jsonl');

  // Stratify the validation carve-out by band, so the loss curve is not
  // dominated by whichever band happened to land in it.
  const byBand = new Map<string, Rec[]>();
  for (const r of train) {
    const list = byBand.get(r.verdict.category) ?? [];
    list.push(r);
    byBand.set(r.verdict.category, list);
  }

  const valid: Rec[] = [];
  const fit: Rec[] = [];
  for (const [, records] of [...byBand.entries()].sort()) {
    const take = Math.max(1, Math.round(records.length * fraction));
    valid.push(...records.slice(0, take));
    fit.push(...records.slice(take));
  }

  mkdirSync(OUT, { recursive: true });

  const write = (name: string, records: Rec[]) =>
    writeFileSync(
      resolve(OUT, name),
      records.map((r) => JSON.stringify(toChat(r))).join('\n') + '\n',
    );

  // Single source of truth for the serving side. The Python runner and, later,
  // the inference server read this rather than keeping their own copy — a
  // prompt that drifts between training and serving is silent quality loss.
  writeFileSync(resolve(OUT, 'system-prompt.txt'), SYSTEM_PROMPT + '\n');

  write('train.jsonl', fit);
  write('valid.jsonl', valid);
  // MLX reads test.jsonl when asked to run a test pass; point it at the
  // holdout so `--test` reports the number that actually matters.
  write('test.jsonl', holdout);

  const bands = (rs: Rec[]) =>
    [...rs.reduce((m, r) => m.set(r.verdict.category, (m.get(r.verdict.category) ?? 0) + 1), new Map<string, number>())]
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join('  ');

  console.log(`\nWrote MLX chat-format data to ${OUT}`);
  console.log(`  train.jsonl  ${fit.length}   ${bands(fit)}`);
  console.log(`  valid.jsonl  ${valid.length}   ${bands(valid)}`);
  console.log(`  test.jsonl   ${holdout.length}   ${bands(holdout)}  (holdout — untouched by training)`);
  console.log('');
}

main();

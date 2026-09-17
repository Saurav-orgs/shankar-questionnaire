/**
 * Compact digest of dataset records, for authoring — plan.md §9, Phase 5a.
 *
 * A rendered model input runs ~60 lines, most of it red-flag questions answered
 * "No". Authoring hundreds of summaries against the full text is slow and makes
 * the salient facts easy to miss. This prints only what varies: the positives,
 * the verdict, and anything a summary would actually mention.
 *
 * Not used at training or inference — an authoring aid only.
 *
 * Usage:
 *   npm --prefix api run digest -- --unauthored --limit 40
 *   npm --prefix api run digest -- --rule GREY_HIP
 *   npm --prefix api run digest -- --id grey_hip-004
 */

import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../..');
const DATASET = resolve(ROOT, 'training-data/dataset.jsonl');
const AUTHORED_DIR = resolve(ROOT, 'training-data/authored');

interface Rec {
  id: string;
  targetRule: string;
  language: string;
  freeTextScript: string | null;
  firedRules: string[];
  verdict: { category: string; urgency: string; pathway: string };
  input: string;
}

/** Answers worth repeating in a summary. Everything else is a negative. */
const INTERESTING = [
  'How long have you had this pain?',
  'How did it start?',
  'How bad is the pain right now?',
  'How far down does the pain travel?',
  'How far down the arm does the pain go?',
  'Which side?',
  'How far can you walk before the pain stops you?',
  'When leg pain stops you walking, what makes it settle?',
  'Can you do your normal work?',
  'Does the pain disturb your sleep?',
  'Do you need help with daily tasks such as dressing or bathing?',
  'Over the last month, how has it changed?',
  'What have you already tried?',
  'How long did you do physiotherapy?',
  'Did the treatment help?',
  'Have you had any scans for this problem?',
  'When was the most recent scan?',
  'Do you have any of these?',
  'Are you pregnant?',
];

/** Yes/no questions only worth printing when the answer is yes. */
const POSITIVE_ONLY = /\?\s*(Yes|Not sure)$/;

function authoredIds(): Set<string> {
  const ids = new Set<string>();
  for (const file of readdirSync(AUTHORED_DIR).filter((f) => f.endsWith('.json'))) {
    const parsed = JSON.parse(
      readFileSync(resolve(AUTHORED_DIR, file), 'utf8'),
    ) as Record<string, unknown>;
    for (const id of Object.keys(parsed)) {
      if (!id.startsWith('_')) ids.add(id);
    }
  }
  return ids;
}

function digest(rec: Rec): string {
  const lines = rec.input.split('\n');
  const out: string[] = [];

  const snapshot = lines[1] ?? '';
  const complaint = lines
    .filter((l) => l.startsWith('Main complaint:') || l.startsWith('Also reported:'))
    .join(' | ');

  out.push(`── ${rec.id}  [${rec.verdict.category}/${rec.verdict.urgency}]`);
  out.push(`   ${snapshot}`);
  if (complaint) out.push(`   ${complaint}`);
  out.push(`   pathway: ${rec.verdict.pathway}`);

  const notable: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith('Have') && !line.includes('?')) continue;
    const isInteresting = INTERESTING.some((q) => line.startsWith(q));
    if (isInteresting || POSITIVE_ONLY.test(line)) notable.push(line);
  }
  if (notable.length) {
    out.push('   answers:');
    for (const n of notable) out.push(`     ${n}`);
  }

  const ftIndex = rec.input.indexOf('FREE TEXT');
  if (ftIndex >= 0) {
    const block = rec.input.slice(ftIndex, rec.input.indexOf('\nTRIAGE'));
    out.push(`   free text (${rec.freeTextScript}):`);
    for (const l of block.split('\n')) {
      if (l.trim() && !l.startsWith('FREE TEXT')) out.push(`     ${l.trim()}`);
    }
  }

  const matched = rec.input
    .split('Matched rules:')[1]
    ?.split(/Red flags|Advisory notes|INCONSISTENCIES/)[0];
  if (matched) {
    out.push('   matched:');
    for (const l of matched.split('\n')) {
      if (l.trim().startsWith('-')) out.push(`     ${l.trim().split(':')[0]}`);
    }
  }

  if (rec.input.includes('Red flags reported:')) {
    const rf = rec.input
      .split('Red flags reported:')[1]
      .split(/Advisory notes|INCONSISTENCIES|$/)[0];
    out.push('   RED FLAGS POSITIVE:');
    for (const l of rf.split('\n')) if (l.trim().startsWith('-')) out.push(`     ${l.trim()}`);
  }

  for (const section of ['Advisory notes:', 'INCONSISTENCIES FLAGGED']) {
    if (!rec.input.includes(section)) continue;
    const body = rec.input.split(section)[1].split(/\n[A-Z]{3,}/)[0];
    out.push(`   ${section.replace(':', '').toLowerCase()}:`);
    for (const l of body.split('\n')) if (l.trim().startsWith('-')) out.push(`     ${l.trim()}`);
  }

  return out.join('\n');
}

function main() {
  const argv = process.argv.slice(2);
  const flag = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  const records = readFileSync(DATASET, 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l) as Rec);

  const done = authoredIds();
  let selected = records;

  if (argv.includes('--unauthored')) selected = selected.filter((r) => !done.has(r.id));
  const rule = flag('--rule');
  if (rule) selected = selected.filter((r) => r.targetRule === rule);
  const id = flag('--id');
  if (id) selected = selected.filter((r) => r.id === id);
  const script = flag('--script');
  if (script) selected = selected.filter((r) => r.freeTextScript === script);
  const band = flag('--band');
  if (band) selected = selected.filter((r) => r.verdict.category === band);

  // Spread across rules rather than taking the first N, which would otherwise
  // return sixteen variants of the same case.
  if (argv.includes('--spread')) {
    const seen = new Map<string, Rec[]>();
    for (const r of selected) {
      const list = seen.get(r.targetRule) ?? [];
      list.push(r);
      seen.set(r.targetRule, list);
    }
    const rotated: Rec[] = [];
    for (let i = 0; ; i++) {
      const round = [...seen.values()].map((l) => l[i]).filter(Boolean);
      if (!round.length) break;
      rotated.push(...round);
    }
    selected = rotated;
  }

  const limit = Number(flag('--limit') ?? selected.length);
  selected = selected.slice(0, limit);

  for (const rec of selected) console.log(digest(rec) + '\n');
  console.error(`${selected.length} record(s); ${done.size} already authored.`);
}

main();

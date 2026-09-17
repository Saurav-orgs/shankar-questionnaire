# Training data

Dataset for the on-device summary model — see `plan.md` §9 and Phase 5a.

`dataset.jsonl` is **generated**, not hand-edited. Regenerate with:

```bash
npm --prefix api run generate:dataset
```

Options: `--per-case N` (default 16) and `--out PATH`.

## How it is built

`api/src/training/` holds three files:

| File | What it is |
|---|---|
| `cases.ts` | 28 seed patients, at least one per triage rule |
| `free-text.ts` | Free-text pools in English, Hinglish and Devanagari |
| `generate-dataset.ts` | Expands the seeds and writes the JSONL |

The generator runs offline and imports the **same** evaluator, schema and rules
the server runs, so a record's `input` is byte-identical to what production
will send the model. Driving the live API would give the same answers far more
slowly and would need the database up.

Every variant is checked: if a seed case stops firing its own target rule, the
generator prints the failures and exits non-zero rather than quietly writing a
dataset with a rule missing.

## Record shape

```jsonc
{
  "id": "amber_stenosis-004",
  "targetRule": "AMBER_STENOSIS",   // rule the case was written to fire
  "language": "hi",                  // form language
  "freeTextScript": "hinglish",      // english | hinglish | devanagari | null
  "firedRules": ["AMBER_STENOSIS", "ADVISORY_FREE_TEXT"],
  "verdict": { "category": "AMBER", "urgency": "routine", "pathway": "..." },
  "completeness": 1,
  "input": "PATIENT\n62y, female, ...",   // exactly what the model receives
  "templateSummary": "62y female...",      // deterministic summary, for reference
  "output": null                           // ← authored, this is the target
}
```

A rule higher in severity than the target may win the verdict; that is realistic
and recorded in `firedRules`. The only failure condition is the target not
firing at all.

## Authoring the `output`

This is the remaining work in Phase 5a. Each `output` is the summary the model
should produce for that `input`, in four sections — *Snapshot*, *Key findings*,
*Supporting the triage verdict*, *What the doctor may want to ask* — under 150
words, obeying the five constraints in `plan.md` §9.

`templateSummary` is a starting point for the factual content. It is **not** the
target: it only restates answers, and the section the model exists to produce —
what to ask — is absent from it.

Points to hold to while authoring:

- **Never restate or contradict the verdict.** Category, urgency and pathway are
  rendered by application code. The prose refers to findings, not to the band.
- **Never introduce anything not in the input.** No inferred diagnoses, no
  symptoms the patient did not report.
- **Hinglish free text is rendered in English** and marked *(translated)*.
- **`INCONSISTENCIES FLAGGED`, when present, belongs in what-to-ask.** An answer
  that disagrees with another answer is exactly what a consult should resolve.

## Current composition

448 records from 28 seed cases, 16 variants each.

| Axis | Split |
|---|---|
| Verdict | RED 128 · AMBER 128 · GREY 96 · GREEN 96 |
| Form language | English 242 · Hindi 206 |
| Free text | none 230 · Hinglish 112 · English 60 · Devanagari 46 |
| Contradictions | 32 records, covering all four reachable checks |

Script is sampled independently of form language, and weighted toward Hinglish:
it is the capability the fine-tune exists to add, and the compatibility gate in
`free-text.ts` rejects more Hinglish notes than English ones, so uniform
sampling would under-represent it.

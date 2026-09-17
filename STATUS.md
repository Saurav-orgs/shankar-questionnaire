# Status

Tracking checkpoints for the Spine Patient Filter build. Updated 12 August 2026.

See `plan.md` for the specification and `FEATURES-REPORT.md` for the manager-facing summary.

---

## Shipped

| Phase | What | State |
|---|---|---|
| 0 | Scaffold, DB connection, CORS, health check | Done |
| 1 | Migrations, models, questionnaire v1 seed | Done |
| 2 | Questionnaire API + branching evaluator | Done |
| 3 | patient-web flow, both languages | Done |
| 4 | Rules engine, 26 rules, fixture suite | Done |
| 6 | doctor-web panel, passcode, decision capture | Done |
| 7 | Demo readiness, audit logging | Done |

**119 automated tests passing.** Build clean.

---

## Phase 5 — AI summary

The one specified feature not finished. Split into 5a (build the training set) and
5b (train and ship the model). No third-party service in either; nothing is
purchased.

### 5a — Training set

| # | Checkpoint | State |
|---|---|---|
| — | Synthetic patient generator across all 26 rules | **Done** |
| — | Hinglish / Devanagari / English free-text pools | **Done** |
| — | Model input renderer shared with production | **Done** |
| — | Dataset generated — 448 records, 26/26 rules | **Done** |
| — | Merge + constraint validation tooling | **Done** |
| — | Digest tool for authoring | **Done** |
| 1 | Author the summaries — **150 done**, 26/26 rules | **Done** |
| 2 | Split into train / holdout / unseen | **Done** |

**Phase 5a is complete.** 150 authored across 11 batches in
`training-data/authored/`, ages 22–80, bands even (GREY 40 · GREEN 38 ·
RED 36 · AMBER 36).

Split: **train 120 · holdout 30 · unseen 298**. All 26 rules appear in
training; no id appears in two splits.

The holdout takes the highest-index variants within each seed case, so it
measures **adherence** — format, voice, constraint-following on a pattern the
model has learned — not generalisation to new clinical patterns. That is the
right question here: the rule set is fixed and enumerable, so every pattern the
product will meet is in training by construction. `unseen.jsonl` carries the
298 unauthored records; they have no reference output, but the five mechanical
constraints can be checked on genuinely novel inputs, and that is the honest
generalisation signal.

Each authored record's input is fingerprinted in
`training-data/authored/input-hashes.json`. Regenerating the dataset can hand
an id different content — a changed sampler, an edited seed case — and the
summary would then describe a patient who no longer exists. The merge step
compares hashes and refuses to write on a mismatch. After re-reading and
re-authoring a drifted record, clear it with `--relock`.

**Authoring target is ~150, not all 448.** The merge step trains only on records
that have an authored output, so the dataset can stay at 448 while a well-chosen
subset carries the training. 150 diverse examples is enough for a model learning
format and voice on a task where the rules engine already makes every decision.
If the eval shows weak areas, the fix is more examples there specifically —
cheaper than authoring everything up front and discovering the gaps were
elsewhere.

```bash
npm --prefix api run generate:dataset      # rebuild the dataset
npm --prefix api run merge:dataset          # validate authored batches
npm --prefix api run merge:dataset -- --write
```

Dataset composition: RED 128 · AMBER 128 · GREY 96 · GREEN 96. Free text on 230
records — Hinglish 118, English 64, Devanagari 48. 32 records carry flagged
inconsistencies.

### 5b — Model

| # | Checkpoint | State |
|---|---|---|
| 4 | Five-constraint evaluation harness | **Done** |
| 3 | Hinglish bake-off — **Gemma 3 4B chosen** | **Done** |
| 5 | LoRA fine-tune of Gemma 3 4B on the M1 | **Done** |
| 6 | Wire local inference behind `TriageService` | **Done** |

**Phase 5b is complete.** Verified end to end: a real assessment submitted
through the live API, `summary_source` came back `ai`, `model` recorded
`mlx-community/gemma-3-4b-it-4bit`, band never named in the prose, a
Hinglish free-text note correctly marked `(translated)`. Killing the summary
model server (or setting `AI_SUMMARY_ENABLED=false`) makes it fall straight
back to the template — verified, not assumed.

**Running it:**

```bash
.venv/bin/python scripts/summary-server.py     # loads once, serves :8080
npm run dev                                     # api + patient-web + doctor-web
```

`api/src/triage/triage.service.ts` calls `POST /summarize` on
`SUMMARY_MODEL_URL` with the same `renderModelInput` used in training, and
validates the response with the *same* `checkConstraints` used to score the
holdout — the bar a live summary has to clear is exactly the bar training
data was held to, not a separate reimplementation. Any failure — model down,
timeout, a constraint violation — falls back to the deterministic template
and logs a `warn`, never a thrown error; submission always succeeds.

**The 15 s timeout in plan.md §9 was never achievable and is now 30 s.**
Timed directly against the server: a realistic full patient record takes
~16.5 s of generation alone, already past the original figure before
counting scheduling or a slow moment. 15 s was written before the model
existed to measure against.

`classifyFreeTextScript` (`api/src/triage/free-text-script.ts`) is the one
piece with no training-time equivalent: production doesn't get to label a
patient's free text `hinglish`/`devanagari`/`english` the way authored
training data did, so it infers the script from the text itself — Devanagari
Unicode range, or two-plus Romanised Hindi function words — conservatively,
because a missed classification only skips one check, while a wrong one
could fail a correct summary.

**Fine-tune result — 600 iterations, resumed twice across interruptions, no data lost.**
Scored on the 30-record holdout, never seen during training:

| | Baseline (untrained) | Fine-tuned |
|---|---|---|
| Clean | 8/30 (26.7%) | **29/30 (96.7%)** |
| Unmarked translation | 12 | 0 |
| Verdict band leaked into prose | 2 | 0 |
| Over the 150-word cap | 10 | 1 |
| Hallucinated finding | 0 | 0 |

One residual failure: a single AMBER record 12 words over cap from genuine
verbosity (near-duplicate phrasing), not a safety issue.

**A decoding bug surfaced in eval, not training.** Greedy decoding has no
defense against loops — three holdout records degenerated into repeating a
phrase ("walking still unrestricted" x11, a fabricated exam name x15) until
they blew the word cap. Repetition penalty was tried as the standard fix and
made things *worse* (90% → 70%): it penalises legitimate short-range
repeats — the `(translated)` marker, section headers — far more often than
it catches a real loop. Fixed instead with a deterministic post-process
(`dedupe_repeats` in `scripts/run-summaries.py`) that drops a clause or line
only once it has repeated more than twice, leaving correct output
untouched — 27/30 → 29/30.

**Base model: Gemma 3 4B**, settled by bake-off — 78.8% Hinglish fact recall
against Qwen 3 4B's 68.6%. Qwen 3 **8B was worse** (66.0%), so the failure was
not capacity: both Qwen sizes echo Roman-script Hinglish back untranslated.
Full results and surviving failures: `training-data/bakeoff/RESULTS.md`.

**Baseline before training — 8/30 clean (26.7%)** on the holdout. Failures were
`unmarked_translation` 12, `length` 10, `verdict_leak` 2, and **zero
hallucinated findings**. The gap is formatting discipline, which is what a
fine-tune fixes cheaply.

**The M1 is at its limit.** Two runs died before one held:

| Attempt | Config | Outcome |
|---|---|---|
| 1 | 8 LoRA layers, 14 val batches | Thrashing — 8.7 min per validation, 14GB of 15GB swap |
| 2 | 4 layers, adafactor, grad-checkpoint | Killed by the macOS GPU watchdog (`Impacting Interactivity`) |
| 3 | **2 layers, no grad-checkpoint, 2 val batches** | **Stable — 6.5GB peak** |

Grad checkpointing was the wrong lever: it trades memory for longer GPU
kernels, and long kernels are exactly what the watchdog kills. Fewer LoRA
layers was the right one.

Cost: ~31s per iteration, so 600 iterations is roughly **5 hours**. Two LoRA
layers is few, but the gap being closed is surface format — translation
marking, length, band leakage — not new capability, and that is what the
shallowest adapters handle.

```bash
npm --prefix api run evaluate -- --self                  # score the authored set
npm --prefix api run evaluate -- --self --split holdout
npm --prefix api run evaluate -- --predictions preds.jsonl
```

The harness scores all five constraints mechanically. Constraint 2 — no
invented findings — is checkable because the input is rendered from a fixed
question bank: a claim in the output maps to the question that would have to
support it, and that question's answer is in the input. Asserting leg weakness
against a form recording "no" is a hallucination, detectably.

Constraints 2 and 3 are scored only on the three assertive sections. The
questions section is interrogative — asking about a symptom the form does not
record is the point of it, not a violation.

Authored set scores **150/150**, holdout **30/30**. That number only means
something because 17 negative tests in `constraints.spec.ts` prove the checker
can fail: one per constraint, plus the false-positive cases it was corrected
for, pinned so they cannot regress.

**Remaining for 5b:** wire this into `TriageService` behind the existing call
site, with the template as fallback. **Done when** a summary generates
on-device with no network call and pulling the network changes nothing.

The deterministic template ships throughout, so the doctor panel has never
been without a summary at any point in this build.

---

## Blocking, not code

| # | Checkpoint | State |
|---|---|---|
| 7 | Clinical review of the 26 rules with the surgeon | Not started |

This gates the training run. The model learns from summaries derived from these
rules, so a rule that changes after training means a retrain rather than a
one-line fix. `plan.md` §14 has the question list. Needs the doctor, not code.

---

## Queued

| # | Checkpoint | State |
|---|---|---|
| 8 | Voice mode for the patient questionnaire | Blocked by 6 |

Agreed to sit after Phase 5. Mode selection at the start, pre-recorded human
audio (~140 clips), synonym matching for the 57 closed-vocabulary questions,
read-back confirmation on every answer. ~2 weeks plus a recording session, which
is worth booking early since it needs a person and a mic.

Note: voice mode will be **slower** than tapping, because every answer needs
confirming. The 5–7 minute target in §1 will not hold there. Its value is
reaching patients who cannot read or type.

---

## Known gaps

- Clinical logic unreviewed — checkpoint 7 above, and the highest risk in the build
- No regression tests on patient-web navigation (the branching evaluator itself is covered)
- Back button history is in-memory; resets on reload. Resuming a saved link always works.
- Passcode auth only; DPDP, encryption and retention deferred — `plan.md` §15

## Environment note

`api/.env`, `patient-web/.env` and `doctor-web/.env` point at **localhost**. The
dev tunnel URLs are kept as comments in each file. Tunnel IDs change on every
restart, so those need updating rather than just uncommenting.

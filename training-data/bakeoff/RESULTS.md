# Hinglish comprehension bake-off — results

Phase 5b, checkpoint 3. Run 12 August 2026 on the M1, MLX, 4-bit quantised,
zero-shot. 50 samples, 156 expected facts.

Reproduce:

```bash
.venv/bin/python scripts/run-bakeoff.py --model mlx-community/gemma-3-4b-it-4bit
npm --prefix api run score:bakeoff -- --renderings training-data/bakeoff/renderings/gemma-3-4b-it-4bit.jsonl --verbose
```

## Scores

| Model | Fact recall | Untranslated | Inversions | Speed |
|---|---|---|---|---|
| **Gemma 3 4B it** | **123/156 (78.8%)** | **2** | 0 | 1.9s/sample |
| Qwen 3 4B | 107/156 (68.6%) | 5 | 0 | 2.8s/sample |
| Qwen 3 8B | 103/156 (66.0%) | 8 | 0 | 3.5s/sample |

**Decision: Gemma 3 4B.** Best on every axis, and the fastest.

## Size did not help — the failure is not capacity

Qwen 3 **8B scored worse than 4B**, with more untranslated samples. Both models
treat Roman-script Hinglish as if it were already English and pass it through.
8B does it more confidently, which is worse: it prefixes the untranslated text
with *"The patient's note is translated as:"*.

That rules out the obvious escalation. Moving to a bigger Qwen would cost
~12–14GB peak for a LoRA against 16GB of unified memory — and buy nothing.

## Why "untranslated" is tracked separately from recall

The first scoring run reported **0 inversions** while `hg-023` — the bladder
incontinence sample, the most urgent red flag in the instrument — sat
completely untranslated. Untranslated text cannot contain the phrase *"no
urinary symptoms"*, so the inversion check passed it silently.

A model that echoes the input scores low on recall and clean on inversions,
which reads as "weak but honest". It is neither: the doctor sees raw Hinglish
where English was promised. Passthrough is now detected by word overlap with
the source (≥60%).

## Failures that survive in the chosen model

Gemma 3 4B is the best candidate, not a clean one. These are on the record so
they can be re-checked after fine-tuning:

| Sample | Source | Gemma rendering | Problem |
|---|---|---|---|
| `hg-023` | *susu control nahi hota* | "control over their **bowel** movements" | Wrong organ — urinary rendered as bowel. Both are cauda equina red flags so routing survives, but the fact is wrong. |
| `hg-041` | *pair bilkul uth nahi raha, ghisat ke chal raha hoon* | "not able to walk at all today… appearing distressed" | Foot drop lost. "Appearing distressed" is **added** — not in the source. |
| `hg-037` | *kandhe se neeche haath tak* | "below the **collarbone**" | Shoulder rendered as collarbone. The discriminator ("not reaching the fingers") did survive. |

It reads the single most important discriminator correctly: `hg-027`, *sitting
relieves but standing does not*, came back exactly right. That is the fact that
separates spinal from vascular claudication.

## What this changes about the fine-tune

The working assumption was that fine-tuning teaches format cheaply but cannot
cheaply teach a language the base lacks — so the base must already read
Hinglish. That still holds, and it is why Qwen is out: a model that passes text
through has nothing to sharpen.

Gemma is different. It **translates 48 of 50** and gets most facts; the errors
are precision errors, not comprehension absence. That is the case fine-tuning
can improve, because the training set contains the exact pairs — Hinglish note
in, English rendering out — that these failures need.

**Consequence for the training data:** the three failures above should become
seed cases in their own right, so the fine-tune sees them and the eval catches
a regression.

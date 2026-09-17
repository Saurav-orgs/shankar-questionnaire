#!/usr/bin/env python3
"""Generate summaries with the base or fine-tuned model — plan.md §9, Phase 5b.

Writes JSONL of {id, output} for `npm --prefix api run evaluate -- --predictions`.

Run it once without --adapter to get a baseline, then again with the trained
adapter. Without the baseline there is nothing to compare the fine-tune against,
and "the model produces summaries" is not the same claim as "the fine-tune
helped".

Usage:
    .venv/bin/python scripts/run-summaries.py --split holdout --out preds-base.jsonl
    .venv/bin/python scripts/run-summaries.py --split holdout \\
        --adapter training-data/mlx/adapters --out preds-tuned.jsonl
"""

import argparse
import json
import pathlib
import re
import sys
import time
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "training-data"
MLX = DATA / "mlx"

DEFAULT_MODEL = "mlx-community/gemma-3-4b-it-4bit"


def dedupe_repeats(text: str, max_repeats: int = 2) -> str:
    """Drop clauses and lines once they've repeated `max_repeats` times.

    Greedy decoding has no built-in defense against looping, and on a sparse
    case (little to report) the model can fall into repeating the same
    clause or bullet verbatim until it hits the token limit — seen on
    holdout as "walking still unrestricted" x11 (repeats within one
    semicolon-joined bullet) and a fabricated exam name repeated x15
    (repeats as separate whole lines), both in the same run that scored
    27/30 clean on every other constraint.

    Surgical on purpose: an earlier version truncated the entire rest of the
    document at the first excess repeat, which silently deleted the two
    sections that came after it in one case — trading a length violation for
    a worse structure violation. This instead removes only the repeated
    clause or line and keeps generating the document around it, so content
    that was never part of the loop survives untouched.

    A clause can legitimately appear twice (once in Key findings, once in
    Supporting the verdict); a third repeat is always noise, never content —
    which is also why this beat a repetition-penalty fix at the sampling
    level (see --repetition-penalty): that penalises every reused token
    equally, including a legitimate second mention, where this only ever
    removes an exact match past the count that's actually normal.
    """
    seen: Counter = Counter()
    out_lines = []

    for line in text.split('\n'):
        kept_clauses = []
        for clause in line.split(';'):
            key = re.sub(r'[^a-z0-9 ]', '', clause.strip().lower())
            key = re.sub(r'\s+', ' ', key).strip()
            if len(key) < 8:  # too short to be a meaningful repeated claim
                kept_clauses.append(clause)
                continue
            seen[key] += 1
            if seen[key] <= max_repeats:
                kept_clauses.append(clause)
            # else: drop this repeated clause, keep scanning the rest of the line

        new_line = ';'.join(kept_clauses)
        # A line that was one clause, now fully removed, would otherwise
        # survive as a bare "- " bullet with nothing after it.
        if new_line.strip() and new_line.strip('- *'):
            out_lines.append(new_line)

    return '\n'.join(out_lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--adapter", default=None, help="path to trained LoRA adapters")
    ap.add_argument("--split", default="holdout", help="holdout | train | unseen")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--max-tokens", type=int, default=400)
    ap.add_argument(
        "--repetition-penalty",
        type=float,
        default=0.0,
        help="Off by default. Tried as a fix for occasional generation loops "
        "('walking still unrestricted' x11) — measured worse on holdout at "
        "every value tried (1.1, 1.3): it penalises legitimate short-range "
        "repeats — the '(translated)' marker, section headers, a red-flag "
        "term the summary needs to name — far more often than it catches a "
        "real loop. dedupe_repeats() below handles loops instead, as a "
        "deterministic post-process that can't touch correct output.",
    )
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    try:
        from mlx_lm import load, generate
        from mlx_lm.sample_utils import make_repetition_penalty, make_sampler
    except ImportError:
        print("mlx-lm not installed. Run: .venv/bin/pip install mlx-lm", file=sys.stderr)
        return 1

    sampler = make_sampler(temp=0.0)
    logits_processors = (
        [make_repetition_penalty(args.repetition_penalty)]
        if args.repetition_penalty > 0
        else None
    )

    system_prompt = (MLX / "system-prompt.txt").read_text().strip()

    records = [
        json.loads(line)
        for line in (DATA / f"{args.split}.jsonl").read_text().strip().split("\n")
        if line
    ]
    if args.limit:
        records = records[: args.limit]

    print(f"loading {args.model}" + (f" + {args.adapter}" if args.adapter else " (base)"), flush=True)
    t0 = time.time()
    model, tokenizer = load(
        args.model,
        adapter_path=args.adapter if args.adapter else None,
    )
    print(f"loaded in {time.time() - t0:.0f}s", flush=True)

    results = []
    started = time.time()

    for i, rec in enumerate(records, 1):
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": rec["input"]},
        ]

        # Gemma's chat template has no system role; fold the system prompt into
        # the first user turn rather than dropping it, which is what a naive
        # apply_chat_template would do silently.
        try:
            prompt = tokenizer.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=True
            )
        except Exception:
            merged = [{"role": "user", "content": system_prompt + "\n\n" + rec["input"]}]
            prompt = tokenizer.apply_chat_template(
                merged, tokenize=False, add_generation_prompt=True
            )

        text = generate(
            model,
            tokenizer,
            prompt=prompt,
            max_tokens=args.max_tokens,
            verbose=False,
            sampler=sampler,
            logits_processors=logits_processors,
        )

        if "</think>" in text:
            text = text.split("</think>", 1)[1]
        text = dedupe_repeats(text)

        results.append({"id": rec["id"], "output": text.strip()})
        print(
            f"  [{i}/{len(records)}] {rec['id']}  ({(time.time() - started) / i:.1f}s/rec)",
            flush=True,
        )

    out_path = pathlib.Path(args.out)
    if not out_path.is_absolute():
        out_path = ROOT / out_path
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(json.dumps(r) for r in results) + "\n")

    print(f"\nwrote {len(results)} predictions to {out_path}")
    print(f"score with: npm --prefix api run evaluate -- --predictions {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Render the Hinglish bake-off samples with a candidate base model.

Phase 5b, step 3 — plan.md §9. Produces JSONL of {id, output} for
`npm --prefix api run score:bakeoff` to score.

The prompt is deliberately bare. This measures what the *base* model already
understands, before any fine-tuning: if a model needs coaching to read
Hinglish, the fine-tune would be teaching it the language rather than the
format, and that is the expensive kind of teaching.

Usage:
    .venv/bin/python scripts/run-bakeoff.py --model mlx-community/Qwen3-4B-4bit
    .venv/bin/python scripts/run-bakeoff.py --model <repo> --limit 5   # smoke test
"""

import argparse
import json
import pathlib
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
SET = ROOT / "training-data" / "bakeoff" / "hinglish-comprehension.json"
OUT_DIR = ROOT / "training-data" / "bakeoff" / "renderings"

PROMPT = (
    "Translate this patient's note into English.\n"
    "Keep every detail. Do not add anything that is not there. "
    "Do not give advice.\n\n"
    "Note: {text}\n\n"
    "English:"
)


# Instruction fragments some models echo back before answering. Stripping them
# is normalisation, not scoring help: none of them contain a fact keyword, but
# leaving them in makes the renderings unreadable when reviewing by eye.
ECHOES = (
    "Keep every detail. Do not add anything that is not there. Do not give advice.",
    "Translate this patient's note into English.",
    "English:",
)


def clean(text: str) -> str:
    for echo in ECHOES:
        text = text.replace(echo, " ")
    # Models that restate the label before the translation.
    if "Note:" in text:
        text = text.split("Note:", 1)[1]
    return " ".join(text.split())


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, help="HF repo id, e.g. mlx-community/Qwen3-4B-4bit")
    ap.add_argument("--limit", type=int, default=0, help="render only the first N samples")
    ap.add_argument("--max-tokens", type=int, default=400)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    try:
        from mlx_lm import load, generate
    except ImportError:
        print("mlx-lm not installed. Run: .venv/bin/pip install mlx-lm", file=sys.stderr)
        return 1

    samples = json.loads(SET.read_text())["samples"]
    if args.limit:
        samples = samples[: args.limit]

    slug = args.model.rstrip("/").split("/")[-1].lower()
    out_path = pathlib.Path(args.out) if args.out else OUT_DIR / f"{slug}.jsonl"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"loading {args.model} ...", flush=True)
    t0 = time.time()
    model, tokenizer = load(args.model)
    print(f"loaded in {time.time() - t0:.0f}s", flush=True)

    results = []
    truncated = 0
    started = time.time()

    for i, sample in enumerate(samples, 1):
        prompt = PROMPT.format(text=sample["text"])

        # Chat template where the model has one; a base model without a
        # template gets the raw prompt rather than a fabricated one.
        #
        # `enable_thinking=False` matters more than it looks. Qwen 3 is a
        # reasoning model: left alone it spends the whole token budget inside a
        # <think> block deliberating about the instructions and never reaches
        # the translation. Templates that don't take the kwarg ignore it.
        if getattr(tokenizer, "chat_template", None):
            messages = [{"role": "user", "content": prompt}]
            try:
                prompt = tokenizer.apply_chat_template(
                    messages,
                    tokenize=False,
                    add_generation_prompt=True,
                    enable_thinking=False,
                )
            except TypeError:
                prompt = tokenizer.apply_chat_template(
                    messages, tokenize=False, add_generation_prompt=True
                )

        text = generate(
            model,
            tokenizer,
            prompt=prompt,
            max_tokens=args.max_tokens,
            verbose=False,
        )

        # Reasoning models emit a think block before the answer.
        #
        # An *unclosed* block means generation ran out of budget mid-thought,
        # so there is no rendering at all. Recording the deliberation as the
        # rendering would let the scorer credit facts the model happened to
        # mention while reasoning — inflating a model that never answered.
        # Record it as empty and count it, loudly.
        if "</think>" in text:
            text = text.split("</think>", 1)[1]
        elif "<think>" in text:
            truncated += 1
            text = ""

        results.append({"id": sample["id"], "output": clean(text)})
        elapsed = time.time() - started
        print(
            f"  [{i}/{len(samples)}] {sample['id']}  ({elapsed / i:.1f}s/sample)",
            flush=True,
        )

    out_path.write_text("\n".join(json.dumps(r) for r in results) + "\n")
    print(f"\nwrote {len(results)} renderings to {out_path}")
    if truncated:
        print(
            f"WARNING: {truncated}/{len(results)} runs never finished thinking and "
            f"produced no rendering.\n"
            f"         Raise --max-tokens or check that thinking is disabled; "
            f"the score below is not usable as it stands."
        )
    print(f"score with: npm --prefix api run score:bakeoff -- --renderings {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

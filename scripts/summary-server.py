#!/usr/bin/env python3
"""On-device summary model server — plan.md §9, Phase 5b.

Loads the base model plus the trained LoRA adapter once at startup, then
serves POST /summarize over plain HTTP on localhost. No framework dependency
beyond mlx-lm — the venv already has everything this needs, and a POC serving
one local client doesn't need more than the standard library gives it.

The doubled dedupe_repeats() here (also in scripts/run-summaries.py) is a
known duplication, not an oversight: the eval pipeline and the server have
different dependency footprints — the eval script imports freely from
anywhere in scripts/, but this server should stay import-light so a stray
break in an unrelated script can't take the running service down with it. If
this drifts from the copy in run-summaries.py, re-sync it — the fixture that
would catch drift is scripts/run-summaries.py's own eval run.

Usage:
    .venv/bin/python scripts/summary-server.py
    .venv/bin/python scripts/summary-server.py --port 8080 --adapter training-data/mlx/adapters
"""

import argparse
import json
import pathlib
import re
import sys
import time
from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parent.parent
MLX = ROOT / "training-data" / "mlx"

DEFAULT_MODEL = "mlx-community/gemma-3-4b-it-4bit"
DEFAULT_ADAPTER = MLX / "adapters"
MAX_TOKENS = 400
# plan.md §9: "times out (>15 s)" is the caller's contract with TriageService,
# not this server's — the server has no request deadline of its own, because
# a request that's still running when the caller gives up should finish and
# get logged, not be killed mid-generation. TriageService owns the timeout.


def dedupe_repeats(text: str, max_repeats: int = 2) -> str:
    """Drop clauses and lines once they've repeated `max_repeats` times.

    See scripts/run-summaries.py for the full rationale — greedy decoding on
    a sparse case can loop ("walking still unrestricted" x11) until it blows
    the word cap, and this is the fix that survived: it removes only the
    repeated clause or line rather than truncating everything after it, so
    content that was never part of the loop is untouched.
    """
    seen: Counter = Counter()
    out_lines = []

    for line in text.split('\n'):
        kept_clauses = []
        for clause in line.split(';'):
            key = re.sub(r'[^a-z0-9 ]', '', clause.strip().lower())
            key = re.sub(r'\s+', ' ', key).strip()
            if len(key) < 8:
                kept_clauses.append(clause)
                continue
            seen[key] += 1
            if seen[key] <= max_repeats:
                kept_clauses.append(clause)

        new_line = ';'.join(kept_clauses)
        if new_line.strip() and new_line.strip('- *'):
            out_lines.append(new_line)

    return '\n'.join(out_lines)


class State:
    model = None
    tokenizer = None
    system_prompt = ""
    sampler = None
    ready = False


def build_prompt(user_input: str) -> str:
    messages = [
        {"role": "system", "content": State.system_prompt},
        {"role": "user", "content": user_input},
    ]
    try:
        return State.tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
    except Exception:
        merged = [{"role": "user", "content": State.system_prompt + "\n\n" + user_input}]
        return State.tokenizer.apply_chat_template(
            merged, tokenize=False, add_generation_prompt=True
        )


class Handler(BaseHTTPRequestHandler):
    # Quiets the default per-request access log line — the summary text
    # itself is patient data and does not belong in a log file by default.
    def log_message(self, fmt, *args):
        pass

    def _json(self, status: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._json(200, {"status": "ok" if State.ready else "loading"})
            return
        self._json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/summarize":
            self._json(404, {"error": "not found"})
            return
        if not State.ready:
            self._json(503, {"error": "model still loading"})
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length) or b"{}")
            user_input = body["input"]
        except (ValueError, KeyError, json.JSONDecodeError) as e:
            self._json(400, {"error": f"bad request: {e}"})
            return

        from mlx_lm import generate

        t0 = time.time()
        try:
            prompt = build_prompt(user_input)
            text = generate(
                State.model,
                State.tokenizer,
                prompt=prompt,
                max_tokens=MAX_TOKENS,
                verbose=False,
                sampler=State.sampler,
            )
        except Exception as e:
            self._json(500, {"error": f"generation failed: {e}"})
            return

        if "</think>" in text:
            text = text.split("</think>", 1)[1]
        text = dedupe_repeats(text).strip()

        self._json(200, {
            "output": text,
            "model": DEFAULT_MODEL,
            "adapter": str(State.adapter_path) if State.adapter_path else None,
            "generation_seconds": round(time.time() - t0, 2),
        })


State.adapter_path = None  # type: ignore[attr-defined]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--adapter", default=str(DEFAULT_ADAPTER))
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8080)
    args = ap.parse_args()

    try:
        from mlx_lm import load
        from mlx_lm.sample_utils import make_sampler
    except ImportError:
        print("mlx-lm not installed. Run: .venv/bin/pip install mlx-lm", file=sys.stderr)
        return 1

    adapter_path = pathlib.Path(args.adapter)
    has_adapter = adapter_path.exists() and (adapter_path / "adapters.safetensors").exists()

    print(f"loading {args.model}" + (f" + {adapter_path}" if has_adapter else " (base, no adapter found)"), flush=True)
    t0 = time.time()
    State.model, State.tokenizer = load(
        args.model, adapter_path=str(adapter_path) if has_adapter else None
    )
    State.system_prompt = (MLX / "system-prompt.txt").read_text().strip()
    State.sampler = make_sampler(temp=0.0)
    State.adapter_path = adapter_path if has_adapter else None
    State.ready = True
    print(f"loaded in {time.time() - t0:.0f}s — listening on http://{args.host}:{args.port}", flush=True)

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())

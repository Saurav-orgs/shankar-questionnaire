#!/usr/bin/env bash
# Resumable LoRA fine-tune of Gemma 3 4B — plan.md §9, Phase 5b.
#
# Re-runnable. Tracks cumulative iterations completed in a small state file
# and resumes from the last saved checkpoint with however many iterations
# remain, instead of restarting from iteration 0.
#
# Why this exists: the first attempt died when the machine rebooted — /tmp,
# where the log lived, gets cleared on boot, which is what actually killed it.
# Closing the lid alone does not kill the process; it sleeps the machine, which
# pauses everything including the training loop, and it continues on wake. The
# real risks are (a) a reboot/shutdown, and (b) the terminal session or app
# closing. This script defends against both: --save-every is frequent enough
# that a hard kill loses minutes, not hours, and every run picks up the
# cumulative count from the last one.
#
# Two things this got wrong on the first version, both fixed here:
#
# 1. `adapters.safetensors` is overwritten on *every* periodic save, not only
#    at genuine completion — mlx_lm's "Saved adapter weights to ... and
#    adapters.safetensors" fires at each --save-every boundary. Checking for
#    that file's existence to mean "training is done" made the script declare
#    victory after the very first checkpoint. Completion is now judged purely
#    by the iteration count in the state file against --iters.
#
# 2. mlx_lm's internal iteration counter restarts at 1 on every invocation,
#    --resume-adapter-file or not — so a numbered checkpoint filename
#    (0000060_adapters.safetensors) is relative to that run, not a cumulative
#    total. Reading it as a global count was only ever correct on the very
#    first run. Cumulative progress is now tracked explicitly in
#    adapters/.iters_done, and resuming always loads the plain
#    adapters.safetensors file, which mlx_lm overwrites in place on every
#    save and therefore always holds the true latest weights regardless of
#    which run produced them.
#
# Usage:
#   ./scripts/train-lora.sh              # start, or resume if interrupted
#   ./scripts/train-lora.sh --iters 900  # change the target iteration count

set -euo pipefail
cd "$(dirname "$0")/.."

MODEL="mlx-community/gemma-3-4b-it-4bit"
DATA_DIR="training-data/mlx"
ADAPTER_DIR="$DATA_DIR/adapters"
LOG="$DATA_DIR/train.log"
STATE_FILE="$ADAPTER_DIR/.iters_done"
ROLLING_WEIGHTS="$ADAPTER_DIR/adapters.safetensors"
TOTAL_ITERS=600

while [[ $# -gt 0 ]]; do
  case "$1" in
    --iters) TOTAL_ITERS="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

mkdir -p "$ADAPTER_DIR"

DONE=0
[[ -f "$STATE_FILE" ]] && DONE=$(cat "$STATE_FILE")

# A recorded DONE count with no weights to back it up is an inconsistent
# state (the file was deleted, or copied without its sibling) — there is
# nothing to resume from, so start over rather than pass a missing path to
# --resume-adapter-file and fail.
if (( DONE > 0 )) && [[ ! -f "$ROLLING_WEIGHTS" ]]; then
  echo "State file says $DONE iterations done, but $ROLLING_WEIGHTS is missing — resetting to 0." | tee -a "$LOG"
  DONE=0
fi

REMAINING=$(( TOTAL_ITERS - DONE ))
if (( REMAINING <= 0 )); then
  echo "$DONE/$TOTAL_ITERS iterations already done. Nothing to do — raise --iters to train further."
  exit 0
fi

if (( DONE > 0 )); then
  echo "Resuming from $ROLLING_WEIGHTS ($DONE/$TOTAL_ITERS done) — $REMAINING iterations remaining." | tee -a "$LOG"
  RESUME_ARGS=(--resume-adapter-file "$ROLLING_WEIGHTS")
else
  echo "No prior progress — starting fresh, $TOTAL_ITERS iterations." | tee -a "$LOG"
  RESUME_ARGS=()
fi

# --save-every 20 -> roughly every 10 minutes at ~31s/iter, so a hard kill
# between checkpoints loses at most ~10 minutes of progress, not hours.
#
# caffeinate -dims keeps the machine from idling to sleep on its own; it
# cannot override a physically closed lid (that needs clamshell mode with an
# external display, which this script does not assume). A lid-close sleep
# pauses the run safely — re-running this script after reopening resumes it.
RUN_MARKER="=== run start $(date '+%Y-%m-%d %H:%M:%S') (resuming from $DONE) ==="
echo "$RUN_MARKER" >> "$LOG"

set +e
caffeinate -dims .venv/bin/python -m mlx_lm lora \
  --model "$MODEL" \
  --train --data "$DATA_DIR" \
  --adapter-path "$ADAPTER_DIR" \
  --iters "$REMAINING" \
  --batch-size 1 \
  --num-layers 2 \
  --max-seq-length 1344 \
  --learning-rate 2e-5 \
  --optimizer adafactor \
  --mask-prompt \
  --steps-per-eval 300 \
  --save-every 20 \
  --val-batches 2 \
  ${RESUME_ARGS[@]+"${RESUME_ARGS[@]}"} \
  >> "$LOG" 2>&1
EXIT_CODE=$?
set -e

echo "$(date '+%Y-%m-%d %H:%M:%S') mlx_lm lora exited $EXIT_CODE" >> "$LOG"

# Credit this run's progress against a *saved checkpoint*, not the last
# printed loss line — those are the only iterations --resume-adapter-file can
# actually pick back up from. A line like "Iter 20: Saved adapter weights..."
# (periodic) or "Iter 600: Saved final weights..." (completion) both match.
THIS_RUN=$(awk -v marker="$RUN_MARKER" '
  $0 == marker { found=1; next }
  found && /^Iter [0-9]+: Saved/ { n=$2; sub(":", "", n); last=n }
  END { print last + 0 }
' "$LOG")

NEW_DONE=$(( DONE + THIS_RUN ))
echo "$NEW_DONE" > "$STATE_FILE"
echo "$(date '+%Y-%m-%d %H:%M:%S') progress: $DONE + $THIS_RUN = $NEW_DONE/$TOTAL_ITERS" >> "$LOG"

if (( NEW_DONE >= TOTAL_ITERS )); then
  echo "Training complete: $NEW_DONE/$TOTAL_ITERS iterations." | tee -a "$LOG"
elif (( EXIT_CODE != 0 )); then
  echo "Run exited with an error after $THIS_RUN new iterations ($NEW_DONE/$TOTAL_ITERS total). Re-run this script to resume." | tee -a "$LOG"
  exit "$EXIT_CODE"
else
  echo "Run ended after $THIS_RUN new iterations ($NEW_DONE/$TOTAL_ITERS total). Re-run this script to resume." | tee -a "$LOG"
fi

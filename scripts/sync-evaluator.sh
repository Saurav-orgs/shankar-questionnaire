#!/usr/bin/env bash
#
# Copies the questionnaire evaluator from api/ into patient-web/.
#
# There is no shared package (no monorepo), so these files are duplicated on
# purpose. api/ is the source of truth; patient-web/ is a copy. Run this after
# any change to the evaluator, its types, or its fixtures — then run the tests
# on both sides.
#
# The copies are checked in, so `--check` in CI (or before a demo) tells you
# whether they have drifted.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/api/src/questionnaire"
DEST="$ROOT/patient-web/src/questionnaire"

FILES=(types.ts evaluator.ts evaluator.fixtures.ts)

if [[ "${1:-}" == "--check" ]]; then
  status=0
  for file in "${FILES[@]}"; do
    if ! diff -q "$SRC/$file" "$DEST/$file" >/dev/null 2>&1; then
      echo "DRIFT: $file differs between api/ and patient-web/"
      status=1
    fi
  done
  if [[ $status -eq 0 ]]; then
    echo "Evaluator copies are in sync."
  fi
  exit $status
fi

mkdir -p "$DEST"
for file in "${FILES[@]}"; do
  cp "$SRC/$file" "$DEST/$file"
  echo "synced $file"
done

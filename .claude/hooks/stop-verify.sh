#!/usr/bin/env bash
# Stop hook (replaces post-edit-verify.sh, which ran the whole e2e suite after EVERY single edit).
# Runs when Claude finishes a turn, and only if something that can cause a regression changed since the last green run:
#   - src/, public/mock-data/, test-data/, e2e/, package.json, tsconfig, next/playwright config  → tsc + the FULL suite
#   - only spec files changed                                                                    → tsc + just those specs
#   - docs, report-ui/, anything else                                                            → nothing runs
# A red result blocks the stop (exit 2: the output goes back to Claude to fix), at most 3 times in a row so it can't loop.
# When source changed but no spec did, it asks once for a test (or a one-line reason why none is needed).
# Set HOOK_TEST_CMD to replace the test command (used to try the hook itself).
cd "$(dirname "$0")/../.." || exit 0

STATE=.claude
LAST_GREEN="$STATE/.last-green"; ATTEMPTS="$STATE/.stop-attempts"; NUDGED="$STATE/.nudged"
WATCH=(src tests e2e public/mock-data test-data package.json tsconfig.json next.config.ts playwright.config.ts playwright.prod.config.ts)

changed=$( { git diff --name-only HEAD -- "${WATCH[@]}"; git ls-files --others --exclude-standard -- "${WATCH[@]}"; } 2>/dev/null | sort -u)
[ -z "$changed" ] && exit 0

# fingerprint of the watched files' current content (tracked or not), so "nothing changed since the last green run" is exact
fp=$( { git diff HEAD -- "${WATCH[@]}"; while IFS= read -r f; do [ -f "$f" ] && git hash-object "$f"; done <<< "$changed"; } 2>/dev/null | git hash-object --stdin)
[ "$fp" = "$(cat "$LAST_GREEN" 2>/dev/null)" ] && exit 0

src_changed=$(echo "$changed" | grep -E '^(src/|public/mock-data/|test-data/|e2e/|package\.json|tsconfig\.json|next\.config\.ts|playwright)' || true)
specs_changed=$(echo "$changed" | grep -E '\.spec\.ts$' || true)
ts_changed=$(echo "$changed" | grep -E '\.(ts|tsx)$' || true)

[ -z "$src_changed" ] && [ -z "$specs_changed" ] && exit 0   # only docs / helpers: nothing to verify

fail() {   # $1 = what failed, $2 = file with its output
  n=$(( $(cat "$ATTEMPTS" 2>/dev/null || echo 0) + 1 )); echo "$n" > "$ATTEMPTS"
  { echo "[stop-verify] $1 — fix it before finishing (attempt $n of 3)."; tail -50 "$2"; } >&2
  [ "$n" -lt 3 ] && exit 2
  echo "[stop-verify] giving up blocking after 3 tries; report the failure to the user instead." >&2
  exit 0
}

out=$(mktemp)
echo "[stop-verify] changed: $(echo "$changed" | wc -l) file(s) — $( [ -n "$src_changed" ] && echo 'full suite' || echo 'changed specs only')"

if [ -n "$ts_changed" ]; then
  npx tsc --noEmit > "$out" 2>&1 || fail "tsc found type errors" "$out"
fi

if [ -n "$HOOK_TEST_CMD" ]; then cmd="$HOOK_TEST_CMD"
elif [ -n "$src_changed" ]; then cmd="npm run test:e2e:fast"
else cmd="npm run test:e2e:fast -- $(echo $specs_changed | tr '\n' ' ')"; fi
echo "[stop-verify] running: $cmd"
eval "$cmd" > "$out" 2>&1 || fail "tests failed" "$out"

echo "$fp" > "$LAST_GREEN"; echo 0 > "$ATTEMPTS"
echo "[stop-verify] green: $(grep -E '[0-9]+ passed' "$out" | tail -1)"

# source changed but not one spec touched → ask once for a test (this blocks one stop; the answer can be "none needed because …")
if [ -n "$src_changed" ] && [ -z "$specs_changed" ] && [ "$fp" != "$(cat "$NUDGED" 2>/dev/null)" ]; then
  echo "$fp" > "$NUDGED"
  echo "[stop-verify] Source changed but no spec was added or edited. Add a test that would fail without this change (new behaviour, or a regression test for the bug fixed), or say in your reply why none is needed." >&2
  exit 2
fi
exit 0

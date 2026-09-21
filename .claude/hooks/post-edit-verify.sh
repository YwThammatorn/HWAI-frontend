#!/usr/bin/env bash
set -euo pipefail

TEST_CMD="npm run test:e2e"

echo "[post-edit-verify] running: $TEST_CMD"
if ! eval "$TEST_CMD"; then
  echo "[post-edit-verify] ❌ test ไม่ผ่าน — ห้ามสรุปว่างานเสร็จจนกว่าจะแก้"
  exit 1
fi
echo "[post-edit-verify] ✅ test ผ่าน"

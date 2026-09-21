# HANDOFF — Teacher: Assignments / Grading split + Score Book

Plan file: `C:\Users\ASUS\.claude\plans\lively-tinkering-mitten.md` (approved 21/9/2569).

## Goal
- **Assignments** = planning only. **Grading** = checking only (takes over every stat Assignments used to show).
- **Results** → **Score Book** (redesign within DESIGN.md).
- Grading is a course-level sidebar entry: Overview · Assignments · **Grading** · **Score Book**.

## Decisions (and why)
- Course-level `/teacher/courses/[id]/grading` = queue of assignments (stat cards moved from Assignments). User chose this over a per-assignment-only split.
- Score Book keeps the `/results` URL (links/tests stay valid); only the label changed (สมุดคะแนน / Score Book).
- Score Book is read-only; score edits stay on the Grading pages (assumption, not contradicted).
- Sidebar active state is derived from path segments (`ProfileSidebar.tsx`) so nested routes light exactly one item.
- "Manage Collaborators" on the Assignments header was a dead button — it now links to `/collaborators`.

## Done (sub-task 1)
- `src/components/ProfileSidebar.tsx` — Grading entry + Score Book label, segment-based active state.
- `src/app/teacher/courses/[id]/grading/page.tsx` — NEW course-level queue (4 `StatCard`s, `PillTabBar` filter with counts, search, rows with progress bar / actions).
- `src/app/teacher/courses/[id]/assignments/page.tsx` — rewritten planning-only (no stats / Start Grading / expandable grading panel; adds category + rubric chips, "Grade →" bridge, token styling).
- Tests: `tests/teacher-grading-split.spec.ts` (26), `e2e/hwai.spec.ts` (sidebar label), `tests/font-scale.spec.ts` (+`/grading`).
- Verified: tsc clean, lint 0 in touched files, full suite 292 passed / 30 skipped, screenshots light + dark.

## Not done yet
2. Assignment detail (`assignments/[assignmentId]/page.tsx`) → planning only (info + rubric card + "Go to grading"); per-assignment `…/grading` absorbs Submitted x/y stat, real search + status filter, Review/Recheck link column, footer. **Tests to move:** `tests/teacher-p5-group-grading.spec.ts` (team rows / "Recheck team" / "Showing 1–2 of 2 team(s)" currently assert on the detail page) and the "Assignment Detail" describe in `e2e/hwai.spec.ts`.
3. Score Book (`/results`) — `src/lib/scoreBook.ts` + page + CSV export; `gradeLetter` moves to the lib; DESIGN.md §9b.
4. Remaining tests (`tests/teacher-score-book.spec.ts`, detail/grading additions to `teacher-grading-split.spec.ts`), KB update.

## Gotchas
- Pre-existing lint baseline must not grow (admin/users ×4, recheck ×1, grading page purity ×1, teacher/courses ×3, student/courses ×2, import ×2, collaborators ×1, dashboard ×1).
- Files are CRLF (`core.autocrlf=true`); node edit scripts must normalise `\r\n`; write scripts with the Write tool, not heredoc-with-backticks.
- Playwright `addInitScript` re-runs on every navigation — guard seeding with `sessionStorage`.

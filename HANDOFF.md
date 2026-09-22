# HANDOFF — Teacher: Assignments / Grading split + Score Book

Plan file: `C:\Users\ASUS\.claude\plans\lively-tinkering-mitten.md` (approved 21/9/2569). **All 4 sub-tasks are done and pushed.**

## Goal
- **Assignments** = planning only. **Grading** = checking only (takes over every stat Assignments used to show).
- **Results** → **Score Book** (redesign within DESIGN.md).
- Grading is a course-level sidebar entry: Overview · Assignments · **Grading** · **Score Book**.

## Decisions (and why)
- Course-level `/teacher/courses/[id]/grading` = queue of assignments (stat cards moved from Assignments). User chose this over a per-assignment-only split.
- Score Book keeps the `/results` URL (links/tests stay valid); only the label changed (สมุดคะแนน / Score Book). It is read-only; score edits stay on the Grading pages.
- Sidebar active state is derived from path segments (`ProfileSidebar.tsx`) so nested routes light exactly one item.
- "Total" in the Score Book is the same weighted "total so far" the student sees, shown with what it is out of (`15.0 / 30`), because only categories with graded work count. Letter = the running percentage (`total / gradedWeight`).
- `--s-warn-*` is reserved for "awaiting grading"; graded bands are ok ≥80 / info 60–79 / err <60.
- Per-assignment `…/results` (distribution + export) is kept as a drill-down; the sidebar highlights Score Book for it.
- "Manage Collaborators" on the Assignments header was a dead button — it now links to `/collaborators`.

## What changed (files)
- `src/components/ProfileSidebar.tsx` — Grading entry, Score Book label, segment-based active state.
- `src/app/teacher/courses/[id]/grading/page.tsx` — NEW course-level queue.
- `src/app/teacher/courses/[id]/assignments/page.tsx` — planning-only list (category + rubric chips, "Grade →" bridge).
- `…/assignments/[assignmentId]/page.tsx` — planning-only detail (brief, Details card, Rubric card, Go to grading).
- `…/assignments/[assignmentId]/grading/page.tsx` — absorbed Submitted x/y stat, search + status filter, Review/Recheck column, footer; compact progress strip; tokens on touched blocks.
- `src/lib/scoreBook.ts` (NEW, pure) + `src/app/teacher/courses/[id]/results/page.tsx` (Score Book).
- `SortableTh` (+`className`/`style`), `StatCard` (+`suffix`) — optional props only. `DESIGN.md` §9b Data tables.
- Tests: `tests/teacher-grading-split.spec.ts` (37), `tests/teacher-score-book.spec.ts` (20), `tests/font-scale.spec.ts` (+/grading, +score book th), `tests/teacher-p5-group-grading.spec.ts` + `e2e/hwai.spec.ts` (assertions moved / rewritten).

## Verified
tsc clean; lint on touched files = the one pre-existing `react-hooks/purity` (Math.random in the mock re-grade); full suite 324 passed / 30 skipped; screenshots light + dark for Grading, Assignments, detail, per-assignment grading, Score Book; Score Book total for 69070101 (36.0 on the mock course; 83.0 in the test seed) equals the student Evaluation page.

## Follow-up (21/9, after the 4 sub-tasks): rubric-grounded scores (pushed 82488b4)
User: "คะแนนที่โชว์ตอนหน้า result อิงตามคะแนน rubric ด้วย" — the Score Book's number should be traceable to the rubric, not just a bare total.
- `Submission.criterionScores?: Record<criterionId, number>` (new field, `lib/assignments.ts`) — the recheck page now saves it alongside `instructorScore` whenever a grade is saved (`updateSubmission` Pick type extended in 3 places: `lib/assignments.ts`, `lib/api/assignments.ts`, `AssignmentProvider.tsx`).
- Score Book: every **graded** cell whose assignment has a rubric gets a small chevron button next to the score chip (separate control, not nested in the `<Link>`, so clicking the score still opens recheck). Click opens a `Modal` (size sm) with criterion / weight / points-earned-out-of and a total row.
- Breakdown source: `submission.criterionScores` if present (exact — what recheck actually saved); otherwise estimated by splitting the total by criterion weight (`Math.round((c.weight/100) * cell.score)` — same formula the recheck page itself starts a fresh grade from), with a visible "Estimated from the criteria weights…" notice. Old/legacy submissions (graded before this existed) always fall into the estimated path.
- No changes to `lib/scoreBook.ts` — `ScoreCell` already carried `submissionId`; the page looks up the full `Submission` and the course's `Rubric` itself via `useAssignments()`.
- Tests: `tests/teacher-score-book.spec.ts` "Score Book — rubric breakdown" (6) + "a real recheck feeds the breakdown" (1, actually edits a criterion on the recheck page, saves, and checks the Score Book shows the exact edited number). Suite 331 passed / 30 skipped.

## Follow-up (21/9): status-chip contrast fix (pushed b493fc2)
User flagged (screenshot): Score Book chips ("58", "Pending", "Missing", grade letters) blended into the white table — barely visible. Root cause: every tinted cell used only `--s-*-bg` + text, no `--s-*-bd` border, even though DESIGN.md §6 defines the `.badge` pattern with a border on every status pill (the `-bg` tints are calibrated against `--bg-card`, not a plain white/dark surface). Fixed: added a solid border in the matching `-bd` token (e.g. `border-[var(--s-ok-bd)]`) to the `TONE` map (graded chips + Grade column, since both reuse it), the Pending pill, the legend swatches (now literally the same tokens as the cells), and the rubric-breakdown modal's "estimated" notice. Missing also changed from a transparent dashed outline (the *least* visible option) to a filled pill with a dot, matching Pending's shape. DESIGN.md §9b updated with this as a named pitfall. Suite still 331 passed / 30 skipped; screenshots confirm all 5 tones (ok/info/err/pending/missing) are now clearly bordered in both themes.

## Follow-up (22/9): the real "blending" was the table header/footer background, not the score chips (pushed f18624b)
After two rounds of strengthening the score-chip borders (still not enough per the teacher), they sent a cropped
screenshot of specifically the search-box-to-table-header region — the chips were never the issue; the sticky
header row (and footer) used `--bg-subtle` (#E4ECF3) sitting right at the card's edge, one shade off the page's
own `--bg-app` (#EEF2F7). On a real screen those two near-identical pale blues read as one continuous field, so
the whole card had no visible boundary. Checked the actual precedent (admin Students tab, teacher roster) instead
of re-deriving from DESIGN.md prose: neither tints its header — both keep it the same white/surface as the body,
differentiated by a border + muted uppercase text; `--bg-subtle` is reserved for row hover only. Switched every
structural header/footer cell in the Score Book from `--bg-subtle` to `--bg-surface`. Verified with a pixel-crop
of the exact region the teacher screenshotted, light + dark, before sending it back.
**Lesson**: when a colour complaint persists after a plausible-looking fix, get the exact crop/region from the
user before iterating again — I spent two rounds fixing the wrong element (chip borders) because I assumed the
crop from the first report was about the same cells as the earlier conversation, instead of confirming.

## Follow-up (22/9): dialed the chip border back down (pushed 9e3db2d)
With the header/footer background fixed, the 2px chip border from the previous round read as heavier
than the rest of the app. Kept the saturated `--s-*-text` colour (the original pale `--s-*-bd` was
proven too weak) but thinned every chip/legend/notice border back to a plain 1px. User confirmed the
header/footer fix looked correct before asking for this.

## Follow-up (22/9): reverted the chip border to the DESIGN.md-standard `-bd` token
User asked to go back to the pale `-bd` border. With the real bug (header/footer bg) fixed, the
`-bd` token — the actual DESIGN.md §6 "Status Badges" pattern — reads fine on its own: the table now
has a visible card boundary, so the chip border no longer has to carry contrast by itself. Swapped
every chip/legend/notice border in the Score Book (TONE map, Pending/Missing pills, legend swatches,
rubric-breakdown estimated notice) from e.g. `border-[var(--s-ok-text)]` back to `border-[var(--s-ok-bd)]`;
text stays the saturated `-text` token. tsc clean, lint clean, `teacher-score-book.spec.ts` 27/27, full suite unchanged.

## Not done / open
- Score Book is read-only by design; if the teacher wants to type scores into cells, that is a new decision (Grading pages own edits today).
- `gradeLetter` still exists locally in the two per-assignment results pages (the Score Book uses `lib/scoreBook.ts`); could be unified later.
- Group assignments: recheck already fans the saved score out to every teammate's `Submission`, so `criterionScores` is saved per teammate too — not specifically re-verified beyond the individual-assignment test above.
- The mock re-grade on the per-assignment Grading page still uses `Math.random` (pre-existing lint error).
- Hook still runs the whole e2e suite per edit (~2 min); user hasn't chosen a lighter `TEST_CMD`.

## Gotchas
- Pre-existing lint baseline must not grow (admin/users ×4, recheck ×1, grading page purity ×1, teacher/courses ×3, student/courses ×2, import ×2, collaborators ×1, dashboard ×1).
- Files are CRLF (`core.autocrlf=true`); node edit scripts must normalise `\r\n`; write scripts with the Write tool, not heredoc-with-backticks.
- Playwright `addInitScript` re-runs on every navigation — guard seeding with `sessionStorage`.
- Sticky table headers need explicit heights (`HEAD1_H` in the Score Book) so the second header row knows where to stick.

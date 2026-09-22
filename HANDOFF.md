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

## Follow-up (22/9): student Evaluation page adapts the Score Book (pushed next commit)
User: "role student ลองนำเอา grade book จากฝั่ง teacher มา ประยุกต์ใส่ที่ฝั่ง student หน่อย" — bring the
teacher Score Book's concept/visual language to the student's own `/evaluation` page. Confirmed via
AskUserQuestion: adopt the full graded/pending/missing/not-due cell model (not just the old flat
"Pending"), and rebuild as a table (not just re-colour the existing per-category cards).
- **Shared code extracted first** (both screens now single-sourced, was inline-duplicated before):
  `SCORE_TONE_CLASSES` / `PENDING_CHIP_CLASSES` / `MISSING_CHIP_CLASSES` moved from the teacher page
  into `lib/scoreBook.ts`; the rubric-breakdown `Modal` block moved into a new
  `src/components/RubricBreakdownModal.tsx`. Teacher page updated to import both — behaviourally
  identical (its 64 existing tests still pass unchanged).
- **New page** (`src/app/student/courses/[secId]/evaluation/page.tsx`, full rewrite): a single-row
  table (rows = assignments, grouped by category header rows — axes swapped vs. the teacher's
  students-×-assignments matrix, since there's only one student). Cell states/tones/legend/rubric
  breakdown are the exact `buildScoreBook()` logic the teacher page uses, called with a one-element
  `students` array. Category-level numbers (percent, earned/possible pts) and the weighted "Total so
  far" stay on `computeCategoryGradeRows`/`computeTotalSoFar` — unchanged from before this redesign, so
  the teacher-page cross-check test and the exact tested strings ("80%", "80/100 pts", "40.0%", "Based
  on 1/2 categories graded") didn't need to move. Added a letter-grade badge next to the total (new).
  h1 label kept as "ผลการประเมิน"/"Evaluation" (renaming to "Score Book" would break a regex-based
  test and wasn't asked for — this is a layout/visual adoption, not a rename).
- **One existing test deliberately updated**: `tests/student-p4.spec.ts`'s "Lab 2" fixture (due
  2026-01-20, no submission) is genuinely overdue against the real test-run clock, so under the new
  3-state model it now shows "Missing" instead of the old catch-all "Pending" — the one behaviour
  change the user explicitly accepted when choosing the 3-state option.
- New `tests/student-score-book.spec.ts` (13): cell states/colours, category section headers (incl.
  "Not graded yet" and the uncategorized "Excluded from the total" bucket, skipped entirely when it's
  the *only* group — the no-categories fallback case), rubric breakdown (exact vs. estimated), total +
  letter, stat cards, empty state, TH/EN, assignment-name links to classwork.
- **Gotcha hit while writing this**: the category header's first pass combined name+weight into one
  span (`"Midterm · 50%"`), which silently broke `student-p4.spec.ts`'s pre-existing exact-text
  match on `"Midterm"` alone — fixed by nesting the name in its own inner `<span>` so both an exact
  match on the name and a substring match on the combined text still work. Caught by running the
  *existing* test files alongside the new one before considering this done, not just the new suite.
- DESIGN.md §9b: fixed a stale line that still said the table header sits on `--bg-subtle` (true
  before the 22/9 header/footer fix, not since); added a note that this pattern covers a single-row
  table too, no sticky/matrix machinery needed at that scale.
- Verified: tsc clean; lint clean on every touched file; full suite 344 passed / 30 skipped (361 → 374,
  +13 new, 0 changed-behaviour regressions beyond the one deliberate Lab 2 update) via Playwright's own
  `webServer` on an unpiped log.

## Follow-up (22/9): student category header blended into its own text (pushed a351947)
User flagged (screenshot) the "Homework · 50%" section-header row — teal `--accent` text on the
group-header row's `--bg-subtle` fill read as washed out. Same class of bug as the 22/9 header/footer
fix, this time in the *new* student code: `--bg-subtle` is reserved for row hover, not a static fill
(DESIGN.md §9b) — 4.58:1 contrast on that pale-blue fill vs. 5.48:1 on plain white/`--bg-surface`, and
the shared cool hue makes it look worse than the number alone suggests. Fixed by switching the row to
`--bg-surface` (no tint), matching the teacher Score Book's own column-group header, which was never
tinted either. Verified with fresh screenshots (both themes) before pushing; suite unaffected (43/7
skipped on the touched test files).

## Unrelated (22/9): finished the API layer skeleton for a backend dev — `src/lib/api/` + `API_CONTRACT.md`
User: "อยากให้เตรียมพร้อมไว้ เพื่อให้ backend dev ทำงานต่อได้ง่ายขึ้น โดยที่ไม่กระทบภาพรวมตอนนี้" — prepare
`src/lib/api/` (a "Phase 1: localStorage, swap to `client.*()` later" skeleton scaffolded once on 21/8,
covering only `assignments`/`courses`/`auth`/`notifications` and **not imported anywhere in the app**)
so a backend dev has a real contract to build against, without touching today's behaviour. Went through
Plan Mode (wide surface — 12 new files) after an Explore pass mapped every data-layer Provider.
- **Added 11 more `lib/api/<domain>.ts` files** (`students`, `cohort-students`, `grading-categories`,
  `curriculum`, `managed-teachers`, `section-roles`, `student-groups`, `weekly-plan`,
  `teaching-materials`, `announcements`, `clo`, `grading-assignments`), each mirroring its real
  Provider's CRUD 1:1, same "commented real call + working localStorage fallback" pattern as the
  existing `assignments.ts`/`courses.ts`. "Collaborators" isn't its own entity (it's `SectionRole` +
  `ManagedTeacher.courseIds`) so it has no separate file. `lib/api/index.ts` barrel updated.
- **Fixed 2 drifted existing files**: `auth.ts` had its own `AuthUser` shape that didn't match the real
  one in `AuthContext.tsx` (missing `studentId`/`roles`/`accountEmail`, no `"student"`/`"admin"` role) —
  now imports the real type so it can't drift again; `register()` no longer unconditionally throws.
  `notifications.ts` is flagged with a header comment as **speculative** — no live Provider backs it at
  all (the feature is flag-disabled and was never persisted even when on), unlike every other file here.
- **New `API_CONTRACT.md`** (repo root): one doc per domain (resource, suggested REST path, each
  function → verb/request/response, generated straight from the `lib/api/*.ts` signatures), the auth
  header convention, the `ApiError` shape, and explicit open gaps (no `token` field exists on `AuthUser`
  yet; file uploads aren't covered; wiring the Providers to actually call this layer is a named,
  deliberately-not-started follow-up).
- **Scope boundary, on purpose**: did *not* wire any Provider to call through `lib/api/*` — every
  Provider still reads/writes `localStorage` directly, exactly as before. That's the real behaviour-risk
  refactor (adding loading/error state that exists nowhere today) and belongs to whenever there's an
  actual backend to test against, not "preparation." Verified by `grep -rl "from \"@/lib/api" src`
  outside `lib/api/` staying empty, and a full suite run before/after landing on the exact same
  344 passed / 30 skipped.
- Verified: tsc clean; lint clean on every new/touched file.

## Unrelated (22/9): toggleable teal chrome theme for Navbar + the 3 portal sidebars
Advisor feedback: try the site's navbar/sidebar in the same teal as the "Sign in" button
(`--accent-solid`, `#0F766E`/`#12817A`) instead of the fixed navy, with a toggle like the existing
light/dark button. Went through Plan Mode — found a real risk first: `--bg-nav` (today's navy token) is
reused in ~15 unrelated places (tab active-states, filter chips, cards across teacher pages), and a
past `globals.css` comment already warns repointing it "would have reskinned half the teacher portal
by accident." `--sidebar-bg` was cleanly scoped (confirmed by grep — only the 3 sidebar files).
- **New `--navbar-bg` token** (`globals.css`) — the Navbar's own top-bar fill split off `--bg-nav`, the
  same move already made once for `--sidebar-bg` (9/9/2569). Starts equal to `--bg-nav`'s value in both
  themes, so the split alone is a no-op.
- **`[data-nav-theme="teal"]` / `[data-theme="dark"][data-nav-theme="teal"]` override blocks** —
  repaint only `--navbar-bg`, `--sidebar-bg`, `--nav-active-bg`, `--nav-active-text`. `--bg-nav` itself
  and its ~14 other consumers are never touched.
- **`--nav-active-text` recomputed for teal, not reused from navy** — plain white already clears
  4.5:1 against the flat teal fill (4.76:1 light / 4.73:1 dark), verified by hand.
- **`--nav-active-bg` found a genuine contrast dead-end and had to change direction**: navy's active-row
  highlight *lightens* the row (`--accent-bright`/20% over near-black) — composited over teal (already
  mid-lightness) that overshoots to where no text colour, not even white, can reach 4.5:1 again (max
  ~4.24:1, verified by hand). Fixed by *darkening* the row in teal mode instead (black at 18-20%
  opacity) — 6-7:1 margin, still reads as a clear highlight. This token was also previously unused (the
  3 sidebars had `bg-[var(--accent-bright)]/20` hardcoded inline) — wired all 4 occurrences
  (`ProfileSidebar.tsx` ×1, `AdminSidebar.tsx` ×1, `StudentSidebar.tsx` ×2) onto `--nav-active-bg` so
  the toggle can repaint them; value set to match the old hardcoded opacity exactly (`.2`, not the
  token's stale pre-existing `.18`) so navy mode is pixel-identical to before.
- **`ThemeProvider.tsx`**: added a second, independent preference (`navTheme: "navy"|"teal"`,
  `toggleNavTheme()`) to the same context as light/dark, persisted to its own
  `localStorage["hwai-nav-theme"]` key, applied via a second `data-nav-theme` attribute on `<html>` in
  the same effect. **Default `"navy"`** — opt-in, nobody sees a different site unless they toggle it.
- **`Navbar.tsx`**: new toggle button, identical visual treatment to the light/dark one, right next to
  it (paint-drop icon, filled when teal is active).
- Verified live in the browser pane, all 4 combinations (navy/teal × light/dark) — teal reads as a
  deliberate brand colour at full-surface scale, not garish; active-nav-item text clearly legible in
  both themes. Default navy+light/navy+dark screenshots pixel-match the pre-change look.
- tsc clean; lint = 2 pre-existing baseline errors only (`AdminSidebar.tsx` unrelated collapsed-state
  effect, `ThemeProvider.tsx`'s original `setPreference` call — confirmed both existed on `HEAD` before
  this change, this change added zero new ones).

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

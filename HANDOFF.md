# HANDOFF — Teacher: Assignments / Grading split + Score Book

Plan file: `C:\Users\ASUS\.claude\plans\lively-tinkering-mitten.md` — now on its 3rd plan (21/9 batch of
4, 23/9 batch of 4 items, done and pushed; the file was overwritten in place each round per its own
"this replaces it" convention, so only the latest plan text is preserved there).

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

### Follow-up (22/9): sidebar and navbar needed to look different in teal too (pushed next commit)
User: "สีระหว่าง navbar กับ sidebar มันน่าจะแตกต่างกันหน่อย เหมือนเวอร์ชั่นสีน้ำเงินอ่ะ" — both had shipped
as the exact same flat teal; navy's own navbar/sidebar aren't identical either (`#1A2D45` vs `#243C5A`).
Checking navy's actual relationship (sidebar *lighter* than navbar) exposed a real bug rather than just
a copy-paste job: teal's relative luminance (0.14) is already much higher than navy's (~0.02) at a
comparable "visual" darkness — hue affects the luminance formula heavily, green/teal weighs more than
blue. The 3 sidebars' existing `text-white/55` inactive-nav-item treatment clears 4.6:1 on navy but
drops to ~2.8:1 on the flat teal that had already shipped — an accessibility regression that predates
this specific complaint, just not caught by the original round's verification (which checked the
*active* state's math and a visual screenshot pass, not this specific opacity-blended case). Fixed by
giving `--sidebar-bg` its own, *darker* teal (`#084541`) rather than a lighter one — solves both at
once: visually distinct from `--navbar-bg` (kept at the literal Sign-in-button teal), and back over
4.5:1 for the existing white/55 text (verified 4.6-4.7:1) without touching the 3 sidebar components at
all. Kept identical between light/dark chrome-teal (the contrast fix applies to both, unlike navy's
light-only distinction). Verified with fresh screenshots (both themes); full suite still 344/30.

## Unrelated (22/9): batch of 10 small teacher-page UI fixes
User sent a terse 10-item list. Investigated each live (screenshots / live scroll test) before touching
anything, per two of them turning out to already work / need a different fix than the literal wording
suggested:
1. **Score Book sticky ID/Name columns** — already worked correctly (verified with a real horizontal
   scroll test, 10 assignment columns); no code change.
2. **CLO page: Actions column** — header cell was a literal `""` (no label) → added "จัดการ"/"Actions".
   The "No linked criteria" warning text was overflowing into the action buttons' space — a classic
   CSS Grid gotcha (a grid item's default `min-width: auto` lets long content overflow a fixed-px
   track); fixed with `min-w-0` + `truncate` on that cell.
3. **Teacher can no longer delete a course** — removed the "Delete Permanently" button + `handleDelete`
   from `teacher/courses/[id]/settings/page.tsx`; Archive (reversible) stays. Admin already has its own
   delete flow (`admin/courses/page.tsx`) — teachers are pointed there via the updated Danger Zone copy.
   Updated `e2e/hwai.spec.ts`'s "Course Settings" test (asserted the button existed).
4. **Teacher Settings layout now full-width** — was `max-w-[860px] mx-auto`, unlike every sibling
   teacher page; now `w-full` to match.
5. **Settings preview: text lifted into the colour band** — was a separate white box below the swatch;
   now reuses the real `CourseBanner` component (the same one My Courses cards use), so the preview is
   an exact live preview of the real card, not a hand-rolled approximation.
6. **Assignment list row is now clickable through to detail** — was title-text-only before. Kept the
   title's own real `<Link>` (keyboard/ctrl-click semantics) and added a convenience `onClick` on the
   row `<div>` to the same destination; the action cluster (menu, was also "Grade →") gets
   `stopPropagation` so it doesn't double-navigate.
7. **Removed the "Grade →" link from the assignment list row** — a plain, low-visual-weight text link,
   redundant now that the row itself opens detail (which has its own prominent "Go to grading").
   Updated `tests/teacher-grading-split.spec.ts`'s row-bridge test accordingly.
8. **Grading page: Review/Recheck now styled as a real button** — was a plain underlined text link next
   to the outlined-pill "Re-grade" button; now matches its visual weight (outlined pill, `--accent`).
9. **Grading page: merged "AI Score" + "Instructor Score" into one "Score" column** — the instructor
   input already showed the AI score as its placeholder when empty, so the separate always-visible "AI
   Score" cell was showing the same number twice. Once overridden, the AI score would otherwise
   disappear from the row entirely — added a small "AI: N" hint next to the "Edited" badge so it stays
   visible. Updated `tests/teacher-p2.spec.ts`'s "AI scores shown" test (was asserting bare visible text
   "72"/"55"; now asserts the input's placeholder).
10. **Removed the star-rating control from per-assignment Results' "AI Feedback" panel** — kept the
    textarea + "Feedback Grading" button, dropped the 5-star `StarRating` component and its state.

Verified: tsc clean; lint = baseline only on every touched file (confirmed pre-existing counts on `HEAD`
where relevant — `AdminSidebar`/`ThemeProvider` refs error, grading page `Math.random` purity error).
Screenshots for every visual change (both themes where relevant). Full suite: see below.

## Unrelated (23/9): 2nd batch of 7 teacher feedback items — new plan, 4 sub-tasks (3 done, 1 open)
User sent 7 more items prefixed by an explicit standing instruction: "ส่วนนี้งงตรงไหน หรือไม่เคลียร์ ให้ถามฉันก่อนนะ"
(ask first if anything is unclear). 3 of the 7 were unambiguous and folded straight into the plan; 4 needed
clarification — asked via AskUserQuestion across 3 rounds, including surfacing a real architecture conflict
(weight-based vs points-based rubric) instead of silently picking the safer option. Plan file:
`C:\Users\ASUS\.claude\plans\lively-tinkering-mitten.md` (approved). Ordered smallest-risk-first; each
sub-task = code + tests + tsc/lint + full suite + commit.

### Sub-task 1 (pushed d4a55e4): assignment detail rubric card → student-style view
`…/assignments/[assignmentId]/page.tsx`'s Rubric section (was a compact Criterion/Weight/Levels-count table)
now reuses the exact card-per-criterion layout the student classwork page already has — name+weight chip,
description, a grid of level label+description cards — plus a small `Total {totalWeight}%` sanity line kept
below it and the "Edit Rubric" link kept in the section header (teacher-only chrome the student view lacks).

### Sub-task 2 (pushed e1f864b): teacher Students table — Cohort/Program/Status columns + delete
Table grew from 5 to 9 columns. Clarified via AskUserQuestion: "Status" = **per-section enrollment status**
(`enrolled`/`withdrawn`/`added-midterm`, already on `Student` as `enrollmentStatus`) — not the unrelated
account-level `CohortStudent.status` (`active`/`inactive`). "(delete)" in the user's list meant a **delete-
from-course** button, confirmed over the alternative reading (deactivate).
- Added `updateStudent` to `StudentContextValue`/`StudentProvider.tsx` (didn't exist before — only
  `addStudents`/`removeStudent`/`getStudentsByCourse`) + the matching `lib/api/students.ts` mirror.
- New columns: Cohort (`s.cohort`), Program (cross-referenced from `findByStudentId`, same live-lookup
  pattern already used for `title`), Status (tone-colored badge, `--s-ok/err/info-*`).
- Actions column: conditional withdraw⇄re-enroll icon button (confirm only on withdraw, matching the
  admin activate/deactivate asymmetry) + a delete icon button (confirm always, wired to the already-
  existing `removeStudent`).
- Updated `tests/teacher-roster-table.spec.ts`'s 2 column-header-list assertions (5→9 columns, both
  languages) + added ~14 new tests for the 3 new behaviors.

### Sub-task 3 (this commit): Finalize Grading + Score Book view-only lock
Clarified via AskUserQuestion: the Score Book has no "final" concept today, so "shouldn't be editable from
here unless not-yet-final" needed a real mechanism — user chose adding a **"Finish Grading" button** on the
per-assignment Grading page over the alternative (an implicit 100%-triggers-lock rule), because implicit
locking would surprise a teacher who wants to keep tweaking scores past 100% before calling it done.
- `Assignment.gradingFinalized?: boolean` (`lib/assignments.ts`) — absent/false = still open, no migration
  needed since `updateAssignment` already accepts any partial patch.
- Per-assignment Grading page: once `isDone` (100% processed) and not yet finalized, both the header pill
  and the progress-circle block show a **"Finish Grading"** button (`handleFinishGrading` →
  `updateAssignment(id, {gradingFinalized: true})`). Once finalized, both show **"View Results"** plus a
  small, quiet **"Reopen grading"** text link (`handleReopenGrading` → sets it back to `false`) — a safety
  valve so a teacher is never permanently stuck if they need to correct something later; not explicitly
  requested but a cheap addition given the "Finish Grading" button already exists.
- Score Book (`renderCell`): `"graded"`/`"pending"` cells on a finalized assignment render as a plain
  `<span>` (no `<Link>`) — same shape already used for `"missing"` — instead of the clickable link to
  recheck. Not-yet-finalized assignments keep the existing clickable behavior regardless of percent graded.
  The rubric-breakdown chevron button stays available either way (it's a separate control, not the score
  link, so it doesn't defeat the lock).
- Tests: new self-contained `test.describe("Score Book — a finalized assignment is view-only", …)` block
  in `tests/teacher-score-book.spec.ts` (own fixture, course `c-fz`, so it doesn't disturb the main
  fixture's hand-worked numbers) — 2 tests, checks the locked cell has no link role and that clicking it
  doesn't navigate. **Gotcha**: first draft hardcoded the locked/unlocked `<td>` index assuming array
  order; `lib/scoreBook.ts`'s `byDue` actually sorts columns by `dueDate` then `name` — with both
  fixture assignments sharing a due date, "Finalized Assignment" sorts before "Open Assignment"
  alphabetically, so the indices were swapped. Fixed by reading the real column order from a failing
  test's accessibility-tree dump instead of re-guessing.
- Verified: tsc clean; lint clean (only the pre-existing `Math.random` purity error on the Grading page,
  confirmed present on `HEAD`); screenshots both themes for both Grading-page button states + the Score
  Book (the lock is behavior-only, not visually distinct — confirmed by the passing tests, not by eye);
  a stray "0%" in one dark-mode screenshot was the `CircleProgress` component's own 80ms mount-in
  animation caught mid-transition by the screenshot timing, not a real bug (re-screenshotted after a
  longer wait → 100%, consistent with the not-yet-finalized state).

### Sub-task 4 (done, pushed): isExam + points-based rubric rework
Confirmed via AskUserQuestion to be the *bigger* of two options after surfacing a real conflict: the
rubric editor was weight-based (criteria % must sum to 100, each criterion's `maxPoints` *derived* from
`assignment.maxPoints × weight%`). "Remove the manual max-score field, derive it from the rubric instead"
required inverting that.
- **`Assignment.isExam?: boolean`** (`lib/assignments.ts`) — exam-type assignments keep today's manual
  max-score entry and never get a rubric (`rubricIds` stays `[]`).
- **`RubricCriteriaEditor.tsx` core rework**: `CriterionDraft.weight` → `.points` (a real input, not
  derived); `criteriaWeightOk`/`criteriaTotalWeight` → `criteriaPointsOk`/`criteriaTotalPoints` (≥1
  criterion, each with points > 0 — no forced total, points are free-form unlike weights);
  `finalizeCriteria(criteria, untitled)` dropped its `maxPoints` param — it now computes
  `weight = round(points/total × 100)` per criterion as the *derived* display value and
  `maxPoints = points` as the stored value. Every existing consumer of `RubricCriterion.{weight,
  maxPoints}` (rubric cards, `RubricBreakdownModal`, `lib/scoreBook.ts`, CSV) kept working unchanged —
  only how those two fields get populated inverted. AI Rubric Assistant's mock suggestions now propose
  points (same 40/30/20/10 numbers, reinterpreted).
- **New Assignment form**: added an **Exam Assignment** toggle (Submission Settings, `aria-label="Exam
  Assignment"` for testability) next to Accept Files. Off (default): Max Score becomes a read-only "Total:
  N pts (from the rubric below)" display, `RubricCriteriaEditor` is the only way to set points, `maxPoints
  = criteriaTotalPoints(criteria)` at submit — this is also item 6 from the original 7-item list ("block
  creating an assignment without a filled-in rubric"), satisfied because Create stays disabled until every
  criterion has points > 0. On: unchanged manual Max Score input, rubric section hidden entirely, empty
  `rubricIds`.
- **Edit Assignment form**: same toggle. Off: Max Score is a read-only live total from the linked rubric's
  current criteria (`linkedRubrics[0]?.criteria.reduce(...)`, "—" if none yet); that same live total is
  what actually gets saved as `assignment.maxPoints` on this form's own Save (so toggling isExam off can't
  leave `maxPoints` stale before the teacher ever opens the rubric editor). On: manual input, as today.
  Rubric section hidden entirely when isExam.
- **Standalone rubric editor** (`rubrics/[rubricId]/page.tsx`): switched to the points-based editor/
  `finalizeCriteria`; Save now **also** calls `updateAssignment(assignmentId, {maxPoints: newTotalPoints})`
  — the sync step that keeps the ~15 other `assignment.maxPoints` read-sites (Score Book, grading table
  bounds, CSV, student pages…) correct without touching any of them, guarded by `!assignment.isExam` so a
  direct-URL visit to an exam assignment's (nonexistent, in practice) rubric can't clobber its manually-set
  score.
- **Teacher assignment-detail page**: rubric section is isExam-aware — shows a neutral "Exam Assignment /
  Graded on a manually set max score — no rubric is used" note instead of the amber "No rubric yet"
  warning (which is factually wrong for a deliberately-rubric-less exam) and hides the now-meaningless
  "Edit/Add Rubric" link.
- **Recheck page — closed a real gap found while implementing, not in the original plan text**: with no
  rubric, the per-criterion scoring UI rendered nothing and silently graded every exam submission 0
  (`scores` stayed `[]`, `totalScore` was always 0) — there was no way to actually grade an isExam
  submission. Added a manual "Enter this submission's total score directly" input (own `manualScore`
  state, same init-from-`aiScore`/Reset-to-Default pattern as the rubric path) shown whenever `!rubric`.
  `totalScore`/`totalMax` now branch on `rubric` presence; `handleSave` unchanged (already just uses
  `totalScore`).
- Tests: rewrote `tests/assignment-create-rubric.spec.ts` for the points model (labels, "N pts total",
  the 0-points block message) + a new "Exam Assignment toggle hides the rubric…" end-to-end test. Verified
  live in the browser beyond the automated suite: create → rubric points → assignment.maxPoints synced
  (100); standalone rubric editor add-criterion+save → maxPoints re-synced (150); isExam assignment →
  recheck's manual-score input → save → `submission.instructorScore` persisted correctly, status →
  "graded". Full suite 355 passed / 30 skipped.
- **Lint note**: `edit/page.tsx`'s pre-existing baseline (15 problems / 14 errors, all `react-hooks/refs`
  from a `useRef`-based `isDirty` computation that reads `origRef.current.*` directly during render — an
  existing anti-pattern used for every one of that form's ~9 tracked fields) grew by exactly 1 error when
  `isExam` was added as a 10th tracked field the same way. Same rule, same pre-existing pattern extended
  by one field — not a new category of issue. Fixing it properly means restructuring that whole form's
  dirty-tracking (out of scope, never done for the other 9). Every other touched file matched its baseline
  exactly (0 new anywhere else).

## Unrelated (23/9): c-mock-1 mock data enriched with 6 more assignments, for variety + a real Score Book scroll
User: "ลอง mockup ชิ้นงานเพิ่มได้ไหม ให้เห็นความหลากหลาย แล้วก็จะได้ดู score book sticky ด้วย" — the live demo
course `c-mock-1` (seeded via `test-data/seed-commands.txt` step [5], not the Playwright-only `seed-1`/`seed-2`
fixtures in `AssignmentProvider.tsx`) only had 3 assignments, all individual, all rubric-graded, all in the
same "งานที่มอบหมาย" category — not enough columns to see the Score Book's sticky ID/Name/Total/Grade columns
actually scroll, and its other 2 categories (สอบกลางภาค 25%, สอบปลายภาค 35%) had zero assignments (a known,
documented gap in seed-commands.txt, not a bug).
- Added **a-mock-4..a-mock-9** to `public/mock-data/student-flow-mockup.json` **and** `-en.json` (kept
  byte-identical IDs per the file's own [10] convention), then copied both into `test-data/` to match —
  confirmed via `git show HEAD:...` that the two copies were byte-identical before touching them.
- Deliberately varied: **a-mock-5** (Midterm) and **a-mock-9** (Final) are `isExam: true` — the first live
  showcase of this session's sub-task 4 feature in the demo data, one category each (previously empty).
  **a-mock-4** (Quiz 1) is `gradingFinalized: true` — showcases the Score Book's view-only lock (sub-task
  3) on real demo data. **a-mock-7** is a second group assignment. Due dates spread past/near/future
  relative to today (2026-09-23) so the Score Book shows all its cell states at once: graded, pending
  (a-mock-6 for 69070102), missing (a-mock-6 and a-mock-8 for 69070103 — no submission row at all, not
  just ungraded), and not-yet-due dashes (a-mock-2/3/7/9).
- Verified live (not just by reading the code): seeded `c-mock-1` in the browser pane via the same
  `fetch(...).then(...)` pattern as seed-commands.txt step [5], confirmed the Score Book now shows "9 งาน" /
  3 category groups / the category filter dropdown populated, scrolled the matrix and confirmed ID/Name
  stay pinned left while Total/Grade stay pinned right (both light and dark theme), confirmed Quiz 1's
  cells have no `<a>` (locked), and cross-checked the student Evaluation page for 69070101 shows the same
  numbers split across all 3 categories now. `node -e` sanity check: TH/EN assignment+rubric+submission ID
  sets match exactly, and every non-exam assignment's `maxPoints` equals its rubric's criteria point sum.
- Full Playwright suite unaffected (no test hardcodes `c-mock-1`'s old 3-assignment count; `font-scale.spec.ts`,
  the only spec touching these fixtures, only visits `a-mock-1`-specific URLs). No app code changed — mock
  data only.

## Unrelated (23/9): CLO page mockup+layout fix, Grade Adjustment reverted to read-only, Students table cleanup
User feedback batch, several of them corrections to earlier work in this session.

### CLO page: real mockup data + fixed a layout bug (screenshot: table content "leaning right")
- `src/app/teacher/courses/[id]/clo/page.tsx`: the row list was a fixed-column CSS grid
  (`88px 1fr 170px 76px`) — on a wide screen the `1fr` CLO Text column stretched to fill all
  remaining space, leaving a large blank gap before the Linked Criteria/Actions columns, which read
  as detached and pushed off to the right. Converted to a real `<table>` (DESIGN.md §9b, the pattern
  every sibling table already uses) so columns size to content instead, **and** capped the page to
  `max-w-[960px]` (was `w-full`) since a 4-row CLO list is inherently narrow content — confirmed live
  at 1600px viewport: CLO Text column went from 867px (stretched) to 514px (content-sized), table
  886px instead of spanning the full 1600px main.
- Added real mock CLO data for the `c-mock-1` demo course (`public/mock-data/student-flow-mockup.json`
  + `-en.json` + `test-data/` copies, `clos` array, 4 CLOs matching the course's own assignment content
  — variables/quiz1, data structures/quiz2, functions/lab5, teamwork/group projects) — c-mock-1 had none
  before (the 1-CLO gibberish row in the screenshot was the user's own manual test via "+ Add CLO").
  **Also updated `test-data/seed-commands.txt`**: step [5] (TH) and [10] (EN) now also seed
  `hwai_clos_v1` from the same fetch, and the reset-all command's key list includes it too — without
  this the new `clos` data would sit in the JSON unused.
- "Linked Criteria" always shows "No linked criteria" regardless of CLO — that's the real current app
  state, not a bug: `CLO` (`lib/clo.ts`) has no criteria-linking field at all yet (deferred feature,
  tracked since 19/9).

### Grading page "Grade Adjustment": Score reverted to read-only (corrects the 22/9 change)
User: the 22/9 "merge AI Score + Instructor Score into one editable column" was a **misreading** —
the actual ask was to remove the Instructor Score column, full stop. The instructor only ever edits a
score by opening Review/Recheck and adjusting it per criterion; this table should just show the
current score, not offer a second, shortcut way to edit it.
- `…/grading/page.tsx`: removed the editable `<input>` (and the whole "Save All" batch-save mechanic
  that existed to persist it: `handleSaveAll`, `modifiedCount`, the per-row `instructorScore` string in
  `RowState`, the header Save/​"Saved ✓" UI). The Score cell is now plain text: the instructor's saved
  override if one exists, else the AI's own score (`rep.instructorScore ?? rep.aiScore`); "Edited" +
  the amber tint + an "AI: N" hint still appear when a saved override differs from the AI score — same
  visual signal as before, just driven by saved data instead of a live-typed value. Re-grade is
  untouched (it already saves immediately per row, no "Save" step involved). Section description
  updated to say so. Also fixed a pre-existing off-by-one `colSpan` (7 instead of 6) on the empty-state
  row, noticed while touching this table.
- Tests: rewrote the input-dependent parts of `teacher-p2.spec.ts` (dropped 4 tests that only existed
  to verify the removed input/Save mechanics; added one for the read-only display + the saved-override
  "Edited" state), `teacher-grading-split.spec.ts` ("filtering does not lose an edited score" → there's
  no more live state to lose, replaced with a plain filter-round-trip row-count check),
  `teacher-p5-group-grading.spec.ts` (team fan-out is now tested via Re-grade instead of the removed
  manual save, since Re-grade already fans a team's score to every member), and the real end-to-end
  `e2e-group-assignment-flow.spec.ts` (teacher grading step now goes Re-grade → Recheck → the recheck
  page's own manual-total-score input, since this fixture's assignment has no rubric — matches the
  corrected UX exactly and doubles as live coverage of the isExam-style no-rubric recheck fallback from
  sub-task 4). Full suite green after (see final count below).

### Teacher Students table: Program shown as its full name, Cohort column removed
User: "program ใช้ตัวเต็มนะ แล้วก็เอา column cohort ออกคับ ไม่ได้ใช้แล้ว" (use the full program name;
Cohort column is unused, remove it).
- `…/students/page.tsx`: added a local `PROGRAM_LABEL` map (CE/CECS/CEI → full bilingual names) —
  the exact same map `admin/users.tsx` already has inline for the same reason (`program` is a free-text
  field, not FK-enforced, per that file's own comment) — deliberately duplicated per-page rather than
  extracted into a shared module, matching that existing precedent instead of introducing a new one.
  Dropped the Cohort `<th>`/`<td>` entirely (column count 9→8, `colSpan` on the empty-state row
  updated). Verified live: Program column now reads "Computer Engineering" / "Computer Engineering and
  Cybersecurity" / "Computer Engineering International" instead of "CE"/"CECS"/"CEI".
- Tests: `tests/teacher-roster-table.spec.ts` column-header-list assertions (EN/TH) updated to 8
  columns, Program assertion updated to the full name, all `.nth()` cell indices past Email shifted
  down by one (Cohort's removal), describe block retitled "Program / Status".

### Explaining two items the user asked about directly (no code changes, already shipped in sub-task 4)
- **isExam**: see the sub-task 4 entry above — an `Assignment.isExam` toggle on the New/Edit Assignment
  forms that swaps the rubric-derived Max Score for a manual one and skips the rubric entirely; verified
  again live this round via the Grading page's Score column and the recheck page's manual-score fallback.
- **Blocking "Add Assignment" without a filled-in rubric**: already implemented in sub-task 4
  (`criteriaPointsOk` gates the Create button; the amber banner + a message next to Create explain why).
  Re-verified live this round: setting a criterion's points to 0 disables Create and shows "Every
  criterion needs more than 0 points before you can create the assignment" right next to the button.

## Unrelated (23/9): 3 corrections after the user tried the above round live
### CLO page: user wanted full-bleed after all (pushed 641802a)
The previous round capped the page to `max-w-[960px]` to fix the stretched-text-column bug; user asked
for the page frame back to full width to match every other course page. Reverted `<main>` to `w-full`,
but kept the table itself un-stretched: dropped `w-full` from the `<table>` (so it sizes to its own
content instead of being forced to fill the card) and added `max-w-[560px]` to the CLO Text `<td>` (so a
long CLO description still wraps sanely instead of pulling the table wide on its own). Verified at
1600px: `<main>` 1351px, the white card 1279px (both full-bleed, matching siblings), but the actual
`<table>` sizes to 932px and sits left-aligned inside the card — code/text/badge/actions stay visually
grouped, no more big dead gap.

### Recheck "Save Changes" now returns to where the teacher came from (pushed 239b95a)
Was `router.push(.../results)`, hardcoded. Recheck has 3 real entry points — the Grading page's Review/
Recheck link, the per-assignment Results drill-down, and the course-level Score Book — so a fixed
destination was wrong for at least two of them. Changed to `router.back()` (real browser session
history, so it works regardless of which of the 3 it was opened from). Verified live: clicked Review
from the Grading page, saved, landed back on Grading — not Results. No test asserted the old redirect
target, so nothing needed updating.

### The "must fill in the rubric" warning: a real bug, found by trying it at real size (pushed 0db68e2)
User: "ไม่เจอว่ามีข้อความสีส้มขึ้นนะ" (never saw the orange message). My own verification had only used
`get_page_text` (which just confirms the text exists in the DOM) and a full-width screenshot — neither
would have caught this. Reproduced by actually looking at a screenshot at a realistic width: the warning
`<span>` shared a plain flex row with the Cancel/Create (or Discard/Save) buttons with no `flex-wrap`,
so on a narrower viewport it got flex-shrunk down to almost nothing and wrapped **one word per line**,
crammed against the sidebar — technically present, completely unreadable. Root cause was identical on
both the New Assignment form and the standalone rubric editor (the second one nested the span inside an
even smaller flex group next to just the Save button, same class of bug). Fixed both with `flex-wrap` on
the container + `basis-full` on the warning span, forcing it onto its own full-width line above the
buttons at any viewport width. Verified with a real screenshot this time, at the same narrow width that
originally reproduced it.
**Lesson for next time**: `get_page_text` confirms a message exists; it says nothing about whether it's
actually legible. When a user says they didn't see something despite the DOM having it, check a real
screenshot at a real (non-huge) viewport before concluding it's a user-side miss.

Full suite 351 passed / 30 skipped after all three (one earlier run this round showed 11 failures / 8
flaky across totally unrelated files — admin, auth, course cards — that self-resolved on a clean rerun;
almost certainly resource contention from having the browser pane open during the run, not a real
regression; the two files actually touched this round passed cleanly in isolation before the clean
full rerun confirmed it).

## Unrelated (23/9): round 3 — 4 more teacher feedback items, unify Grade link, Edit absorbs rubric, no-file assignments skip AI
User sent 4 more items with the same "ask first if unclear" standing instruction. One item (reverse
weight→pts) was already fully implemented by the previous round — explained back, no code change. The
other 3 took several rounds of `AskUserQuestion` to pin down; one round the user explicitly said they
were still confused and asked to be walked through it slowly one question at a time rather than given
option lists — worth remembering for future rounds when a first clarifying question doesn't land.

### Grading page: one "Grade" link on every row, Re-grade hidden for no-file assignments (pushed 78f51fa)
The Review/Recheck link (label changed by status, hidden until an AI score existed) is now one
"ตรวจ"/"Grade" label shown on every row regardless of status — the user's actual desired flow (walked
through step by step) turned out to already match what existed (Re-grade per row → open the link to
check some → Finish Grading to confirm); the only real gap was that the link was unreachable before an
AI pass happened, which blocked grading a no-AI assignment by hand at all. Re-grade (AI) itself is now
hidden when `!assignment.acceptsFiles` — nothing for AI to check. `GradeRow`/`GradeAdjustmentTable`
gained a new `acceptsFiles` prop threaded from `assignment.acceptsFiles`.

### `needsManualScore = isExam || !acceptsFiles`; Edit Assignment absorbs rubric editing inline (pushed e91bc24)
Two independent toggles that both mean "no rubric, manual max score" now share one derived boolean on
both `assignments/new/page.tsx` and `.../edit/page.tsx` — was `isExam`-only. Edit Assignment's rubric
section used to be a separate list of rubric *shells* (add/delete/rename) linking out to a standalone
`rubrics/[rubricId]` route to actually edit criteria; it now embeds `RubricCriteriaEditor` inline exactly
like New Assignment, assuming a single rubric (`linkedRubrics[0]`) like every other rubric-reading spot
in the app already does. The standalone route is deleted (grepped — no other reference). Edit's `<main>`
also switched from a centred `max-w-[700px]` column to full width, matching New and every sibling page.
**Edge case found while implementing**: a legacy/seeded assignment with zero rubrics linked (not exam,
accepts files) would otherwise get stuck with Save permanently disabled (`criteria` seeded as `[]`,
`criteriaPointsOk([])` is always false) — fixed by seeding one default 100-pt criterion when there's
nothing to load from, same fallback New Assignment already starts every fresh form with, and by having
`handleSave` create a rubric via `addRubric` (not just `updateRubric`) when none exists yet.

### Recheck: AI Confidence panel hidden when a submission has no AI score yet (pushed 0b7d4bc)
Since the Grade link is reachable before any AI pass now, recheck opens on genuinely un-scored
submissions for the first time — the AI Confidence badge would show a misleading "Low / 0%" there.
Guarded on `submission.aiScore !== null`; shows a plain "not yet AI-graded" note otherwise. Also fixed
the manual-score panel's label (`!rubric` fallback, built for isExam), which unconditionally said "Exam
assignment — no rubric" even when reached via the acceptsFiles-off path instead — now branches on which
of the two actually applies.

Verified: tsc clean; lint baseline grew by exactly 1 (Edit page's pre-existing `react-hooks/refs`
ref-comparison pattern, extended by the new `criteria` field — same as how `isExam` extended it last
round). Full suite 358 passed / 30 skipped (was 351 before this round: +7 net after also catching 2 more
`Recheck`/`Review`-label test assertions the first commit had missed, surfaced only by a full-suite run,
not the per-file runs during that sub-task). Live-verified in the browser: a no-file assignment's Grading
page shows the Grade link with no Re-grade button on a `not_graded` row; opening it lands on recheck with
"Not yet AI-graded — grading manually" and a working manual Total Score input that persists
(`instructorScore`, `status: "graded"`) on Save; Edit Assignment's inline rubric editor renders an
existing rubric's real criteria (points, % hints, AI Rubric Assistant) exactly like New Assignment's.

## Unrelated (23/9): Edit Assignment layout now fully matches New Assignment (pushed 3c18121)
User: "หน้า edit ให้ทำเหมือนหน้าตอน create assignment เลย" — round 3 above only merged the rubric
editor and matched `<main>`'s max-width; the rest of Edit was still stacked single-column while New
uses a 2-column grid. Converted Edit to the exact same structure: `grid grid-cols-1 xl:grid-cols-2`
(General Info + Description left, Deadline & Score + Submission Settings right), replaced the old
"Back to assignment" chevron button with the same breadcrumb component New uses (Courses / course /
Assignments / current page), switched the Rubric section from a card to New's plain non-card style
(icon+heading+description, full width below the grid), and added New's Enter-doesn't-submit guard on
the form (rubric fields live here too now). Danger Zone (no New equivalent) stays a full-width card
below Rubric. Verified live at 1600px: General Information x≈322, Deadline & Score x≈972 — genuinely
two side-by-side columns, `<main>` maxWidth still `none`. Full suite 358/30 unaffected; lint baseline
unchanged (16 errors, same as the previous round).

## Unrelated (23/9): admin batch — 11 items across Users / Courses / Curriculum, all done and pushed
User sent 11 terse items grouped easy/medium/hard. 5 needed clarification (confirmed via
`AskUserQuestion`, including one answer — cohort removal — that reversed the recommended/narrower
option). Plan file: `C:\Users\ASUS\.claude\plans\lively-tinkering-mitten.md`. Pushed as
`f71dcff`/`218ddd5`/`5d5e162`/`4c15664`(unrelated, same session)/`238abde`/`039ba4a`.

- **Add Teacher role picker removed** (`admin/users/page.tsx` `TeacherModal`) — every teacher created
  here now starts as plain `"teacher"`; TAs are assigned per-course via Collaborators instead, matching
  what the page's own copy already said. Scope boundary: the inline row-edit role selector and CSV
  import's role column are untouched (not what was asked).
- **`cohort` field removed from the whole system**, not just the add-student form (user explicitly chose
  this over the narrower option) — `CohortStudent.cohort`/`Student.cohort` deleted along with
  `cohortYearLabel()`/`getCohorts()`/`getStudentsByCohort()`; Add Student/inline-edit/CSV import all drop
  it; `public/cohort-students-template.csv`, `test-data/students_sample.csv`, and the 4 mock-data JSON
  pairs (public + test-data) had the column/key stripped (verified byte-identical after).
- **Program → real `<select>` dropdown** on Add Student (both add + inline-edit) and on admin Curriculum
  (was a 3-button toggle, functionally constrained already but showing abbreviations) — full names as
  labels via a small `PROGRAM_LABEL` map duplicated per-component, matching this codebase's established
  precedent (not extracted to `src/lib`).
- **Curriculum Label auto-defaults** to `"{program} {year}"` as a real typed-in value now (was only ever
  placeholder ghost text) — a plain derived value gated on a `labelTouched` flag, not a `useEffect`, to
  avoid a new `set-state-in-effect` lint error.
- **Admin Courses: Term 3 added** (`Term` type widened `1|2|"summer"` → `1|2|3|"summer"`) and **Summer
  removed from the create dropdown** (the type itself keeps `"summer"` for reading old data).
- **Primary Teacher is now an autocomplete** (`SearchInput`, same component used elsewhere in the app)
  instead of a plain `<select>` of every teacher — resolves the typed/picked display name back to a
  `teacherId` locally since `SearchInput` only ever returns a string.
- **"Teaching Staff" → "Teacher"** wording in the course-row expand panel.
- **"+ Add Section"** — duplicates an existing course into a new course row (same template/term/year),
  leaving `sectionNumber` and Primary Teacher blank for the admin to fill in fresh; no new `Section`
  entity (a hard Course/Section split stays explicitly out of scope, per `lib/courses.ts`'s own comment).
  Found already built on disk mid-session by a **peer Claude session working the same plan in the same
  working directory** — only the button's discoverability needed fixing (was an unlabeled 13px icon
  identical in weight to Edit/Archive/Delete; now a bordered "+ Section" pill with visible text,
  `aria-label` kept as "Add Section" so the peer's existing test locator still resolves).
- Verified: tsc clean throughout; lint baseline unchanged on every touched file (checked via
  `git stash` + `eslint` diff before/after on each one); full suite 359 passed / 30 skipped; live-verified
  in the browser: Add Teacher/Add Student forms, admin Students table (no Cohort column/filter), Primary
  Teacher autocomplete end-to-end (type → pick suggestion → resolves to id → Create Course), Add Section
  flow, Curriculum dropdown + Label auto-fill.
- **Working-directory note**: this session shares a filesystem with another live Claude session also
  working `admin/courses/page.tsx` off the same plan — coordinated via `SendMessage`/`ListAgents`
  mid-session once both sessions' edits started landing in the same file. Current split: admin/users,
  admin/courses, admin/curriculum are done (this session); `teacher/courses/[id]/clo/page.tsx` (a
  separate "make the CLO page less ugly" ask) is the peer session's, deliberately left untouched here.

## Unrelated (23/9): teacher CLO page redesign (pushed daa27ef) — the peer session's half of the split above
User: "teacher clo รูปที่แนบ ที่ 2 น่าเกลียดไปไหม ตั้งใจทำหน่อย" (screenshot: plain CODE/CLO TEXT/LINKED
CRITERIA/ACTIONS table, every row repeating the identical amber "No linked criteria" warning).
- One page-level info banner replaces the per-row warning — it's true of every CLO at once (the
  CLO↔criteria linking feature doesn't exist yet, deferred since 19/9), not 4 separate facts.
- Card-per-CLO (code badge + text + hover-reveal Edit/Delete) instead of a dense `<table>` — CLO text is
  a full sentence, not tabular data; matches the card pattern already used for rubric criteria on the
  assignment detail page. Edit/Delete only need to be visible on hover/focus, not permanently in their
  own column.
- Add/Edit CLO moved into the shared `Modal` component (DESIGN.md §9a) — the inline panel appended below
  the table was the one form in this app still not using the centred-popup pattern everything else
  converted to on 20/9.
- Added a one-line subtitle explaining what a CLO is, for context a bare heading didn't give.
- Verified: tsc/lint clean; ran `e2e/hwai.spec.ts` + `tests/teacher-batch-3.spec.ts` (the two files that
  touch this page — neither asserts on table/inline-panel structure, both passed unchanged) plus a full
  suite run, 359 passed / 30 skipped.

## Not done / open
- Score Book is read-only by design; if the teacher wants to type scores into cells, that is a new decision (Grading pages own edits today). Finalized assignments are additionally locked from click-through (23/9, this batch).
- `gradeLetter` still exists locally in the two per-assignment results pages (the Score Book uses `lib/scoreBook.ts`); could be unified later.
- Group assignments: recheck already fans the saved score out to every teammate's `Submission`, so `criterionScores` is saved per teammate too — not specifically re-verified beyond the individual-assignment test above.
- The mock re-grade on the per-assignment Grading page still uses `Math.random` (pre-existing lint error).
- Hook still runs the whole e2e suite per edit (~2 min); user hasn't chosen a lighter `TEST_CMD`.

## Gotchas
- Pre-existing lint baseline must not grow (admin/users ×4, recheck ×1, grading page purity ×1, teacher/courses ×3, student/courses ×2, import ×2, collaborators ×1, dashboard ×1).
- Files are CRLF (`core.autocrlf=true`); node edit scripts must normalise `\r\n`; write scripts with the Write tool, not heredoc-with-backticks.
- Playwright `addInitScript` re-runs on every navigation — guard seeding with `sessionStorage`.
- Sticky table headers need explicit heights (`HEAD1_H` in the Score Book) so the second header row knows where to stick.

## 24/9: row actions always visible (CLO, Curriculum) + teacher Import Students is a popup
- CLO cards and admin Curriculum course-template rows had Edit/Delete hidden until hover — no other page does that. Now always visible (`f6be954`, `a8cfd19`). No hover-reveal actions remain in `src`.
- Teacher `/students/import` route DELETED; the same flow lives in `components/ImportCourseStudentsModal.tsx` (upload → preview → done, mount-on-open like `EnrollStudentModal`), opened from both Import buttons on the roster page. Behaviour unchanged: each ID is cross-checked against the cohort DB, real name/email win over the CSV's.
- Tests moved from the route to the popup (`teacher-p4`, `add-student-popups`, `e2e/hwai`), plus a new "teacher · Import Students (CSV)" case in `popups-all`. Suite 360 passed / 30 skipped.

## 24/9: navy/teal chrome theme for every role + navbar↔sidebar colours swapped
- `NavThemeToggle.tsx` (shared) is now in the Teacher `Navbar`, `AdminShell` and `StudentShell` top bars. Admin/Student headers switched `--bg-nav` → `--navbar-bg` so they follow the theme (they never did before).
- Swap ("ลองสลับสี", easy to revert — tokens only, `globals.css`): navy navbar `#243C5A` / sidebar `#1A2D45`; teal navbar `#084541` / sidebar `#0F766E` (both light and dark). Dark-navy is unchanged (both were already `#0A1218`).
- The lighter teal sidebar broke the old hard-coded `text-white/55` (~2.8:1) → new `--sidebar-text-muted` token used by the 3 sidebars (0.55 navy, 0.9 teal ≈ 4.76:1, measured in-browser).
- New `tests/nav-theme.spec.ts` (3 roles × navy default + teal switch/persist). Note the admin sidebar has a 200ms colour transition — assert with `toHaveCSS`, not a one-shot read.

## 24/9: withdrawn students leave the class numbers + AI Rubric Assistant asks for a brief and shows levels
- **Withdrawn students** (`lib/students.ts` `isWithdrawn` / `withdrawnIds`): out of every class-level number and hidden behind an "Enrolled / Withdrawn" `WithdrawnTabs` (built on `PillTabBar`, renders nothing until someone has withdrawn — user picked "hide like archive, separate tab"). Score Book (tab; withdrawn tab hides stat cards + class-average footer), per-assignment Grading (active rows feed the stats and `Finish Grading`; tab lists withdrawn), course Grading, course Overview, Assignments header and My Courses card (count + "All Graded"/"Active") all exclude them. Roster page still shows everyone (that is where you withdraw / re-enroll). A group row is "withdrawn" only if every member is.
- **AI Rubric Assistant** (`RubricCriteriaEditor.tsx`): now a shared `Modal` with 3 steps — brief (textarea pre-filled from assignment name + description, new `assignmentDescription` prop passed by New and Edit; Generate disabled while empty) → loading → suggestions, each criterion with its 4-level rubric (Excellent/Good/Fair/Needs Improvement, 2×2). Apply keeps exactly the previewed levels (was 3 short generic ones). The brief doesn't change the mock output yet.
- Tests: new `withdrawn-students.spec.ts` (6), 2 new + 1 updated AI assistant tests in `assignment-create-rubric.spec.ts`, `e2e/hwai.spec.ts` AI test updated. Suite 374 passed / 30 skipped.

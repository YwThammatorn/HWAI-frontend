# Phase 1 Model Validation — Scenario Walkthrough

No code exists yet for this model, so "testing" it means tracing real scenarios (from the reviewer's 10 questions and the 4/9 meeting decisions) through the drafted entities by hand and checking each one resolves cleanly. This is the gate before Phase 2 draws the ER diagram from it — a wrong model is cheap to catch here, expensive to catch after the diagram (and worse, after code) exists.

Format per scenario: **Given / When / Then**, then a verdict — ✅ PASS (the model answers this cleanly) or ⚠ GAP (found a real hole, noted for Phase 1 follow-up or Phase 4).

---

## S1 — Two sections of the same course, same term

**Given** `CourseTemplate("UX/UI Design")` under curriculum CE2565
**When** the department opens 2 sections in 2569/1 (section 001, section 002), possibly different teachers
**Then** two `Section` rows exist, same `courseTemplateId`, different `sectionNumber` — CLO/rubric/roster/scores attach per-`Section.id`, so section 001 and 002 never share data by accident.

**Verdict:** ✅ PASS. This is exactly what `Course.section: string` (today's flat field) could not represent — two sections would have required two full `Course` record duplicates, with no shared link back to "these are the same course."

---

## S2 — One person, Teacher in one section, TA in another, same term

**Given** Account "อ.สมชาย" teaches Section A, and separately assists as TA in Section B (different course) this term
**When** the system checks his role per section
**Then** two `SectionRole` rows exist: `{accountId: สมชาย, sectionId: A, role: "teacher"}` and `{accountId: สมชาย, sectionId: B, role: "ta"}` — no conflict, no single "role" field to fight over.

**Verdict:** ✅ PASS. This is the core fix for reviewer issue 1.2 — today's `AuthUser.role` (one flat field) cannot represent this at all.

---

## S3 — Student drops out mid-program, but has historical enrollment records

**Given** a student enrolled in 3 past sections over 2 years, then withdraws from the program entirely
**When** admin sets their account to inactive
**Then** `Account.status = "inactive"` — but their 3 `Enrollment` rows (each with its own `enrollmentStatus`, e.g. `"enrolled"` for completed terms) are untouched. Historical grades/CLO attainment stay queryable.

**Verdict:** ✅ PASS. This is exactly meeting decision #1 — account status and enrollment status are genuinely separate fields on separate entities, not one flag doing double duty.

---

## S4 — Same course, two sections, different publish policy

**Given** Section A (อาจารย์ x) sets `publishMode: "manual"`, Section B (อาจารย์ y) of the same `CourseTemplate` sets `publishMode: "auto"`
**When** TA finishes grading in both sections
**Then** Section A's scores wait for teacher approval; Section B's publish immediately. Both read from `Section.publishMode`, not a course-wide setting.

**Verdict:** ✅ PASS. Confirms `publishMode` was correctly placed on `Section`, not on `CourseTemplate` or globally.

---

## S5 — Two TAs split grading by week, no overlap or gap

**Given** Section has 8 weeks of submissions, TA1 and TA2
**When** TA1 gets `GradingAssignment{scope:{type:"week", weekNumbers:[1,2,3,4]}}` and TA2 gets `{weekNumbers:[5,6,7,8]}`
**Then** every submission's week number maps to exactly one `GradingAssignment` row — queryable, no double-assignment.

**Verdict:** ✅ PASS *for the week-numbers themselves*. ⚠ **GAP found**: nothing in the model checks that the two `GradingAssignment` rows for a `Section` don't overlap or leave gaps — that's a validation rule, not a data-shape problem, but it needs to live somewhere (form validation when the teacher sets up the split). Flagging for Phase 4, not a blocker for the ER diagram.

---

## S6 — TA cannot edit roster or settings; co-teacher can

**Given** `SectionRole{role:"ta"}` and `SectionRole{role:"co-teacher"}` in the same section
**When** each tries to open the roster-edit or settings screen
**Then** TA is blocked (`permissions.canManageRoster/canEditSettings` hardcoded false in the type), co-teacher is allowed (no restriction — inherits full teacher-equivalent access since `permissions` is only ever set for TA rows).

**Verdict:** ✅ PASS — this is the exact bug the self-review caught during Phase 1 drafting (co-teacher was almost defaulted to TA-level permissions) and the fix holds up under this scenario.

---

## S7 — Student under an old curriculum takes a course listed under a newer one

**Given** a student admitted under CE2560 (`Account.curriculumVersionId` = CE2560) enrolls in a general-elective `Section` whose `CourseTemplate.curriculumVersionId` = CE2565
**When** the system records the `Enrollment`
**Then** it succeeds — `Enrollment` only needs `accountId` + `sectionId`, no curriculum-match constraint enforced.

**Verdict:** ✅ PASS, but worth stating explicitly: this is an *intentional* decoupling, not an oversight. Real universities allow cross-curriculum enrollment (electives, retakes after a curriculum revision) — the model doesn't block it. If HWAI actually needs to *restrict* this later, that's a business rule to add on top, not a missing FK.

---

## S8 — TA numbering never touches student sequence numbers

**Given** Section has 30 enrolled students (`Enrollment.sequenceNumber` 1–30) and 2 TAs
**When** a 31st student is added mid-term
**Then** they get `sequenceNumber: 31`. TAs live in `SectionRole`, a completely separate table — they never appear in, or shift, the `Enrollment` sequence.

**Verdict:** ✅ PASS. Matches your clarification directly ("แยกกันชัดเจน") — the separation is structural, not just a convention someone has to remember.

---

## ⚠ Gap claimed here on 4/9/2569 — ❌ RETRACTED 5/9/2569, was wrong

Original text claimed "CLO, Rubric, Assignment, Submission have no shared TypeScript types at all today... page-local mock arrays." **This was false.** When Phase 4 actually started, `src/lib/clo.ts`, `src/lib/assignments.ts` (Assignment + Submission + Rubric + RubricCriterion) all turned out to already have complete, working types with real Context + Provider + localStorage persistence (`CLOProvider.tsx`, `AssignmentProvider.tsx`). The `teacher/history/page.tsx` mock array I cited as evidence was real, but it was one page's local display data, not proof that the underlying types didn't exist elsewhere — I generalized from a single grep hit without checking `src/lib/*.ts` directly.

**Also wrong in the original Phase 1 model:** the ER diagram and this validation were built against `src/types/course.ts` (which has `code`, `semester`, `year`, `section` fields) — that file turned out to be **dead code, imported nowhere**. The `Course` type actually used by 28+ files (`src/lib/courses.ts`) is simpler and had none of those fields before Phase 4 added them. The *target* model (Account/Section/Role/GradingAssignment) drafted in Phase 1 was still the right direction — just the description of the *current* state it was diffing against was inaccurate in two places. Lesson: when validating a model against "current code," read the file the app actually imports, not the one that merely has a plausible-sounding name.

**Actual Phase 4 scope, corrected:**
1. `Course` (`src/lib/courses.ts`) — add Section fields (`courseTemplateId`, `academicYear`, `term`, `sectionNumber`, `gradingSource`, `publishMode`, `code`) as new optional fields — done, additive, no rename.
2. `CohortStudent` → add `status`, `curriculumVersionId` — done. `taAssignments` kept (deprecated, not removed) until a real `SectionRole` UI replaces the admin/users TA-tagging flow that still reads it.
3. `Student` → add `sequenceNumber`, `enrollmentStatus` — done, **and fixed a real bug found in the process**: `StudentProvider.addStudents` was replacing the entire roster on every CSV import instead of appending, which directly broke the meeting's "เพิ่มกลางเทอมได้เลขต่อท้าย" requirement. Fixed and verified via a scripted two-batch import (sequence continued 1→2→3 across imports, second batch correctly tagged `added-midterm`, first batch's students were not wiped).
4. `CurriculumVersion`, `CourseTemplate`, `SectionRole`, `GradingAssignment` — genuinely new, created with full Context+Provider+localStorage in this pass. `CLO` needed no new type (see retraction above).

**Still not done (deliberately out of scope for this pass):** no new UI reads or writes these new fields/entities yet (no curriculum management screen, no section-role assignment screen, no grading-split config screen) — the data layer exists and is wired into the app, but nothing calls it. That UI work is Phase 5.

**`GradingAssignment` overlap/gap validation** (from S5) is still a form-level business rule to build when the Phase 5 TA-split config screen gets built — not a schema gap.

---

## Verdict

7 of 8 scenarios pass cleanly, the 8th needs a validation rule (not a model change). One real scope gap found (CLO/Rubric/Assignment have no shared types yet) — added to Phase 4 in `PLAN.md`. Model is solid enough to proceed to Phase 2 (ER diagram).

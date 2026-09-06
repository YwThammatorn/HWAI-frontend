# Phase 2 Validation — LIST PAGE MVP + ER Diagram

Same discipline as `docs/phase1-model-validation.md`: check the draft against reality before it goes any further, not after packaging it into something polished.

## Check 1 — Route completeness (LIST PAGE MVP)

**Method:** `find src/app -name page.tsx` against the first-draft table.

**Result: ⚠ GAP found and fixed.** First draft covered 24 screens; the real app has 36 `page.tsx` routes. Missing:

| Missing route | Why it was missed |
|---|---|
| `/register` | Not in `project-hwai-agent` memory's "Key Routes" list at all — that list was itself incomplete, and the draft trusted memory over the actual file tree |
| `/student/courses/[secId]` | Course-overview page for students — draft jumped straight to classwork/announcements/evaluation sub-pages, skipped the parent |
| `/teacher/courses/[id]/assignments` (list), `/new`, `/[id]` (detail), `/edit`, `/results`, `/rubrics/[rubricId]` | Draft only listed `grading` and `recheck` — the rest of the assignment lifecycle (create → view → edit → results → rubric) got skipped entirely |
| `/teacher/courses/new` | Course creation itself, not just course management |
| `/teacher/profile`, `/teacher/settings` | Basic account screens, not mentioned at all in first draft |

**Root cause:** the first draft was built from memory (`project-hwai-agent.md`'s route list) instead of the actual file tree. Memory is a point-in-time snapshot and was already stale/incomplete on this exact point — the lesson from `feedback-dev-style` ("verify against current code before asserting as fact") applied to *my own* draft, not just to old memory claims about other things.

**Fixed in:** `docs/phase2-list-page-mvp.md` — now cross-checked 1:1 against `find src/app -name page.tsx` output, all 36 routes accounted for (34 real screens + `/` and `/teacher` root redirects excluded as non-UI).

## Check 2 — ER diagram fidelity to the Phase 1 model

Walking the diagram against the 7 entities drafted in `PLAN.md` Phase 1:

| Entity | In diagram? | Relationship shown correctly? |
|---|---|---|
| `Account` | ✅ | Hub node, 3 outgoing edges (Enrollment, SectionRole, GradingAssignment) — matches |
| `CurriculumVersion` | ✅ | → `CourseTemplate` (owns) — matches |
| `CourseTemplate` | ✅ | → `Section` (offered as) — matches |
| `Section` | ✅ | Emphasized visually (green fill), all 3 Account-branches converge on it — matches the "everything attaches to Section, not Course" point from reviewer issue 1.1 |
| `Enrollment` | ✅ | Account → Enrollment → Section, labeled "(นักศึกษา)" | 
| `SectionRole` | ✅ | Account → SectionRole → Section, labeled with issue 1.2 callout |
| `GradingAssignment` | ✅ | Account (as TA) → GradingAssignment → Section |

**Result: ✅ PASS.** All 7 entities present, no drift from the Phase 1 draft, cardinality direction matches (arrows point from the "many" side toward what it references, consistent throughout).

**Minor note, not a blocker:** the diagram doesn't show `Account.curriculumVersionId` as clearly optional in visual weight (dashed line is there, but easy to miss against 6 other solid connectors). Fine for an internal draft; would tighten before a final send if the professor asks about it specifically.

## Check 3 — Does "MVP" actually track the professor's own stated priorities?

Cross-checked every MVP-tagged *new, unbuilt* screen against reviewer issues marked "หัวใจโครงงาน" (issues 6, 7):

- Grading-split config → not itself marked "หัวใจ" by the professor, but directly required by meeting decision #3 (TA work-splitting) — correctly MVP, correctly *not* over-claimed as "หัวใจ"
- AI Calibration Report → directly answers issue 7, which *is* marked "หัวใจโครงงาน" — correctly MVP, correctly tagged in the Q&A section

**Result: ✅ PASS.** No screen is over- or under-prioritized relative to what the professor actually flagged as central.

## Outcome

Fixed the route-completeness gap (`docs/phase2-list-page-mvp.md` now complete). ER diagram passes as-drafted. Content is ready — **packaging into a single send-able document is a separate, explicit step, not bundled into this validation pass.**

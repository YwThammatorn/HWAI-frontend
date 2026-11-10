# API Contract — HWAI Agent

A reference for whoever builds the real backend. Everything below is generated straight off
`src/lib/api/*.ts` — the frontend's typed "Phase 1" data layer — so it can't silently drift from the
code the way hand-written API docs usually do. If a domain's shape changes, its `lib/api/*.ts` file
fails to compile until it's updated, which is also why this file exists as `.ts`, not just prose.

## How the frontend is wired today

`src/lib/api/` is a **complete but currently unused** typed contract. Every function has the real
endpoint call written as a comment directly above a localStorage-backed implementation that runs
today, e.g.:

```ts
export async function getCourses(): Promise<Course[]> {
  // return client.get<Course[]>("/api/courses");
  return readLocal();
}
```

`grep -rl "from \"@/lib/api" src` outside `lib/api/` itself returns nothing — **no component or
Context Provider calls into this layer**. The live app (`AssignmentProvider.tsx`, `CourseProvider.tsx`,
etc. — one per domain, composed in `src/app/layout.tsx`) reads/writes `localStorage` directly and
assumes it's always synchronously available with no loading/error state. That's a deliberate, separate
follow-up (see **Open follow-ups** below), not something this pass touches — this pass only had to not
change how the app behaves today, and extending an already-unused layer can't.

**When the backend exists**: uncomment the `client.*()` line, delete the localStorage body, done — the
function's signature is already the async contract every future caller will use. No caller changes
needed *at that point*; wiring the Providers to actually call these functions is the separate follow-up.

## Auth

- `Authorization: Bearer <token>` header, added automatically by `src/lib/api/client.ts` when a token
  is present. Base URL from `NEXT_PUBLIC_API_URL` (empty string today — same-origin).
- **Open gap, not solved here**: `AuthContext.tsx`'s `AuthUser` (the real session shape, stored under
  `localStorage["hwai_user"]`) has no `token` field, and nothing in the app ever sets one — this demo
  never had real login. `client.ts` already reads `JSON.parse(hwai_user)?.token` and quietly sends no
  `Authorization` header when it's absent, so nothing breaks today; whoever builds real login needs to
  add a `token` field to `AuthUser` and populate it on sign-in before this does anything.
- Errors: any non-2xx response throws `ApiError { status: number, message: string }` (`client.ts`).
  `message` is the response body text, or `res.statusText` if the body is empty. `204 No Content`
  resolves as `undefined`.

## Domains

Each function below is `async`, already matches its real TypeScript type import (see the `lib/api/*.ts`
file for the exact type), and the endpoint/method is the one suggested in that file's comment — adjust
freely, these are starting points, not a spec the frontend enforces.

### Auth — `lib/api/auth.ts`
| Function | Verb + path | Request | Response |
|---|---|---|---|
| `login` | `POST /api/auth/login` | `{ email, password }` | `AuthUser` |
| `register` | `POST /api/auth/register` | `{ name, email, password, role }` | `AuthUser` |
| `logout` | `POST /api/auth/logout` | — | `void` |
| `me` | `GET /api/auth/me` | — | `AuthUser` |

### Courses — `lib/api/courses.ts` (`Course` = a *section* instance, not a catalog entry)
| Function | Verb + path | Request | Response |
|---|---|---|---|
| `getCourses` | `GET /api/courses` | — | `Course[]` |
| `createCourse` | `POST /api/courses` | `Omit<Course, "id"\|"createdAt"\|"updatedAt">` | `Course` |
| `updateCourse` | `PATCH /api/courses/:id` | `Partial<Omit<Course, "id"\|"createdAt">>` | `Course` |
| `deleteCourse` | `DELETE /api/courses/:id` | — | `void` |

### Assignments, submissions, rubrics — `lib/api/assignments.ts`
| Function | Verb + path | Request | Response |
|---|---|---|---|
| `getAssignments` | `GET /api/courses/:courseId/assignments` | — | `Assignment[]` |
| `createAssignment` | `POST /api/courses/:courseId/assignments` | `Omit<Assignment, "id"\|"createdAt"\|"updatedAt">` | `Assignment` |
| `updateAssignment` | `PATCH /api/assignments/:id` | `Partial<Omit<Assignment, "id"\|"courseId"\|"createdAt">>` | `Assignment` |
| `deleteAssignment` | `DELETE /api/assignments/:id` | — | `void` |
| `getSubmissions` | `GET /api/assignments/:assignmentId/submissions` | — | `Submission[]` |
| `updateSubmission` | `PATCH /api/submissions/:id` | `Partial<Pick<Submission, "aiScore"\|"instructorScore"\|"instructorComment"\|"criterionComments"\|"criterionScores"\|"status"\|"fileUrl"\|"attachments"\|"aiEvidence"\|"snapshot">>` | `Submission` |
| `getRubrics` | `GET /api/assignments/:assignmentId/rubrics` | — | `Rubric[]` |
| `createRubric` | `POST /api/assignments/:assignmentId/rubrics` | `Omit<Rubric, "id"\|"createdAt"\|"updatedAt">` | `Rubric` |
| `updateRubric` | `PATCH /api/rubrics/:id` | `Partial<Omit<Rubric, "id"\|"assignmentId"\|"createdAt">>` | `Rubric` |
| `deleteRubric` | `DELETE /api/rubrics/:id` | — | `void` |

Each rubric criterion may carry `cloIds?: string[]` (11/10/2569) — the ids of the course's CLOs (see the CLO endpoints below) it measures. It is metadata: it never changes how a score is computed, so a `PATCH` that only changes `cloIds` must not reset graded submissions. The CLO page lists, per CLO, the assignments that have a criterion tagged with it (assignment names only, once each, derived client-side from the rubrics) — since 15/10/2569 it shows no attainment figure, points or averages, so nothing needs to be computed from `Submission.criterionScores` for it.

### Notifications — `lib/api/notifications.ts` ⚠️ speculative
No live feature backs this today (the bell is behind `NOTIFICATIONS_DISABLED` in `lib/featureFlags.ts`,
and even enabled it was never persisted — plain `useState` in `Navbar.tsx`/`teacher/notifications/page.tsx`).
Treat this section as a reasonable starting shape, not a spec pulled from working behavior.
| Function | Verb + path | Request | Response |
|---|---|---|---|
| `getNotifications` | `GET /api/notifications` | — | `Notif[]` |
| `markRead` | `PATCH /api/notifications/:id/read` | — | `void` |
| `markAllRead` | `POST /api/notifications/read-all` | — | `void` |
| `dismissNotification` | `DELETE /api/notifications/:id` | — | `void` |

### Students (per-section roster) — `lib/api/students.ts`
| Function | Verb + path | Request | Response |
|---|---|---|---|
| `getStudents` | `GET /api/courses/:courseId/students` | — | `Student[]` |
| `addStudents` | `POST /api/courses/:courseId/students` | `Omit<Student, "id"\|"courseId">[]` | `Student[]` |
| `updateStudent` | `PATCH /api/students/:id` | `Partial<Omit<Student, "id"\|"courseId">>` | `Student` |
| `removeStudent` | `DELETE /api/students/:id` | — | `void` |

**Rule the server must enforce on `addStudents` (4/10/2569): one section = one program.** Every student enrolled in a
section must have the same `CohortStudent.program` (CE / CECS / CEI) as that section. The section's program is the program
of the curriculum its `courseTemplateId` belongs to; a section with no curriculum takes the program of the first
non-withdrawn student enrolled. Reject a student from another program (suggest `409`/`422` with the student's program and the
section's) — the frontend already blocks it in the UI (`lib/sectionProgram.ts`), but the UI check is not a substitute.
When a batch contains a mix, enrol the matching rows and report the rest per row, as the CSV import preview does.

### Cohort students (account-level) — `lib/api/cohort-students.ts`
| Function | Verb + path | Request | Response |
|---|---|---|---|
| `getCohortStudents` | `GET /api/cohort-students` | — | `CohortStudent[]` |
| `addCohortStudents` | `POST /api/cohort-students` | `Omit<CohortStudent, "id">[]` | `CohortStudent[]` |
| `updateCohortStudent` | `PATCH /api/cohort-students/:id` | `Partial<Omit<CohortStudent, "id">>` | `CohortStudent` |
| `removeCohortStudent` | `DELETE /api/cohort-students/:id` | — (cascade-delete this account's section-roles + grading-assignments server-side) | `void` |

### Grading categories — `lib/api/grading-categories.ts`
| Function | Verb + path | Request | Response |
|---|---|---|---|
| `getGradingCategories` | `GET /api/courses/:courseId/grading-categories` | — | `GradingCategory[]` |
| `addGradingCategory` | `POST /api/courses/:courseId/grading-categories` | `Omit<GradingCategory, "id"\|"createdAt"\|"updatedAt">` | `GradingCategory` |
| `updateGradingCategory` | `PATCH /api/grading-categories/:id` | `Partial<Omit<GradingCategory, "id"\|"courseId"\|"createdAt">>` | `GradingCategory` |
| `removeGradingCategory` | `DELETE /api/grading-categories/:id` | — | `void` |

### Curriculum versions + course templates — `lib/api/curriculum.ts`
| Function | Verb + path | Request | Response |
|---|---|---|---|
| `getCurriculumVersions` | `GET /api/curriculum-versions` | — | `CurriculumVersion[]` |
| `addCurriculumVersion` | `POST /api/curriculum-versions` | `Omit<CurriculumVersion, "id">` | `CurriculumVersion` |
| `updateCurriculumVersion` | `PATCH /api/curriculum-versions/:id` | `Partial<Omit<CurriculumVersion, "id">>` | `CurriculumVersion` |
| `removeCurriculumVersion` | `DELETE /api/curriculum-versions/:id` | — (cascade-delete its course templates) | `void` |
| `getCourseTemplates` | `GET /api/curriculum-versions/:id/course-templates` | — | `CourseTemplate[]` |
| `addCourseTemplate` | `POST /api/curriculum-versions/:id/course-templates` | `Omit<CourseTemplate, "id">` | `CourseTemplate` |
| `updateCourseTemplate` | `PATCH /api/course-templates/:id` | `Partial<Omit<CourseTemplate, "id"\|"curriculumVersionId">>` | `CourseTemplate` |
| `removeCourseTemplate` | `DELETE /api/course-templates/:id` | — | `void` |

### Managed teachers — `lib/api/managed-teachers.ts`
| Function | Verb + path | Request | Response |
|---|---|---|---|
| `getManagedTeachers` | `GET /api/managed-teachers` | — | `ManagedTeacher[]` |
| `addManagedTeacher` | `POST /api/managed-teachers` | `Omit<ManagedTeacher, "id"\|"courseIds"\|"status">` | `ManagedTeacher` |
| `importManagedTeachers` | `POST /api/managed-teachers/import` | `Omit<ManagedTeacher, "id"\|"courseIds"\|"status">[]` | `ManagedTeacher[]` |
| `updateManagedTeacher` | `PATCH /api/managed-teachers/:id` | `Partial<Omit<ManagedTeacher, "id">>` | `ManagedTeacher` |
| `removeManagedTeacher` | `DELETE /api/managed-teachers/:id` | — (cascade, same as cohort-students) | `void` |
| `setManagedTeacherStatus` | `PATCH /api/managed-teachers/:id/status` | `{ status: "active"\|"inactive" }` | `void` |
| `assignTeacherToCourse` | `POST /api/managed-teachers/:id/courses/:courseId` | — | `void` |
| `unassignTeacherFromCourse` | `DELETE /api/managed-teachers/:id/courses/:courseId` | — | `void` |

### Section roles ("Collaborators") — `lib/api/section-roles.ts`
There is no separate "Collaborator" resource — a collaborator on a course *is* a `SectionRole` row
(`role: "co-teacher" | "ta"`) plus a matching entry in `ManagedTeacher.courseIds`. Keep the two in sync
server-side on add/remove (the live frontend does it with two separate client calls today).
`hasPermission()` is a pure client-side check over already-fetched roles — no endpoint for it.
| Function | Verb + path | Request | Response |
|---|---|---|---|
| `getSectionRoles` | `GET /api/courses/:courseId/roles` | — | `SectionRole[]` |
| `addSectionRole` | `POST /api/courses/:courseId/roles` | `Omit<SectionRole, "id"\|"permissions">` | `SectionRole` |
| `removeSectionRole` | `DELETE /api/section-roles/:id` | — | `void` |

### Student groups — `lib/api/student-groups.ts`
| Function | Verb + path | Request | Response |
|---|---|---|---|
| `getStudentGroups` | `GET /api/assignments/:assignmentId/groups` | — | `StudentGroup[]` |
| `addStudentGroup` | `POST /api/assignments/:assignmentId/groups` | `Omit<StudentGroup, "id"\|"createdAt"\|"updatedAt">` | `StudentGroup` |
| `updateStudentGroup` | `PATCH /api/student-groups/:id` | `Partial<Pick<StudentGroup, "name"\|"memberStudentIds">>` | `StudentGroup` |
| `removeStudentGroup` | `DELETE /api/student-groups/:id` | — | `void` |

### Weekly plan — `lib/api/weekly-plan.ts`
| Function | Verb + path | Request | Response |
|---|---|---|---|
| `getWeeklyPlan` | `GET /api/courses/:courseId/weekly-plan` | — | `WeeklyPlanItem[]` |
| `addWeeklyPlanItem` | `POST /api/courses/:courseId/weekly-plan` | `Omit<WeeklyPlanItem, "id"\|"createdAt"\|"updatedAt">` | `WeeklyPlanItem` |
| `updateWeeklyPlanItem` | `PATCH /api/weekly-plan/:id` | `Partial<Omit<WeeklyPlanItem, "id"\|"courseId"\|"createdAt"\|"updatedAt">>` | `WeeklyPlanItem` |
| `removeWeeklyPlanItem` | `DELETE /api/weekly-plan/:id` | — | `void` |

### Teaching materials — `lib/api/teaching-materials.ts`
`source: "upload"` materials store a `lib/fileStorage.ts` key in `ref` today; a real backend should
resolve uploads to an object-storage URL server-side so `ref` stays a plain string either way.
| Function | Verb + path | Request | Response |
|---|---|---|---|
| `getTeachingMaterials` | `GET /api/courses/:courseId/materials` | — | `TeachingMaterial[]` |
| `addTeachingMaterial` | `POST /api/courses/:courseId/materials` | `Omit<TeachingMaterial, "id"\|"createdAt"\|"updatedAt">` | `TeachingMaterial` |
| `removeTeachingMaterial` | `DELETE /api/teaching-materials/:id` | — | `void` |

### Announcements — `lib/api/announcements.ts`
`scope: "all-sections"` fan-out is computed client-side today (`announcementReachesCourse()` in
`lib/announcements.ts`, matching `courseTemplateId`/`term`/`academicYear` against every loaded
`Course`). The backend can keep doing that (return everything, let the client filter) or resolve the
fan-out server-side — either way `getAnnouncements`'s signature doesn't need to change.
| Function | Verb + path | Request | Response |
|---|---|---|---|
| `getAnnouncements` | `GET /api/courses/:courseId/announcements` | — | `Announcement[]` |
| `addAnnouncement` | `POST /api/courses/:courseId/announcements` | `Omit<Announcement, "id"\|"createdAt"\|"updatedAt">` | `Announcement` |
| `removeAnnouncement` | `DELETE /api/announcements/:id` | — | `void` |

### Course Learning Outcomes (CLOs) — `lib/api/clo.ts`
| Function | Verb + path | Request | Response |
|---|---|---|---|
| `getCLOs` | `GET /api/courses/:courseId/clos` | — | `CLO[]` |
| `addCLO` | `POST /api/courses/:courseId/clos` | `Omit<CLO, "id"\|"createdAt"\|"updatedAt">` | `CLO` |
| `updateCLO` | `PATCH /api/clos/:id` | `Partial<Omit<CLO, "id"\|"courseId"\|"createdAt"\|"updatedAt">>` | `CLO` |
| `removeCLO` | `DELETE /api/clos/:id` | — | `void` |

### Grading assignments (TA scoping) — `lib/api/grading-assignments.ts`
| Function | Verb + path | Request | Response |
|---|---|---|---|
| `getGradingAssignments` | `GET /api/courses/:courseId/grading-assignments` | — | `GradingAssignment[]` |
| `addGradingAssignment` | `POST /api/courses/:courseId/grading-assignments` | `Omit<GradingAssignment, "id">` | `GradingAssignment` |
| `updateGradingAssignment` | `PATCH /api/grading-assignments/:id` | `Partial<Omit<GradingAssignment, "id"\|"courseId">>` | `GradingAssignment` |
| `removeGradingAssignment` | `DELETE /api/grading-assignments/:id` | — | `void` |
| `removeGradingAssignmentsByTa` | `DELETE /api/grading-assignments?taAccountId=:id` | — | `void` |
| `removeGradingAssignmentsByTaInCourse` | `DELETE /api/courses/:courseId/grading-assignments?taAccountId=:id` | — | `void` — called when the TA's role on that course is removed |
| `removeAssignmentFromScopes` | server-side side effect of `DELETE /api/assignments/:id` | — | — — the deleted assignment's id is dropped from every scope |

**Assigned work (10/11/2569, advisor R28–R30).** The only scope the front end writes is `{ type: "assignments"; assignmentIds: string[] }` — one record per TA per course, whole assignments (the `week` / `group` / `all` / `custom` scopes belong to the archived first Grading Split page and are not read). `taAccountId` is the TA's `CohortStudent.id` (the id their `SectionRole` is keyed on). **The server must enforce it**, the UI only hides: a TA (a `ta` section role whose holder is not enrolled in that subject that term) may list, read, grade and see the Score Book columns of **only** the assignments in their scope — every `GET /api/assignments/:id`, `/submissions`, `PATCH /api/submissions/:id` outside it is `403`; a course's assignment list, "to grade" counts and Score Book for a TA are computed over the same set. Only the primary teacher or a role with `canEditSettings` may write these records. A TA's queue figures are `waiting = submissions not graded (incl. need_review)` and `graded = submissions graded` over that set, withdrawn students left out — the same definitions as the teacher's "N to grade" (`lib/taWork.ts` `queueFigures`). The TA never gets Total / class average / Class summary (`useCan().seeTotals`). Console command [30] seeds a TA together with their work.

## Open follow-ups (deliberately not done in this pass)

1. **Wire the Providers.** Every `*Provider.tsx`/`*Context.tsx` in `src/app/layout.tsx`'s provider tree
   still reads/writes `localStorage` directly — none of them call into `lib/api/*`. That's a real,
   separate refactor: today's Providers assume synchronous, always-succeeds storage access with no
   `loading`/`error` state anywhere, and a real API needs both. Do this only once there's an actual
   backend to point at, so it can be tested against something real rather than guessed at.
2. **Real auth/session.** No `token` field exists yet (see **Auth** above) — needs to land alongside
   whatever backend auth endpoint gets built.
3. File uploads (`lib/fileStorage.ts`, used by submissions/materials/announcements attachments) aren't
   covered here — they're a distinct concern (multipart or presigned-URL upload flow) from the CRUD
   endpoints above.


### Assignment.gradingMode (11/10/2569)
`gradingMode?: "ai" | "manual"` — how the teacher grades: the AI scores first (default) or by hand with no AI result shown. An exam or an assignment without files is always manual regardless of this field. Switching to manual clears scores that only the AI produced (status back to not_graded); the teacher's own scores stay.

### Assignment.rubricRestartedAt (22/10/2569)
`rubricRestartedAt?: string` (ISO time) — set when the rubric's scoring was changed after grading had started and the earlier scores were cleared (work back to `not_graded`). It only labels the AI action "Regrade with new rubric" and shows a banner on the assignment's Grading page; the backend clears it as soon as the AI has scored the waiting work again. Never set for an assignment graded by hand. Saving with "regrade now" clears the scores and runs the AI in one step, so the field stays absent.

### Rubric reuse and calibration (12/10/2569)
- `RubricLibraryEntry { id, name, courseTemplateId?, criteria: RubricCriterion[], sourceAssignmentId?, createdAt }` — a rubric saved for reuse, per subject.
- `Submission.aiCriterionScores?: Record<criterionId, number>` — what the AI gave each criterion, set when the work is sent through the rubric; never visible to students.
- **Evidence for the AI's marks (10/11/2569; advisor R22 "score with reasons and evidence", R35 "the work a grade rests on must not change after the deadline")** — two optional fields on `Submission`. `snapshot?: { takenAt: ISO; sourceUrl?: string; frames: { id; name; image }[] }` is the frozen copy of a linked design (Figma etc.) **taken by the server at submission time** — `image` is a stored file URL, `sourceUrl` the live file (which may have changed since; the UI offers it as "Open live file"). It belongs to the submission: a regrade keeps it, a resubmission replaces it. `aiEvidence?: Record<criterionId, { reason: string; refs: { frameId; label?; box?: { x; y; w; h } }[] }>` is the AI's reason per criterion and where in the work it looked (`box` = fractions 0..1 of the frame). Written together with `aiCriterionScores` by whatever grades with the AI, in the language of the rubric; **cleared with them** (regrade/resubmit). **Never sent to students** (`studentVisibleSubmission` strips it) — teachers and TAs may read it; only the teacher's "Feedback to AI" notes stay teacher-only. The front end's stand-in is `lib/aiEvidence.ts` (`aiEvidenceFor`); replace it with the model's answer in the same shape.
- **AI offset removed (10/11/2569)** — `Rubric.aiOffsets` and `Submission.aiOffsetsUsed` no longer exist: Calibration compares the teacher with what the AI stored and suggests rubric changes, it does not tune the AI. A backend must not store or expect them; old rows that still carry them are ignored.
- **Submit / grading window (15/10/2569, reworked 21/10/2569)** — `dueDate` stays a date; the deadline is the end of that day (23:59:59). The fixed 1-hour late window is **gone**: `Assignment.latePolicy?` is the teacher's choice per assignment. Without it submissions close at the deadline. With it they stay open through the end of `latePolicy.closeDate` (a date after `dueDate`; otherwise ignored). The teacher may start grading only after submissions close (`gradingOpen`, `lib/assignments.ts`). Exams (`isExam`) and assignments without a `dueDate` are never locked. The backend must enforce both sides (reject a submission after the close time, reject any grading write, AI run, re-grade or announce before it) — the front end only disables the controls. `Submission.late?: boolean` is set by the server when `submittedAt` falls after the deadline (set again on every resubmission). A resubmission replaces the earlier file and **clears its result**: `aiScore`, `instructorScore`, `instructorComment`, `criterionScores`, `aiCriterionScores`, `aiOffsetsUsed`, `criterionComments`, `status → not_graded`, new `submittedAt`.
- **Late policy / deduction (21/10/2569)** — `latePolicy: { closeDate: "YYYY-MM-DD"; mode: "none" | "perDay" | "tiers" | "flat"; unit: "percent" | "points"; amount?: number; cap?: number; tiers?: { untilDay: number; amount: number }[] }`. `percent` = a share of the assignment's `maxPoints`. `perDay`: `amount` × late days, at most `cap`; `flat`: `amount` once; `tiers`: the first tier with `lateDays <= untilDay` (later than the last tier pays the last); `none`: accepted, nothing taken. **Late days** = whole calendar days between `dueDate` and the date of `submittedAt` (0 = on time). The deduction is rounded to whole points and never exceeds `maxPoints`. **Stored scores stay raw**: `instructorScore` / `aiScore` are what the rubric earned; the counted score is `max(0, (instructorScore ?? aiScore) − deduction)` — the front end derives it (`finalScoreOf` / `latePenaltyOf`) for the Score Book, student Evaluation, classwork, class statistics and the Grade page, so a backend can either return both or compute the counted score itself, but must use the same formula. The policy is locked once results are announced (`gradingFinalized`).
- `Rubric.sourceRubricId?: string` (14/10/2569) — the rubric this one was copied from by "Use a rubric from before" (the copy is not linked in any other way). Calibration follows these links, both ways, to find the other assignments that share a rubric when it offers to re-grade.
- Every criterion of a rubric has the same number of levels (2–6) — the editor won't save otherwise; older data that mixes counts is evened out by the editor's "let the AI even them out" (`resizeLevels`).
- `CalibrationRun { id, assignmentId, createdAt, sampleIds, teacherLevels: Record<sampleId, Record<criterionId, number>>, completedAt?, appliedAt?, appliedOffsets?, blind?, sawAi? }` — levels are positions on the criterion's scale, 0 = best; `blind` is the Blind-test switch (ON by default since 14/10/2569, and it also hides the students' names and what files / links are called; a run saved without the field was not blind), `sawAi` = something was scored while the AI's level was on screen (the comparison is then not blind).

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

## Backend wiring (HWAI-backend)

These domains are implemented by the Express/Prisma backend in `../HWAI-backend` (see its README and
Swagger at `/docs`):

- **Admin**: courses, curriculum (versions + course templates), managed teachers, cohort students
- **Course content** (student pages + the teacher's create/edit assignment pages): course rosters
  (`Student`), grading categories, assignments + rubrics + submissions, student groups
- **Course staff**: section roles (Collaborators — a TA is a student, a co-teacher a teacher; the server
  removes a person's roles when their account is deleted) and CLOs
- **Rubric tools**: the rubric reuse library (RubricLibraryProvider → `/api/rubric-library`) and Calibration
  runs (CalibrationProvider → `PUT /api/calibration-runs/:id`, create-or-replace like `saveRun`). The AI
  fields `Assignment.gradingMode`, `Submission.aiCriterionScores` and `Rubric.aiOffsets` are stored too
  (the AI grading itself is still the frontend's stand-in, `lib/aiGrading.ts`).
- **Uploaded files** — `lib/fileStorage.ts` uploads to `POST /api/files` and a file's key is its id,
  served at `GET /api/files/:id` (10MB limit). Mock `hwai_file_…` keys still resolve from localStorage.

Their `lib/api/*.ts` files make the real `client.*()` calls, and their Providers use them **only when
`NEXT_PUBLIC_API_URL` is set** (e.g. `NEXT_PUBLIC_API_URL=http://localhost:4000` in `.env.local`).
Unset, everything stays on localStorage exactly as before — the Playwright suites depend on that.

In API mode those Providers keep their synchronous context API: they update state optimistically with a
client-generated id (the backend accepts `id` on create), then push the write through
`enqueueWrite()` (`lib/api/sync.ts`), a single sequential queue so dependent writes made in the same
tick (create course → assign teacher; create assignment → add rubric → set its rubricIds) reach the
server in order. A failed write shows an alert and reloads that domain from the server.

Still localStorage-only, all currently hidden by `lib/featureFlags.ts`: grading assignments (Grading
Split), notifications, announcements, weekly plan and teaching materials — their backend gets built when
they come back.

## Auth

- **Session = an HttpOnly cookie** (`hwai_session`) set by HWAI-backend. `client.ts` sends
  `credentials: "include"` on every request (and so do the raw file fetches in `fileStorage.ts`,
  `SubmissionViewer`, `AssignmentAttachments`); the page never sees or stores a token.
- `AuthContext` (API mode) asks `GET /api/auth/me` on load: who is signed in and every role they hold
  (`roles`, plus `teacher` / `student` — their account records; staff are never also students).
  The role switcher then offers exactly `roles` (somsak: admin + teacher) — `lib/accounts.ts`'s list,
  which also gives somsak a student persona, applies only to the localStorage mock.
  `localStorage["hwai_user"]` only remembers which of those roles the user is acting as.
  `AuthUser.demo` is set for demo sessions — a "Demo mode" banner (`DemoBanner`) shows on every page.
- The data Providers load once on mount, so `AuthProvider` remounts them whenever a different account
  signs in or out. While signed out `client.ts` answers non-auth calls with a 401 itself (no request),
  and a 401 from the API fires `hwai:unauthorized` → the UI signs out → the shells send the user to /login.
  `loadFailed()` (`sync.ts`) keeps 401/403 on a Provider's initial load quiet — e.g. a student has no
  rubric library.
- **Google sign-in** (shown when `/api/auth/config` says `google`): the login page renders Google's own
  "Sign in with Google" button (`GoogleSignInButton`, Google Identity Services, popup). Its ID token goes
  to `POST /api/auth/google`; the backend verifies it (signature, `aud`, verified email, `hd` = kmitl.ac.th)
  and signs in the existing account with that email — no self-registration. The OAuth client must list the
  frontend's origin under *Authorized JavaScript origins*.
- **Demo sign-in** (only while the backend runs with `DEMO_LOGIN=true`): the login page's "Demo sign-in"
  buttons — Admin / Teacher → `somsak.c@kmitl.ac.th`, Student → `69070101@kmitl.ac.th`. It skips Google
  only; the account keeps exactly its own permissions.
- The email + password form has no backend: in API mode it points to the Google button. Without
  `NEXT_PUBLIC_API_URL` the old localStorage login and "Dev Bypass" are unchanged.
- The backend enforces who may do what (see HWAI-backend's README, "การเข้าสู่ระบบและสิทธิ์") — the
  frontend's own hiding of controls is only UX now. A refused write (403) shows the usual
  "Failed to save" alert and the Provider resyncs.
- Errors: any non-2xx response throws `ApiError { status: number, message: string }` (`client.ts`).
  `message` is the response body text, or `res.statusText` if the body is empty. `204 No Content`
  resolves as `undefined`.

## Domains

Each function below is `async`, already matches its real TypeScript type import (see the `lib/api/*.ts`
file for the exact type), and the endpoint/method is the one suggested in that file's comment — adjust
freely, these are starting points, not a spec the frontend enforces.

### Auth — `lib/api/auth.ts` ✅ backed
| Function | Verb + path | Request | Response |
|---|---|---|---|
| `authConfig` | `GET /api/auth/config` | — | `{ demoLogin, demoAccounts, google, googleClientId?, googleDomain? }` |
| `googleLogin` | `POST /api/auth/google` | `{ credential }` (Google ID token) | `Me` (+ sets the cookie) |
| `demoLogin` | `POST /api/auth/demo-login` | `{ email }` | `Me` (+ sets the cookie) |
| `logout` | `POST /api/auth/logout` | — | `void` |
| `me` | `GET /api/auth/me` | — | `Me` — `{ email, name, demo, roles, defaultRole, teacher, student }` |

`userFromMe(me, role)` turns a `Me` into the `AuthUser` acting as `role`.

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
| `updateSubmission` | `PATCH /api/submissions/:id` | `Partial<Pick<Submission, "aiScore"\|"instructorScore"\|"instructorComment"\|"criterionComments"\|"criterionScores"\|"status"\|"fileUrl"\|"attachments">>` | `Submission` |
| `getRubrics` | `GET /api/assignments/:assignmentId/rubrics` | — | `Rubric[]` |
| `createRubric` | `POST /api/assignments/:assignmentId/rubrics` | `Omit<Rubric, "id"\|"createdAt"\|"updatedAt">` | `Rubric` |
| `updateRubric` | `PATCH /api/rubrics/:id` | `Partial<Omit<Rubric, "id"\|"assignmentId"\|"createdAt">>` | `Rubric` |
| `deleteRubric` | `DELETE /api/rubrics/:id` | — | `void` |

Each rubric criterion may carry `cloIds?: string[]` (11/10/2569) — the ids of the course's CLOs (see the CLO endpoints below) it measures. It is metadata: it never changes how a score is computed, so a `PATCH` that only changes `cloIds` must not reset graded submissions. The CLO attainment shown on the CLO page is computed client-side from `Submission.criterionScores` (points earned ÷ points available over every criterion tagged with that CLO, withdrawn students excluded); a backend may serve it instead.

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

**HWAI-backend enforces this.** `POST /api/courses/:courseId/students` answers
`201 { enrolled: Student[], rejected: { studentId, program, sectionProgram, reason: "wrong_program" }[] }`
(`rejected` is `[]` when everyone fit), or `422 { error, rejected }` when nobody did. A student unknown to the
cohort list has no program and is accepted, as in the UI. `api/students.ts` throws when anything was rejected, so
the write queue alerts and reloads the rosters instead of showing a student the server didn't enrol.

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
There is no separate "Collaborator" resource — a collaborator on a course *is* a `SectionRole` row:
`role: "ta"` with `accountId` = a `CohortStudent.id`, or `role: "co-teacher"` with `accountId` = a
`ManagedTeacher.id`. The primary teacher is separate (admin's `ManagedTeacher.courseIds`) and the
Collaborators page doesn't touch it. The backend rejects a role that doesn't fit the account (400) or a
second role for the same person in a course (409), and drops a person's roles when their account is
deleted. `hasPermission()` is a pure client-side check over already-fetched roles — no endpoint for it.
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

### Rubric reuse and calibration (12/10/2569)
- `RubricLibraryEntry { id, name, courseTemplateId?, criteria: RubricCriterion[], sourceAssignmentId?, createdAt }` — a rubric saved for reuse, per subject.
- `Submission.aiCriterionScores?: Record<criterionId, number>` — what the AI gave each criterion, set when the work is sent through the rubric; never visible to students.
- `Rubric.aiOffsets?: Record<criterionId, number>` — correction of the AI in levels (+ stricter, − more generous), set by "Use these values" on Calibration; applied to later AI grading of that assignment.
- `CalibrationRun { id, assignmentId, createdAt, sampleIds, teacherLevels: Record<sampleId, Record<criterionId, number>>, completedAt?, appliedAt?, appliedOffsets?, blind?, sawAi? }` — levels are positions on the criterion's scale, 0 = best; `blind` is the Blind-test switch (off by default: the AI's level is shown while scoring), `sawAi` = something was scored while the AI's level was on screen (the comparison is then not blind).

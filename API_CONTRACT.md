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
| `updateSubmission` | `PATCH /api/submissions/:id` | `Partial<Pick<Submission, "aiScore"\|"instructorScore"\|"instructorComment"\|"criterionComments"\|"criterionScores"\|"status"\|"fileUrl"\|"attachments">>` | `Submission` |
| `getRubrics` | `GET /api/assignments/:assignmentId/rubrics` | — | `Rubric[]` |
| `createRubric` | `POST /api/assignments/:assignmentId/rubrics` | `Omit<Rubric, "id"\|"createdAt"\|"updatedAt">` | `Rubric` |
| `updateRubric` | `PATCH /api/rubrics/:id` | `Partial<Omit<Rubric, "id"\|"assignmentId"\|"createdAt">>` | `Rubric` |
| `deleteRubric` | `DELETE /api/rubrics/:id` | — | `void` |

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
| `removeStudent` | `DELETE /api/students/:id` | — | `void` |

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

import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// ── Fixtures ──────────────────────────────────────────────────────────────────
// Covers the systems shipped from the teacher-role flow-diagram review
// (14-15/9/2569): grading categories, weekly plan, teaching materials,
// announcements (incl. all-sections scoping), and the students roster page
// with cohort-cross-checked CSV import.

const COURSE = {
  id: "c-p4", name: "UI/UX Design", description: "Human-centered design fundamentals",
  status: "active", source: "manual", coverColor: "#2DD4BF", iconColor: "#2DD4BF",
  courseTemplateId: "ct-p4", term: 1, academicYear: 2569, sectionNumber: "1",
  code: "01076036", schedule: "Mon 9:00-12:00", room: "305",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

// Same subject, same term/year, different section — used by the
// all-sections announcement scoping tests.
const SIBLING_COURSE = {
  ...COURSE, id: "c-p4-sec2", sectionNumber: "2",
};

const TEACHER = {
  id: "t-p4", title: "ผศ.ดร.", name: "Chompoonuch Sanguan", email: "chompoonuch@kmitl.ac.th",
  role: "teacher", status: "active", courseIds: ["c-p4", "c-p4-sec2"],
};

// "Coursework" (not "Assignments") — the literal word "Assignments" already
// appears elsewhere in this page's own chrome (sidebar nav, tab bar), which
// makes it an unreliable, non-unique locator target in tests.
const GRADING_CATEGORIES = [
  { id: "gc-p4-1", courseId: "c-p4", name: "Coursework", weight: 60, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "gc-p4-2", courseId: "c-p4", name: "Final Project", weight: 30, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
];

const WEEKLY_PLAN = [
  { id: "wp-p4-1", courseId: "c-p4", week: 1, topic: "Introduction to UX", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
];

const MATERIALS = [
  { id: "tm-p4-1", courseId: "c-p4", title: "Syllabus PDF", type: "link", source: "url", ref: "https://example.com/syllabus.pdf", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
];

const ANNOUNCEMENTS = [
  { id: "ann-p4-1", authorCourseId: "c-p4", scope: "this-section", title: "Welcome", body: "Welcome to the course.", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
];

const STUDENT_RECORD = {
  id: "sr-p4-1", courseId: "c-p4", studentId: "64070777", firstName: "Somsak", lastName: "Ruk", email: "s@kmitl.ac.th", cohort: "CE69",
};

// One student already enrolled (matches STUDENT_RECORD), one not yet enrolled
// anywhere — the import CSV below targets both, plus an ID that doesn't
// exist in the cohort at all.
const COHORT_STUDENTS = [
  { id: "cs-p4-1", studentId: "64070778", firstName: "Katherine", lastName: "Nguyen", email: "64070778@kmitl.ac.th", cohort: "CE69", program: "CE", status: "active" },
  { id: "cs-p4-2", studentId: "64070777", firstName: "Somsak", lastName: "Ruk", email: "s@kmitl.ac.th", cohort: "CE69", program: "CE", status: "active" },
];

async function seedTeacher(page: Page, opts: {
  categories?: unknown[]; weeklyPlan?: unknown[]; materials?: unknown[];
  announcements?: unknown[]; students?: unknown[]; cohort?: unknown[]; courses?: unknown[];
} = {}) {
  const {
    categories = GRADING_CATEGORIES, weeklyPlan = WEEKLY_PLAN, materials = MATERIALS,
    announcements = ANNOUNCEMENTS, students = [STUDENT_RECORD], cohort = COHORT_STUDENTS,
    courses = [COURSE],
  } = opts;
  await page.addInitScript((data) => {
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({
      name: "Chompoonuch Sanguan", email: "chompoonuch@kmitl.ac.th", role: "teacher",
    }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify(data.courses));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([data.teacher]));
    localStorage.setItem("hwai_grading_categories_v1", JSON.stringify(data.categories));
    localStorage.setItem("hwai_weekly_plan_v1", JSON.stringify(data.weeklyPlan));
    localStorage.setItem("hwai_teaching_materials_v1", JSON.stringify(data.materials));
    localStorage.setItem("hwai_announcements_v1", JSON.stringify(data.announcements));
    localStorage.setItem("hwai_students_v1", JSON.stringify(data.students));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(data.cohort));
  }, { courses, teacher: TEACHER, categories, weeklyPlan, materials, announcements, students, cohort });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("P4 — Course Landing: Details + Grading Categories", () => {
  test.beforeEach(async ({ page }) => { await seedTeacher(page); });

  test("details card shows code, section, schedule, room, instructor", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-p4`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("01076036")).toBeVisible();
    await expect(page.getByText("Mon 9:00-12:00")).toBeVisible();
    await expect(page.getByText("305")).toBeVisible();
    await expect(page.getByText("ผศ.ดร. Chompoonuch Sanguan")).toBeVisible();
  });

  test("grading categories list with weights and incomplete-total warning", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-p4`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Coursework")).toBeVisible();
    await expect(page.getByText("60%")).toBeVisible();
    await expect(page.getByText("Final Project")).toBeVisible();
    await expect(page.getByText("30%")).toBeVisible();
    // 60 + 30 = 90, not 100 — must show the incomplete warning
    await expect(page.getByText(/Total so far: 90%/i)).toBeVisible();
    await expect(page.getByText(/must equal 100%/i)).toBeVisible();
  });

  test("adding a category updates the running total to 100%", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-p4`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Add Category/i }).click();
    await page.getByPlaceholder("e.g. Midterm").fill("Quiz");
    await page.getByPlaceholder("30").fill("10");
    await page.getByRole("button", { name: /^Save$/i }).click();
    await expect(page.getByText("Quiz")).toBeVisible();
    await expect(page.getByText("Total so far: 100%", { exact: true })).toBeVisible();
  });
});

test.describe("P4 — Weekly Teaching Plan", () => {
  test.beforeEach(async ({ page }) => { await seedTeacher(page); });

  test("shows seeded week and topic", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-p4/weekly-plan`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("W1")).toBeVisible();
    await expect(page.getByText("Introduction to UX")).toBeVisible();
  });

  test("adding a week auto-suggests the next week number", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-p4/weekly-plan`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Add Week/i }).click();
    await expect(page.locator('input[type="number"]')).toHaveValue("2");
    await page.getByPlaceholder(/Python fundamentals/i).fill("Wireframing basics");
    await page.getByRole("button", { name: /^Save$/i }).click();
    await expect(page.getByText("W2")).toBeVisible();
    await expect(page.getByText("Wireframing basics")).toBeVisible();
  });
});

test.describe("P4 — Teaching Materials", () => {
  test.beforeEach(async ({ page }) => { await seedTeacher(page); });

  test("shows seeded material", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-p4/materials`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Syllabus PDF")).toBeVisible();
  });

  test("adding a link material appears in the list", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-p4/materials`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Add Material/i }).click();
    await page.getByPlaceholder(/Chapter 1 slides/i).fill("Recorded lecture week 2");
    await page.getByPlaceholder("https://...").fill("https://example.com/recording.mp4");
    await page.getByRole("button", { name: /^Save$/i }).click();
    await expect(page.getByText("Recorded lecture week 2")).toBeVisible();
  });
});

test.describe("P4 — Announcements: authoring and section scoping", () => {
  test.beforeEach(async ({ page }) => { await seedTeacher(page, { courses: [COURSE, SIBLING_COURSE] }); });

  test("shows seeded announcement", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-p4/announcements`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Welcome", { exact: true })).toBeVisible();
    await expect(page.getByText("Welcome to the course.")).toBeVisible();
  });

  test("posting a this-section announcement appears immediately", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-p4/announcements`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /New Announcement/i }).click();
    await page.getByPlaceholder(/Deadline extended/i).fill("Reminder");
    await page.locator("textarea").fill("Bring your laptops next week.");
    await page.getByRole("button", { name: /^Post$/i }).click();
    await expect(page.getByText("Reminder")).toBeVisible();
    await expect(page.getByText("Bring your laptops next week.")).toBeVisible();
  });

  test("posting with all-sections scope saves the correct scope and offers the sibling section", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-p4/announcements`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /New Announcement/i }).click();
    await expect(page.getByText(/Also reaches: Sec\. 2/i)).toBeVisible();

    await page.getByPlaceholder(/Deadline extended/i).fill("Midterm moved");
    await page.locator("textarea").fill("Midterm is now on the 20th for all sections.");
    await page.getByText(/All sections of this subject/i).click();
    await page.getByRole("button", { name: /^Post$/i }).click();
    await expect(page.getByText("Midterm moved")).toBeVisible();
    await expect(page.getByText("All Sections", { exact: true })).toBeVisible();

    // Verify the persisted record itself, rather than navigating to the
    // sibling course's page — a fresh page.goto would re-run this test's
    // addInitScript and silently reset localStorage back to the seed,
    // wiping out the announcement this test just posted.
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_announcements_v1") ?? "[]"));
    const posted = stored.find((a: { title: string }) => a.title === "Midterm moved");
    expect(posted).toBeTruthy();
    expect(posted.scope).toBe("all-sections");
    expect(posted.courseTemplateId).toBe("ct-p4");
  });
});

test.describe("P4 — Announcements: cross-section visibility (fresh seed, no post-mutation navigation)", () => {
  test("an all-sections announcement authored elsewhere shows on the sibling section, un-deletable", async ({ page }) => {
    const crossSectionAnnouncement = {
      id: "ann-p4-cross", authorCourseId: "c-p4", scope: "all-sections",
      courseTemplateId: "ct-p4", term: 1, academicYear: 2569,
      title: "Midterm moved", body: "Midterm is now on the 20th for all sections.",
      createdAt: "2026-01-02T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
    };
    await seedTeacher(page, { courses: [COURSE, SIBLING_COURSE], announcements: [crossSectionAnnouncement] });
    await page.goto(`${BASE}/teacher/courses/c-p4-sec2/announcements`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Midterm moved")).toBeVisible();
    await expect(page.getByText(/From another section/i)).toBeVisible();
    // Only the authoring section can delete it — sec2's view must not offer a delete button for this row.
    await expect(page.getByTitle("Delete")).toHaveCount(0);
  });
});

test.describe("P4 — Students Roster + CSV Import Cross-Check", () => {
  test.beforeEach(async ({ page }) => { await seedTeacher(page); });

  test("roster page shows the enrolled student", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-p4/students`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Somsak")).toBeVisible();
    await expect(page.getByText("64070777")).toBeVisible();
  });

  test("CSV import cross-checks each row against the cohort database", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-p4/students/import`);
    await page.waitForLoadState("networkidle");

    const csv = [
      "student_id,first_name,last_name,email",
      "64070778,Wrong,Name,wrong@example.com", // in cohort, not enrolled -> OK, name should be overridden
      "64070777,Dup,Row,dup@example.com",       // already enrolled in this course
      "99999999,Nobody,Here,none@example.com",  // not in cohort at all
    ].join("\n");

    await page.locator('input[type="file"]').setInputFiles({
      name: "import-test.csv", mimeType: "text/csv", buffer: Buffer.from(csv),
    });

    // Real cohort name/email overrides the (wrong) name typed in the CSV.
    await expect(page.getByText("Katherine")).toBeVisible();
    await expect(page.getByText("Nguyen")).toBeVisible();
    await expect(page.getByText("Wrong")).not.toBeVisible();

    await expect(page.getByText("Already enrolled")).toBeVisible();
    await expect(page.getByText("Not found in system")).toBeVisible();

    await expect(page.getByRole("button", { name: /Import 1 Student/i })).toBeVisible();
  });

  test("importing enrolls only the valid, unenrolled, in-cohort row", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-p4/students/import`);
    await page.waitForLoadState("networkidle");

    const csv = [
      "student_id,first_name,last_name,email",
      "64070778,Wrong,Name,wrong@example.com",
      "99999999,Nobody,Here,none@example.com",
    ].join("\n");

    await page.locator('input[type="file"]').setInputFiles({
      name: "import-test.csv", mimeType: "text/csv", buffer: Buffer.from(csv),
    });
    await page.getByRole("button", { name: /Import 1 Student/i }).click();
    await expect(page.getByText(/Import Complete/i)).toBeVisible();

    // Verify the persisted roster directly rather than navigating to
    // /students — a fresh page.goto would re-run this test's addInitScript
    // and reset localStorage back to the seed, wiping out the student the
    // import above just added.
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_students_v1") ?? "[]"));
    expect(stored).toHaveLength(2);
    const imported = stored.find((s: { studentId: string }) => s.studentId === "64070778");
    expect(imported).toBeTruthy();
    expect(imported.firstName).toBe("Katherine");
    expect(imported.lastName).toBe("Nguyen");
  });
});

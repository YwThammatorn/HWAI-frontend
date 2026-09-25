import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeacherSeed {
  id: string;
  name: string;
  email: string;
  role: "teacher" | "ta";
  courseIds: string[];
}

interface StudentSeed {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  program: string;
}

interface CourseSeed {
  id: string;
  name: string;
  description: string;
  status: "active" | "archived";
  coverColor: string;
  createdAt: string;
  updatedAt: string;
}

// ── Seed helper ───────────────────────────────────────────────────────────────

/**
 * Injects localStorage before page load:
 *  - hwai_lang        → "en"   (English UI so assertions use English strings)
 *  - hwai_user        → admin role
 *  - hwai_managed_teachers_v1  (only when teachers array is non-empty)
 *  - hwai_cohort_students_v1   (only when students array is non-empty)
 *  - hwai_courses_v2           (only when courses is non-null; pass [] for empty state)
 */
async function seedPage(
  page: Page,
  opts: {
    teachers?: TeacherSeed[];
    students?: StudentSeed[];
    /** null = don't touch storage (CourseProvider falls back to SEED_COURSES)
     *  []   = set empty array → triggers empty-state UI
     *  [...] = seed specific courses */
    courses?: CourseSeed[] | null;
  } = {}
) {
  const { teachers = [], students = [], courses = null } = opts;
  await page.addInitScript(
    (data) => {
      localStorage.setItem("hwai_lang", "en");
      localStorage.setItem(
        "hwai_user",
        JSON.stringify({ name: "Admin User", email: "admin@kmitl.ac.th", role: "admin" })
      );
      if (data.teachers.length > 0)
        localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify(data.teachers));
      if (data.students.length > 0)
        localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(data.students));
      if (data.courses !== null)
        localStorage.setItem("hwai_courses_v2", JSON.stringify(data.courses));
    },
    { teachers, students, courses }
  );
}

async function gotoPage(page: Page, path: string) {
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");
}

// ── Sample fixtures ───────────────────────────────────────────────────────────

const TEACHER_1: TeacherSeed = {
  id: "t-1",
  // Deliberately not title-prefixed ("Dr. Smith") — 10/9/2569 split teacher
  // title into its own field, and a name starting with a recognized prefix
  // like "Dr." gets that prefix stripped into `title` on load. This fixture
  // is about the deactivate/checkbox flows, not title-splitting, so keep it
  // plain to avoid coupling the two.
  name: "John Smith",
  email: "smith@kmitl.ac.th",
  role: "teacher",
  courseIds: [],
};

const TA_1: TeacherSeed = {
  id: "t-2",
  name: "Alice Johnson",
  email: "alice@kmitl.ac.th",
  role: "ta",
  courseIds: [],
};

const STUDENT_1: StudentSeed = {
  id: "s-1",
  studentId: "64070501",
  firstName: "สมชาย",
  lastName: "ใจดี",
  email: "s64070501@email.kmitl.ac.th",
  program: "CE",
};

const STUDENT_2: StudentSeed = {
  id: "s-2",
  studentId: "64070502",
  firstName: "สมหญิง",
  lastName: "ดีมาก",
  email: "s64070502@email.kmitl.ac.th",
  program: "CE",
};

const COURSE_1: CourseSeed = {
  id: "c-1",
  name: "Software Engineering",
  description: "SE course",
  status: "active",
  coverColor: "#2DD4BF",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

// ═══════════════════════════════════════════════════════════════════════════════
// P1a — /admin/teachers
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("P1a — Admin Teachers (/admin/teachers)", () => {
  // /admin/teachers redirects to the combined /admin/users page (Teachers tab
  // is the default view there) — Teacher and Student management were merged
  // into one page with pill tabs; there's no longer a standalone "Teacher
  // Management" heading, just "User Management" shared by both tabs.
  test("page loads with User Management heading", async ({ page }) => {
    await seedPage(page);
    await gotoPage(page, "/admin/teachers");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "User Management"
    );
  });

  test("shows empty state when no teachers exist", async ({ page }) => {
    await seedPage(page);
    await gotoPage(page, "/admin/teachers");
    await expect(page.getByText("No teachers yet")).toBeVisible();
  });

  test("clicking Add Teacher opens the drawer dialog", async ({ page }) => {
    await seedPage(page);
    await gotoPage(page, "/admin/teachers");
    // Two "Add Teacher" buttons when empty state — header button is first
    await page.getByRole("button", { name: "Add Teacher" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading")).toContainText("Add Teacher");
  });

  test("filling form and submitting adds teacher to table", async ({ page }) => {
    await seedPage(page);
    await gotoPage(page, "/admin/teachers");
    await page.getByRole("button", { name: "Add Teacher" }).first().click();
    const dialog = page.getByRole("dialog");
    // Use field ids (aria-hidden asterisk in label makes getByLabel unreliable)
    await dialog.locator("#teacher-name").fill("Prof. Jane Doe");
    await dialog.locator("#teacher-email").fill("jane@kmitl.ac.th");
    await dialog.getByRole("button", { name: "Add Teacher" }).click();
    // Drawer closes
    await expect(page.getByRole("dialog")).not.toBeVisible();
    // Teacher appears in table
    await expect(page.getByText("Prof. Jane Doe")).toBeVisible();
    await expect(page.getByText("jane@kmitl.ac.th")).toBeVisible();
  });

  test("deactivate button opens confirm dialog and confirming marks teacher Inactive", async ({
    page,
  }) => {
    // Teacher removal is a reversible Deactivate, not a hard delete (Sprint 3
    // "Delete → Suspend" decision, renamed 9/9/2569 to the same active/inactive
    // vocabulary as student status — see project_hwai_design_system memory) —
    // the row stays in the table with an "Inactive" badge and an Activate
    // button, it does not disappear to the empty state.
    await seedPage(page, { teachers: [TEACHER_1] });
    await gotoPage(page, "/admin/teachers");
    await expect(page.getByText("John Smith")).toBeVisible();
    // Deactivate button aria-label: "Deactivate John Smith" (English mode)
    await page.getByRole("button", { name: "Deactivate John Smith" }).click();
    const alertDialog = page.getByRole("alertdialog");
    await expect(alertDialog).toBeVisible();
    await expect(alertDialog).toContainText("Confirm Deactivate");
    await alertDialog.getByRole("button", { name: "Deactivate" }).click();
    // Teacher stays visible, now flagged Inactive, with an Activate action
    await expect(page.getByText("John Smith")).toBeVisible();
    await expect(page.getByText("Inactive")).toBeVisible();
    await expect(page.getByRole("button", { name: "Activate John Smith" })).toBeVisible();
  });

  test("validation: submitting with empty name shows Name is required", async ({
    page,
  }) => {
    await seedPage(page);
    await gotoPage(page, "/admin/teachers");
    await page.getByRole("button", { name: "Add Teacher" }).first().click();
    const dialog = page.getByRole("dialog");
    // Submit with all fields empty
    await dialog.getByRole("button", { name: "Add Teacher" }).click();
    await expect(page.getByText("Name is required")).toBeVisible();
  });

  test("validation: invalid email shows Invalid email format", async ({ page }) => {
    await seedPage(page);
    await gotoPage(page, "/admin/teachers");
    await page.getByRole("button", { name: "Add Teacher" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#teacher-name").fill("Test Teacher");
    await dialog.locator("#teacher-email").fill("not-an-email");
    await dialog.getByRole("button", { name: "Add Teacher" }).click();
    await expect(page.getByText("Invalid email format")).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P1b — /admin/students
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("P1b — Admin Students (/admin/students)", () => {
  // /admin/students also redirects to /admin/users, which defaults to the
  // Teachers tab — every test here must click the "Students" pill tab first.
  async function openStudentsTab(page: Page) {
    await page.getByRole("tab", { name: /^Students/ }).click();
  }

  test("page loads with User Management heading", async ({ page }) => {
    await seedPage(page);
    await gotoPage(page, "/admin/students");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "User Management"
    );
  });

  test("shows empty state when no students exist", async ({ page }) => {
    await seedPage(page);
    await gotoPage(page, "/admin/students");
    await openStudentsTab(page);
    await expect(page.getByText("No students yet")).toBeVisible();
  });

  test("seeded student appears in table", async ({ page }) => {
    await seedPage(page, { students: [STUDENT_1] });
    await gotoPage(page, "/admin/students");
    await openStudentsTab(page);
    // exact: true avoids matching the email cell (s64070501@email.kmitl.ac.th)
    await expect(page.getByText("64070501", { exact: true })).toBeVisible();
    // Table renders firstName + " " + lastName in one cell
    await expect(page.getByText("สมชาย ใจดี")).toBeVisible();
  });

  test("search input filters table by studentId", async ({ page }) => {
    await seedPage(page, { students: [STUDENT_1, STUDENT_2] });
    await gotoPage(page, "/admin/students");
    await openStudentsTab(page);
    // Both visible initially
    await expect(page.getByText("64070501", { exact: true })).toBeVisible();
    await expect(page.getByText("64070502", { exact: true })).toBeVisible();
    // Type in search box. Role is "combobox" (not "searchbox") now that this
    // input has autocomplete suggestions — role reflects the ARIA combobox
    // pattern (aria-expanded/aria-autocomplete), so locate by placeholder instead.
    await page.getByPlaceholder("Search students...").fill("64070501");
    await expect(page.getByText("64070501", { exact: true })).toBeVisible();
    await expect(page.getByText("64070502", { exact: true })).not.toBeVisible();
  });

  test("delete student → confirm dialog → confirmed → student removed", async ({
    page,
  }) => {
    // Student deletion is still a real hard delete (unlike teacher Suspend).
    await seedPage(page, { students: [STUDENT_1] });
    await gotoPage(page, "/admin/students");
    await openStudentsTab(page);
    await expect(page.getByText("64070501", { exact: true })).toBeVisible();
    // aria-label: "Delete สมชาย ใจดี" (English prefix, Thai name)
    await page.getByRole("button", { name: /Delete สมชาย ใจดี/i }).click();
    const alertDialog = page.getByRole("alertdialog");
    await expect(alertDialog).toBeVisible();
    await expect(alertDialog).toContainText("Confirm Delete");
    await alertDialog.getByRole("button", { name: "Delete" }).click();
    // Student gone → empty state
    await expect(page.getByText("64070501", { exact: true })).not.toBeVisible();
    await expect(page.getByText("No students yet")).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P1c — /admin/courses
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("P1c — Admin Courses (/admin/courses)", () => {
  test("page loads with Course Management heading", async ({ page }) => {
    await seedPage(page);
    await gotoPage(page, "/admin/courses");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Course Management"
    );
  });

  test("shows empty state when courses seeded as empty array", async ({ page }) => {
    // courses: [] sets hwai_courses_v2="[]" → CourseProvider returns [] → empty state
    await seedPage(page, { courses: [] });
    await gotoPage(page, "/admin/courses");
    await expect(page.getByText("No courses yet")).toBeVisible();
  });

  test("seeded course row appears on page", async ({ page }) => {
    await seedPage(page, { courses: [COURSE_1] });
    await gotoPage(page, "/admin/courses");
    await expect(page.getByText("Software Engineering")).toBeVisible();
  });

  test("clicking course row expands the assign panel", async ({ page }) => {
    await seedPage(page, { courses: [COURSE_1] });
    await gotoPage(page, "/admin/courses");
    // The expandable row is a <button aria-expanded>
    const courseBtn = page.getByRole("button", { name: /Software Engineering/ });
    await expect(courseBtn).toHaveAttribute("aria-expanded", "false");
    await courseBtn.click();
    await expect(courseBtn).toHaveAttribute("aria-expanded", "true");
    // Panel title "Teacher" visible in expanded section (23/9/2569: was "Teaching Staff")
    await expect(page.getByText("Teacher", { exact: true })).toBeVisible();
  });

  test("+ Add Section duplicates the course into a new one, teacher and section left blank", async ({ page }) => {
    await seedPage(page, { teachers: [TEACHER_1], courses: [COURSE_1] });
    await gotoPage(page, "/admin/courses");
    await page.getByRole("button", { name: "Add Section" }).click();
    const dialog = page.getByRole("dialog", { name: "Add Section" });
    await expect(dialog.getByText('Adding sections to "Software Engineering"')).toBeVisible();
    await expect(dialog.getByPlaceholder("e.g. UX/UI Design")).toHaveValue("Software Engineering");
    await expect(dialog.getByLabel("Primary Teacher")).toHaveValue("");
    await expect(dialog.getByRole("button", { name: "Create Course" })).toBeDisabled();

    await dialog.getByLabel("Primary Teacher").fill("John");
    await dialog.getByRole("option", { name: "John Smith" }).click();
    await dialog.getByRole("button", { name: "Create Course" }).click();
    await expect(dialog).toHaveCount(0);

    const courses = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_courses_v2") ?? "[]"));
    expect(courses).toHaveLength(2);
    const added = courses.find((c: { id: string }) => c.id !== COURSE_1.id);
    expect(added).toMatchObject({ name: "Software Engineering", description: "SE course" });
    expect(added.sectionNumber).toBeUndefined();
  });

  test("New Course: Primary Teacher is an autocomplete, not a dropdown of every teacher", async ({ page }) => {
    await seedPage(page, { teachers: [TEACHER_1] });
    await gotoPage(page, "/admin/courses");
    await page.getByRole("button", { name: "New Course" }).first().click();
    const dialog = page.getByRole("dialog", { name: "New Course" });
    await dialog.getByPlaceholder("e.g. UX/UI Design").fill("Web Design");
    await expect(dialog.getByRole("button", { name: "Create Course" })).toBeDisabled();

    const teacherField = dialog.getByLabel("Primary Teacher");
    await teacherField.fill("John");
    await dialog.getByRole("option", { name: "John Smith" }).click();
    await expect(dialog.getByRole("button", { name: "Create Course" })).toBeEnabled();
    await dialog.getByRole("button", { name: "Create Course" }).click();
    await expect(dialog).toHaveCount(0);

    const courses = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_courses_v2") ?? "[]"));
    expect(courses.map((c: { name: string }) => c.name)).toContain("Web Design");
  });

  test("seeded teacher appears as unchecked checkbox in expanded panel", async ({
    page,
  }) => {
    await seedPage(page, { courses: [COURSE_1], teachers: [TEACHER_1] });
    await gotoPage(page, "/admin/courses");
    await page.getByRole("button", { name: /Software Engineering/ }).click();
    // Checkbox aria-label: "John Smith (Teacher)"
    const checkbox = page.getByRole("checkbox", { name: /John Smith/ });
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();
  });

  test("checking teacher checkbox marks them assigned", async ({ page }) => {
    // Assignment is now shown via a checkmark icon next to the row (no text
    // "Assigned" badge exists anymore) — checked state is the real signal.
    await seedPage(page, { courses: [COURSE_1], teachers: [TEACHER_1] });
    await gotoPage(page, "/admin/courses");
    await page.getByRole("button", { name: /Software Engineering/ }).click();
    const checkbox = page.getByRole("checkbox", { name: /John Smith/ });
    await checkbox.click();
    await expect(checkbox).toBeChecked();
  });
});

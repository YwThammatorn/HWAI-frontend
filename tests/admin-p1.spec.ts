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
  cohort: string;
  program: string;
}

interface CourseSeed {
  id: string;
  name: string;
  description: string;
  status: "active" | "archived";
  source: string;
  coverColor: string;
  iconColor: string;
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
  name: "Dr. Smith",
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
  cohort: "CE69",
  program: "CE",
};

const STUDENT_2: StudentSeed = {
  id: "s-2",
  studentId: "64070502",
  firstName: "สมหญิง",
  lastName: "ดีมาก",
  email: "s64070502@email.kmitl.ac.th",
  cohort: "CE68",
  program: "CE",
};

const COURSE_1: CourseSeed = {
  id: "c-1",
  name: "Software Engineering",
  description: "SE course",
  status: "active",
  source: "manual",
  coverColor: "#2DD4BF",
  iconColor: "#2DD4BF",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

// ═══════════════════════════════════════════════════════════════════════════════
// P1a — /admin/teachers
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("P1a — Admin Teachers (/admin/teachers)", () => {
  test("page loads with Teacher Management heading", async ({ page }) => {
    await seedPage(page);
    await gotoPage(page, "/admin/teachers");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Teacher Management"
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

  test("teacher role shows Teacher badge in table row", async ({ page }) => {
    await seedPage(page, { teachers: [TEACHER_1] });
    await gotoPage(page, "/admin/teachers");
    // Badge is rendered inside a <td>; role "Teacher" → English "Teacher"
    await expect(page.locator("td").getByText("Teacher")).toBeVisible();
  });

  test("TA role shows TA badge in table row", async ({ page }) => {
    await seedPage(page, { teachers: [TA_1] });
    await gotoPage(page, "/admin/teachers");
    await expect(page.locator("td").getByText("TA")).toBeVisible();
  });

  test("delete button opens confirm dialog and confirming removes teacher", async ({
    page,
  }) => {
    await seedPage(page, { teachers: [TEACHER_1] });
    await gotoPage(page, "/admin/teachers");
    await expect(page.getByText("Dr. Smith")).toBeVisible();
    // Delete button aria-label: "Delete Dr. Smith" (English mode)
    await page.getByRole("button", { name: "Delete Dr. Smith" }).click();
    const alertDialog = page.getByRole("alertdialog");
    await expect(alertDialog).toBeVisible();
    await expect(alertDialog).toContainText("Confirm Delete");
    await alertDialog.getByRole("button", { name: "Delete" }).click();
    // Teacher removed → back to empty state
    await expect(page.getByText("Dr. Smith")).not.toBeVisible();
    await expect(page.getByText("No teachers yet")).toBeVisible();
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
  test("page loads with Student Management heading", async ({ page }) => {
    await seedPage(page);
    await gotoPage(page, "/admin/students");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Student Management"
    );
  });

  test("shows empty state when no students exist", async ({ page }) => {
    await seedPage(page);
    await gotoPage(page, "/admin/students");
    await expect(page.getByText("No students yet")).toBeVisible();
  });

  test("seeded student appears in table", async ({ page }) => {
    await seedPage(page, { students: [STUDENT_1] });
    await gotoPage(page, "/admin/students");
    // exact: true avoids matching the email cell (s64070501@email.kmitl.ac.th)
    await expect(page.getByText("64070501", { exact: true })).toBeVisible();
    // Table renders firstName + " " + lastName in one cell
    await expect(page.getByText("สมชาย ใจดี")).toBeVisible();
  });

  test("search input filters table by studentId", async ({ page }) => {
    await seedPage(page, { students: [STUDENT_1, STUDENT_2] });
    await gotoPage(page, "/admin/students");
    // Both visible initially
    await expect(page.getByText("64070501", { exact: true })).toBeVisible();
    await expect(page.getByText("64070502", { exact: true })).toBeVisible();
    // Type in search box (type="search" → role searchbox)
    await page.getByRole("searchbox").fill("64070501");
    await expect(page.getByText("64070501", { exact: true })).toBeVisible();
    await expect(page.getByText("64070502", { exact: true })).not.toBeVisible();
  });

  test("cohort filter dropdown shows cohorts present in data", async ({ page }) => {
    await seedPage(page, { students: [STUDENT_1, STUDENT_2] });
    await gotoPage(page, "/admin/students");
    // aria-label: "Filter by cohort" (English)
    const select = page.getByRole("combobox", { name: "Filter by cohort" });
    await expect(select).toBeVisible();
    await expect(select.locator("option[value='CE69']")).toHaveCount(1);
    await expect(select.locator("option[value='CE68']")).toHaveCount(1);
  });

  test("delete student → confirm dialog → confirmed → student removed", async ({
    page,
  }) => {
    await seedPage(page, { students: [STUDENT_1] });
    await gotoPage(page, "/admin/students");
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
    // Panel title "Teaching Staff" visible in expanded section
    await expect(page.getByText("Teaching Staff")).toBeVisible();
  });

  test("seeded teacher appears as unchecked checkbox in expanded panel", async ({
    page,
  }) => {
    await seedPage(page, { courses: [COURSE_1], teachers: [TEACHER_1] });
    await gotoPage(page, "/admin/courses");
    await page.getByRole("button", { name: /Software Engineering/ }).click();
    // Checkbox aria-label: "Dr. Smith (Teacher)"
    const checkbox = page.getByRole("checkbox", { name: /Dr\. Smith/ });
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();
  });

  test("checking teacher checkbox shows Assigned badge", async ({ page }) => {
    await seedPage(page, { courses: [COURSE_1], teachers: [TEACHER_1] });
    await gotoPage(page, "/admin/courses");
    await page.getByRole("button", { name: /Software Engineering/ }).click();
    const checkbox = page.getByRole("checkbox", { name: /Dr\. Smith/ });
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    // Assigned badge appears next to the teacher entry
    await expect(page.getByText("Assigned")).toBeVisible();
  });
});

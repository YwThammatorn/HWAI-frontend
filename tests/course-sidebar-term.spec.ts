import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const NOW = "2026-01-01T00:00:00.000Z";

const course = (over: Record<string, unknown>) => ({
  id: "c-cb", name: "Programming", description: "Basics", status: "active",
  coverColor: "#0F766E", sectionNumber: "1", code: "01076112",
  createdAt: NOW, updatedAt: NOW, ...over,
});

async function open(page: Page, role: "student" | "teacher", lang: "en" | "th", c: unknown) {
  await page.addInitScript(([r, l, cr]) => {
    localStorage.setItem("hwai_lang", l as string);
    localStorage.setItem("hwai_user", JSON.stringify(r === "student"
      ? { name: "Somchai Jaidee", email: "s1@kmitl.ac.th", role: "student", studentId: "64070501" }
      : { name: "Teacher One", email: "t1@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([cr]));
    localStorage.setItem("hwai_students_v1", JSON.stringify([{ id: "sr-cb", courseId: "c-cb", studentId: "64070501", firstName: "Somchai", lastName: "Jaidee", email: "s1@kmitl.ac.th" }]));
  }, [role, lang, c] as const);
  await page.goto(role === "student" ? `${BASE}/student/courses/c-cb/classwork` : `${BASE}/teacher/courses/c-cb`);
}

const sidebar = (page: Page) => page.getByRole("complementary");

for (const role of ["student", "teacher"] as const) {
  test.describe(`${role} course sidebar`, () => {
    test("shows academic year and term under the course name", async ({ page }) => {
      await open(page, role, "en", course({ academicYear: 2569, term: 1 }));
      await expect(sidebar(page).getByText("Academic year 2569 · Term 1")).toBeVisible();
    });

    test("Thai UI; a summer term has no number", async ({ page }) => {
      await open(page, role, "th", course({ academicYear: 2569, term: "summer" }));
      await expect(sidebar(page).getByText("ปีการศึกษา 2569 · ภาคฤดูร้อน")).toBeVisible();
    });

    test("a course with no year/term shows no term line", async ({ page }) => {
      await open(page, role, "en", course({}));
      await expect(sidebar(page).getByText("01076112")).toBeVisible();
      await expect(sidebar(page).getByText(/Academic year/)).toHaveCount(0);
    });
  });
}

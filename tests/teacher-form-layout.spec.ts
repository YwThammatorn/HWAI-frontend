import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// Teacher form pages share one layout (19/9/2569): full width, left-aligned like the other
// course pages (not a centred max-w column), a breadcrumb on top, and two form columns on
// wide screens that stack below the xl breakpoint. Covers the pages changed after the
// New Assignment page: Edit Assignment, Course Settings, the standalone Rubric editor.
// (courses/new is behind TEACHER_COURSE_CREATION_DISABLED, so it has no test here.)

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-lay", name: "Web Design", description: "Layout course", status: "active", source: "manual",
  coverColor: "#2DD4BF", iconColor: "#2DD4BF", courseTemplateId: "ct-lay", term: 1, academicYear: 2569,
  sectionNumber: "1", code: "01076097", schedule: "-", room: "-", createdAt: NOW, updatedAt: NOW,
};
const RUBRIC = {
  id: "r-lay", assignmentId: "a-lay", name: "Grading Rubric", createdAt: NOW, updatedAt: NOW,
  criteria: [
    { id: "cr1", name: "Layout", description: "", weight: 60, maxPoints: 60, levels: [{ label: "ดีเยี่ยม", description: "" }, { label: "ดี", description: "" }, { label: "ต้องปรับปรุง", description: "" }] },
    { id: "cr2", name: "Accessibility", description: "", weight: 40, maxPoints: 40, levels: [{ label: "ดีเยี่ยม", description: "" }, { label: "ดี", description: "" }, { label: "ต้องปรับปรุง", description: "" }] },
  ],
};
const ASSIGNMENT = {
  id: "a-lay", courseId: "c-lay", name: "Landing page", description: "d", dueDate: "2099-12-31", maxPoints: 100,
  acceptsFiles: true, fileTypes: ["pdf"], submissionType: "individual", maxGroupSize: null, rubricIds: ["r-lay"],
  createdAt: NOW, updatedAt: NOW,
};

async function seedTeacher(page: Page) {
  await page.addInitScript((data) => {
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([data.course]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([data.assignment]));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify([data.rubric]));
  }, { course: COURSE, assignment: ASSIGNMENT, rubric: RUBRIC });
}

async function open(page: Page, path: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");
}

const mainCss = (page: Page) =>
  page.locator("main").evaluate((el) => { const c = getComputedStyle(el); return { maxWidth: c.maxWidth, marginLeft: c.marginLeft }; });

const x = async (page: Page, text: string) => Math.round((await page.getByText(text, { exact: true }).first().boundingBox())!.x);
const y = async (page: Page, text: string) => Math.round((await page.getByText(text, { exact: true }).first().boundingBox())!.y);

test.describe("Teacher form pages — left-aligned, two columns", () => {
  test.beforeEach(async ({ page }) => { await seedTeacher(page); });

  test("Edit Assignment: full width, breadcrumb, General+Description+Rubric left, Deadline+Submission+Danger right", async ({ page }) => {
    await open(page, "/teacher/courses/c-lay/assignments/a-lay/edit", 1600);
    expect(await mainCss(page)).toEqual({ maxWidth: "none", marginLeft: "0px" });

    // breadcrumb: course / Assignments / assignment / Edit
    const crumbs = page.locator("main div.text-sm.text-gray-500").first();
    await expect(crumbs.getByRole("button", { name: "Web Design" })).toBeVisible();
    await expect(crumbs.getByRole("button", { name: "Assignments" })).toBeVisible();
    await expect(crumbs.getByRole("button", { name: "Landing page" })).toBeVisible();

    const left = await x(page, "General Information");
    const right = await x(page, "Deadline & Score");
    expect(right).toBeGreaterThan(left + 300);
    expect(await x(page, "Description")).toBe(left);
    expect(await x(page, "Submission Settings")).toBe(right);
    // (Danger Zone's heading has no leading icon, so it sits ~one icon-width left of the other headings)
    expect(Math.abs((await x(page, "Danger Zone")) - right)).toBeLessThan(30);
    // rubric list sits in the left column, below the description
    expect(await x(page, "Grading Rubric")).toBe(left);
    expect(await y(page, "Grading Rubric")).toBeGreaterThan(await y(page, "Description"));
  });

  test("Edit Assignment: stacks to one column below the xl breakpoint", async ({ page }) => {
    await open(page, "/teacher/courses/c-lay/assignments/a-lay/edit", 1100);
    expect(await x(page, "Deadline & Score")).toBe(await x(page, "General Information"));
  });

  test("Course Settings: full width, breadcrumb, General+Danger left, Visuals right", async ({ page }) => {
    await open(page, "/teacher/courses/c-lay/settings", 1600);
    expect(await mainCss(page)).toEqual({ maxWidth: "none", marginLeft: "0px" });
    await expect(page.getByRole("heading", { name: "Edit Existing Course" })).toBeVisible();
    const crumbs = page.locator("main div.text-sm.text-gray-500").first();
    await expect(crumbs.getByRole("button", { name: "Web Design" })).toBeVisible();
    await expect(crumbs.getByText("Settings")).toBeVisible();

    const left = await x(page, "General Information");
    const right = await x(page, "Course Visuals");
    expect(right).toBeGreaterThan(left + 300);
    expect(await x(page, "Danger Zone")).toBe(left);
    expect(await y(page, "Danger Zone")).toBeGreaterThan(await y(page, "General Information"));
  });

  test("Course Settings still saves", async ({ page }) => {
    await open(page, "/teacher/courses/c-lay/settings", 1600);
    await page.locator("input[required]").first().fill("Web Design 2");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("hwai_courses_v2") ?? "[]")[0]?.name)).toBe("Web Design 2");
  });

  test("Rubric editor: full width, left-aligned", async ({ page }) => {
    await open(page, "/teacher/courses/c-lay/assignments/a-lay/rubrics/r-lay", 1600);
    expect(await mainCss(page)).toEqual({ maxWidth: "none", marginLeft: "0px" });
    await expect(page.getByRole("heading", { name: "Define Criteria" })).toBeVisible();
    await expect(page.getByLabel("Criterion name")).toHaveCount(2);
  });
});

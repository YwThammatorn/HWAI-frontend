import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// "New Assignment" now includes the grading rubric (19/9/2569) — previously creating an
// assignment redirected to a separate rubric editor page.

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-rub", name: "Web Design", description: "", status: "active", source: "manual",
  coverColor: "#2DD4BF", iconColor: "#2DD4BF", courseTemplateId: "ct-rub", term: 1, academicYear: 2569,
  sectionNumber: "1", code: "01076098", schedule: "-", room: "-", createdAt: NOW, updatedAt: NOW,
};

async function seedTeacher(page: Page) {
  await page.addInitScript((data) => {
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([data.course]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([]));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify([]));
  }, { course: COURSE });
}

async function fillBasics(page: Page) {
  await page.getByPlaceholder(/User Research Report/i).fill("Landing page redesign");
  await page.locator('input[type="date"]').fill("2099-12-31");
}

test.describe("New assignment — rubric on the same page", () => {
  test.beforeEach(async ({ page }) => { await seedTeacher(page); });

  test("shows the rubric editor with one 100% criterion, and Create is enabled", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-rub/assignments/new`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Grading Rubric" })).toBeVisible();
    await expect(page.getByText("100 / 100%")).toBeVisible();
    await expect(page.getByRole("button", { name: /AI Rubric Assistant/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add New Criterion" })).toBeVisible();
    await fillBasics(page);
    await expect(page.getByRole("button", { name: "Create Assignment" })).toBeEnabled();
  });

  test("weights not totalling 100% block Create and say why", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-rub/assignments/new`);
    await page.waitForLoadState("networkidle");
    await fillBasics(page);
    await page.getByLabel("Weight (%)").first().fill("60");
    await expect(page.getByText("60 / 100%")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Assignment" })).toBeDisabled();
    await expect(page.getByText(/must total 100% before you can create/i)).toBeVisible();

    await page.getByRole("button", { name: "Add New Criterion" }).click();
    await page.getByLabel("Weight (%)").nth(1).fill("40");
    await expect(page.getByText("100 / 100%")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Assignment" })).toBeEnabled();
  });

  test("creating saves assignment + rubric criteria in one go and lands on the assignment page", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-rub/assignments/new`);
    await page.waitForLoadState("networkidle");
    await fillBasics(page);
    await page.getByLabel("Criterion name").first().fill("Layout");
    await page.getByLabel("Weight (%)").first().fill("60");
    await page.getByRole("button", { name: "Add New Criterion" }).click();
    await page.getByLabel("Criterion name").nth(1).fill("Accessibility");
    await page.getByLabel("Weight (%)").nth(1).fill("40");
    await page.getByRole("button", { name: "Create Assignment" }).click();
    await expect(page).toHaveURL(/\/assignments\/(?!new)[^/]+$/, { timeout: 20_000 }); // first visit compiles the route in dev

    const { assignments, rubrics } = await page.evaluate(() => ({
      assignments: JSON.parse(localStorage.getItem("hwai_assignments_v1") ?? "[]"),
      rubrics: JSON.parse(localStorage.getItem("hwai_rubrics_v1") ?? "[]"),
    }));
    expect(assignments).toHaveLength(1);
    expect(rubrics).toHaveLength(1);
    expect(assignments[0].rubricIds).toEqual([rubrics[0].id]);
    expect(rubrics[0].assignmentId).toBe(assignments[0].id);
    expect(rubrics[0].criteria.map((c: { name: string; weight: number; maxPoints: number }) => [c.name, c.weight, c.maxPoints]))
      .toEqual([["Layout", 60, 60], ["Accessibility", 40, 40]]);
    // 3 default levels per criterion so grading/recheck screens keep working
    expect(rubrics[0].criteria[0].levels).toHaveLength(3);
  });

  test("pressing Enter in a rubric field does not submit the form", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-rub/assignments/new`);
    await page.waitForLoadState("networkidle");
    await fillBasics(page);
    await page.getByLabel("Criterion name").first().fill("Layout");
    await page.getByLabel("Criterion name").first().press("Enter");
    await page.waitForTimeout(400);
    await expect(page).toHaveURL(/\/assignments\/new$/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_assignments_v1") ?? "[]").length)).toBe(0);
  });

  test("AI assistant fills the criteria (weights = 100)", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-rub/assignments/new`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /AI Rubric Assistant/i }).click();
    await page.getByRole("button", { name: "Apply Suggestions" }).click({ timeout: 8000 });
    await expect(page.getByText("100 / 100%")).toBeVisible();
    await expect(page.getByLabel("Criterion name")).toHaveCount(4);
  });

  test("layout is left-aligned and full width like the other course pages (not a centred column)", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(`${BASE}/teacher/courses/c-rub/assignments/new`);
    await page.waitForLoadState("networkidle");
    const main = page.locator("main");
    const css = await main.evaluate((el) => { const c = getComputedStyle(el); return { maxWidth: c.maxWidth, marginLeft: c.marginLeft }; });
    expect(css).toEqual({ maxWidth: "none", marginLeft: "0px" });
    // two form columns side by side on a wide screen
    const a = await page.getByText("General Information").boundingBox();
    const b = await page.getByText("Deadline & Score").boundingBox();
    expect(b!.x).toBeGreaterThan(a!.x + 300);
  });
});

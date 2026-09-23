import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// Edit Assignment absorbs rubric editing inline now (23/9/2569 round 3) — was a separate list of
// rubric shells linking out to a standalone /rubrics/[rubricId] route (now deleted). Mirrors
// tests/assignment-create-rubric.spec.ts's coverage of the same shared RubricCriteriaEditor.

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-erub", name: "Web Design", description: "", status: "active", source: "manual",
  coverColor: "#2DD4BF", iconColor: "#2DD4BF", courseTemplateId: "ct-erub", term: 1, academicYear: 2569,
  sectionNumber: "1", code: "01076099", schedule: "-", room: "-", createdAt: NOW, updatedAt: NOW,
};

const LEVELS = [
  { label: "Excellent", description: "" },
  { label: "Good", description: "" },
  { label: "Needs Improvement", description: "" },
];

const ASSIGNMENT = {
  id: "a-erub", courseId: "c-erub", name: "Landing page redesign",
  description: "", dueDate: "2099-12-31", maxPoints: 100,
  acceptsFiles: true, fileTypes: ["figma", "pdf"],
  submissionType: "individual" as const, maxGroupSize: null,
  rubricIds: ["r-erub"], isExam: false,
  createdAt: NOW, updatedAt: NOW,
};

const RUBRIC = {
  id: "r-erub", assignmentId: "a-erub", name: "Grading Rubric",
  criteria: [
    { id: "rc-erub-1", name: "Layout", description: "", maxPoints: 60, weight: 60, levels: LEVELS },
    { id: "rc-erub-2", name: "Accessibility", description: "", maxPoints: 40, weight: 40, levels: LEVELS },
  ],
  createdAt: NOW, updatedAt: NOW,
};

async function seedTeacher(page: Page, assignment = ASSIGNMENT, rubric: typeof RUBRIC | null = RUBRIC) {
  await page.addInitScript((data) => {
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([data.course]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([data.assignment]));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify(data.rubric ? [data.rubric] : []));
  }, { course: COURSE, assignment, rubric });
}

test.describe("Edit assignment — rubric editing absorbed inline", () => {
  test("shows the existing rubric's criteria inline, no separate route", async ({ page }) => {
    await seedTeacher(page);
    await page.goto(`${BASE}/teacher/courses/c-erub/assignments/a-erub/edit`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Grading Rubric" })).toBeVisible();
    await expect(page.getByLabel("Criterion name").nth(0)).toHaveValue("Layout");
    await expect(page.getByLabel("Criterion name").nth(1)).toHaveValue("Accessibility");
    await expect(page.getByText("100 pts total")).toBeVisible();
  });

  test("editing a criterion's points and saving re-syncs assignment.maxPoints and the rubric", async ({ page }) => {
    await seedTeacher(page);
    await page.goto(`${BASE}/teacher/courses/c-erub/assignments/a-erub/edit`);
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Points").nth(0).fill("70");
    await expect(page.getByText("110 pts total")).toBeVisible();
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();

    const { assignments, rubrics } = await page.evaluate(() => ({
      assignments: JSON.parse(localStorage.getItem("hwai_assignments_v1") ?? "[]"),
      rubrics: JSON.parse(localStorage.getItem("hwai_rubrics_v1") ?? "[]"),
    }));
    expect(assignments[0].maxPoints).toBe(110);
    expect(rubrics[0].criteria.map((c: { name: string; maxPoints: number }) => [c.name, c.maxPoints]))
      .toEqual([["Layout", 70], ["Accessibility", 40]]);
  });

  test("a criterion with 0 points blocks Save and says why", async ({ page }) => {
    await seedTeacher(page);
    await page.goto(`${BASE}/teacher/courses/c-erub/assignments/a-erub/edit`);
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Points").nth(0).fill("0");
    await expect(page.getByRole("button", { name: "Save Changes" })).toBeDisabled();
    await expect(page.getByText(/every criterion needs more than 0 points before you can save/i)).toBeVisible();
  });

  test("turning off Accept Files hides the rubric editor and switches to a manual max score", async ({ page }) => {
    await seedTeacher(page);
    await page.goto(`${BASE}/teacher/courses/c-erub/assignments/a-erub/edit`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Grading Rubric" })).toBeVisible();

    await page.getByRole("button", { name: "Accept Files" }).click();
    await expect(page.getByRole("heading", { name: "Grading Rubric" })).toHaveCount(0);
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();

    const { assignments } = await page.evaluate(() => ({
      assignments: JSON.parse(localStorage.getItem("hwai_assignments_v1") ?? "[]"),
    }));
    expect(assignments[0].acceptsFiles).toBe(false);
    expect(assignments[0].maxPoints).toBe(100); // manual field, unchanged from the seeded value
  });

  test("toggling Exam Assignment on also hides the rubric editor", async ({ page }) => {
    await seedTeacher(page);
    await page.goto(`${BASE}/teacher/courses/c-erub/assignments/a-erub/edit`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Exam Assignment" }).click();
    await expect(page.getByRole("heading", { name: "Grading Rubric" })).toHaveCount(0);
    await expect(page.locator("input[type='number']").first()).toBeVisible();
  });

  test("layout is full width and two columns, matching New Assignment", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await seedTeacher(page);
    await page.goto(`${BASE}/teacher/courses/c-erub/assignments/a-erub/edit`);
    await page.waitForLoadState("networkidle");
    const main = page.locator("main");
    const css = await main.evaluate((el) => { const c = getComputedStyle(el); return { maxWidth: c.maxWidth, marginLeft: c.marginLeft }; });
    expect(css).toEqual({ maxWidth: "none", marginLeft: "0px" });
    // two form columns side by side on a wide screen, same as New Assignment
    const a = await page.getByText("General Information").boundingBox();
    const b = await page.getByText("Deadline & Score").boundingBox();
    expect(b!.x).toBeGreaterThan(a!.x + 300);
    // breadcrumb replaced the old "Back to assignment" chevron button
    await expect(page.getByRole("button", { name: "Back to assignment" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Edit Assignment" })).toBeVisible();
  });
});

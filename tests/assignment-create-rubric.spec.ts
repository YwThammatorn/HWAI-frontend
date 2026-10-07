import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// "New Assignment" now includes the grading rubric (19/9/2569) — previously creating an
// assignment redirected to a separate rubric editor page.

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-rub", name: "Web Design", description: "", status: "active",
  coverColor: "#2DD4BF", courseTemplateId: "ct-rub", term: 1, academicYear: 2569,
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
  await page.getByPlaceholder("เช่น รายงานการวิจัยผู้ใช้").fill("Landing page redesign");
  await page.locator('input[type="date"]').fill("2099-12-31");
}

test.describe("New assignment — rubric on the same page", () => {
  test.beforeEach(async ({ page }) => { await seedTeacher(page); });

  test("shows the rubric editor with one 100pt criterion, and Create is enabled", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-rub/assignments/new`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Grading Rubric" })).toBeVisible();
    await expect(page.getByText("100 pts total")).toBeVisible();
    await expect(page.getByRole("button", { name: /AI Rubric Assistant/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add New Criterion" })).toBeVisible();
    await fillBasics(page);
    await expect(page.getByRole("button", { name: "Create Assignment" })).toBeEnabled();
  });

  test("a criterion with 0 points blocks Create and says why", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-rub/assignments/new`);
    await page.waitForLoadState("networkidle");
    await fillBasics(page);
    await page.getByLabel("Points").first().fill("0");
    await expect(page.getByText("0 pts total")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Assignment" })).toBeDisabled();
    await expect(page.getByText(/every criterion needs more than 0 points before you can create/i)).toBeVisible();

    await page.getByLabel("Points").first().fill("60");
    await expect(page.getByText("60 pts total")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Assignment" })).toBeEnabled();
  });

  test("creating saves assignment + rubric criteria in one go and lands on the assignment page", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-rub/assignments/new`);
    await page.waitForLoadState("networkidle");
    await fillBasics(page);
    await page.getByLabel("Criterion name").first().fill("Layout");
    await page.getByLabel("Points").first().fill("60");
    await page.getByRole("button", { name: "Add New Criterion" }).click();
    await page.getByLabel("Criterion name").nth(1).fill("Accessibility");
    await page.getByLabel("Points").nth(1).fill("40");
    await page.getByRole("button", { name: "Create Assignment" }).click();
    await expect(page).toHaveURL(/\/assignments\/(?!new)[^/]+$/, { timeout: 20_000 }); // first visit compiles the route in dev

    const { assignments, rubrics } = await page.evaluate(() => ({
      assignments: JSON.parse(localStorage.getItem("hwai_assignments_v1") ?? "[]"),
      rubrics: JSON.parse(localStorage.getItem("hwai_rubrics_v1") ?? "[]"),
    }));
    expect(assignments).toHaveLength(1);
    expect(rubrics).toHaveLength(1);
    expect(assignments[0].rubricIds).toEqual([rubrics[0].id]);
    expect(assignments[0].maxPoints).toBe(100); // sum of the criteria's own points, not a manual field
    expect(rubrics[0].assignmentId).toBe(assignments[0].id);
    expect(rubrics[0].criteria.map((c: { name: string; weight: number; maxPoints: number }) => [c.name, c.weight, c.maxPoints]))
      .toEqual([["Layout", 60, 60], ["Accessibility", 40, 40]]); // weight is now derived from points, not the other way round
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

  test("AI assistant fills the criteria (points sum to 100)", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-rub/assignments/new`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /AI Rubric Assistant/i }).click();
    await page.getByLabel("What should this assignment assess?").fill("A research summary");   // nothing specific in the brief: the general-purpose suggestions
    await page.getByRole("button", { name: "Generate criteria" }).click();
    await page.getByRole("button", { name: "Apply Suggestions" }).click({ timeout: 8000 });
    await expect(page.getByText("100 pts total")).toBeVisible();
    await expect(page.getByLabel("Criterion name")).toHaveCount(4);
  });

  test("AI assistant asks for a brief first, pre-filled from the name and description already typed", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-rub/assignments/new`);
    await page.waitForLoadState("networkidle");
    await page.getByPlaceholder("เช่น รายงานการวิจัยผู้ใช้").fill("Landing page redesign");
    await page.getByPlaceholder("อธิบายวัตถุประสงค์ รูปแบบไฟล์ที่ต้องส่ง เกณฑ์เบื้องต้น ฯลฯ").fill("Redesign the landing page in Figma and export a PDF");

    await page.getByRole("button", { name: /AI Rubric Assistant/i }).click();
    const dialog = page.getByRole("dialog", { name: "AI Rubric Assistant" });
    const brief = dialog.getByLabel("What should this assignment assess?");
    await expect(brief).toHaveValue("Landing page redesign\nRedesign the landing page in Figma and export a PDF");

    // nothing is generated until the teacher says so, and an empty brief can't be sent
    await expect(dialog.getByText("Content Completeness", { exact: true })).toHaveCount(0);
    await brief.fill("");
    await expect(dialog.getByRole("button", { name: "Generate criteria" })).toBeDisabled();
    await brief.fill("Rubric for a Figma landing page");
    await expect(dialog.getByRole("button", { name: "Generate criteria" })).toBeEnabled();
  });

  test("Fill from assignment pulls the name, description and attachments into the brief without clobbering typed text", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-rub/assignments/new`);
    await page.waitForLoadState("networkidle");
    await page.getByPlaceholder("เช่น รายงานการวิจัยผู้ใช้").fill("Landing page redesign");
    await page.getByPlaceholder("อธิบายวัตถุประสงค์ รูปแบบไฟล์ที่ต้องส่ง เกณฑ์เบื้องต้น ฯลฯ").fill("Redesign it in Figma");
    await page.locator('input[type="file"]').setInputFiles({ name: "brief.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") });
    await page.getByRole("button", { name: "Add link" }).click();
    await page.getByLabel("Link URL").fill("figma.com/file/abc123");
    await page.getByLabel("Display name").fill("Figma reference");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await page.getByRole("button", { name: /AI Rubric Assistant/i }).click();
    const dialog = page.getByRole("dialog", { name: "AI Rubric Assistant" });
    const brief = dialog.getByLabel("What should this assignment assess?");
    const pulled = "Landing page redesign\nRedesign it in Figma\nAttachments: brief.pdf (file), Figma reference (link: https://figma.com/file/abc123)";
    await expect(brief).toHaveValue(pulled);

    // cleared → the button brings it back
    await brief.fill("");
    await dialog.getByRole("button", { name: "Fill from assignment" }).click();
    await expect(brief).toHaveValue(pulled);

    // their own words stay; the button adds the details underneath, and a second click doesn't repeat them
    await brief.fill("Focus on accessibility");
    await dialog.getByRole("button", { name: "Fill from assignment" }).click();
    await expect(brief).toHaveValue(`Focus on accessibility\n\n${pulled}`);
    await dialog.getByRole("button", { name: "Fill from assignment" }).click();
    await expect(brief).toHaveValue(`Focus on accessibility\n\n${pulled}`);
  });

  test("Fill from assignment is disabled while there is nothing to pull", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-rub/assignments/new`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /AI Rubric Assistant/i }).click();
    await expect(page.getByRole("dialog", { name: "AI Rubric Assistant" }).getByRole("button", { name: "Fill from assignment" })).toBeDisabled();
  });

  test("AI assistant previews every criterion's level rubric, and Apply keeps exactly those levels", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-rub/assignments/new`);
    await page.waitForLoadState("networkidle");
    await fillBasics(page);
    await page.getByRole("button", { name: /AI Rubric Assistant/i }).click();
    const dialog = page.getByRole("dialog", { name: "AI Rubric Assistant" });
    await dialog.getByLabel("What should this assignment assess?").fill("Research summary");
    await dialog.getByRole("button", { name: "Generate criteria" }).click();

    await expect(dialog.getByText("Content Completeness", { exact: true })).toBeVisible({ timeout: 8000 });
    // 4 criteria × 4 levels, each with its wording
    for (const label of ["Excellent", "Good", "Fair", "Needs Improvement"]) {
      await expect(dialog.getByText(label, { exact: true })).toHaveCount(4);
    }
    await expect(dialog.getByText(/Clearly demonstrates content completeness/i)).toBeVisible();

    await dialog.getByRole("button", { name: "Apply Suggestions" }).click();
    await expect(page.getByLabel("Criterion name")).toHaveCount(4);
    await expect(page.getByLabel("Level name")).toHaveCount(16);
    await expect(page.getByLabel(/Content Completeness — Excellent/)).toHaveValue(/Clearly demonstrates content completeness/i);
  });

  // 4/10/2569 — the assistant suggests the rubric that fits what was typed (templates in lib/rubricTemplates.ts):
  // UX/UI → the 7 criteria of the UX/UI Final Project rubric file, exams / quizzes, code / labs; otherwise the general set.
  async function ask(page: Page, brief: string) {
    await page.goto(`${BASE}/teacher/courses/c-rub/assignments/new`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /AI Rubric Assistant/i }).click();
    const dialog = page.getByRole("dialog", { name: "AI Rubric Assistant" });
    await dialog.getByLabel("What should this assignment assess?").fill(brief);
    await dialog.getByRole("button", { name: "Generate criteria" }).click();
    return dialog;
  }

  test("a UX/UI brief gets the 7 criteria of the UX/UI Final Project rubric, four levels each, 100 points", async ({ page }) => {
    const dialog = await ask(page, "Figma prototype for a booking app");
    await expect(dialog.getByText("C1 · Screen Completeness & Content Realism", { exact: true })).toBeVisible({ timeout: 8000 });
    for (const label of ["Excellent", "Fair", "Needs Improvement", "Fail"]) await expect(dialog.getByText(label, { exact: true })).toHaveCount(7);
    await expect(dialog.getByText("Spacing, Alignment & Grid Pattern", { exact: false })).toBeVisible();
    await dialog.getByRole("button", { name: "Apply Suggestions" }).click();
    await expect(page.getByText("100 pts total")).toBeVisible();
    await expect(page.getByLabel("Criterion name")).toHaveCount(7);
    await expect(page.getByLabel("Level name")).toHaveCount(28);
    const pts = await page.getByLabel("Points").evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value));
    expect(pts).toEqual(["15", "15", "10", "15", "15", "15", "15"]);
  });

  test("an exam or quiz brief gets exam criteria; a code or lab brief gets programming criteria", async ({ page }) => {
    let dialog = await ask(page, "Midterm quiz on loops");
    await expect(dialog.getByText("C2 · Applying and solving problems", { exact: true })).toBeVisible({ timeout: 8000 });
    await dialog.getByRole("button", { name: "Apply Suggestions" }).click();
    await expect(page.getByText("100 pts total")).toBeVisible();
    await expect(page.getByLabel("Criterion name")).toHaveCount(3);

    dialog = await ask(page, "Python lab on writing functions");
    await expect(dialog.getByText("C1 · Program correctness", { exact: true })).toBeVisible({ timeout: 8000 });
    await dialog.getByRole("button", { name: "Apply Suggestions" }).click();
    await expect(page.getByText("100 pts total")).toBeVisible();
    await expect(page.getByLabel("Criterion name")).toHaveCount(4);
  });

  test("UX/UI wins over exam and code words; a brief with none of them keeps the general suggestions", async ({ page }) => {
    let dialog = await ask(page, "Final exam: design a UX flow in Python");
    await expect(dialog.getByText("C5 · Visual Hierarchy", { exact: true })).toBeVisible({ timeout: 8000 });
    dialog = await ask(page, "Essay about the history of computing");
    await expect(dialog.getByText("Content Completeness", { exact: true })).toBeVisible({ timeout: 8000 });
  });

  test("Exam Assignment toggle hides the rubric and switches to a manual max score", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-rub/assignments/new`);
    await page.waitForLoadState("networkidle");
    await fillBasics(page);
    await expect(page.getByRole("heading", { name: "Grading Rubric" })).toBeVisible();

    await page.getByRole("button", { name: "Exam Assignment" }).click();
    await expect(page.getByRole("heading", { name: "Grading Rubric" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Create Assignment" })).toBeEnabled(); // default 100 is already valid

    await page.getByRole("button", { name: "Create Assignment" }).click();
    await expect(page).toHaveURL(/\/assignments\/(?!new)[^/]+$/, { timeout: 20_000 });
    const { assignments, rubrics } = await page.evaluate(() => ({
      assignments: JSON.parse(localStorage.getItem("hwai_assignments_v1") ?? "[]"),
      rubrics: JSON.parse(localStorage.getItem("hwai_rubrics_v1") ?? "[]"),
    }));
    expect(assignments).toHaveLength(1);
    expect(assignments[0].isExam).toBe(true);
    expect(assignments[0].maxPoints).toBe(100);
    expect(assignments[0].rubricIds).toEqual([]);
    expect(rubrics).toHaveLength(0);
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

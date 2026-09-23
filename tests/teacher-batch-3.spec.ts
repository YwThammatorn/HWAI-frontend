import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// Teacher batch (19/9/2569): My Courses card splits Code / Section, the sidebar tab
// "Course Planning" is now "CLO", rubrics can have more than 3 levels, and a manual
// score override on the recheck screen can carry a per-criterion comment.

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-tb3", name: "Programming", description: "", status: "active", source: "manual",
  coverColor: "#2DD4BF", courseTemplateId: "ct-tb3", term: 1, academicYear: 2569,
  sectionNumber: "1", code: "01076112", schedule: "Mon 9:00-12:00", room: "811", createdAt: NOW, updatedAt: NOW,
};
const TEACHER = {
  id: "t-tb3", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th",
  role: "teacher", status: "active", courseIds: ["c-tb3"],
};

const CRITERIA = [
  { id: "crit-a", name: "Layout", description: "", maxPoints: 60, weight: 60, levels: [{ label: "Excellent", description: "" }, { label: "Good", description: "" }, { label: "Needs Improvement", description: "" }] },
  { id: "crit-b", name: "Accessibility", description: "", maxPoints: 40, weight: 40, levels: [{ label: "Excellent", description: "" }, { label: "Good", description: "" }, { label: "Needs Improvement", description: "" }] },
];
const ASSIGNMENT = {
  id: "a-tb3", courseId: "c-tb3", name: "Landing page", description: "", dueDate: "2099-12-31",
  maxPoints: 100, submissionType: "individual", maxGroupSize: null, acceptsFiles: true, fileTypes: [],
  rubricIds: ["r-tb3"], createdAt: NOW, updatedAt: NOW,
};
const RUBRIC = { id: "r-tb3", assignmentId: "a-tb3", name: "Landing page rubric", criteria: CRITERIA, createdAt: NOW, updatedAt: NOW };
const SUBMISSION = {
  id: "sub-tb3", assignmentId: "a-tb3", studentId: "64070701", studentName: "Fah Test", email: "64070701@kmitl.ac.th",
  submittedAt: "2026-01-05T10:00:00.000Z", fileUrl: null, aiScore: 80, instructorScore: null, instructorComment: "",
  externalUseConsent: false, status: "need_review", updatedAt: "2026-01-05T10:00:00.000Z",
};

async function seedTeacher(page: Page, opts: { withAssignment?: boolean } = {}) {
  await page.addInitScript((data) => {
    // addInitScript re-runs on every navigation — only seed once so saved state survives a reload
    if (sessionStorage.getItem("tb3_seeded")) return;
    sessionStorage.setItem("tb3_seeded", "1");
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([data.course]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([data.teacher]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify(data.withAssignment ? [data.assignment] : []));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify(data.withAssignment ? [data.rubric] : []));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(data.withAssignment ? [data.submission] : []));
  }, { course: COURSE, teacher: TEACHER, assignment: ASSIGNMENT, rubric: RUBRIC, submission: SUBMISSION, withAssignment: !!opts.withAssignment });
}

test.describe("Teacher My Courses — Code and Section are separate", () => {
  test("card shows Code (in the colour band), Section and Term as their own fields", async ({ page }) => {
    await seedTeacher(page);
    await page.goto(`${BASE}/teacher/courses`);
    await page.waitForLoadState("networkidle");
    const card = page.getByRole("link", { name: /Programming/ });
    const field = (label: string) => card.getByText(label, { exact: true }).locator("xpath=following-sibling::p[1]");
    // The code moved up into the colour band (see course-card-banner.spec.ts) — no "Code" field in the body any more
    await expect(card.getByText("01076112", { exact: true })).toHaveCount(1);
    await expect(card.getByText("Code", { exact: true })).toHaveCount(0);
    await expect(field("Section")).toHaveText("1");
    await expect(field("Term")).toHaveText("1/2569");
    await expect(card.getByText("01076112 · Sec")).toHaveCount(0);
  });
});

test.describe("Teacher sidebar — CLO tab", () => {
  test("the tab is labelled CLO (not Course Planning) in both languages", async ({ page }) => {
    await seedTeacher(page);
    await page.goto(`${BASE}/teacher/courses/c-tb3`);
    await page.waitForLoadState("networkidle");
    const tab = page.getByRole("link", { name: "CLO", exact: true });
    await expect(tab).toBeVisible();
    await expect(tab).toHaveAttribute("href", "/teacher/courses/c-tb3/clo");
    await expect(page.getByText("Course Planning")).toHaveCount(0);

    await page.evaluate(() => localStorage.setItem("hwai_lang", "th"));
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("link", { name: "CLO", exact: true })).toBeVisible();
    await expect(page.getByText("วางแผนรายวิชา")).toHaveCount(0);
  });
});

test.describe("Rubric — more than 3 levels", () => {
  async function openNew(page: Page) {
    await seedTeacher(page);
    await page.goto(`${BASE}/teacher/courses/c-tb3/assignments/new`);
    await page.waitForLoadState("networkidle");
  }
  // .last() = innermost match, i.e. the criterion card itself rather than a wrapper around it
  const firstCard = (page: Page) => page.locator("div.rounded-2xl", { has: page.getByLabel("Criterion name") }).last();

  test("starts with 3 levels, Add level inserts above the lowest, capped at 6", async ({ page }) => {
    await openNew(page);
    const card = firstCard(page);
    const names = card.getByLabel("Level name");
    await expect(names).toHaveCount(3);

    await card.getByRole("button", { name: "Add level" }).click();
    await expect(names).toHaveCount(4);
    expect(await names.evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value)))
      .toEqual(["Excellent", "Good", "Fair", "Needs Improvement"]);

    await card.getByRole("button", { name: "Add level" }).click();
    await card.getByRole("button", { name: "Add level" }).click();
    await expect(names).toHaveCount(6);
    await expect(card.getByRole("button", { name: "Add level" })).toBeDisabled();
    await expect(card.getByText("6 / 6 levels")).toBeVisible();
    // the last one is still the lowest rung
    expect(await names.last().inputValue()).toBe("Needs Improvement");
  });

  test("levels can be renamed and removed, but never below 2", async ({ page }) => {
    await openNew(page);
    const card = firstCard(page);
    const names = card.getByLabel("Level name");
    await names.nth(1).fill("Very good");
    await expect(names.nth(1)).toHaveValue("Very good");

    await card.getByRole("button", { name: "Remove level Very good" }).click();
    await expect(names).toHaveCount(2);
    await expect(card.getByRole("button", { name: /^Remove level/ })).toHaveCount(0);
  });

  test("Generate writes a description for every level, and the saved rubric keeps them all", async ({ page }) => {
    await openNew(page);
    const card = firstCard(page);
    await page.getByLabel("Criterion name").first().fill("Layout");
    await card.getByRole("button", { name: "Add level" }).click();
    await card.getByRole("button", { name: "Add level" }).click(); // 5 levels
    await card.getByRole("button", { name: "Generate" }).click();
    await expect(card.locator("textarea[aria-label^='Layout — ']")).toHaveCount(5);
    await expect.poll(async () =>
      (await card.locator("textarea[aria-label^='Layout — ']").evaluateAll((els) => els.map((e) => (e as HTMLTextAreaElement).value.length > 0))).every(Boolean),
    ).toBe(true);

    await page.getByPlaceholder(/User Research Report/i).fill("Landing page");
    await page.locator('input[type="date"]').fill("2099-12-31");
    await page.getByRole("button", { name: "Create Assignment" }).click();
    await expect(page).toHaveURL(/\/assignments\/(?!new)[^/]+$/, { timeout: 20_000 });
    const rubrics = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_rubrics_v1") ?? "[]"));
    expect(rubrics[0].criteria[0].levels).toHaveLength(5);
    expect(rubrics[0].criteria[0].levels.map((l: { label: string }) => l.label))
      .toEqual(["ดีเยี่ยม", "ดี", "พอใช้", "Level 4", "ต้องปรับปรุง"]);
  });
});

test.describe("Recheck — comment on a manually adjusted score", () => {
  const open = async (page: Page) => {
    await seedTeacher(page, { withAssignment: true });
    await page.goto(`${BASE}/teacher/courses/c-tb3/assignments/a-tb3/recheck?sub=sub-tb3`);
    await page.waitForLoadState("networkidle");
  };

  test("the comment box appears only after the score is changed, and is saved per criterion", async ({ page }) => {
    await open(page);
    await expect(page.getByLabel("Feedback to AI")).toHaveCount(0);

    // Layout starts at round(0.6 × 80) = 48 — push it to 55
    await page.locator('input[type="number"]').first().fill("55");
    await expect(page.getByText("Manually Edited")).toBeVisible();
    const note = page.getByLabel("Feedback to AI");
    await expect(note).toHaveCount(1);
    await note.fill("Strong grid work, bumped up");
    await page.getByRole("button", { name: /save changes/i }).click();

    const sub = (await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_submissions_v1") ?? "[]")))
      .find((s: { id: string }) => s.id === "sub-tb3");
    expect(sub.criterionComments).toEqual({ "crit-a": "Strong grid work, bumped up" });
    expect(sub.instructorScore).toBe(55 + 32);
  });

  test("a saved note is still there when the page is reopened, blank notes are not stored", async ({ page }) => {
    await open(page);
    await page.locator('input[type="number"]').first().fill("55");
    await page.getByLabel("Feedback to AI").fill("Bumped up");
    await page.locator('input[type="number"]').nth(1).fill("30");
    await page.getByLabel("Feedback to AI").nth(1).fill("   ");
    await page.getByRole("button", { name: /save changes/i }).click();
    const sub = (await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_submissions_v1") ?? "[]")))
      .find((s: { id: string }) => s.id === "sub-tb3");
    expect(sub.criterionComments).toEqual({ "crit-a": "Bumped up" });

    await page.goto(`${BASE}/teacher/courses/c-tb3/assignments/a-tb3/recheck?sub=sub-tb3`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByLabel("Feedback to AI")).toHaveCount(1);
    await expect(page.getByLabel("Feedback to AI")).toHaveValue("Bumped up");
  });

  test("Reset to Default drops unsaved notes", async ({ page }) => {
    await open(page);
    await page.locator('input[type="number"]').first().fill("55");
    await page.getByLabel("Feedback to AI").fill("temp");
    await page.getByRole("button", { name: /reset to default/i }).click();
    await expect(page.getByLabel("Feedback to AI")).toHaveCount(0);
  });
});

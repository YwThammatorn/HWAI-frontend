import { test, expect, Page } from "@playwright/test";
import fs from "node:fs";

const BASE = "http://localhost:3000";

// 12/10/2569 — the Rubrics page (teacher course sidebar): Library (saved rubrics + this subject's rubrics term by term) and Compare
// years (the same rubric — same subject, same assignment name — next to its earlier years, criteria matched by name).
// Seeded from the real mock files: this year's c-mock-1 plus the two earlier offerings of rubric-years-mockup-en.json.

const rd = (f: string) => JSON.parse(fs.readFileSync(`public/mock-data/${f}`, "utf8"));
const courses = rd("courses-mockup-en.json"), teachers = rd("teachers-mockup-en.json"), flow = rd("student-flow-mockup-en.json"), years = rd("rubric-years-mockup-en.json");
const myTeacher = teachers.find((t: { id: string }) => t.id === "t-mock-1");
const TEACHERS = teachers.map((t: { id: string; courseIds: string[] }) => (t.id === "t-mock-1" ? { ...t, courseIds: [...t.courseIds, ...years.courses.map((c: { id: string }) => c.id)] } : t));

async function open(page: Page, path = "/teacher/courses/c-mock-1/rubrics", opts: { withYears?: boolean } = {}) {
  const withYears = opts.withYears !== false;
  await page.addInitScript((d) => {
    if (sessionStorage.getItem("ry_seeded")) return;
    sessionStorage.setItem("ry_seeded", "1");
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: d.email, role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify(d.courses));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify(d.teachers));
    localStorage.setItem("hwai_students_v1", JSON.stringify(d.roster));
    localStorage.setItem("hwai_grading_categories_v1", JSON.stringify(d.categories));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify(d.assignments));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify(d.rubrics));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(d.subs));
    localStorage.setItem("hwai_clos_v1", JSON.stringify(d.clos));
  }, {
    email: myTeacher.email,
    courses: withYears ? [...courses, ...years.courses] : courses,
    teachers: withYears ? TEACHERS : teachers,
    roster: flow.courseStudents, categories: flow.gradingCategories, clos: flow.clos,
    assignments: withYears ? [...flow.assignments, ...years.assignments] : flow.assignments,
    rubrics: withYears ? [...flow.rubrics, ...years.rubrics] : flow.rubrics,
    subs: withYears ? [...flow.submissions, ...years.submissions] : flow.submissions,
  });
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");
}

const compareTab = (page: Page) => page.getByRole("tab", { name: /Compare years/ });
const ref = (page: Page, name: string) => page.getByLabel("Compare the rubric of").selectOption({ label: name });
const cell = (page: Page, key: string, aid: string) => page.getByTestId(`cell-${key}-${aid}`);

// expected class average of one criterion of one assignment, straight from the mock file
const expectedAvg = (assignmentId: string, criterionIndex: number) => {
  const r = years.rubrics.find((x: { assignmentId: string }) => x.assignmentId === assignmentId);
  const c = r.criteria[criterionIndex];
  const subs = years.submissions.filter((s: { assignmentId: string }) => s.assignmentId === assignmentId);
  return Math.round((subs.reduce((n: number, s: { criterionScores: Record<string, number> }) => n + s.criterionScores[c.id], 0) / subs.length / c.maxPoints) * 100);
};

test.describe("Rubrics page", () => {
  test("the sidebar has a Rubrics item that opens the page", async ({ page }) => {
    await open(page, "/teacher/courses/c-mock-1");
    await page.getByLabel("Teacher navigation").getByRole("link", { name: "Rubrics" }).click();
    await expect(page).toHaveURL(/\/teacher\/courses\/c-mock-1\/rubrics$/);
    await expect(page.getByRole("heading", { level: 1, name: "Rubrics" })).toBeVisible();
  });

  test("Library: nothing saved yet; this subject's rubrics are listed newest term first with Last year marked", async ({ page }) => {
    await open(page);
    await expect(page.getByTestId("library-empty")).toBeVisible();
    const rows = page.getByTestId(/^subject-/);
    const first = rows.first();
    await expect(first).toContainText("Term 1/2568");
    await expect(first).toContainText("Last year");
    await expect(page.getByTestId("subject-a-yr-67-1")).toContainText("Term 1/2567");
    await expect(page.getByTestId("subject-a-yr-67-1")).not.toContainText("Last year");
  });

  test("Library: save a term's rubric, view it, rename it, delete it (with a confirmation)", async ({ page }) => {
    await open(page);
    await page.getByTestId("subject-a-yr-68-1").getByRole("button", { name: "Save to library" }).click();
    await expect(page.getByTestId("subject-a-yr-68-1").getByRole("button", { name: "Saved" })).toBeDisabled();
    const saved = page.locator("[data-testid^=library-]").filter({ hasNot: page.getByTestId("library-empty") }).first();
    await expect(saved).toContainText("3 criteria · 15 pts");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_rubric_library_v1")!)[0].courseTemplateId)).toBe("ct-18");

    await saved.getByRole("button", { name: "View criteria" }).click();
    await expect(saved.getByText("Program correctness", { exact: true })).toBeVisible();

    await saved.getByRole("button", { name: "Rename" }).click();
    await page.getByRole("dialog", { name: "Rename rubric" }).getByLabel("Rubric name").fill("Programming standard");
    await page.getByRole("dialog", { name: "Rename rubric" }).getByRole("button", { name: "Save" }).click();
    await expect(saved).toContainText("Programming standard");

    await saved.getByRole("button", { name: "Delete" }).click();
    const confirm = page.getByRole("dialog", { name: "Delete this rubric from the library?" });
    await confirm.getByRole("button", { name: "Not yet" }).click();
    await expect(saved).toBeVisible();                                           // Not yet changes nothing
    await saved.getByRole("button", { name: "Delete" }).click();
    await confirm.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByTestId("library-empty")).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_rubric_library_v1")!))).toEqual([]);
  });

  test("Compare years: this year's Python exercise next to 2567 and 2568, oldest to newest, criteria matched by name", async ({ page }) => {
    await open(page);
    await compareTab(page).click();
    await ref(page, "Introductory Python Exercise");
    const cols = page.locator("[data-testid^=col-]");
    await expect(cols).toHaveCount(3);
    expect(await cols.evaluateAll((els) => els.map((e) => (e.textContent ?? "").slice(0, 14)))).toEqual(["Term 1/2567Int", "Term 1/2568Int", "Term 1/2569(th"]);
    await expect(page.getByTestId("col-a-mock-1")).toContainText("(this one)");

    // 2568 has all three criteria and its numbers are the mock file's own
    await expect(cell(page, "program-correctness", "a-yr-68-1")).toContainText(`${expectedAvg("a-yr-68-1", 0)}%`);
    await expect(cell(page, "code-readability", "a-yr-68-1")).toContainText(`${expectedAvg("a-yr-68-1", 1)}%`);
    await expect(cell(page, "error-handling", "a-yr-68-1")).toContainText(`${expectedAvg("a-yr-68-1", 2)}%`);
    await expect(cell(page, "program-correctness", "a-yr-68-1")).toContainText("n = 36");
    // 2567 had no Error handling: an empty cell, and the row says it is not in every rubric
    await expect(cell(page, "error-handling", "a-yr-67-1")).toHaveText("—");
    await expect(page.getByTestId("row-error-handling")).toContainText("In 2 of 3 rubrics");
    await expect(page.getByTestId("row-program-correctness")).not.toContainText("of 3 rubrics");
  });

  test("Compare years: a criterion that only an older year had gets its own row, flagged", async ({ page }) => {
    await open(page);
    await compareTab(page).click();
    await ref(page, "Mini Project: Calculator");
    await expect(page.getByTestId("row-style-and-documentation")).toContainText("In 1 of 3 rubrics");
    await expect(cell(page, "style-and-documentation", "a-yr-67-2")).toContainText("%");
    await expect(cell(page, "style-and-documentation", "a-mock-2")).toHaveText("—");
    // this year's criteria come first, the older year's extra one last
    const names = await page.locator("[data-testid^=row-]").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
    expect(names[names.length - 1]).toBe("row-style-and-documentation");
  });

  test("Compare years: with no other year of the subject there is nothing to compare, and it says so", async ({ page }) => {
    await open(page, "/teacher/courses/c-mock-1/rubrics", { withYears: false });
    await compareTab(page).click();
    await expect(page.getByTestId("compare-none")).toContainText("No rubric of this subject in another term or year matches this one yet");
  });

  test("another assignment of the SAME term is never treated as 'the same rubric a year on'", async ({ page }) => {
    await open(page);
    await compareTab(page).click();
    await ref(page, "Introductory Python Exercise");
    await expect(page.getByTestId("col-a-mock-2")).toHaveCount(0);          // Mini Project (also this year) has the same criteria, but is another task
  });

  test("Thai UI", async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem("hwai_lang", "th"); });
    await open(page);
    await page.evaluate(() => localStorage.setItem("hwai_lang", "th"));
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: /เกณฑ์การให้คะแนน/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /เทียบข้ามปี/ })).toBeVisible();
  });
});

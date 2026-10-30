import { test, expect, Page } from "@playwright/test";
import fs from "node:fs";

import { BASE } from "./base";

// 12/10/2569 — the Rubrics page (teacher course sidebar): Library (saved rubrics + this subject's rubrics term by term) and Compare rubrics
// (14/10/2569: the teacher picks the rubrics to put side by side and lines the criteria up himself — it used to match them by name).
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

const compareTab = (page: Page) => page.getByRole("tab", { name: /Compare rubrics/ });
const cell = (page: Page, row: string, aid: string) => page.getByTestId(`cell-${row}-${aid}`);

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
    await expect(page.getByRole("tab", { name: /^Library/ })).toHaveText(/^Library\s*0$/);     // the count is what is saved, not the subject's rubrics listed below
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
    await expect(page.getByRole("tab", { name: /^Library/ })).toHaveText(/^Library\s*1$/);
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

  // 14/10/2569 — the teacher picks the rubrics to compare and says which criterion sits on which row; nothing is matched by name.
  const add = async (page: Page, assignmentId: string) => {
    await page.getByTestId("cmp-add").click();
    await page.getByTestId(`cmp-opt-${assignmentId}`).click();
  };
  const pick = (page: Page, row: number, assignmentId: string) => page.getByTestId(`map-${row}-${assignmentId}`);

  test("Compare: nothing is picked at first; the teacher adds rubrics one by one, in the order added, and the numbers are the mock file's own", async ({ page }) => {
    await open(page);
    await compareTab(page).click();
    await expect(page.getByTestId("compare-none")).toContainText("Nothing picked yet");
    await add(page, "a-yr-67-1");
    await expect(page.getByTestId("compare-one")).toBeVisible();
    await add(page, "a-yr-68-1");
    await add(page, "a-mock-1");
    const cols = page.locator("[data-testid^=col-]");
    await expect(cols).toHaveCount(3);
    expect(await cols.evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")))).toEqual(["col-a-yr-67-1", "col-a-yr-68-1", "col-a-mock-1"]);
    await expect(page.getByTestId("col-a-yr-68-1")).toContainText("Term 1/2568");

    // rows follow position by default: criterion 1, 2, 3 of each rubric
    await expect(cell(page, "0", "a-yr-68-1")).toContainText(`${expectedAvg("a-yr-68-1", 0)}%`);
    await expect(cell(page, "1", "a-yr-68-1")).toContainText(`${expectedAvg("a-yr-68-1", 1)}%`);
    await expect(cell(page, "2", "a-yr-68-1")).toContainText(`${expectedAvg("a-yr-68-1", 2)}%`);
    await expect(cell(page, "0", "a-yr-68-1")).toContainText("n = 36");
    // 2567 only has two criteria: its third row is empty, and says so
    await expect(pick(page, 2, "a-yr-67-1")).toHaveValue("");
    await expect(cell(page, "2", "a-yr-67-1")).toContainText("—");
    await expect(page.getByTestId("compare-levels-note")).toHaveCount(0);                   // all four-level rubrics
  });

  test("Compare: the list offers every assignment with a rubric in any of my courses — another subject too, never an exam — and a search narrows it", async ({ page }) => {
    await open(page);
    await compareTab(page).click();
    await page.getByTestId("cmp-add").click();
    await expect(page.getByTestId("cmp-opt-a-yr-67-1")).toBeVisible();               // an earlier year
    await expect(page.getByTestId("cmp-opt-a-mock-4")).toBeVisible();                // Quiz 1 — a different assignment of this year
    await expect(page.getByTestId("cmp-opt-a-mock-5")).toHaveCount(0);               // the midterm is an exam
    await page.getByLabel("Search assignments or courses").fill("calculator");
    await expect(page.getByTestId("cmp-opt-a-yr-67-2")).toBeVisible();
    await expect(page.getByTestId("cmp-opt-a-mock-2")).toBeVisible();
    await expect(page.getByTestId("cmp-opt-a-yr-67-1")).toHaveCount(0);
    await page.getByLabel("Search assignments or courses").fill("zzz nothing");
    await expect(page.getByTestId("cmp-add-empty")).toBeVisible();
  });

  test("Compare: the teacher chooses which criterion sits on a row — a rubric whose criteria are in another order can be lined up by hand", async ({ page }) => {
    await open(page);
    await compareTab(page).click();
    await add(page, "a-mock-2");        // C1 correctness · C2 readability · C3 error handling
    await add(page, "a-yr-68-2");       // C1 correctness · C2 error handling · C3 readability — same criteria, other order
    // by position, row 2 puts readability next to error handling: the teacher fixes it
    const c2 = (await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_rubrics_v1")!).find((r: { assignmentId: string }) => r.assignmentId === "a-yr-68-2").criteria.map((c: { id: string; name: string }) => [c.id, c.name]))) as [string, string][];
    const readability = c2.find(([, n]) => n.includes("readability"))![0];
    const errors = c2.find(([, n]) => n.includes("Error handling"))![0];
    await expect(pick(page, 1, "a-yr-68-2")).toHaveValue(errors);
    await pick(page, 1, "a-yr-68-2").selectOption(readability);
    await pick(page, 2, "a-yr-68-2").selectOption(errors);
    await expect(pick(page, 1, "a-yr-68-2")).toHaveValue(readability);
    const readabilityIndex = c2.findIndex(([id]) => id === readability);
    await expect(cell(page, "1", "a-yr-68-2")).toContainText(`${expectedAvg("a-yr-68-2", readabilityIndex)}%`);
    // and a row can be left empty on purpose
    await pick(page, 0, "a-yr-68-2").selectOption("");
    await expect(cell(page, "0", "a-yr-68-2")).toContainText("—");
  });

  test("Compare: a column can be removed, an added one cannot be added twice, and four is the most", async ({ page }) => {
    await open(page);
    await compareTab(page).click();
    await add(page, "a-yr-67-1");
    await page.getByTestId("cmp-add").click();
    await expect(page.getByTestId("cmp-opt-a-yr-67-1")).toBeDisabled();
    await expect(page.getByTestId("cmp-opt-a-yr-67-1")).toContainText("already added");
    await page.getByTestId("cmp-opt-a-yr-68-1").click();
    await add(page, "a-mock-1");
    await add(page, "a-mock-2");
    await expect(page.locator("[data-testid^=col-]")).toHaveCount(4);
    await expect(page.getByTestId("cmp-add")).toBeDisabled();
    await expect(page.getByTestId("cmp-add")).toHaveText("Up to 4 at a time");
    await page.getByRole("button", { name: "Remove Introductory Python Exercise from the comparison" }).first().click();
    await expect(page.locator("[data-testid^=col-]")).toHaveCount(3);
    await expect(page.getByTestId("cmp-add")).toBeEnabled();
  });

  test("Compare: rubrics with different numbers of levels can sit side by side, and the page says so", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      const r = JSON.parse(localStorage.getItem("hwai_rubrics_v1")!) as { assignmentId: string; criteria: { levels: unknown[] }[] }[];
      r.find((x) => x.assignmentId === "a-yr-67-1")!.criteria.forEach((c) => { c.levels = c.levels.slice(0, 3); });
      localStorage.setItem("hwai_rubrics_v1", JSON.stringify(r));
    });
    await page.reload();
    await compareTab(page).click();
    await add(page, "a-yr-67-1");
    await add(page, "a-yr-68-1");
    await expect(page.getByTestId("compare-levels-note")).toContainText("3 / 4");
    await expect(page.getByTestId("col-a-yr-67-1")).toContainText("2 criteria · 3 levels");
    await expect(page.getByTestId("col-a-yr-68-1")).toContainText("3 criteria · 4 levels");
  });

  test("Compare: with no rubric anywhere there is nothing to pick, and it says so", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("hwai_lang", "en");
      localStorage.setItem("hwai_user", JSON.stringify({ name: "S", email: "somsak@kmitl.ac.th", role: "teacher" }));
      localStorage.setItem("hwai_courses_v2", JSON.stringify([{ id: "c-x", name: "Empty course", status: "active", coverColor: "#0F766E", description: "", createdAt: "x", updatedAt: "x" }]));
      localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([{ id: "t-x", name: "S", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-x"] }]));
    });
    await page.goto(`${BASE}/teacher/courses/c-x/rubrics`);
    await compareTab(page).click();
    await expect(page.getByText("No rubric to compare yet")).toBeVisible();
  });

  test("Thai UI", async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem("hwai_lang", "th"); });
    await open(page);
    await page.evaluate(() => localStorage.setItem("hwai_lang", "th"));
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: /เกณฑ์การให้คะแนน/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /เทียบ rubric/ })).toBeVisible();
  });
});

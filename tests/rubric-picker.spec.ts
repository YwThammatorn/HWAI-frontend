import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// 12/10/2569 — "Use a rubric from before" on New / Edit Assignment: pick a rubric used earlier (same subject, last year first;
// any of my courses; the subject's library), take or skip it criterion by criterion — a skipped one can be dropped, replaced by
// a name the teacher types, or by one the stand-in AI proposes ("Ask again" gives another) — then replace or add to the criteria.
// "Save to library" keeps the current rubric for the subject.

const NOW = "2026-01-01T00:00:00.000Z";
const course = (id: string, name: string, tpl: string, year: number, term: number, extra: Record<string, unknown> = {}) => ({
  id, name, description: "", status: year < 2569 ? "archived" : "active", source: "manual", coverColor: "#0F766E", iconColor: "#0F766E",
  courseTemplateId: tpl, term, academicYear: year, sectionNumber: "1", code: "01076112", schedule: "Mon", room: "811", createdAt: NOW, updatedAt: NOW, ...extra,
});
const COURSES = [
  course("c-now", "Programming", "ct-prog", 2569, 1),
  course("c-prev", "Programming", "ct-prog", 2568, 1),
  course("c-old", "Programming", "ct-prog", 2567, 1),
  course("c-db", "Databases", "ct-db", 2568, 1),                // mine, another subject
  course("c-stranger", "Someone else's course", "ct-x", 2568, 1),   // not mine, not the same subject
];
const TEACHER = { id: "t-rp", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-now", "c-prev", "c-old", "c-db"] };

const levels = (a: string, b: string, c: string, d: string) => [
  { label: "Excellent", description: a }, { label: "Fair", description: b }, { label: "Needs Improvement", description: c }, { label: "Fail", description: d },
];
const crit = (id: string, name: string, pts: number, extra: Record<string, unknown> = {}) => ({
  id, name, description: `${name} description`, maxPoints: pts, weight: 0, levels: levels(`${name} top`, `${name} ok`, `${name} weak`, `${name} none`), ...extra,
});
const asg = (id: string, courseId: string, name: string, pts: number) => ({
  id, courseId, name, description: "", dueDate: "2025-01-10", maxPoints: pts, acceptsFiles: true, fileTypes: ["pdf"], submissionType: "individual",
  maxGroupSize: null, rubricIds: [], createdAt: NOW, updatedAt: NOW,
});
const ASSIGNMENTS = [
  asg("a-prev", "c-prev", "Python Exercise 2568", 20),
  asg("a-old", "c-old", "Python Exercise 2567", 20),
  asg("a-db", "c-db", "SQL Lab", 10),
  asg("a-stranger", "c-stranger", "Stranger Essay", 10),
];
const RUBRICS = [
  { id: "r-prev", assignmentId: "a-prev", name: "prev", createdAt: NOW, updatedAt: NOW, criteria: [
    crit("p1", "C1 · Program correctness / ความถูกต้อง", 10, { cloIds: ["clo-keep", "clo-gone"] }),
    crit("p2", "C2 · Error handling / การจัดการ Error", 6),
    crit("p3", "C3 · Code readability / ความอ่านง่าย", 4),
  ] },
  { id: "r-old", assignmentId: "a-old", name: "old", createdAt: NOW, updatedAt: NOW, criteria: [crit("o1", "C1 · Program correctness / ความถูกต้อง", 20)] },
  { id: "r-db", assignmentId: "a-db", name: "db", createdAt: NOW, updatedAt: NOW, criteria: [crit("d1", "C1 · Query correctness / ความถูกต้องของ SQL", 10)] },
  { id: "r-stranger", assignmentId: "a-stranger", name: "stranger", createdAt: NOW, updatedAt: NOW, criteria: [crit("s1", "C1 · Argument / ข้อโต้แย้ง", 10)] },
];
const sub = (id: string, studentId: string, p1: number, p2: number, p3: number) => ({
  id, assignmentId: "a-prev", studentId, studentName: studentId, email: `${studentId}@kmitl.ac.th`, submittedAt: "2025-01-05T10:00:00.000Z", fileUrl: null,
  aiScore: null, instructorScore: p1 + p2 + p3, instructorComment: "", externalUseConsent: false, status: "graded", updatedAt: NOW, criterionScores: { p1, p2, p3 },
});
const SUBS = [sub("s1", "64070701", 10, 4, 2), sub("s2", "64070702", 7, 2, 2)];   // p1 avg 85%, p2 50%, p3 50%
const CLOS = [{ id: "clo-keep", courseId: "c-now", code: "CLO1", text: "keep", createdAt: NOW, updatedAt: NOW }];

async function open(page: Page, path: string, extra: { library?: unknown[] } = {}) {
  await page.addInitScript((d) => {
    if (sessionStorage.getItem("rp_seeded")) return;
    sessionStorage.setItem("rp_seeded", "1");
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify(d.courses));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([d.teacher]));
    localStorage.setItem("hwai_students_v1", JSON.stringify([]));
    localStorage.setItem("hwai_grading_categories_v1", JSON.stringify([]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify(d.assignments));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify(d.rubrics));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(d.subs));
    localStorage.setItem("hwai_clos_v1", JSON.stringify(d.clos));
    if (d.library) localStorage.setItem("hwai_rubric_library_v1", JSON.stringify(d.library));
  }, { courses: COURSES, teacher: TEACHER, assignments: ASSIGNMENTS, rubrics: RUBRICS, subs: SUBS, clos: CLOS, library: extra.library });
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");
}

const NEW = "/teacher/courses/c-now/assignments/new";
const picker = (page: Page) => page.getByRole("dialog", { name: "Use a rubric from before" });
const openPicker = async (page: Page) => { await page.getByRole("button", { name: "Use a rubric from before" }).click(); const d = picker(page); await expect(d).toBeVisible(); return d; };
const pickRow = (d: ReturnType<typeof picker>, title: string) => d.getByRole("radio", { name: new RegExp(title) });
const names = (page: Page) => page.getByLabel("Criterion name").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));

test.describe("Use a rubric from before", () => {
  test("same subject lists earlier terms newest first with a Last year badge; All my courses adds my other subject; a stranger's course never shows", async ({ page }) => {
    await open(page, NEW);
    const d = await openPicker(page);
    await expect(d.getByRole("tab", { name: /Same subject\s*2/ })).toHaveAttribute("aria-selected", "true");
    const titles = await d.getByRole("radiogroup", { name: "Rubrics to choose from" }).getByRole("radio").evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText.split("\n")[0]));
    expect(titles).toEqual(["Python Exercise 2568", "Python Exercise 2567"]);                                // last year first
    await expect(pickRow(d, "Python Exercise 2568")).toContainText("Last year");
    await expect(pickRow(d, "Python Exercise 2567")).not.toContainText("Last year");
    await expect(pickRow(d, "Python Exercise 2568")).toContainText("3 criteria · 20 pts");
    await expect(pickRow(d, "Python Exercise 2568")).toContainText("avg 68% (2)");                             // (16 + 11) / 2 of 20, two graded
    await d.getByRole("tab", { name: /All my courses\s*3/ }).click();
    await expect(d.getByRole("radio", { name: /SQL Lab/ })).toBeVisible();
    await expect(d.getByText("Stranger Essay")).toHaveCount(0);
    await d.getByRole("tab", { name: /Library\s*0/ }).click();
    await expect(d.getByTestId("picker-empty")).toContainText("Nothing in the library yet");
  });

  test("the preview shows each criterion with how the class did on it then", async ({ page }) => {
    await open(page, NEW);
    const d = await openPicker(page);
    await pickRow(d, "Python Exercise 2568").click();
    const prev = d.getByTestId("picker-preview");
    await expect(prev).toContainText("Program correctness");
    await expect(prev).toContainText("85%");                  // p1: (10 + 7) / 2 / 10
    await expect(prev.getByText("50%")).toHaveCount(2);       // p2 and p3
  });

  test("take everything: the criteria arrive with their points, levels and only the CLO tags this course has", async ({ page }) => {
    await open(page, NEW);
    const d = await openPicker(page);
    await pickRow(d, "Python Exercise 2568").click();
    await d.getByRole("button", { name: "Next: choose criteria" }).click();
    await expect(d.getByRole("button", { name: "Use 3 criteria (20 pts)" })).toBeVisible();
    await d.getByRole("button", { name: "Use 3 criteria (20 pts)" }).click();
    await expect(picker(page)).toHaveCount(0);
    expect((await names(page)).filter((n) => n.includes("/"))).toEqual(["C1 · Program correctness / ความถูกต้อง", "C2 · Error handling / การจัดการ Error", "C3 · Code readability / ความอ่านง่าย"]);
    expect(await page.getByLabel("Points").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).toEqual(["10", "6", "4"]);
    await expect(page.getByText("20 pts total")).toBeVisible();
    // level wording came along
    await expect(page.locator("textarea").filter({ hasText: "C1 · Program correctness / ความถูกต้อง top" })).toHaveCount(1);
    // CLO tags: CLO1 exists in c-now (pressed), the other tag points at a CLO this course does not have
    await expect(page.getByTestId("clo-row-0").getByRole("button", { name: "CLO1" })).toHaveAttribute("aria-pressed", "true");
  });

  test("Skip → drop, name my own, or ask the AI; the skipped points follow the replacement", async ({ page }) => {
    await open(page, NEW);
    const d = await openPicker(page);
    await pickRow(d, "Python Exercise 2568").click();
    await d.getByRole("button", { name: "Next: choose criteria" }).click();

    // C2 skipped and replaced by one I name (keeps its 6 points)
    await d.getByTestId("pick-row-p2").getByRole("radio", { name: "Skip" }).click();
    await d.getByTestId("pick-row-p2").getByRole("radio", { name: "Go to a criterion I name" }).click();
    await expect(d.getByRole("button", { name: /^Use 2 criteria/ })).toBeDisabled();                    // a name is still missing
    await d.getByLabel(/Name of the criterion that replaces C2/).fill("Presentation");
    await expect(d.getByRole("button", { name: "Use 3 criteria (20 pts)" })).toBeEnabled();
    // C3 skipped and dropped
    await d.getByTestId("pick-row-p3").getByRole("radio", { name: "Skip" }).click();
    await expect(d.getByRole("button", { name: "Use 2 criteria (16 pts)" })).toBeVisible();
    await d.getByRole("button", { name: "Use 2 criteria (16 pts)" }).click();
    expect((await names(page)).filter(Boolean)).toEqual(["C1 · Program correctness / ความถูกต้อง", "Presentation"]);
    expect(await page.getByLabel("Points").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).toEqual(["10", "6"]);
  });

  test("Skip → the AI proposes a different criterion each time, never one that is already taken", async ({ page }) => {
    await open(page, NEW);
    const d = await openPicker(page);
    await pickRow(d, "Python Exercise 2568").click();
    await d.getByRole("button", { name: "Next: choose criteria" }).click();
    const row = d.getByTestId("pick-row-p3");
    await row.getByRole("radio", { name: "Skip" }).click();
    await row.getByRole("radio", { name: "Go to one the AI proposes" }).click();
    const proposed = () => d.getByTestId("ai-proposal-p3").locator("p").first().innerText();
    const first = await proposed();
    await d.getByTestId("ai-proposal-p3").getByRole("button", { name: "Ask again" }).click();
    const second = await proposed();
    expect(second).not.toBe(first);
    for (const n of [first, second]) { expect(n).not.toContain("Program correctness"); expect(n).not.toContain("Error handling"); expect(n).not.toContain("Code readability"); }
    await d.getByRole("button", { name: /^Use 3 criteria/ }).click();
    expect((await names(page)).some((n) => n.includes(second))).toBe(true);                               // the one on show when I pressed Use
    expect(await page.getByLabel("Points").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).toEqual(["10", "6", "4"]);   // the skipped criterion's 4 points
  });

  test("after a skip the C-codes run on without a gap: C1, C2 — not C1, C3", async ({ page }) => {
    await open(page, NEW);
    const d = await openPicker(page);
    await pickRow(d, "Python Exercise 2568").click();
    await d.getByRole("button", { name: "Next: choose criteria" }).click();
    await d.getByTestId("pick-row-p2").getByRole("radio", { name: "Skip" }).click();      // dropped
    await d.getByRole("button", { name: /^Use 2 criteria/ }).click();
    expect((await names(page)).filter(Boolean)).toEqual(["C1 · Program correctness / ความถูกต้อง", "C2 · Code readability / ความอ่านง่าย"]);
  });

  test("with criteria already in the editor the picker offers Replace or Add", async ({ page }) => {
    await open(page, NEW);
    await page.getByRole("button", { name: "Add New Criterion" }).click();
    await page.getByLabel("Criterion name").first().fill("My own first");
    const d = await openPicker(page);
    await pickRow(d, "Python Exercise 2567").click();
    await d.getByRole("button", { name: "Next: choose criteria" }).click();
    await d.getByRole("radio", { name: "Be added to the current ones" }).click();
    await d.getByRole("button", { name: /^Use 1 criterion/ }).click();
    const n = (await names(page)).filter(Boolean);
    expect(n[0]).toBe("My own first");
    expect(n).toContain("C3 · Program correctness / ความถูกต้อง");     // renumbered to follow the two that were already there
  });

  test("Save to library keeps the rubric for the subject; it shows up under Library next time, and never in another subject", async ({ page }) => {
    await open(page, NEW);
    let d = await openPicker(page);
    await pickRow(d, "Python Exercise 2568").click();
    await d.getByRole("button", { name: "Next: choose criteria" }).click();
    await d.getByRole("button", { name: /^Use 3 criteria/ }).click();
    await page.getByRole("button", { name: "Save to library" }).click();
    const save = page.getByRole("dialog", { name: "Save rubric to the library" });
    await save.getByLabel("Rubric name").fill("Programming standard rubric");
    await save.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved to the library" })).toBeVisible();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_rubric_library_v1") ?? "[]"));
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ name: "Programming standard rubric", courseTemplateId: "ct-prog" });
    expect(stored[0].criteria).toHaveLength(3);

    d = await openPicker(page);
    await d.getByRole("tab", { name: /Library\s*1/ }).click();
    await expect(d.getByRole("radio", { name: /Programming standard rubric/ })).toContainText("Library");
  });

  test("a library entry of another subject is not offered, and one with no subject is offered everywhere", async ({ page }) => {
    const entry = (id: string, name: string, tpl?: string) => ({ id, name, courseTemplateId: tpl, criteria: [crit("x1", "C1 · Style / สไตล์", 5)], createdAt: NOW });
    await open(page, NEW, { library: [entry("e1", "Mine for programming", "ct-prog"), entry("e2", "For databases only", "ct-db"), entry("e3", "For everything")] });
    const d = await openPicker(page);
    await d.getByRole("tab", { name: /Library\s*2/ }).click();
    await expect(d.getByRole("radio", { name: /Mine for programming/ })).toBeVisible();
    await expect(d.getByRole("radio", { name: /For everything/ })).toBeVisible();
    await expect(d.getByText("For databases only")).toHaveCount(0);
  });

  test("on Edit Assignment the assignment is never its own source", async ({ page }) => {
    await open(page, "/teacher/courses/c-prev/assignments/a-prev/edit");
    const d = await openPicker(page);
    // same subject from c-prev's point of view: the 2567 offering (a-prev excluded) — and c-now has no rubric yet
    await expect(d.getByRole("radio", { name: /Python Exercise 2568/ })).toHaveCount(0);
    await expect(d.getByRole("radio", { name: /Python Exercise 2567/ })).toBeVisible();
  });
});

import { test, expect, Page } from "@playwright/test";

import { BASE } from "./base";
import { mockAiGradeCriteria } from "../src/lib/aiGrading";

// 22/10/2569 — "Grade with AI" shows what is about to happen first (work, rubric, late work), and a rubric changed
// while grading is under way can be graded again with the new rubric: from the Edit popup, or later from the Grading pages.

const NOW = "2026-01-01T00:00:00.000Z";
const PEOPLE = [["69071101", "Ann"], ["69071102", "Ben"], ["69071103", "Cat"], ["69071104", "Dan"], ["69071105", "Eve"]];
const levels = [{ label: "Excellent", description: "" }, { label: "Good", description: "" }, { label: "Needs Improvement", description: "" }];
const RUBRIC = {
  id: "r1", assignmentId: "as1", name: "Landing page rubric", createdAt: NOW, updatedAt: NOW,
  criteria: [
    { id: "k1", name: "Layout", description: "", maxPoints: 60, weight: 60, levels },
    { id: "k2", name: "Accessibility", description: "", maxPoints: 40, weight: 40, levels },
  ],
};

interface Opt { offsets?: Record<string, number>; latePolicy?: object; eveLate?: boolean; noRubric?: boolean; manual?: boolean }

/** Ann–Dan are graded and Eve has only handed in. Seeded once per tab so changes made during the test survive navigation. */
async function seed(page: Page, o: Opt = {}) {
  await page.addInitScript(([people, rubric, opt]) => {
    if (sessionStorage.getItem("ap_seeded")) return;
    sessionStorage.setItem("ap_seeded", "1");
    const NOW = "2026-01-01T00:00:00.000Z";
    const ppl = people as string[][];
    const op = opt as { offsets?: Record<string, number>; latePolicy?: object; eveLate?: boolean; noRubric?: boolean; manual?: boolean };
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([{ id: "c-rs", name: "Restart Course", description: "", status: "active", source: "manual", coverColor: "#2DD4BF", iconColor: "#2DD4BF", courseTemplateId: "ct-rs", term: 1, academicYear: 2569, sectionNumber: "1", code: "01076555", schedule: "-", room: "-", createdAt: NOW, updatedAt: NOW }]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([{ id: "t1", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", status: "active", courseIds: ["c-rs"] }]));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(ppl.map(([id, f], i) => ({ id: `cs-${i}`, studentId: id, name: `${f} Test`, email: `${id}@kmitl.ac.th`, program: "CE", status: "active" }))));
    localStorage.setItem("hwai_students_v1", JSON.stringify(ppl.map(([id, f], i) => ({ id: `r-${i}`, courseId: "c-rs", studentId: id, name: `${f} Test`, email: `${id}@kmitl.ac.th`, enrollmentStatus: "enrolled" }))));
    localStorage.setItem("hwai_grading_categories_v1", "[]");
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([{
      id: "as1", courseId: "c-rs", name: "Landing page", description: "", dueDate: "2026-01-10", maxPoints: 100, acceptsFiles: true, fileTypes: ["pdf"],
      submissionType: "individual", maxGroupSize: null, rubricIds: ["r1"], createdAt: NOW, updatedAt: NOW,
      ...(op.manual ? { gradingMode: "manual" } : {}), ...(op.latePolicy ? { latePolicy: op.latePolicy } : {}),
    }]));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify(op.noRubric ? [] : [{ ...(rubric as object), ...(op.offsets ? { aiOffsets: op.offsets } : {}) }]));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(ppl.map(([id, f], i) => {
      const base = { id: `sub-${id}`, assignmentId: "as1", studentId: id, studentName: `${f} Test`, email: `${id}@kmitl.ac.th`, submittedAt: "2026-01-05T10:00:00.000Z", instructorComment: "", updatedAt: NOW };
      return i < 4
        ? { ...base, aiScore: 50 + i, instructorScore: 50 + i, status: "graded", criterionScores: { k1: 30, k2: 20 + i } }
        : { ...base, submittedAt: op.eveLate ? "2026-01-12T10:00:00.000Z" : base.submittedAt, late: op.eveLate || undefined, aiScore: null, instructorScore: null, status: "not_graded" };
    })));
  }, [PEOPLE, RUBRIC, o] as const);
}

const QUEUE = `${BASE}/teacher/courses/c-rs/grading`;
const ASSIGNMENT_GRADING = `${BASE}/teacher/courses/c-rs/assignments/as1/grading`;
const EDIT = `${BASE}/teacher/courses/c-rs/assignments/as1/edit`;
const go = async (page: Page, url: string) => { await page.goto(url); await page.waitForLoadState("networkidle"); };
const stored = (page: Page) => page.evaluate(() => ({
  subs: JSON.parse(localStorage.getItem("hwai_submissions_v1") ?? "[]") as { id: string; status: string; aiScore: number | null; instructorScore: number | null; aiCriterionScores?: Record<string, number> }[],
  asg: JSON.parse(localStorage.getItem("hwai_assignments_v1") ?? "[]")[0] as { rubricRestartedAt?: string; maxPoints: number },
}));
const aiButton = (page: Page, label: RegExp | string) => page.locator("main li", { hasText: "Landing page" }).getByRole("button", { name: label });

test.describe("Grade with AI — look before it starts", () => {
  test("the button opens a preview of the work and the rubric; “Not yet” writes nothing, confirming sends the work", async ({ page }) => {
    await seed(page);
    await go(page, QUEUE);
    await aiButton(page, "Grade with AI (1)").click();
    const dlg = page.getByRole("dialog", { name: "Grade this assignment with AI?" });
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText("Landing page");
    await expect(page.getByTestId("ai-preview-count")).toContainText("1 submission not graded yet");
    await expect(page.getByTestId("ai-preview-count")).toContainText("4 already scored");
    const rubric = page.getByTestId("ai-preview-rubric");
    await expect(rubric).toContainText("Layout");
    await expect(rubric).toContainText("Accessibility");
    await expect(rubric).toContainText("Excellent › Good › Needs Improvement");
    await expect(page.getByTestId("ai-preview").getByRole("link")).toHaveCount(0);        // no way out to Edit rubric / Calibration from here: that lives on the assignment's Grading page
    await expect(page.getByTestId("ai-preview-strictness")).toHaveCount(0);           // no AI strictness any more (8/11/2569)
    await expect(page.getByTestId("ai-preview-late")).toHaveCount(0);

    await dlg.getByRole("button", { name: "Not yet" }).click();
    await expect(dlg).toHaveCount(0);
    await expect(page).toHaveURL(/\/teacher\/courses\/c-rs\/grading$/);
    expect((await stored(page)).subs.find((s) => s.id === "sub-69071105")).toMatchObject({ status: "not_graded", aiScore: null });

    await aiButton(page, "Grade with AI (1)").click();
    await page.getByTestId("ai-preview-confirm").click();
    await expect(page).toHaveURL(/assignments\/as1\/grading$/);
    const eve = (await stored(page)).subs.find((s) => s.id === "sub-69071105")!;
    expect(eve.aiScore).not.toBeNull();
    expect(Object.keys(eve.aiCriterionScores ?? {}).sort()).toEqual(["k1", "k2"]);
  });

  test("continuing (nothing waits for the AI any more) still opens the popup: rubric first, nothing is sent, then the grading page", async ({ page }) => {
    await seed(page);
    await page.addInitScript(() => {
      if (sessionStorage.getItem("ap_all")) return;
      sessionStorage.setItem("ap_all", "1");
      // the AI has already scored Eve and the teacher has not confirmed it: the row is not "complete" (so the buttons stay), but nothing waits for the AI
      const subs = JSON.parse(localStorage.getItem("hwai_submissions_v1") ?? "[]");
      localStorage.setItem("hwai_submissions_v1", JSON.stringify(subs.map((s: { id: string }) => s.id === "sub-69071105" ? { ...s, aiScore: 55, instructorScore: null, status: "need_review", aiCriterionScores: { k1: 30, k2: 25 } } : s)));
    });
    await go(page, QUEUE);
    await aiButton(page, "Grade with AI").click();
    const dlg = page.getByRole("dialog", { name: "Continue grading this assignment?" });
    await expect(dlg).toBeVisible();
    await expect(page.getByTestId("ai-preview-count")).toContainText("Nothing is waiting for the AI");
    await expect(page.getByTestId("ai-preview-count")).toContainText("5 already scored");
    await expect(page.getByTestId("ai-preview-confirm")).toHaveText("Open grading");
    await expect(page.getByTestId("ai-preview-rubric")).toContainText("Layout");
    await dlg.getByRole("button", { name: "Not yet" }).click();
    await expect(page).toHaveURL(/\/teacher\/courses\/c-rs\/grading$/);

    await aiButton(page, "Grade with AI").click();
    await page.getByTestId("ai-preview-confirm").click();
    await expect(page).toHaveURL(/assignments\/as1\/grading$/);
    expect((await stored(page)).subs.find((s) => s.id === "sub-69071105")).toMatchObject({ status: "need_review", aiScore: 55 });      // nothing was touched
  });

  test("an old AI correction left on a rubric is ignored: no strictness in the preview, and the AI marks the work as it would without it", async ({ page }) => {
    // 8/11/2569: Calibration no longer tunes the AI — a rubric saved before that may still carry aiOffsets, which nothing reads
    await seed(page, { offsets: { k1: 1, k2: -1 } });
    await go(page, QUEUE);
    await aiButton(page, "Grade with AI (1)").click();
    await expect(page.getByTestId("ai-preview")).toBeVisible();
    await expect(page.getByTestId("ai-preview-strictness")).toHaveCount(0);
    await expect(page.getByTestId("ai-preview")).not.toContainText("stricter");
    await page.getByTestId("ai-preview-confirm").click();
    await expect(page).toHaveURL(/assignments\/as1\/grading$/);
    const eve = (await stored(page)).subs.find((s) => s.id === "sub-69071105")!;
    expect(eve.aiCriterionScores).toEqual(mockAiGradeCriteria("sub-69071105", RUBRIC.criteria).criterionScores);
    expect(eve).not.toHaveProperty("aiOffsetsUsed");
  });

  test("an assignment with a late policy says what late work costs and how many are late", async ({ page }) => {
    await seed(page, { eveLate: true, latePolicy: { closeDate: "2026-01-13", mode: "perDay", unit: "percent", amount: 10, cap: 30 } });
    await go(page, QUEUE);
    await aiButton(page, "Grade with AI (1)").click();
    const late = page.getByTestId("ai-preview-late");
    await expect(late).toContainText("10% per day");
    await expect(late).toContainText("1 submission handed in late");
  });

  test("without a rubric it warns that the AI gives a total only", async ({ page }) => {
    await seed(page, { noRubric: true });
    await go(page, QUEUE);
    await aiButton(page, "Grade with AI (1)").click();
    const warn = page.getByTestId("ai-preview-norubric");
    await expect(warn).toContainText("a total only");
    await expect(page.getByTestId("ai-preview-confirm")).toBeEnabled();
  });

  test("Thai wording", async ({ page }) => {
    await seed(page);
    await page.addInitScript(() => localStorage.setItem("hwai_lang", "th"));
    await go(page, QUEUE);
    await aiButton(page, "ตรวจด้วย AI (1)").click();
    await expect(page.getByRole("dialog", { name: "ให้ AI ตรวจงานนี้?" })).toBeVisible();
    await expect(page.getByTestId("ai-preview-confirm")).toContainText("เริ่มให้ AI ตรวจ 1 งาน");
  });
});

test.describe("Rubric changed while grading — regrade with the new rubric", () => {
  async function changeRubricAndSave(page: Page) {
    await go(page, EDIT);
    await page.getByLabel("Points").nth(0).fill("70");
    await page.getByRole("button", { name: "Save Changes" }).click();
  }

  test("“Save and regrade with AI now” clears the old scores and has the AI grade the same work under the new rubric", async ({ page }) => {
    await seed(page);
    await changeRubricAndSave(page);
    const dlg = page.getByRole("dialog", { name: "Changing the rubric restarts grading" });
    await expect(dlg.getByTestId("confirm-restart")).toBeVisible();      // the plain restart is still there
    await dlg.getByTestId("confirm-regrade").click();
    await expect.poll(async () => (await stored(page)).subs.filter((s) => s.aiScore !== null).length).toBe(4);
    const s = await stored(page);
    for (const x of s.subs.slice(0, 4)) {
      expect(x.instructorScore).toBeNull();                              // the teacher's own scores went with the old rubric
      expect(["graded", "need_review"]).toContain(x.status);
      expect(Object.keys(x.aiCriterionScores ?? {}).sort()).toEqual(["k1", "k2"]);
      expect(x.aiCriterionScores!.k1).toBeLessThanOrEqual(70);           // scored out of the NEW 70, not the old 60
    }
    expect(s.subs[4]).toMatchObject({ status: "not_graded", aiScore: null });   // nobody had scored Eve: she waits as before
    expect(s.asg.maxPoints).toBe(110);
    expect(s.asg.rubricRestartedAt).toBeUndefined();
  });

  test("a plain restart leaves the work waiting and marks the rubric as restarted; the course Grading list then offers Regrade with new rubric", async ({ page }) => {
    await seed(page);
    await changeRubricAndSave(page);
    await page.getByTestId("confirm-restart").click();
    await expect.poll(async () => (await stored(page)).asg.rubricRestartedAt).toBeTruthy();
    expect((await stored(page)).subs.every((s) => s.status === "not_graded")).toBe(true);

    await go(page, QUEUE);
    await expect(aiButton(page, "Grade with AI")).toHaveCount(0);
    await aiButton(page, "Regrade with new rubric (5)").click();
    const dlg = page.getByRole("dialog", { name: "Regrade with the new rubric?" });
    await expect(page.getByTestId("ai-preview-restarted")).toContainText("rubric was changed after grading started");
    await expect(page.getByTestId("ai-preview-rubric")).toContainText("70");
    await page.getByTestId("ai-preview-confirm").click();
    await expect(page).toHaveURL(/assignments\/as1\/grading$/);
    await expect(dlg).toHaveCount(0);
    const s = await stored(page);
    expect(s.subs.every((x) => x.aiScore !== null)).toBe(true);
    expect(s.asg.rubricRestartedAt).toBeUndefined();
  });

  test("the assignment's own Grading page shows a banner with the same button, which disappears once the AI has graded again", async ({ page }) => {
    await seed(page);
    await changeRubricAndSave(page);
    await page.getByTestId("confirm-restart").click();
    await expect.poll(async () => (await stored(page)).asg.rubricRestartedAt).toBeTruthy();

    await go(page, ASSIGNMENT_GRADING);
    const banner = page.getByTestId("regrade-banner");
    await expect(banner).toContainText("5 submission(s) wait to be graded under the new rubric");
    await page.getByTestId("regrade-new-rubric").click();
    await expect(page.getByRole("dialog", { name: "Regrade with the new rubric?" })).toBeVisible();
    await page.getByTestId("ai-preview-confirm").click();
    await expect(banner).toHaveCount(0);
    await expect.poll(async () => (await stored(page)).subs.filter((x) => x.aiScore !== null).length).toBe(5);
    expect((await stored(page)).asg.rubricRestartedAt).toBeUndefined();
  });

  test("without the marker there is no banner (nothing was restarted)", async ({ page }) => {
    await seed(page);
    await go(page, ASSIGNMENT_GRADING);
    await expect(page.getByTestId("regrade-banner")).toHaveCount(0);
  });

  test("an assignment graded by hand has no AI to regrade with: no regrade button, no marker, no banner", async ({ page }) => {
    await seed(page, { manual: true });
    await changeRubricAndSave(page);
    const dlg = page.getByRole("dialog", { name: "Changing the rubric restarts grading" });
    await expect(dlg.getByTestId("confirm-regrade")).toHaveCount(0);
    await dlg.getByTestId("confirm-restart").click();
    await expect.poll(async () => (await stored(page)).subs.every((s) => s.status === "not_graded")).toBe(true);
    expect((await stored(page)).asg.rubricRestartedAt).toBeUndefined();
    await go(page, ASSIGNMENT_GRADING);
    await expect(page.getByTestId("regrade-banner")).toHaveCount(0);
  });
});

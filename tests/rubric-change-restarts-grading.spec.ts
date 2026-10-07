import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// 7/10/2569 — changing a rubric under work that is already graded restarts that grading, and the teacher is told
// first (a popup on Save). Once the results are announced ("Finish & announce") the rubric is locked altogether.

const NOW = "2026-01-01T00:00:00.000Z";
const PEOPLE = [["69071101", "Ann"], ["69071102", "Ben"], ["69071103", "Cat"], ["69071104", "Dan"], ["69071105", "Eve"]];
const levels = [{ label: "Excellent", description: "" }, { label: "Good", description: "" }, { label: "Needs Improvement", description: "" }];
const RUBRIC = {
  id: "r1", assignmentId: "as1", name: "Rubric", createdAt: NOW, updatedAt: NOW,
  criteria: [
    { id: "k1", name: "Layout", description: "", maxPoints: 60, weight: 60, levels },
    { id: "k2", name: "Accessibility", description: "", maxPoints: 40, weight: 40, levels },
  ],
};

/** Ann–Dan are graded (30+20, 36+24, ...) and Eve has only handed in, unless `ungraded`. */
async function seed(page: Page, o: { finalized?: boolean; ungraded?: boolean } = {}) {
  await page.addInitScript(([people, rubric, finalized, ungraded]) => {
    const NOW = "2026-01-01T00:00:00.000Z";
    const ppl = people as string[][];
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([{ id: "c-rs", name: "Restart Course", description: "", status: "active", source: "manual", coverColor: "#2DD4BF", iconColor: "#2DD4BF", courseTemplateId: "ct-rs", term: 1, academicYear: 2569, sectionNumber: "1", code: "01076555", schedule: "-", room: "-", createdAt: NOW, updatedAt: NOW }]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([{ id: "t1", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-rs"] }]));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(ppl.map(([id, f], i) => ({ id: `cs-${i}`, studentId: id, firstName: f, lastName: "Test", email: `${id}@kmitl.ac.th`, program: "CE", status: "active" }))));
    localStorage.setItem("hwai_students_v1", JSON.stringify(ppl.map(([id, f], i) => ({ id: `r-${i}`, courseId: "c-rs", studentId: id, firstName: f, lastName: "Test", email: `${id}@kmitl.ac.th`, sequenceNumber: i + 1, enrollmentStatus: "enrolled" }))));
    localStorage.setItem("hwai_grading_categories_v1", "[]");
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([{
      id: "as1", courseId: "c-rs", name: "Landing page", description: "", dueDate: "2026-01-10", maxPoints: 100, acceptsFiles: true, fileTypes: ["pdf"],
      submissionType: "individual", maxGroupSize: null, rubricIds: ["r1"], gradingFinalized: finalized || undefined, createdAt: NOW, updatedAt: NOW,
    }]));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify([rubric]));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(ppl.map(([id, f], i) => {
      const base = { id: `sub-${id}`, assignmentId: "as1", studentId: id, studentName: `${f} Test`, email: `${id}@kmitl.ac.th`, submittedAt: "2026-01-05T10:00:00.000Z", fileUrl: null, externalUseConsent: false, instructorComment: "kept note", updatedAt: NOW };
      return i < 4 && !ungraded
        ? { ...base, aiScore: 50 + i, instructorScore: 50 + i, status: "graded", criterionScores: { k1: 30, k2: 20 + i }, criterionComments: { k1: "why" } }
        : { ...base, aiScore: null, instructorScore: null, status: "not_graded" };
    })));
  }, [PEOPLE, RUBRIC, !!o.finalized, !!o.ungraded] as const);
}

const EDIT = `${BASE}/teacher/courses/c-rs/assignments/as1/edit`;
async function openEdit(page: Page) {
  await page.goto(EDIT);
  await page.waitForLoadState("networkidle");
}
const stored = (page: Page) => page.evaluate(() => ({
  subs: JSON.parse(localStorage.getItem("hwai_submissions_v1") ?? "[]") as { id: string; status: string; aiScore: number | null; instructorScore: number | null; criterionScores?: object; criterionComments?: object; instructorComment: string }[],
  rubrics: JSON.parse(localStorage.getItem("hwai_rubrics_v1") ?? "[]") as { criteria: { id: string; name: string; maxPoints: number }[] }[],
  assignment: JSON.parse(localStorage.getItem("hwai_assignments_v1") ?? "[]")[0] as { name: string; maxPoints: number },
}));

test.describe("Rubric change restarts grading", () => {
  test("the rubric section already says changing it restarts the 4 graded submissions", async ({ page }) => {
    await seed(page);
    await openEdit(page);
    await expect(page.getByTestId("rubric-restart-note")).toContainText("4 submissions have been graded");
    await expect(page.getByTestId("rubric-locked")).toHaveCount(0);
  });

  test("saving a changed rubric opens a popup; “Keep editing” leaves everything untouched", async ({ page }) => {
    await seed(page);
    await openEdit(page);
    await page.getByLabel("Points").nth(0).fill("70");
    await page.getByRole("button", { name: "Save Changes" }).click();
    const dlg = page.getByRole("dialog", { name: "Changing the rubric restarts grading" });
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText("4 submissions have already been graded");
    await expect(dlg).toContainText("send them back to “Not graded”");
    await dlg.getByRole("button", { name: "Keep editing" }).click();
    await expect(dlg).toHaveCount(0);
    const s = await stored(page);
    expect(s.subs.filter((x) => x.status === "graded")).toHaveLength(4);
    expect(s.rubrics[0].criteria[0].maxPoints).toBe(60);
    expect(s.assignment.maxPoints).toBe(100);
  });

  test("confirming saves the rubric and sends the 4 graded submissions back to Not graded", async ({ page }) => {
    await seed(page);
    await openEdit(page);
    await page.getByLabel("Points").nth(0).fill("70");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await page.getByTestId("confirm-restart").click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
    const s = await stored(page);
    expect(s.rubrics[0].criteria.map((c) => c.maxPoints)).toEqual([70, 40]);
    expect(s.assignment.maxPoints).toBe(110);
    expect(s.subs.every((x) => x.status === "not_graded" && x.aiScore === null && x.instructorScore === null)).toBe(true);
    expect(s.subs.every((x) => x.criterionScores === undefined && x.criterionComments === undefined)).toBe(true);
    expect(s.subs[0].instructorComment).toBe("kept note");   // the teacher's own note stays
  });

  test("a rubric text-only change (a criterion renamed) restarts too", async ({ page }) => {
    await seed(page);
    await openEdit(page);
    await page.getByLabel("Criterion name").nth(1).fill("Accessibility & contrast");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("changing something other than the rubric saves straight away and keeps the scores", async ({ page }) => {
    await seed(page);
    await openEdit(page);
    await page.locator("input[required]").first().fill("Landing page v2");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const s = await stored(page);
    expect(s.assignment.name).toBe("Landing page v2");
    expect(s.subs.filter((x) => x.status === "graded")).toHaveLength(4);
  });

  test("with nothing graded yet a rubric change needs no popup and no warning", async ({ page }) => {
    await seed(page, { ungraded: true });
    await openEdit(page);
    await expect(page.getByTestId("rubric-restart-note")).toHaveCount(0);
    await page.getByLabel("Points").nth(0).fill("70");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await stored(page)).rubrics[0].criteria[0].maxPoints).toBe(70);
  });

  test("Thai wording", async ({ page }) => {
    await seed(page);
    await page.addInitScript(() => localStorage.setItem("hwai_lang", "th"));
    await openEdit(page);
    await page.getByLabel("คะแนน", { exact: true }).nth(0).fill("70");
    await page.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }).click();
    const dlg = page.getByRole("dialog", { name: "เปลี่ยนเกณฑ์ = เริ่มตรวจใหม่" });
    await expect(dlg).toContainText("งานนี้ตรวจไปแล้ว 4 ชิ้น");
    await expect(dlg.getByRole("button", { name: "บันทึกและเริ่มตรวจใหม่" })).toBeVisible();
  });
});

test.describe("Rubric locked once results are announced", () => {
  test("the Edit page shows why, and every rubric field and button is disabled", async ({ page }) => {
    await seed(page, { finalized: true });
    await openEdit(page);
    const note = page.getByTestId("rubric-locked");
    await expect(note).toContainText("the rubric can't be changed");
    await expect(note.getByRole("link", { name: "Go to Grading" })).toHaveAttribute("href", /\/assignments\/as1\/grading$/);
    await expect(page.getByTestId("rubric-restart-note")).toHaveCount(0);
    await expect(page.getByLabel("Criterion name").nth(0)).toBeDisabled();
    await expect(page.getByLabel("Points").nth(0)).toBeDisabled();
    await expect(page.getByRole("button", { name: /Add New Criterion/i })).toBeDisabled();
  });

  test("other fields still save and the rubric stays exactly as it was, with no popup", async ({ page }) => {
    await seed(page, { finalized: true });
    await openEdit(page);
    await page.locator("input[required]").first().fill("Landing page v2");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const s = await stored(page);
    expect(s.assignment.name).toBe("Landing page v2");
    expect(s.assignment.maxPoints).toBe(100);
    expect(s.rubrics[0].criteria.map((c) => [c.name, c.maxPoints])).toEqual([["Layout", 60], ["Accessibility", 40]]);
    expect(s.subs.filter((x) => x.status === "graded")).toHaveLength(4);
  });

  test("the Grading page's rubric panel shows a lock instead of the Edit link", async ({ page }) => {
    await seed(page, { finalized: true });
    await page.goto(`${BASE}/teacher/courses/c-rs/assignments/as1/grading`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("rubric-locked-chip")).toBeVisible();
    await expect(page.getByTestId("grading-rubric").getByRole("link", { name: "Edit rubric" })).toHaveCount(0);
  });

  test("an open (not announced) assignment keeps its Edit rubric link", async ({ page }) => {
    await seed(page);
    await page.goto(`${BASE}/teacher/courses/c-rs/assignments/as1/grading`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("grading-rubric").getByRole("link", { name: "Edit rubric" })).toBeVisible();
    await expect(page.getByTestId("rubric-locked-chip")).toHaveCount(0);
  });

  test("“Reopen grading” unlocks the rubric again", async ({ page }) => {
    await seed(page, { finalized: true });
    await page.goto(`${BASE}/teacher/courses/c-rs/assignments/as1/grading`);
    await page.waitForLoadState("networkidle");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Reopen grading" }).click();
    // client-side navigation: a fresh page.goto would run the seeding script again and re-announce it
    await page.getByRole("link", { name: "Edit Assignment" }).click();
    await page.waitForURL(/assignments\/as1\/edit$/);
    await expect(page.getByTestId("rubric-locked")).toHaveCount(0);
    await expect(page.getByLabel("Points").nth(0)).toBeEnabled();
  });
});

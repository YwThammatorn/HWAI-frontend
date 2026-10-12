import { test, expect } from "@playwright/test";
import fs from "node:fs";

const BASE = "http://localhost:3000";

// 11/10/2569 — console command [18] must reach a browser that still holds the OLD data (old teachers, rubrics without
// CLO tags): the teachers and the CLO tags update, nothing else is touched. The command text is read out of
// test-data/seed-commands.txt, so what the user pastes is exactly what is tested.

const DOC = fs.readFileSync("test-data/seed-commands.txt", "utf8").split(/\r?\n/);
function command(lang: "th" | "en"): string {
  const start = DOC.findIndex((l) => l.startsWith("[18]"));
  const lines = DOC.slice(start + 1, DOC.findIndex((l, i) => i > start && l.startsWith("[4]")));
  const fetches = lines.filter((l) => l.startsWith("fetch("));
  return fetches[lang === "th" ? 0 : 1].replace(/location\.reload\(\);/g, "").trim().replace(/;$/, "");
}

for (const lang of ["th", "en"] as const) {
  test(`[18] ${lang}: new teachers + CLO tags land on top of the old state, and nothing else changes`, async ({ page }) => {
    await page.goto(`${BASE}/login`);
    // the user's old browser: ประเสริฐ still teaches c-mock-7, the c-mock-1 rubric has no tags, another course's data sits next to it
    await page.evaluate(() => {
      localStorage.setItem("hwai_courses_v2", JSON.stringify([{ id: "c-mock-15", name: "old ML course nobody teaches" }, { id: "c-mock-1", name: "old" }]));
      localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([{ id: "t-mock-2", name: "old", email: "prasert.d@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-mock-7"] }]));
      localStorage.setItem("hwai_rubrics_v1", JSON.stringify([
        { id: "r-mock-1", assignmentId: "a-mock-1", name: "old", criteria: [{ id: "rc-1", name: "old", description: "", maxPoints: 9, weight: 60, levels: [] }], createdAt: "x", updatedAt: "x" },
        { id: "r-keep", assignmentId: "a-other", name: "someone else's rubric", criteria: [], createdAt: "x", updatedAt: "x" },
      ]));
      localStorage.setItem("hwai_submissions_v1", JSON.stringify([{ id: "keep-me", assignmentId: "a-other" }]));
      localStorage.setItem("hwai_cohort_students_v1", JSON.stringify([{ id: "keep-student" }]));
      localStorage.setItem("hwai_clos_v1", JSON.stringify([{ id: "own-clo", courseId: "c-other", code: "X", text: "mine" }]));
    });
    await page.evaluate(`(async () => { await (${command(lang)}); })()`);

    const after = await page.evaluate(() => ({
      courses: JSON.parse(localStorage.getItem("hwai_courses_v2")!) as { id: string }[],
      teachers: JSON.parse(localStorage.getItem("hwai_managed_teachers_v1")!) as { id: string; courseIds: string[] }[],
      rubrics: JSON.parse(localStorage.getItem("hwai_rubrics_v1")!) as { id: string; criteria: { id: string; cloIds?: string[] }[] }[],
      clos: JSON.parse(localStorage.getItem("hwai_clos_v1")!) as { id: string }[],
      submissions: JSON.parse(localStorage.getItem("hwai_submissions_v1")!),
      cohort: JSON.parse(localStorage.getItem("hwai_cohort_students_v1")!),
    }));

    // courses: whole list replaced — the untaught ML courses are gone, every remaining course has a teacher
    expect(after.courses.length).toBe(50);
    expect(after.courses.map((c) => c.id)).not.toContain("c-mock-15");
    expect(after.courses.filter((c) => !after.teachers.some((t) => t.courseIds.includes(c.id)))).toEqual([]);

    // teachers: whole list replaced, and one teacher now has all three Programming sections
    const owner = (id: string) => after.teachers.filter((t) => t.courseIds.includes(id)).map((t) => t.id);
    expect(after.teachers.length).toBe(6);
    expect(owner("c-mock-1")).toEqual(["t-mock-1"]);
    expect(owner("c-mock-7")).toEqual(["t-mock-1"]);
    expect(owner("c-mock-8")).toEqual(["t-mock-1"]);

    // rubrics: replaced by id (now tagged), someone else's kept
    const r1 = after.rubrics.find((r) => r.id === "r-mock-1")!;
    expect(r1.criteria[0].cloIds).toEqual(["clo-mock-1"]);
    expect(after.rubrics.some((r) => r.id === "r-keep")).toBe(true);
    expect(after.rubrics.find((r) => r.id === "r-mock-3")!.criteria.find((c) => c.id === "rc-7")!.cloIds).toEqual(["clo-mock-1", "clo-mock-2"]);

    // CLOs: the four c-mock-1 ones are there, the user's own survives
    expect(after.clos.map((c) => c.id)).toEqual(expect.arrayContaining(["own-clo", "clo-mock-1", "clo-mock-2", "clo-mock-3", "clo-mock-4"]));

    // untouched
    expect(after.submissions).toEqual([{ id: "keep-me", assignmentId: "a-other" }]);
    expect(after.cohort).toEqual([{ id: "keep-student" }]);
  });
}

test("[18]: from an old browser with the course loaded but no CLO tags, the real screens show them afterwards", async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.evaluate(async () => {
    const flow = await (await fetch("/mock-data/student-flow-mockup-en.json")).json();
    const courses = await (await fetch("/mock-data/courses-mockup-en.json")).json();
    localStorage.setItem("hwai_courses_v2", JSON.stringify(courses));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify(flow.assignments));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(flow.submissions));
    localStorage.setItem("hwai_students_v1", JSON.stringify(flow.courseStudents));
    localStorage.setItem("hwai_grading_categories_v1", JSON.stringify(flow.gradingCategories));
    // the old state: rubrics without tags, no CLOs yet
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify(flow.rubrics.map((r: { criteria: Record<string, unknown>[] }) => ({ ...r, criteria: r.criteria.map(({ cloIds: _gone, ...c }) => c) }))));
    localStorage.setItem("hwai_clos_v1", "[]");
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak.c@kmitl.ac.th", role: "teacher" }));
  });
  await page.goto(`${BASE}/teacher/courses/c-mock-1/assignments/a-mock-1`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("clo-chips")).toHaveCount(0);          // before: nothing tagged

  await page.evaluate(`(async () => { await (${command("en")}); })()`);
  await page.goto(`${BASE}/teacher/courses/c-mock-1/assignments/a-mock-1`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("clo-chips").first()).toBeVisible();   // after

  await page.goto(`${BASE}/teacher/courses/c-mock-1/clo`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("clo-links-CLO1").getByTestId("clo-attainment")).toBeVisible();
  await expect(page.getByTestId("clo-unmeasured")).toHaveCount(0);      // all four CLOs are measured
});

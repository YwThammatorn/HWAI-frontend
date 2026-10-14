import { test, expect } from "@playwright/test";
import fs from "node:fs";

import { BASE } from "./base";

// 12/10/2569 — console command [21] adds the two earlier offerings of the programming subject (with rubrics and class results)
// the Rubrics > Compare years page needs. It must merge by id into a browser that already holds data and touch nothing else.
// The command is read out of test-data/seed-commands.txt, so what the user pastes is exactly what is tested.

const DOC = fs.readFileSync("test-data/seed-commands.txt", "utf8").split(/\r?\n/);
function command(lang: "th" | "en"): string {
  const start = DOC.findIndex((l) => l.startsWith("[21]"));
  const lines = DOC.slice(start + 1, DOC.findIndex((l, i) => i > start && l.startsWith("[4]")));
  const found = lines.filter((l) => l.startsWith("const get="));
  return found[lang === "th" ? 0 : 1].replace(/location\.reload\(\);/g, "").trim().replace(/;$/, "");
}

for (const lang of ["th", "en"] as const) {
  test(`[21] ${lang}: adds the earlier years of the subject by id and leaves everything else alone`, async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.evaluate(() => {
      localStorage.setItem("hwai_courses_v2", JSON.stringify([{ id: "c-mock-1", name: "this year" }, { id: "c-own", name: "mine" }]));
      localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([{ id: "t-mock-1", name: "T", email: "t@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-mock-1"] }, { id: "t-other", name: "O", email: "o@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-own"] }]));
      localStorage.setItem("hwai_assignments_v1", JSON.stringify([{ id: "a-keep" }]));
      localStorage.setItem("hwai_rubrics_v1", JSON.stringify([{ id: "r-keep", assignmentId: "a-keep", criteria: [] }]));
      localStorage.setItem("hwai_submissions_v1", JSON.stringify([{ id: "keep-me", assignmentId: "a-keep" }]));
      localStorage.setItem("hwai_cohort_students_v1", JSON.stringify([{ id: "keep-student" }]));
    });
    await page.evaluate(`(async () => { ${command(lang).replace("get('/mock-data", "return get('/mock-data")} })()`);

    const after = await page.evaluate(() => ({
      courses: JSON.parse(localStorage.getItem("hwai_courses_v2")!) as { id: string; academicYear?: number; status?: string }[],
      teachers: JSON.parse(localStorage.getItem("hwai_managed_teachers_v1")!) as { id: string; courseIds: string[] }[],
      assignments: JSON.parse(localStorage.getItem("hwai_assignments_v1")!) as { id: string }[],
      rubrics: JSON.parse(localStorage.getItem("hwai_rubrics_v1")!) as { id: string }[],
      subs: JSON.parse(localStorage.getItem("hwai_submissions_v1")!) as { id: string }[],
      cohort: JSON.parse(localStorage.getItem("hwai_cohort_students_v1")!),
    }));
    expect(after.courses.map((c) => c.id).sort()).toEqual(["c-mock-1", "c-mock-60", "c-mock-61", "c-own"]);
    expect(after.courses.find((c) => c.id === "c-mock-60")).toMatchObject({ academicYear: 2567, status: "archived" });
    expect(after.courses.find((c) => c.id === "c-mock-61")).toMatchObject({ academicYear: 2568, status: "archived" });
    expect(after.teachers.find((t) => t.id === "t-mock-1")!.courseIds).toEqual(["c-mock-1", "c-mock-60", "c-mock-61"]);
    expect(after.teachers.find((t) => t.id === "t-other")!.courseIds).toEqual(["c-own"]);
    expect(after.assignments.map((a) => a.id)).toEqual(expect.arrayContaining(["a-keep", "a-yr-67-1", "a-yr-67-2", "a-yr-68-1", "a-yr-68-2"]));
    expect(after.rubrics).toHaveLength(1 + 4);
    expect(after.subs).toHaveLength(1 + 144);
    expect(after.subs.some((s) => s.id === "keep-me")).toBe(true);
    expect(after.cohort).toEqual([{ id: "keep-student" }]);
    // running it twice adds nothing more
    await page.evaluate(`(async () => { ${command(lang).replace("get('/mock-data", "return get('/mock-data")} })()`);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_submissions_v1")!).length)).toBe(145);
  });
}

// the mock itself: same rubric in two years, criteria differ in a known way, results are real per-criterion scores
for (const sfx of ["", "-en"]) {
  test(`rubric-years mock${sfx}: criteria overlap with this year's rubric but not completely, and every score sits on a level step`, () => {
    const y = JSON.parse(fs.readFileSync(`public/mock-data/rubric-years-mockup${sfx}.json`, "utf8"));
    const flow = JSON.parse(fs.readFileSync(`public/mock-data/student-flow-mockup${sfx}.json`, "utf8"));
    expect(fs.readFileSync(`test-data/rubric-years-mockup${sfx}.json`, "utf8")).toBe(fs.readFileSync(`public/mock-data/rubric-years-mockup${sfx}.json`, "utf8"));
    const key = (n: string) => n.replace(/^C\d+ · /, "").split(" / ")[0].toLowerCase();
    const keysOf = (rid: string, rubrics: { id: string; criteria: { name: string }[] }[]) => new Set(rubrics.find((r) => r.id === rid)!.criteria.map((c) => key(c.name)));
    const now = keysOf("r-mock-1", flow.rubrics);
    const y67 = keysOf("r-yr-67-1", y.rubrics), y68 = keysOf("r-yr-68-1", y.rubrics);
    expect([...y68].every((k) => now.has(k))).toBe(true);                              // 2568: the same three criteria as this year
    expect([...y67].filter((k) => now.has(k))).toHaveLength(2);                        // 2567: one criterion fewer
    expect(keysOf("r-yr-67-2", y.rubrics).has("style and documentation")).toBe(true);  // …and one that this year's mini project does not have
    for (const s of y.submissions) {
      const a = y.assignments.find((x: { id: string }) => x.id === s.assignmentId);
      const r = y.rubrics.find((x: { assignmentId: string }) => x.assignmentId === a.id);
      expect(r.criteria.reduce((n: number, c: { maxPoints: number }) => n + c.maxPoints, 0), a.id).toBe(a.maxPoints);
      expect(Object.values(s.criterionScores as Record<string, number>).reduce((p, q) => p + q, 0), s.id).toBe(s.instructorScore);
      expect(s.studentId, "synthetic ids only").toMatch(/^(67|68)99\d{4}$/);
    }
  });
}

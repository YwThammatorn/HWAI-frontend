import { test, expect } from "@playwright/test";
import fs from "node:fs";

const BASE = "http://localhost:3000";

// 11/10/2569 — console command [20] must reach a browser holding the OLD mock: it brings courses / teachers / rubric wording / CLO tags
// up to date and sends two of c-mock-1's assignments back to "not graded", while every other submission, student and assignment
// stays. The command is read out of test-data/seed-commands.txt, so what the user pastes is exactly what is tested.

const DOC = fs.readFileSync("test-data/seed-commands.txt", "utf8").split(/\r?\n/);
function command(lang: "th" | "en"): string {
  const start = DOC.findIndex((l) => l.startsWith("[20]"));
  const lines = DOC.slice(start + 1, DOC.findIndex((l, i) => i > start && l.startsWith("[4]")));
  const found = lines.filter((l) => l.startsWith("const get="));
  return found[lang === "th" ? 0 : 1].replace(/location\.reload\(\);/g, "").trim().replace(/;$/, "");
}

for (const lang of ["th", "en"] as const) {
  test(`[20] ${lang}: everything changed on 11/10 arrives, and nothing outside it is touched`, async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.evaluate(() => {
      const sub = (id: string, assignmentId: string, status: string, ai: number | null) => ({ id, assignmentId, studentId: "69070102", studentName: "x", email: "x", submittedAt: "2026-09-05T09:15:00.000Z", fileUrl: null, aiScore: ai, instructorScore: null, instructorComment: "", externalUseConsent: true, status, updatedAt: "x" });
      localStorage.setItem("hwai_courses_v2", JSON.stringify([{ id: "c-mock-15", name: "old ML course nobody teaches" }]));
      localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([{ id: "t-old", name: "old", email: "old@kmitl.ac.th", role: "teacher", status: "active", courseIds: [] }]));
      localStorage.setItem("hwai_rubrics_v1", JSON.stringify([{ id: "r-mock-1", assignmentId: "a-mock-1", name: "old", criteria: [{ id: "rc-1", name: "C1 · Program correctness", description: "", maxPoints: 9, weight: 100, levels: [{ label: "Fair", description: "mostly sound, with only minor gaps" }] }], createdAt: "x", updatedAt: "x" }, { id: "r-keep", assignmentId: "a-other", name: "mine", criteria: [], createdAt: "x", updatedAt: "x" }]));
      localStorage.setItem("hwai_clos_v1", JSON.stringify([{ id: "own-clo", courseId: "c-other", code: "X", text: "mine" }]));
      localStorage.setItem("hwai_submissions_v1", JSON.stringify([
        sub("sub-mock-2", "a-mock-1", "need_review", 11),     // the old mock: needs review with an AI score → back to not graded
        sub("sub-mock-11", "a-mock-6", "need_review", 7),
        sub("sub-mock-17", "a-mock-8", "need_review", 99),    // another assignment of the same course: left exactly as it is
        sub("keep-me", "a-other", "graded", 5),
      ]));
      localStorage.setItem("hwai_assignments_v1", JSON.stringify([{ id: "a-keep" }]));
      localStorage.setItem("hwai_cohort_students_v1", JSON.stringify([{ id: "keep-student" }]));
    });
    await page.evaluate(`(async () => { ${command(lang).replace("Promise.all(", "return Promise.all(")} })()`);

    const after = await page.evaluate(() => ({
      courses: JSON.parse(localStorage.getItem("hwai_courses_v2")!) as { id: string }[],
      teachers: JSON.parse(localStorage.getItem("hwai_managed_teachers_v1")!) as { id: string; courseIds: string[] }[],
      rubrics: JSON.parse(localStorage.getItem("hwai_rubrics_v1")!) as { id: string; criteria: { name: string; cloIds?: string[] }[] }[],
      clos: JSON.parse(localStorage.getItem("hwai_clos_v1")!) as { id: string }[],
      subs: JSON.parse(localStorage.getItem("hwai_submissions_v1")!) as { id: string; status: string; aiScore: number | null }[],
      assignments: JSON.parse(localStorage.getItem("hwai_assignments_v1")!),
      cohort: JSON.parse(localStorage.getItem("hwai_cohort_students_v1")!),
    }));

    // courses and teachers: whole lists, every course has a teacher
    expect(after.courses.length).toBe(50);
    expect(after.courses.map((c) => c.id)).not.toContain("c-mock-15");
    expect(after.courses.filter((c) => !after.teachers.some((t) => t.courseIds.includes(c.id)))).toEqual([]);
    // rubrics (all three files) by id: new wording and CLO tags, someone else's kept
    expect(after.rubrics.length).toBe(7 + 45 + 1 + 1);
    expect(after.rubrics.some((r) => r.id === "r-keep")).toBe(true);
    expect(after.rubrics.find((r) => r.id === "r-mock-1")!.criteria[0].name).toMatch(/^C1 · .+ \/ .+/);
    expect(after.rubrics.find((r) => r.id === "r-mock-1")!.criteria[0].cloIds).toEqual(["clo-mock-1"]);
    expect(after.clos.map((c) => c.id)).toEqual(expect.arrayContaining(["own-clo", "clo-mock-1", "clo-mock-4"]));
    // the two assignments are back to "waiting"; nothing else moved
    for (const id of ["sub-mock-2", "sub-mock-11"]) expect(after.subs.find((s) => s.id === id)).toMatchObject({ status: "not_graded", aiScore: null });
    expect(after.subs.find((s) => s.id === "sub-mock-17")).toMatchObject({ status: "need_review", aiScore: 99 });
    expect(after.subs.find((s) => s.id === "keep-me")).toMatchObject({ status: "graded", aiScore: 5 });
    expect(after.subs.filter((s) => s.id.startsWith("sub-mock-")).length).toBeGreaterThan(30);   // the other waiting submissions of the two assignments arrived too
    expect(after.assignments).toEqual([{ id: "a-keep" }]);
    expect(after.cohort).toEqual([{ id: "keep-student" }]);
  });
}

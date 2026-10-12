import { test, expect } from "@playwright/test";
import fs from "node:fs";

const BASE = "http://localhost:3000";

// 11/10/2569 — console command [19] must reach a browser that still holds the OLD rubric wording: only the rubrics change
// (by id) — submissions, other people's rubrics and everything else stay. The command is read out of
// test-data/seed-commands.txt, so what the user pastes is exactly what is tested.

const DOC = fs.readFileSync("test-data/seed-commands.txt", "utf8").split(/\r?\n/);
function command(lang: "th" | "en"): string {
  const start = DOC.findIndex((l) => l.startsWith("[19]"));
  const lines = DOC.slice(start + 1, DOC.findIndex((l, i) => i > start && l.startsWith("[4]")));
  const found = lines.filter((l) => l.startsWith("const merge="));
  return found[lang === "th" ? 0 : 1].replace(/location\.reload\(\);/g, "").trim().replace(/;$/, "");
}

for (const lang of ["th", "en"] as const) {
  test(`[19] ${lang}: rubric wording is replaced by id from every mock file, and nothing else changes`, async ({ page }) => {
    await page.goto(`${BASE}/login`);
    const histRubricId = await page.evaluate(async (sfx) => (await (await fetch(`/mock-data/student-history-mockup${sfx}.json`)).json()).rubrics[0].id as string, lang === "en" ? "-en" : "");
    // the user's old browser: one rubric from each file with the old wording, someone else's rubric, a submission
    await page.evaluate((hid) => {
      const old = (id: string) => ({ id, assignmentId: "x", name: "old", criteria: [{ id: "k", name: "C1 · Program correctness", description: "", maxPoints: 9, weight: 100, levels: [{ label: "Fair", description: "Program correctness — mostly sound, with only minor gaps." }] }], createdAt: "x", updatedAt: "x" });
      localStorage.setItem("hwai_rubrics_v1", JSON.stringify([old("r-mock-1"), old(hid), old("r-mock-10"), { id: "r-keep", assignmentId: "a-other", name: "someone else's rubric", criteria: [], createdAt: "x", updatedAt: "x" }]));
      localStorage.setItem("hwai_submissions_v1", JSON.stringify([{ id: "keep-me", assignmentId: "a-other" }]));
      localStorage.setItem("hwai_assignments_v1", JSON.stringify([{ id: "a-keep" }]));
    }, histRubricId);
    // the command is a few statements ending in a promise chain: return that chain so the test waits for it like the browser does
    await page.evaluate(`(async () => { ${command(lang).replace("Promise.all(", "return Promise.all(")} })()`);

    const after = await page.evaluate(() => ({
      rubrics: JSON.parse(localStorage.getItem("hwai_rubrics_v1")!) as { id: string; criteria: { name: string; levels: { description: string }[] }[] }[],
      submissions: JSON.parse(localStorage.getItem("hwai_submissions_v1")!),
      assignments: JSON.parse(localStorage.getItem("hwai_assignments_v1")!),
    }));

    // every rubric of the three files is in (7 + 45 + 1) next to the one that was not ours
    expect(after.rubrics.length).toBe(7 + 45 + 1 + 1);
    expect(after.rubrics.some((r) => r.id === "r-keep")).toBe(true);
    for (const id of ["r-mock-1", histRubricId, "r-mock-10"]) {
      const r = after.rubrics.find((x) => x.id === id)!;
      for (const c of r.criteria) {
        expect(c.name, id).toMatch(/^C\d+ · .+ \/ .+/);                              // bilingual
        expect(new Set(c.levels.map((l) => l.description)).size, id).toBe(4);       // a wording of its own for every level
        expect(c.levels.map((l) => l.description).join(" "), id).not.toMatch(/mostly sound|โดยรวมทำได้ดี/);
      }
    }
    expect(after.submissions).toEqual([{ id: "keep-me", assignmentId: "a-other" }]);
    expect(after.assignments).toEqual([{ id: "a-keep" }]);
  });
}

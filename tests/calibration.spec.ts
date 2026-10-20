import { test, expect, Page } from "@playwright/test";
import { pickSample, compare, suggestOffsets, suggestRubricChanges, storedAiFor, aiGradedUnits, rubricLineage, rubricsLookAlike, offsetsFor, type CalibrationRun, type WorkUnit } from "../src/lib/calibration";
import { mockAiGradeCriteria, aiGradingUpdate } from "../src/lib/aiGrading";

import { BASE } from "./base";

// 12/10/2569 — the Calibration tab: the teacher scores a few samples by hand, sees where the AI differs per criterion, tunes how strict it
// is, and sees what the rubric itself may need. The numbers on screen are checked against the same pure functions the page uses
// (lib/calibration.ts, lib/aiGrading.ts), so the arithmetic is tested separately from the screen.
// 14/10/2569 — it works on work the AI has ALREADY graded and compares with what the AI really stored; the Blind test is on by default and
// hides the students' names too; the counter counts samples first; "Edit rubric" is a popup; and the AI can grade again afterwards
// (this assignment + the ones that share its rubric, never the teacher's own scores, never announced work).

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-cal", name: "Programming", description: "", status: "active", source: "manual", coverColor: "#0F766E", iconColor: "#0F766E",
  courseTemplateId: "ct-cal", term: 1, academicYear: 2569, sectionNumber: "1", code: "01076112", schedule: "Mon", room: "811", createdAt: NOW, updatedAt: NOW,
};
const TEACHER = { id: "t-cal", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-cal"] };
const LV = (n: string) => [
  { label: "Excellent", description: `${n} top` }, { label: "Fair", description: `${n} ok` }, { label: "Needs Improvement", description: `${n} weak` }, { label: "Fail", description: `${n} none` },
];
const crit = (id: string, name: string, pts: number) => ({ id, name, description: "", maxPoints: pts, weight: 0, levels: LV(name) });
const CRITERIA = [
  crit("k1", "C1 · Program correctness / ความถูกต้อง", 9),
  crit("k2", "C2 · Code readability / ความอ่านง่าย", 3),
  crit("k3", "C3 · Error handling / การจัดการ Error", 3),
];
const asg = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, courseId: "c-cal", name, description: "", dueDate: "2026-01-10", maxPoints: 15, acceptsFiles: true, fileTypes: ["pdf"], submissionType: "individual",
  maxGroupSize: null, rubricIds: [], createdAt: NOW, updatedAt: NOW, ...extra,
});
const BASE_ASSIGNMENTS = [
  asg("a-cal", "AI-assisted work"),
  asg("a-fin", "Announced work", { gradingFinalized: true }),
  asg("a-few", "Too few graded by the AI"),
  asg("a-new", "Not graded by the AI yet"),
  asg("a-man", "Manual work", { gradingMode: "manual" }),
  asg("a-exam", "Midterm", { isExam: true, acceptsFiles: false }),
];
// assignments that share a rubric with a-cal (only the regrade tests load them)
const LINEAGE_ASSIGNMENTS = [
  asg("a-copy", "Copied work"),
  asg("a-ann", "Copied and announced", { gradingFinalized: true }),
];
const rubric = (aid: string, extra: Record<string, unknown> = {}) => ({ id: `r-${aid}`, assignmentId: aid, name: aid, criteria: CRITERIA, createdAt: NOW, updatedAt: NOW, ...extra });
const RUBRIC_EXTRA: Record<string, Record<string, unknown>> = { "a-copy": { sourceRubricId: "r-a-cal" }, "a-ann": { sourceRubricId: "r-a-cal" } };

const sub = (aid: string, n: number, extra: Record<string, unknown> = {}) => ({
  id: `${aid}-s${n}`, assignmentId: aid, studentId: `6407${String(n).padStart(4, "0")}`, studentName: `Student ${n}`, email: `s${n}@kmitl.ac.th`, submittedAt: "2026-01-05T10:00:00.000Z",
  fileUrl: null, aiScore: null, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "not_graded", updatedAt: NOW, ...extra,
});
/** A submission the AI has graded (what "Grade with AI" stores). */
const aiSub = (aid: string, n: number, extra: Record<string, unknown> = {}, offsets?: Record<string, number>) =>
  sub(aid, n, { ...aiGradingUpdate(`${aid}-s${n}`, 15, { criteria: CRITERIA, aiOffsets: offsets }), ...extra });
const topAi = { aiScore: 15, aiCriterionScores: { k1: 9, k2: 3, k3: 3 }, criterionScores: { k1: 9, k2: 3, k3: 3 }, instructorScore: 15, status: "graded" };   // everything on the top level
const teacherScored = { instructorScore: 10, criterionScores: { k1: 6, k2: 2, k3: 2 }, status: "graded" };
const SUBMISSIONS = [
  ...Array.from({ length: 12 }, (_, i) => aiSub("a-cal", i + 1)),
  ...Array.from({ length: 8 }, (_, i) => sub("a-fin", i + 1, topAi)),
  aiSub("a-few", 1), aiSub("a-few", 2),
  ...Array.from({ length: 6 }, (_, i) => sub("a-new", i + 1)),
  ...Array.from({ length: 5 }, (_, i) => sub("a-man", i + 1)),
];
const LINEAGE_SUBMISSIONS = [
  aiSub("a-copy", 1), aiSub("a-copy", 2), aiSub("a-copy", 3, teacherScored), sub("a-copy", 4),
  aiSub("a-ann", 1), aiSub("a-ann", 2), aiSub("a-ann", 3),
];
const unitsOf = (aid: string, subs: Record<string, unknown>[] = SUBMISSIONS): WorkUnit[] => subs.filter((s) => s.assignmentId === aid).map((s) => ({ key: s.id as string, name: s.studentName as string, subs: [s as never] }));
const aiUnits = (aid: string) => aiGradedUnits(unitsOf(aid), { criteria: CRITERIA });
const sampleOf = (n = 5) => pickSample(aiUnits("a-cal"), { criteria: CRITERIA }, n);

async function open(page: Page, opts: { runs?: unknown[]; lang?: "en" | "th"; subs?: unknown[]; lineage?: boolean; blindOff?: boolean } = {}) {
  const assignments = [...BASE_ASSIGNMENTS, ...(opts.lineage ? LINEAGE_ASSIGNMENTS : [])];
  await page.addInitScript((d) => {
    if (sessionStorage.getItem("cal_seeded")) return;
    sessionStorage.setItem("cal_seeded", "1");
    localStorage.setItem("hwai_lang", d.lang);
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([d.course]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([d.teacher]));
    localStorage.setItem("hwai_students_v1", JSON.stringify([]));
    localStorage.setItem("hwai_grading_categories_v1", JSON.stringify([]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify(d.assignments));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify(d.rubrics));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(d.subs));
    if (d.runs) localStorage.setItem("hwai_calibrations_v1", JSON.stringify(d.runs));
  }, {
    lang: opts.lang ?? "en", course: COURSE, teacher: TEACHER, assignments,
    rubrics: assignments.filter((a) => !(a as { isExam?: boolean }).isExam).map((a) => rubric(a.id, RUBRIC_EXTRA[a.id])),
    subs: opts.subs ?? [...SUBMISSIONS, ...(opts.lineage ? LINEAGE_SUBMISSIONS : [])], runs: opts.runs,
  });
  await page.goto(`${BASE}/teacher/courses/c-cal/calibration`);
  await page.waitForLoadState("networkidle");
  if (opts.blindOff) await blindSwitch(page).click();
}

const blindSwitch = (page: Page) => page.getByRole("switch", { name: "Blind test" });
const sampleNames = (page: Page) => page.locator("[data-testid^=sample-]").evaluateAll((els) => els.map((e) => e.getAttribute("data-sample-name") ?? ""));
const runs = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("hwai_calibrations_v1") ?? "[]") as CalibrationRun[]);
const rubricOf = (page: Page, aid: string) => page.evaluate((id) => (JSON.parse(localStorage.getItem("hwai_rubrics_v1") ?? "[]") as { assignmentId: string; aiOffsets?: Record<string, number> }[]).find((r) => r.assignmentId === id), aid);
const storedSubs = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("hwai_submissions_v1") ?? "[]") as { id: string; assignmentId: string; status: string; aiScore: number | null; instructorScore: number | null; aiCriterionScores?: Record<string, number>; aiOffsetsUsed?: Record<string, number>; criterionScores?: Record<string, number> }[]);

/** The teacher's pattern: worse than the AI by 1 on C1 (AI generous), the same on C2, better by 1 on C3 (AI strict) — clamped to the scale. */
const DELTA: Record<string, number> = { k1: 1, k2: 0, k3: -1 };
const teacherLevel = (aiLevel: number, cid: string) => Math.min(3, Math.max(0, aiLevel + DELTA[cid]));

/** Scores every sample the way DELTA says. The samples are the ones the page picked (pickSample is deterministic, so the test does not need to read names off the screen). */
async function scoreAll(page: Page, n = 5) {
  const picked = sampleOf(n);
  for (let i = 0; i < picked.length; i++) {
    const ai = mockAiGradeCriteria(picked[i].key, CRITERIA);
    await page.getByRole("button", { name: `Sample ${i + 1}`, exact: true }).click(); // one sample is open at a time
    for (const c of CRITERIA) {
      const label = ["Excellent", "Fair", "Needs Improvement", "Fail"][teacherLevel(ai.levels[c.id], c.id)];
      await page.getByRole("radiogroup", { name: new RegExp(`Level for ${c.name.replace(/[/·]/g, ".")} — sample ${i + 1}`) }).getByRole("radio", { name: new RegExp(`^${label} ·`) }).click();
    }
  }
  return picked;
}
const runFor = (picked: WorkUnit[], aid = "a-cal"): CalibrationRun => ({
  id: "x", assignmentId: aid, createdAt: NOW, completedAt: NOW, sampleIds: picked.map((u) => u.key),
  teacherLevels: Object.fromEntries(picked.map((u) => [u.key, Object.fromEntries(CRITERIA.map((c) => [c.id, teacherLevel(mockAiGradeCriteria(u.key, CRITERIA).levels[c.id], c.id)]))])),
});

test.describe("Calibration", () => {
  test("only work the AI has graded is offered: a rubric, files, AI-assisted, and at least 3 pieces the AI scored", async ({ page }) => {
    await open(page);
    const options = await page.getByLabel("Assignment", { exact: true }).locator("option").allTextContents();
    expect(options).toEqual(["AI-assisted work", "Announced work"]);       // not: 2 graded only, none graded by the AI, manual, exam
  });

  test("a note beside the picker says these are assignments the AI has already graded and what is compared", async ({ page }) => {
    await open(page);
    const note = page.getByTestId("cal-ai-note");
    await expect(note).toContainText("Only assignments the AI has already graded appear here (at least 3 pieces)");
    await expect(note).toContainText("what the AI really gave");
    await expect(page.getByText("12 graded by the AI · 3 criteria")).toBeVisible();
  });

  test("the sample is spread over the AI's ranking — it contains the AI's best and worst — and shows no AI figure", async ({ page }) => {
    await open(page);
    const units = aiUnits("a-cal");
    const expected = sampleOf(5).map((u) => u.name);
    const ranked = [...units].sort((a, b) => mockAiGradeCriteria(b.key, CRITERIA).score - mockAiGradeCriteria(a.key, CRITERIA).score || a.key.localeCompare(b.key)).map((u) => u.name);
    expect(expected[0]).toBe(ranked[0]);
    expect(expected[expected.length - 1]).toBe(ranked[ranked.length - 1]);
    await expect(page.getByTestId(/^ai-/)).toHaveCount(0);                  // blind until the comparison
    await expect(page.getByTestId("cal-progress")).toContainText("0 of 5 samples fully scored");
    await blindSwitch(page).click();                                        // names are only readable once Blind is off
    expect(await sampleNames(page)).toEqual(expected);
  });

  test("the counter counts samples first and criteria second", async ({ page }) => {
    await open(page);
    const progress = page.getByTestId("cal-progress");
    await expect(progress).toContainText("0 of 5 samples fully scored");
    await expect(progress).toContainText("(0 of 15 criteria)");
    for (const c of CRITERIA) await page.getByRole("radiogroup", { name: new RegExp(`Level for ${c.name.replace(/[/·]/g, ".")} — sample 1$`) }).getByRole("radio").first().click();
    await expect(progress).toContainText("1 of 5 samples fully scored");
    await expect(progress).toContainText("(3 of 15 criteria)");
  });

  test("the number of samples can change (3–10) and re-picks; Swap replaces one with the nearest unused piece of work", async ({ page }) => {
    await open(page, { blindOff: true });
    await page.getByLabel("Samples", { exact: true }).selectOption("8");
    await expect(page.locator("[data-testid^=sample-]")).toHaveCount(8);
    expect(await sampleNames(page)).toEqual(sampleOf(8).map((u) => u.name));
    await page.getByLabel("Samples", { exact: true }).selectOption("3");
    await expect(page.locator("[data-testid^=sample-]")).toHaveCount(3);
    const before = await sampleNames(page);
    await page.getByRole("button", { name: "Sample 2", exact: true }).click();
    await page.getByRole("button", { name: "Swap for another" }).click();
    const after = await sampleNames(page);
    expect(after[0]).toBe(before[0]);
    expect(after[2]).toBe(before[2]);
    expect(before).not.toContain(after[1]);                                  // a different piece of work…
    expect(new Set(after).size).toBe(3);                                      // …and never a duplicate
  });

  test("scoring happens in a Grade-style workspace: one sample at a time, levels picked by clicking, Previous/Next, a tick once a sample is done", async ({ page }) => {
    await open(page);
    // one sample's marking at a time — the others' level groups are not on the page
    await expect(page.getByRole("radiogroup", { name: /sample 1$/ })).toHaveCount(CRITERIA.length);
    await expect(page.getByRole("radiogroup", { name: /sample 2$/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Previous", exact: true })).toBeDisabled();
    await expect(page.getByText("Sample 1 of 5", { exact: true })).toBeVisible();
    await expect(page.locator("input[type=number]")).toHaveCount(0);        // clicking a level, not typing a score
    // every level shows its wording from the rubric
    await expect(page.getByRole("radiogroup", { name: /sample 1$/ }).first().getByRole("radio").first()).toContainText(/\S+ · \d+\s*\S/);

    for (const c of CRITERIA) {
      await page.getByRole("radiogroup", { name: new RegExp(`Level for ${c.name.replace(/[/·]/g, ".")} — sample 1`) }).getByRole("radio").first().click();
    }
    await expect(page.getByTestId("sample-0").locator("svg")).toHaveCount(1);   // the tick on a finished sample
    await expect(page.getByTestId("sample-1").locator("svg")).toHaveCount(0);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText("Sample 2 of 5", { exact: true })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: /sample 2$/ })).toHaveCount(CRITERIA.length);
    await expect(page.getByRole("radiogroup", { name: /sample 2$/ }).first().getByRole("radio", { checked: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Previous", exact: true }).click();
    await expect(page.getByRole("radiogroup", { name: /sample 1$/ }).first().getByRole("radio", { checked: true })).toHaveCount(1);
  });

  test("Blind test is ON by default: no AI tags and no student names; turning it off shows both, and the choice is kept", async ({ page }) => {
    await open(page);
    const sw = blindSwitch(page);
    await expect(sw).toHaveAttribute("aria-checked", "true");
    expect((await runs(page))[0].blind).toBe(true);
    const first = sampleOf(5)[0];
    // on: nothing identifies a student
    await expect(page.locator("[data-testid^=mark-ai-]")).toHaveCount(0);
    await expect(page.locator("[data-sample-name]")).toHaveCount(0);
    await expect(page.getByText(first.name)).toHaveCount(0);
    await expect(page.getByText("Sample 1 of 5", { exact: true })).toBeVisible();
    await expect(page.getByText("the students' names are hidden")).toBeVisible();

    // off: the AI's level is tagged on each criterion and the name is back
    await sw.click();
    await expect(sw).toHaveAttribute("aria-checked", "false");
    const ai = mockAiGradeCriteria(first.key, CRITERIA);
    await expect(page.locator("[data-testid^=mark-ai-]")).toHaveCount(CRITERIA.length);                    // one tag per criterion…
    for (const c of CRITERIA) {
      const label = ["Excellent", "Fair", "Needs Improvement", "Fail"][ai.levels[c.id]];
      await expect(page.getByTestId(`mark-ai-${c.id}`).locator("xpath=ancestor::button[1]")).toContainText(label);   // …on the level the AI gave
    }
    await expect(page.getByText(`Sample 1 of 5 · ${first.name}`)).toBeVisible();
    await expect(page.getByText("its level is marked on each criterion")).toBeVisible();
    expect((await runs(page))[0].blind).toBe(false);
    await page.reload();
    await expect(page.getByRole("switch", { name: "Blind test" })).toHaveAttribute("aria-checked", "false");
  });

  test("blind also hides what a file or link is called, since that can carry a student's name", async ({ page }) => {
    const attachments = [
      { id: "f1", kind: "file", name: "somchai-jaidee-report.pdf", source: "upload", ref: "none" },
      { id: "l1", kind: "link", name: "https://github.com/somchai-jaidee/project", source: "url", ref: "https://github.com/somchai-jaidee/project" },
    ];
    const subs = SUBMISSIONS.map((s) => (s.assignmentId === "a-cal" ? { ...s, attachments } : s));
    await open(page, { subs });
    const viewer = page.getByLabel("Files the student submitted");
    await expect(viewer).toContainText("File 1");
    await expect(viewer).toContainText("Link 1");
    await expect(page.getByText("somchai-jaidee")).toHaveCount(0);
    await blindSwitch(page).click();
    await expect(viewer).toContainText("somchai-jaidee-report.pdf");
  });

  test("a round scored with the AI's level on screen is marked 'not blind' on the result and in the history", async ({ page }) => {
    await open(page, { blindOff: true });
    await scoreAll(page);
    await page.getByRole("button", { name: "Compare with the AI" }).click();
    await expect(page.getByTestId("cal-not-blind")).toContainText("This round was not blind");
    expect((await runs(page))[0].sawAi).toBe(true);
    await expect(page.getByText("AI's level was visible")).toBeVisible();                                  // in the history list
  });

  test("a round scored with the Blind test on (the default) has no 'not blind' note", async ({ page }) => {
    await open(page);
    await scoreAll(page);
    await page.getByRole("button", { name: "Compare with the AI" }).click();
    await expect(page.getByTestId("cal-table")).toBeVisible();
    await expect(page.getByTestId("cal-not-blind")).toHaveCount(0);
    expect((await runs(page))[0].sawAi).toBeFalsy();
    await expect(page.getByText("AI's level was visible")).toHaveCount(0);
  });

  test("a steady lean of the AI is the strictness setting's job, not a 'level wording unclear' suggestion — scattered disagreement still is", () => {
    const units = aiUnits("a-cal");
    const sample = pickSample(units, { criteria: CRITERIA }, 5);
    const aiK1 = (u: WorkUnit) => mockAiGradeCriteria(u.key, CRITERIA).levels.k1;
    const runWith = (level: (u: WorkUnit) => number): CalibrationRun => ({
      id: "r", assignmentId: "a-cal", createdAt: NOW, completedAt: NOW, sampleIds: sample.map((u) => u.key),
      teacherLevels: Object.fromEntries(sample.map((u) => [u.key, { k1: level(u), k2: 0, k3: 0 }])),
    });
    const k1 = (run: CalibrationRun) => compare(run, units, { criteria: CRITERIA }).find((c) => c.criterionId === "k1")!;
    const disagree = (run: CalibrationRun) => suggestRubricChanges({ criteria: CRITERIA }, [], compare(run, units, { criteria: CRITERIA })).filter((s) => s.kind === "disagree" && s.criterionId === "k1");

    // always one level worse than the AI (kept inside the scale): the AI is steadily generous
    const steady = runWith((u) => Math.min(3, aiK1(u) + 1));
    expect(k1(steady).meanAbs).toBeGreaterThan(0.5);
    expect(k1(steady).residual).toBeLessThan(1);                       // …and a correction of one level removes almost all of it
    expect(disagree(steady)).toHaveLength(0);

    // the teacher mirrors the AI (best ↔ worst): no single correction can fix that
    const scattered = runWith((u) => 3 - aiK1(u));
    expect(k1(scattered).residual).toBeGreaterThanOrEqual(1);
    expect(disagree(scattered)).toHaveLength(1);
  });

  test("the comparison uses what the AI really stored — per-criterion marks as saved, a total-only result split by share — and never adds a correction twice", () => {
    const rubricOnly = { criteria: CRITERIA };
    const stored = { ...sub("x", 1), aiScore: 9, aiCriterionScores: { k1: 3, k2: 3, k3: 0 }, status: "graded" };   // C1 level 2 (3 of 9), C2 top, C3 worst
    expect(storedAiFor({ key: "x-s1", name: "n", subs: [stored as never] }, rubricOnly)).toMatchObject({ levels: { k1: 2, k2: 0, k3: 3 }, score: 9 });
    const totalOnly = { ...sub("y", 1), aiScore: 15, status: "graded" };                                      // 15 of 15 → every criterion on its top level
    expect(storedAiFor({ key: "y-s1", name: "n", subs: [totalOnly as never] }, rubricOnly)?.levels).toEqual({ k1: 0, k2: 0, k3: 0 });
    expect(storedAiFor({ key: "z-s1", name: "n", subs: [sub("z", 1) as never] }, rubricOnly)).toBeNull();      // not graded by the AI

    // five samples where the AI sat one level better than the teacher on C1 (bias +1)…
    const mk = (n: number, used: Record<string, number>) => ({ key: `u${n}`, name: `n${n}`, subs: [{ ...sub("u", n), aiScore: 15, aiCriterionScores: { k1: 9, k2: 3, k3: 3 }, aiOffsetsUsed: used, status: "graded" } as never] });
    const run = (units: WorkUnit[]): CalibrationRun => ({ id: "r", assignmentId: "u", createdAt: NOW, completedAt: NOW, sampleIds: units.map((u) => u.key), teacherLevels: Object.fromEntries(units.map((u) => [u.key, { k1: 1, k2: 0, k3: 0 }])) });
    // …marks made with no correction: suggest +1
    const plain = [1, 2, 3, 4, 5].map((n) => mk(n, {}));
    expect(suggestOffsets(compare(run(plain), plain, rubricOnly), { k1: 5 }).k1).toBe(1);
    // …marks that already had +1 inside them: the bias is what is LEFT, so the suggestion is 1 + 1 = 2 — not "saved value (whatever it is now) + 1"
    const corrected = [1, 2, 3, 4, 5].map((n) => mk(n, { k1: 1 }));
    expect(suggestOffsets(compare(run(corrected), corrected, rubricOnly), { k1: 0 }).k1).toBe(2);
  });

  test("lineage and look-alike: a copy points at its source (both ways, through copies of copies); a rubric with no link needs the same level count and 80% of the names", () => {
    const rs = [{ id: "a" }, { id: "b", sourceRubricId: "a" }, { id: "c", sourceRubricId: "b" }, { id: "d" }];
    expect([...rubricLineage({ id: "a" }, rs)].sort()).toEqual(["a", "b", "c"]);
    expect([...rubricLineage({ id: "c" }, rs)].sort()).toEqual(["a", "b", "c"]);
    expect([...rubricLineage({ id: "d" }, rs)]).toEqual(["d"]);
    expect(rubricsLookAlike({ criteria: CRITERIA }, { criteria: CRITERIA })).toEqual({ same: 3, of: 3 });
    expect(rubricsLookAlike({ criteria: CRITERIA }, { criteria: [CRITERIA[0], crit("z", "C2 · Style / สไตล์", 3), crit("w", "C3 · Tests / ทดสอบ", 3)] })).toBeNull();
    expect(rubricsLookAlike({ criteria: CRITERIA }, { criteria: CRITERIA.map((c) => ({ ...c, levels: c.levels.slice(0, 3) })) })).toBeNull();       // another level count
    // the correction travels by name, or by position when the names differ but the counts agree
    expect(offsetsFor({ criteria: CRITERIA, aiOffsets: { k1: 1, k3: -1 } }, { criteria: [crit("n3", "C3 · Error handling / การจัดการ Error", 3), crit("n1", "Program correctness", 9)] })).toEqual({ n3: -1, n1: 1 });
  });

  test("the AI feedback on the Grade screen names the criterion without its code or second-language name", async ({ page }) => {
    await open(page);
    await page.goto(`${BASE}/teacher/courses/c-cal/assignments/a-cal/recheck?sub=a-cal-s1`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Minor issues found in program correctness.", { exact: false })).toBeVisible();
    await expect(page.getByText(/c1 ·/i).filter({ hasText: "Minor issues found" })).toHaveCount(0);
  });

  test("scores are kept as you go and survive a reload; Compare with the AI waits until everything is scored", async ({ page }) => {
    await open(page);
    const compareBtn = page.getByRole("button", { name: "Compare with the AI" });
    await expect(compareBtn).toBeDisabled();
    await page.getByRole("radiogroup", { name: /Level for .* — sample 1$/ }).first().getByRole("radio").first().click();
    await expect(page.getByTestId("cal-progress")).toContainText("(1 of 15 criteria)");
    await page.reload();
    await expect(page.getByTestId("cal-progress")).toContainText("(1 of 15 criteria)");
    await expect(compareBtn).toBeDisabled();
  });

  test("the comparison matches the arithmetic: per criterion the two levels, agreement and who is generous or strict", async ({ page }) => {
    await open(page);
    const picked = await scoreAll(page);
    await expect(page.getByTestId("cal-progress")).toContainText("5 of 5 samples fully scored");
    await expect(page.getByTestId("cal-progress")).toContainText("(15 of 15 criteria)");
    await page.getByRole("button", { name: "Compare with the AI" }).click();
    await expect(page.getByTestId("cal-table")).toBeVisible();

    const cmp = compare(runFor(picked), aiUnits("a-cal"), { criteria: CRITERIA });
    for (const c of cmp) {
      const row = page.getByTestId(`cmp-${c.criterionId}`);
      await expect(row.getByTestId(`agree-${c.criterionId}`)).toHaveText(`${Math.round(c.agreement * 100)}%`);
      await expect(row.getByTestId(`you-${c.criterionId}`)).toHaveText(`Level ${(3 - c.teacherMean).toFixed(1)}`);
      await expect(row.getByTestId(`ai-${c.criterionId}`)).toHaveText(`Level ${(3 - c.aiMean).toFixed(1)}`);
      const verdict = row.getByTestId(`verdict-${c.criterionId}`);
      if (c.verdict === "lenient") await expect(verdict).toContainText("AI is generous");
      if (c.verdict === "strict") await expect(verdict).toContainText("AI is strict");
      if (c.verdict === "aligned") await expect(verdict).toHaveText("Aligned");
      if (c.verdict === "inconsistent") await expect(verdict).toHaveText("Inconsistent");
    }
    // C2 was scored exactly as the AI would: full agreement, nothing to correct
    expect(cmp.find((c) => c.criterionId === "k2")).toMatchObject({ agreement: 1, bias: 0, verdict: "aligned" });
    await expect(page.getByTestId("offset-k2")).toHaveText("0");
    // the suggested corrections are what suggestOffsets says, shown signed
    const sug = suggestOffsets(cmp);
    for (const [cid, v] of Object.entries(sug)) await expect(page.getByTestId(`offset-${cid}`)).toHaveText(v > 0 ? `+${v}` : String(v));
    // nothing has been changed yet
    expect((await rubricOf(page, "a-cal"))?.aiOffsets).toBeUndefined();
    await expect(page.getByTestId("cal-apply-note")).toContainText("Nothing is changed yet");
  });

  test("Use these values saves the correction on the rubric; the AI then grades again with it and stamps the marks with the correction it used", async ({ page }) => {
    await open(page);
    const picked = await scoreAll(page);
    await page.getByRole("button", { name: "Compare with the AI" }).click();
    const offsets = suggestOffsets(compare(runFor(picked), aiUnits("a-cal"), { criteria: CRITERIA }));
    // the teacher can still adjust one before applying
    await page.getByLabel("Strictness for C2 · Code readability / ความอ่านง่าย").getByRole("button", { name: "Stricter" }).click();
    offsets.k2 = 1;
    await page.getByRole("button", { name: "Use these values" }).click();
    await expect(page.getByRole("button", { name: "Use these values" })).toBeDisabled();
    await expect(page.getByTestId("cal-apply-note")).toContainText("the next “Grade with AI” on this assignment uses these corrections");
    await expect(page.getByTestId("cal-apply-note")).toContainText("can be graded again below");
    expect((await rubricOf(page, "a-cal"))?.aiOffsets).toEqual(offsets);
    const saved = (await runs(page))[0];
    expect(saved.appliedOffsets).toEqual(offsets);
    expect(saved.appliedAt).toBeTruthy();

    // nothing has moved yet: the AI's marks are still the ones made without a correction
    const before = (await storedSubs(page)).find((s) => s.id === "a-cal-s1")!;
    expect(before.aiCriterionScores).toEqual(mockAiGradeCriteria("a-cal-s1", CRITERIA).criterionScores);

    // "Let the AI grade again": this assignment is ticked, 12 pieces
    await expect(page.getByTestId("regrade-count-a-cal")).toContainText("12 to grade again");
    await page.getByTestId("regrade-run").click();
    await page.getByTestId("regrade-confirm").click();
    await expect(page.getByTestId("regrade-done")).toContainText("The AI graded 12 pieces again, in 1 assignment");
    const after = await storedSubs(page);
    for (const s of after.filter((x) => x.assignmentId === "a-cal")) {
      expect(s.aiCriterionScores).toEqual(mockAiGradeCriteria(s.id, CRITERIA, offsets).criterionScores);
      expect(s.aiOffsetsUsed).toEqual(offsets);
    }
    const anyDiffers = after.filter((x) => x.assignmentId === "a-cal").some((s) => JSON.stringify(s.aiCriterionScores) !== JSON.stringify(mockAiGradeCriteria(s.id, CRITERIA).criterionScores));
    expect(anyDiffers).toBe(true);                                             // the correction really changes the AI's marks somewhere
    // grading again on the already-corrected marks suggests nothing new to add: the bias that is left is what is left
    const units = aiGradedUnits(unitsOf("a-cal", after as never), { criteria: CRITERIA });
    const again = suggestOffsets(compare(runFor(picked), units, { criteria: CRITERIA }));
    for (const c of CRITERIA) expect(Math.abs((again[c.id] ?? 0) - (offsets[c.id] ?? 0))).toBeLessThanOrEqual(2);
  });

  test("the course Grading list's Grade with AI still works for work not graded yet, and now stamps the correction it used", async ({ page }) => {
    const offsets = { k1: 1, k2: 0, k3: -1 };
    await open(page, { subs: [...SUBMISSIONS.filter((s) => s.assignmentId !== "a-new"), ...Array.from({ length: 4 }, (_, i) => sub("a-new", i + 1))] });
    await page.evaluate((o) => {
      const r = JSON.parse(localStorage.getItem("hwai_rubrics_v1")!) as { assignmentId: string; aiOffsets?: Record<string, number> }[];
      r.find((x) => x.assignmentId === "a-new")!.aiOffsets = o;
      localStorage.setItem("hwai_rubrics_v1", JSON.stringify(r));
    }, offsets);
    await page.goto(`${BASE}/teacher/courses/c-cal/grading`);
    await page.locator("main li", { hasText: "Not graded by the AI yet" }).getByRole("button", { name: /Grade with AI/ }).click();
    await expect(page).toHaveURL(/assignments\/a-new\/grading$/);
    const s1 = (await storedSubs(page)).find((s) => s.id === "a-new-s1")!;
    expect(s1.aiCriterionScores).toEqual(mockAiGradeCriteria("a-new-s1", CRITERIA, offsets).criterionScores);
    expect(s1.aiOffsetsUsed).toEqual(offsets);
  });

  test("rubric suggestions come from the results, each with Edit rubric; once announced the values, the edit button and the regrade panel are locked away", async ({ page }) => {
    const keys = ["a-fin-s1", "a-fin-s2", "a-fin-s3", "a-fin-s4", "a-fin-s5"];
    const run: CalibrationRun = {
      id: "run-fin", assignmentId: "a-fin", createdAt: NOW, completedAt: NOW, sampleIds: keys,
      teacherLevels: Object.fromEntries(keys.map((k) => [k, { k1: 0, k2: 0, k3: 0 }])),
    };
    await open(page, { runs: [run] });
    await page.getByLabel("Assignment", { exact: true }).selectOption({ label: "Announced work" });
    await expect(page.getByTestId("cal-table")).toBeVisible();
    // everyone is on the top level of every criterion → "ceiling" on all three
    const graded = SUBMISSIONS.filter((s) => s.assignmentId === "a-fin") as never[];
    const expected = suggestRubricChanges({ criteria: CRITERIA }, graded, compare(run, aiUnits("a-fin"), { criteria: CRITERIA }));
    for (const s of expected) await expect(page.getByTestId(`suggest-${s.kind}-${s.criterionId}`)).toBeVisible();
    expect(expected.filter((s) => s.kind === "ceiling")).toHaveLength(3);
    await expect(page.getByTestId("suggest-ceiling-k1")).toContainText("100% of the work reaches the top level");
    // announced: locked
    await expect(page.getByRole("button", { name: "Use these values" })).toBeDisabled();
    await expect(page.getByTestId("cal-apply-note")).toContainText("Results are announced");
    await expect(page.getByRole("button", { name: "Edit rubric" })).toHaveCount(0);
    await expect(page.getByTestId("suggest-ceiling-k1")).toContainText("Locked once announced");
    await expect(page.getByTestId("cal-regrade")).toHaveCount(0);
  });

  test("an assignment that is still open: each suggestion's Edit rubric opens the rubric editor in a popup with the flagged criterion marked", async ({ page }) => {
    // the same everyone-on-top situation, but on the assignment that is not announced
    const subs = SUBMISSIONS.map((s) => (s.assignmentId === "a-cal" ? { ...s, ...topAi } : s));
    const run: CalibrationRun = {
      id: "run-cal", assignmentId: "a-cal", createdAt: NOW, completedAt: NOW, sampleIds: ["a-cal-s1", "a-cal-s2", "a-cal-s3"],
      teacherLevels: Object.fromEntries(["a-cal-s1", "a-cal-s2", "a-cal-s3"].map((k) => [k, { k1: 0, k2: 0, k3: 0 }])),
    };
    await open(page, { runs: [run], subs });
    await expect(page.getByTestId("suggest-ceiling-k1")).toBeVisible();
    await page.getByTestId("edit-rubric-k1").click();
    const dialog = page.getByRole("dialog", { name: "Edit rubric" });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/calibration$/);                                              // not sent to another page
    await expect(dialog.getByTestId("flag-note-k1")).toContainText("100% of the work reaches the top level");
    await expect(dialog.getByTestId("flag-note-k2")).toBeVisible();
    await expect(dialog.getByTestId("flag-ai-k1")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Use a rubric from before" })).toBeVisible();   // the picker and the AI assistant come with the editor
    await expect(dialog.getByRole("button", { name: "AI Rubric Assistant" })).toBeVisible();
    await expect(dialog.getByTestId("rubric-edit-save")).toBeDisabled();                         // nothing changed yet
  });

  test("the popup's AI button rewrites the flagged criterion's level wording; saving closes it, keeps the AI's work, and points at the regrade panel", async ({ page }) => {
    const subs = SUBMISSIONS.map((s) => (s.assignmentId === "a-cal" ? { ...s, ...topAi, instructorScore: null, criterionScores: undefined, status: "graded" } : s));
    const keys = ["a-cal-s1", "a-cal-s2", "a-cal-s3"];
    const run: CalibrationRun = { id: "run-cal", assignmentId: "a-cal", createdAt: NOW, completedAt: NOW, sampleIds: keys, teacherLevels: Object.fromEntries(keys.map((k) => [k, { k1: 0, k2: 0, k3: 0 }])) };
    await open(page, { runs: [run], subs });
    await page.getByTestId("edit-rubric-k1").click();
    const dialog = page.getByRole("dialog", { name: "Edit rubric" });
    const card = dialog.getByTestId("criterion-card-k1");
    const before = await card.locator("textarea[aria-label^='C1']").evaluateAll((els) => els.map((e) => (e as HTMLTextAreaElement).value));
    await dialog.getByTestId("flag-ai-k1").click();
    await expect.poll(async () => (await card.locator("textarea[aria-label^='C1']").evaluateAll((els) => els.map((e) => (e as HTMLTextAreaElement).value))).join("|")).not.toBe(before.join("|"));
    await dialog.getByTestId("rubric-edit-save").click();
    await expect(dialog).toHaveCount(0);
    const stored = (await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_rubrics_v1")!) as { assignmentId: string; criteria: { id: string; levels: { description: string }[] }[] }[])).find((r) => r.assignmentId === "a-cal")!;
    expect(stored.criteria.find((c) => c.id === "k1")!.levels.map((l) => l.description)).not.toEqual(before);
    // the AI's work was not wiped (no teacher scores here), and the regrade panel is the next step
    expect((await storedSubs(page)).filter((s) => s.assignmentId === "a-cal" && s.status === "graded")).toHaveLength(12);
    await expect(page.getByTestId("cal-regrade")).toContainText("The rubric was changed");
    await expect(page.getByTestId("regrade-count-a-cal")).toContainText("12 to grade again");
  });

  test("saving a popup edit that changes the scoring asks first, and only the teacher's own scores go back to 'not graded'", async ({ page }) => {
    const subs = SUBMISSIONS.map((s, i) => (s.assignmentId === "a-cal" ? { ...s, ...topAi, ...(i < 3 ? {} : { instructorScore: null, criterionScores: undefined }) } : s));
    const keys = ["a-cal-s1", "a-cal-s2", "a-cal-s3"];
    const run: CalibrationRun = { id: "run-cal", assignmentId: "a-cal", createdAt: NOW, completedAt: NOW, sampleIds: keys, teacherLevels: Object.fromEntries(keys.map((k) => [k, { k1: 0, k2: 0, k3: 0 }])) };
    await open(page, { runs: [run], subs });
    await page.getByTestId("edit-rubric-k1").click();
    const dialog = page.getByRole("dialog", { name: "Edit rubric" });
    await dialog.getByLabel("Points").first().fill("12");
    await dialog.getByTestId("rubric-edit-save").click();
    const ask = page.getByRole("dialog", { name: "The scoring criteria changed" });
    await expect(ask).toContainText("The 3 pieces of work you scored yourself");
    await ask.getByTestId("rubric-edit-confirm").click();
    await expect(dialog).toHaveCount(0);
    const after = await storedSubs(page);
    const mine = after.filter((s) => ["a-cal-s1", "a-cal-s2", "a-cal-s3"].includes(s.id));
    expect(mine.every((s) => s.status === "not_graded" && s.instructorScore === null)).toBe(true);
    expect(after.filter((s) => s.assignmentId === "a-cal" && !["a-cal-s1", "a-cal-s2", "a-cal-s3"].includes(s.id)).every((s) => s.status === "graded")).toBe(true);
    expect((await page.evaluate(() => (JSON.parse(localStorage.getItem("hwai_assignments_v1")!) as { id: string; maxPoints: number }[]).find((a) => a.id === "a-cal")!.maxPoints))).toBe(18);   // 12 + 3 + 3
  });

  test("the regrade panel lists this assignment and the others that share its rubric; announced ones are shut, the teacher's own scores are kept", async ({ page }) => {
    const picked = sampleOf(5);
    const run = runFor(picked);
    await open(page, { runs: [run], lineage: true });
    const panel = page.getByTestId("cal-regrade");
    await expect(panel).toBeVisible();
    // this assignment: ticked; a copy: listed, not ticked, counts what it would re-grade and what stays
    await expect(page.getByTestId("regrade-row-a-cal").getByRole("checkbox")).toBeChecked();
    await expect(page.getByTestId("regrade-row-a-copy").getByRole("checkbox")).not.toBeChecked();
    await expect(page.getByTestId("regrade-row-a-copy")).toContainText("uses a rubric copied from the same one");
    await expect(page.getByTestId("regrade-count-a-copy")).toContainText("2 to grade again");
    await expect(page.getByTestId("regrade-count-a-copy")).toContainText("1 you scored yourself stay");
    // an announced copy cannot be touched
    await expect(page.getByTestId("regrade-row-a-ann").getByRole("checkbox")).toBeDisabled();
    await expect(page.getByTestId("regrade-count-a-ann")).toContainText("Results announced");
    // the exam and the manual assignment are never listed
    await expect(page.getByTestId("regrade-row-a-man")).toHaveCount(0);
    await expect(page.getByTestId("regrade-row-a-exam")).toHaveCount(0);
    // nothing but this assignment is ticked: 12 pieces
    await expect(page.getByTestId("regrade-run")).toHaveText("Grade again (12)");
    await page.getByTestId("regrade-row-a-copy").getByRole("checkbox").check();
    await expect(page.getByTestId("regrade-run")).toHaveText("Grade again (14)");
  });

  test("regrading a second assignment copies the correction onto its rubric, re-grades only AI-only work, and leaves announced and teacher-scored work alone", async ({ page }) => {
    const picked = await (async () => { await open(page, { lineage: true }); return scoreAll(page); })();
    await page.getByRole("button", { name: "Compare with the AI" }).click();
    await page.getByRole("button", { name: "Use these values" }).click();
    const offsets = (await rubricOf(page, "a-cal"))!.aiOffsets!;
    expect(Object.values(offsets).some((v) => v !== 0)).toBe(true);
    void picked;

    await page.getByTestId("regrade-row-a-copy").getByRole("checkbox").check();
    await page.getByTestId("regrade-run").click();
    const ask = page.getByRole("dialog", { name: "Let the AI grade again?" });
    await expect(ask).toContainText("14 pieces in 2 assignments");
    await expect(ask).toContainText("Scores you gave yourself do not change.");
    await expect(ask).toContainText("The other assignments get the same strictness on their own rubric.");
    await ask.getByTestId("regrade-confirm").click();
    await expect(page.getByTestId("regrade-done")).toContainText("The AI graded 14 pieces again, in 2 assignments");

    const subs = await storedSubs(page);
    const get = (id: string) => subs.find((s) => s.id === id)!;
    // the copy: its rubric got the correction, its AI-only work was graded again with it
    const carried = Object.fromEntries(Object.entries(offsets).filter(([, v]) => v !== 0));
    expect((await rubricOf(page, "a-copy"))?.aiOffsets).toEqual(carried);
    for (const id of ["a-copy-s1", "a-copy-s2"]) {
      expect(get(id).aiCriterionScores).toEqual(mockAiGradeCriteria(id, CRITERIA, offsets).criterionScores);
      expect(get(id).aiOffsetsUsed).toEqual(carried);
    }
    expect(get("a-copy-s3")).toMatchObject({ instructorScore: 10, status: "graded", criterionScores: { k1: 6, k2: 2, k3: 2 } });   // the teacher's own score is untouched
    expect(get("a-copy-s4").status).toBe("not_graded");                                                                              // not graded work is not this panel's job
    // the announced copy was not touched
    for (const id of ["a-ann-s1", "a-ann-s2", "a-ann-s3"]) expect(get(id).aiOffsetsUsed).toEqual({});
    expect((await rubricOf(page, "a-ann"))?.aiOffsets).toBeUndefined();
  });

  test("a finished comparison stays on the page until you start a new one; the history lists it and can delete it", async ({ page }) => {
    await open(page);
    await scoreAll(page);
    await page.getByRole("button", { name: "Compare with the AI" }).click();
    await expect(page.getByTestId("cal-table")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("cal-table")).toBeVisible();               // still the result, not a fresh sample
    const [done] = await runs(page);
    await expect(page.getByTestId(`history-${done.id}`)).toContainText("AI-assisted work");
    await expect(page.getByTestId(`history-${done.id}`)).toContainText("Not applied");

    await page.getByRole("button", { name: "Start a new calibration" }).click();
    await expect(page.getByTestId("cal-table")).toHaveCount(0);
    await expect(page.getByTestId("cal-progress")).toContainText("0 of 5 samples fully scored");
    expect((await runs(page)).find((r) => !r.completedAt)?.blind).toBe(true);   // a new round starts blind again
    await page.getByTestId(`history-${done.id}`).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByTestId(`history-${done.id}`)).toHaveCount(0);
    expect((await runs(page)).every((r) => r.id !== done.id)).toBe(true);
  });

  test("nothing to calibrate: a course with no suitable assignment says what is needed", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("hwai_lang", "en");
      localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
      localStorage.setItem("hwai_courses_v2", JSON.stringify([{ id: "c-cal", name: "Programming", status: "active", source: "manual", coverColor: "#0F766E", iconColor: "#0F766E", description: "", createdAt: "x", updatedAt: "x" }]));
      localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([{ id: "t-cal", name: "S", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-cal"] }]));
    });
    await page.goto(`${BASE}/teacher/courses/c-cal/calibration`);
    await expect(page.getByText("Nothing to calibrate yet")).toBeVisible();
    await expect(page.getByText(/at least 3 pieces the AI has already graded/)).toBeVisible();
  });

  test("the sidebar has a Calibration item; Thai UI", async ({ page }) => {
    await open(page, { lang: "th" });
    await expect(page.getByLabel("เมนูผู้สอน").getByRole("link", { name: "ปรับเทียบ AI" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "ปรับเทียบ AI" })).toBeVisible();
    await expect(page.getByText("ตรวจงานตัวอย่างเอง", { exact: false }).first()).toBeVisible();
    await expect(page.getByTestId("cal-progress")).toContainText("ให้ระดับครบแล้ว 0 จาก 5 ตัวอย่าง");
    await expect(page.getByTestId("cal-progress")).toContainText("(0 จาก 15 เกณฑ์)");
    await expect(page.getByTestId("cal-ai-note")).toContainText("เฉพาะงานที่ผ่านการตรวจโดย AI มาแล้ว");
  });
});

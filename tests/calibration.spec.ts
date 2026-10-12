import { test, expect, Page } from "@playwright/test";
import { pickSample, compare, suggestOffsets, suggestRubricChanges, type CalibrationRun, type WorkUnit } from "../src/lib/calibration";
import { mockAiGradeCriteria } from "../src/lib/aiGrading";

const BASE = "http://localhost:3000";

// 12/10/2569 — the Calibration tab: the teacher scores a few samples by hand (blind to the AI), sees where the AI differs per criterion,
// tunes how strict it is, and sees what the rubric itself may need. The numbers on screen are checked against the same pure functions
// the page uses (lib/calibration.ts, lib/aiGrading.ts), so the arithmetic is tested separately from the screen.

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-cal", name: "Programming", description: "", status: "active", coverColor: "#0F766E",
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
const ASSIGNMENTS = [
  asg("a-cal", "AI-assisted work"),
  asg("a-fin", "Announced work", { gradingFinalized: true }),
  asg("a-few", "Too few submissions"),
  asg("a-man", "Manual work", { gradingMode: "manual" }),
  asg("a-exam", "Midterm", { isExam: true, acceptsFiles: false }),
];
const rubric = (aid: string) => ({ id: `r-${aid}`, assignmentId: aid, name: aid, criteria: CRITERIA, createdAt: NOW, updatedAt: NOW });
const sub = (aid: string, n: number, extra: Record<string, unknown> = {}) => ({
  id: `${aid}-s${n}`, assignmentId: aid, studentId: `6407${String(n).padStart(4, "0")}`, studentName: `Student ${n}`, email: `s${n}@kmitl.ac.th`, submittedAt: "2026-01-05T10:00:00.000Z",
  fileUrl: null, aiScore: null, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "not_graded", updatedAt: NOW, ...extra,
});
const topScores = { criterionScores: { k1: 9, k2: 3, k3: 3 }, aiScore: null, instructorScore: 15, status: "graded" };   // everything on the top level
const SUBMISSIONS = [
  ...Array.from({ length: 12 }, (_, i) => sub("a-cal", i + 1)),
  ...Array.from({ length: 8 }, (_, i) => sub("a-fin", i + 1, topScores)),
  sub("a-few", 1), sub("a-few", 2),
  ...Array.from({ length: 5 }, (_, i) => sub("a-man", i + 1)),
];
const unitsOf = (aid: string): WorkUnit[] => SUBMISSIONS.filter((s) => s.assignmentId === aid).map((s) => ({ key: s.id, name: s.studentName, subs: [s as never] }));

async function open(page: Page, opts: { runs?: unknown[]; lang?: "en" | "th"; subs?: unknown[] } = {}) {
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
  }, { lang: opts.lang ?? "en", course: COURSE, teacher: TEACHER, assignments: ASSIGNMENTS, rubrics: ASSIGNMENTS.filter((a) => !(a as { isExam?: boolean }).isExam).map((a) => rubric(a.id)), subs: opts.subs ?? SUBMISSIONS, runs: opts.runs });
  await page.goto(`${BASE}/teacher/courses/c-cal/calibration`);
  await page.waitForLoadState("networkidle");
}

const sampleNames = (page: Page) => page.locator("[data-testid^=sample-]").evaluateAll((els) => els.map((e) => (e.querySelector("p")?.textContent ?? "").replace(/^Sample \d+ · /, "")));
const runs = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("hwai_calibrations_v1") ?? "[]") as CalibrationRun[]);
const rubricOf = (page: Page, aid: string) => page.evaluate((id) => (JSON.parse(localStorage.getItem("hwai_rubrics_v1") ?? "[]") as { assignmentId: string; aiOffsets?: Record<string, number> }[]).find((r) => r.assignmentId === id), aid);

/** The teacher's pattern: worse than the AI by 1 on C1 (AI generous), the same on C2, better by 1 on C3 (AI strict) — clamped to the scale. */
const DELTA: Record<string, number> = { k1: 1, k2: 0, k3: -1 };
const teacherLevel = (aiLevel: number, cid: string) => Math.min(3, Math.max(0, aiLevel + DELTA[cid]));

async function scoreAll(page: Page, aid = "a-cal") {
  const names = await sampleNames(page);
  const units = unitsOf(aid);
  for (let i = 0; i < names.length; i++) {
    const unit = units.find((u) => u.name === names[i])!;
    const ai = mockAiGradeCriteria(unit.key, CRITERIA);
    for (const c of CRITERIA) {
      const label = ["Excellent", "Fair", "Needs Improvement", "Fail"][teacherLevel(ai.levels[c.id], c.id)];
      await page.getByRole("radiogroup", { name: new RegExp(`Level for ${c.name.replace(/[/·]/g, ".")} — sample ${i + 1}`) }).getByRole("radio", { name: new RegExp(`^${label} ·`) }).click();
    }
  }
  return names.map((n) => units.find((u) => u.name === n)!);
}

test.describe("Calibration", () => {
  test("only assignments the AI could be corrected on are offered: rubric, files, AI-assisted, enough work", async ({ page }) => {
    await open(page);
    const options = await page.getByLabel("Assignment", { exact: true }).locator("option").allTextContents();
    expect(options).toEqual(["AI-assisted work", "Announced work"]);       // not: too few submissions, manual, exam
  });

  test("the sample is spread over the AI's ranking — it contains the AI's best and worst — and shows no AI figure", async ({ page }) => {
    await open(page);
    const units = unitsOf("a-cal");
    const expected = pickSample(units, { criteria: CRITERIA }, 5).map((u) => u.name);
    expect(await sampleNames(page)).toEqual(expected);
    const ranked = [...units].sort((a, b) => mockAiGradeCriteria(b.key, CRITERIA).score - mockAiGradeCriteria(a.key, CRITERIA).score || a.key.localeCompare(b.key)).map((u) => u.name);
    expect(expected[0]).toBe(ranked[0]);
    expect(expected[expected.length - 1]).toBe(ranked[ranked.length - 1]);
    await expect(page.getByTestId(/^ai-/)).toHaveCount(0);                  // blind until the comparison
    await expect(page.getByTestId("cal-progress")).toHaveText("0 of 15 scored");
  });

  test("the number of samples can change (3–10) and re-picks; Swap replaces one with the nearest unused piece of work", async ({ page }) => {
    await open(page);
    await page.getByLabel("Samples", { exact: true }).selectOption("8");
    await expect(page.locator("[data-testid^=sample-]")).toHaveCount(8);
    expect(await sampleNames(page)).toEqual(pickSample(unitsOf("a-cal"), { criteria: CRITERIA }, 8).map((u) => u.name));
    await page.getByLabel("Samples", { exact: true }).selectOption("3");
    await expect(page.locator("[data-testid^=sample-]")).toHaveCount(3);
    const before = await sampleNames(page);
    await page.getByTestId("sample-1").getByRole("button", { name: "Swap for another" }).click();
    const after = await sampleNames(page);
    expect(after[0]).toBe(before[0]);
    expect(after[2]).toBe(before[2]);
    expect(before).not.toContain(after[1]);                                  // a different piece of work…
    expect(new Set(after).size).toBe(3);                                      // …and never a duplicate
  });

  test("scores are kept as you go and survive a reload; Compare with the AI waits until everything is scored", async ({ page }) => {
    await open(page);
    const compareBtn = page.getByRole("button", { name: "Compare with the AI" });
    await expect(compareBtn).toBeDisabled();
    await page.getByRole("radiogroup", { name: /Level for .* — sample 1$/ }).first().getByRole("radio").first().click();
    await expect(page.getByTestId("cal-progress")).toHaveText("1 of 15 scored");
    await page.reload();
    await expect(page.getByTestId("cal-progress")).toHaveText("1 of 15 scored");
    await expect(compareBtn).toBeDisabled();
  });

  test("the comparison matches the arithmetic: per criterion the two levels, agreement and who is generous or strict", async ({ page }) => {
    await open(page);
    const picked = await scoreAll(page);
    await expect(page.getByTestId("cal-progress")).toHaveText("15 of 15 scored");
    await page.getByRole("button", { name: "Compare with the AI" }).click();
    await expect(page.getByTestId("cal-table")).toBeVisible();

    const run: CalibrationRun = {
      id: "x", assignmentId: "a-cal", createdAt: NOW, completedAt: NOW, sampleIds: picked.map((u) => u.key),
      teacherLevels: Object.fromEntries(picked.map((u) => [u.key, Object.fromEntries(CRITERIA.map((c) => [c.id, teacherLevel(mockAiGradeCriteria(u.key, CRITERIA).levels[c.id], c.id)]))])),
    };
    const cmp = compare(run, unitsOf("a-cal"), { criteria: CRITERIA });
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

  test("Use these values saves the correction on the rubric — and the next Grade with AI is shifted by it", async ({ page }) => {
    await open(page);
    const picked = await scoreAll(page);
    await page.getByRole("button", { name: "Compare with the AI" }).click();
    const run: CalibrationRun = {
      id: "x", assignmentId: "a-cal", createdAt: NOW, completedAt: NOW, sampleIds: picked.map((u) => u.key),
      teacherLevels: Object.fromEntries(picked.map((u) => [u.key, Object.fromEntries(CRITERIA.map((c) => [c.id, teacherLevel(mockAiGradeCriteria(u.key, CRITERIA).levels[c.id], c.id)]))])),
    };
    const offsets = suggestOffsets(compare(run, unitsOf("a-cal"), { criteria: CRITERIA }));
    // the teacher can still adjust one before applying
    await page.getByLabel("Strictness for C2 · Code readability / ความอ่านง่าย").getByRole("button", { name: "Stricter" }).click();
    offsets.k2 = 1;
    await page.getByRole("button", { name: "Use these values" }).click();
    await expect(page.getByRole("button", { name: "Use these values" })).toBeDisabled();
    await expect(page.getByTestId("cal-apply-note")).toContainText("the next “Grade with AI” on this assignment uses these corrections");
    expect((await rubricOf(page, "a-cal"))?.aiOffsets).toEqual(offsets);
    const saved = (await runs(page))[0];
    expect(saved.appliedOffsets).toEqual(offsets);
    expect(saved.appliedAt).toBeTruthy();

    // the course Grading list: Grade with AI now corrects each criterion by the saved offsets
    await page.goto(`${BASE}/teacher/courses/c-cal/grading`);
    await page.locator("main li", { hasText: "AI-assisted work" }).getByRole("button", { name: /Grade with AI/ }).click();
    await expect(page).toHaveURL(/assignments\/a-cal\/grading$/);
    const subs = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_submissions_v1")!) as { id: string; assignmentId: string; aiCriterionScores?: Record<string, number> }[]);
    const probe = subs.find((s) => s.id === "a-cal-s1")!;
    expect(probe.aiCriterionScores).toEqual(mockAiGradeCriteria("a-cal-s1", CRITERIA, offsets).criterionScores);
    const anyDiffers = unitsOf("a-cal").some((u) => JSON.stringify(mockAiGradeCriteria(u.key, CRITERIA, offsets).criterionScores) !== JSON.stringify(mockAiGradeCriteria(u.key, CRITERIA).criterionScores));
    expect(anyDiffers).toBe(true);                                             // the correction really changes the AI's marks somewhere
  });

  test("rubric suggestions come from the results, each with Edit rubric; once announced the values and the edit link are locked", async ({ page }) => {
    const run: CalibrationRun = {
      id: "run-fin", assignmentId: "a-fin", createdAt: NOW, completedAt: NOW, sampleIds: ["a-fin-s1", "a-fin-s2", "a-fin-s3", "a-fin-s4", "a-fin-s5"],
      teacherLevels: Object.fromEntries(["a-fin-s1", "a-fin-s2", "a-fin-s3", "a-fin-s4", "a-fin-s5"].map((k) => [k, { k1: 0, k2: 0, k3: 0 }])),
    };
    await open(page, { runs: [run] });
    await page.getByLabel("Assignment", { exact: true }).selectOption({ label: "Announced work" });
    await expect(page.getByTestId("cal-table")).toBeVisible();
    // everyone is on the top level of every criterion → "ceiling" on all three
    const graded = SUBMISSIONS.filter((s) => s.assignmentId === "a-fin") as never[];
    const expected = suggestRubricChanges({ criteria: CRITERIA }, graded, compare(run, unitsOf("a-fin"), { criteria: CRITERIA }));
    for (const s of expected) await expect(page.getByTestId(`suggest-${s.kind}-${s.criterionId}`)).toBeVisible();
    expect(expected.filter((s) => s.kind === "ceiling")).toHaveLength(3);
    await expect(page.getByTestId("suggest-ceiling-k1")).toContainText("100% of the work reaches the top level");
    // announced: locked
    await expect(page.getByRole("button", { name: "Use these values" })).toBeDisabled();
    await expect(page.getByTestId("cal-apply-note")).toContainText("Results are announced");
    await expect(page.getByRole("link", { name: "Edit rubric" })).toHaveCount(0);
    await expect(page.getByTestId("suggest-ceiling-k1")).toContainText("Locked once announced");
  });

  test("an assignment that is still open links each suggestion to Edit rubric", async ({ page }) => {
    // the same everyone-on-top situation, but on the assignment that is not announced
    const subs = SUBMISSIONS.map((s) => (s.assignmentId === "a-cal" ? { ...s, ...topScores } : s));
    const run: CalibrationRun = {
      id: "run-cal", assignmentId: "a-cal", createdAt: NOW, completedAt: NOW, sampleIds: ["a-cal-s1", "a-cal-s2", "a-cal-s3"],
      teacherLevels: Object.fromEntries(["a-cal-s1", "a-cal-s2", "a-cal-s3"].map((k) => [k, { k1: 0, k2: 0, k3: 0 }])),
    };
    await open(page, { runs: [run], subs });
    await expect(page.getByRole("link", { name: "Edit rubric" }).first()).toHaveAttribute("href", "/teacher/courses/c-cal/assignments/a-cal/edit");
    await expect(page.getByTestId("suggest-ceiling-k1")).toBeVisible();
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
    await expect(page.getByTestId("cal-progress")).toHaveText("0 of 15 scored");
    await page.getByTestId(`history-${done.id}`).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByTestId(`history-${done.id}`)).toHaveCount(0);
    expect((await runs(page)).every((r) => r.id !== done.id)).toBe(true);
  });

  test("nothing to calibrate: a course with no suitable assignment says what is needed", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("hwai_lang", "en");
      localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
      localStorage.setItem("hwai_courses_v2", JSON.stringify([{ id: "c-cal", name: "Programming", status: "active", coverColor: "#0F766E", description: "", createdAt: "x", updatedAt: "x" }]));
      localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([{ id: "t-cal", name: "S", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-cal"] }]));
    });
    await page.goto(`${BASE}/teacher/courses/c-cal/calibration`);
    await expect(page.getByText("Nothing to calibrate yet")).toBeVisible();
    await expect(page.getByText(/at least 3 submissions/)).toBeVisible();
  });

  test("the sidebar has a Calibration item; Thai UI", async ({ page }) => {
    await open(page, { lang: "th" });
    await expect(page.getByLabel("เมนูผู้สอน").getByRole("link", { name: "Calibration" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Calibration" })).toBeVisible();
    await expect(page.getByText("ตรวจงานตัวอย่างเอง", { exact: false }).first()).toBeVisible();
    await expect(page.getByTestId("cal-progress")).toHaveText("ตรวจแล้ว 0 จาก 15");
  });
});

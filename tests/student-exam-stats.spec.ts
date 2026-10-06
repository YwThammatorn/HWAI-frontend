import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const NOW = "2026-01-01T00:00:00.000Z";

// A student sees where their exam score sits in the class (min / average / max / SD) — but only for an
// exam whose results the teacher has announced, and never for a normal assignment.

const exam = (id: string, name: string, finalized: boolean, max = 40) => ({
  id, courseId: "c-es", name, description: "", maxPoints: max, acceptsFiles: false, fileTypes: [],
  submissionType: "individual", maxGroupSize: null, rubricIds: [], isExam: true, gradingFinalized: finalized, createdAt: NOW,
});
const homework = { id: "a-hw", courseId: "c-es", name: "Homework", description: "", dueDate: "2026-01-05", maxPoints: 40, acceptsFiles: false, fileTypes: [], submissionType: "individual", maxGroupSize: null, rubricIds: [], gradingFinalized: true, createdAt: NOW };

const sub = (assignmentId: string, studentId: string, score: number) => ({
  id: `s-${assignmentId}-${studentId}`, assignmentId, studentId, studentName: studentId, email: `${studentId}@kmitl.ac.th`,
  submittedAt: NOW, fileUrl: null, aiScore: null, instructorScore: score, instructorComment: "", externalUseConsent: false, status: "graded", updatedAt: NOW,
});
// me = 69070401. Scores 37.5, 27, 40, 38, 36 → min 27, mean 35.7, max 40, SD 5.1
const midtermScores: [string, number][] = [["69070401", 37.5], ["69070402", 27], ["69070403", 40], ["69070404", 38], ["69070405", 36]];

async function open(page: Page, path: string, opts: { assignments: unknown[]; submissions: unknown[]; lang?: "en" | "th" }) {
  await page.addInitScript(([lang, a, s]) => {
    localStorage.setItem("hwai_lang", lang as string);
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Ann", email: "69070401@kmitl.ac.th", role: "student", studentId: "69070401" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([{ id: "c-es", name: "Python", description: "", status: "active", coverColor: "#0F766E", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }]));
    localStorage.setItem("hwai_students_v1", JSON.stringify([{ id: "r1", courseId: "c-es", studentId: "69070401", firstName: "Ann", lastName: "S", email: "69070401@kmitl.ac.th", sequenceNumber: 1, enrollmentStatus: "enrolled" }]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify(a));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(s));
  }, [opts.lang ?? "en", opts.assignments, opts.submissions] as const);
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");
}

const midtermSubs = midtermScores.map(([id, sc]) => sub("a-mid", id, sc));
const stat = (page: Page, label: string) => page.locator("dl > div", { has: page.getByText(label, { exact: true }) }).first();

test("an announced exam shows my score next to the class min / average / max / SD", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-mid", { assignments: [exam("a-mid", "Midterm", true)], submissions: midtermSubs });
  const card = page.locator("section", { has: page.getByText("Class statistics") });
  await expect(card).toContainText("5 students");
  await expect(card.getByText("37.5 / 40")).toBeVisible();
  await expect(stat(page, "Min")).toContainText("27");
  await expect(stat(page, "Average")).toContainText("35.7");
  await expect(stat(page, "Max")).toContainText("40");
  await expect(stat(page, "SD")).toContainText("5.1");
  await expect(card).toContainText("1.8 points above the class average");
});

test("an announced, scored exam drops the 'My Work' card — the score lives in the stats card, which uses the full width", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-mid", { assignments: [exam("a-mid", "Midterm", true)], submissions: midtermSubs });
  await expect(page.getByRole("heading", { name: "My Work" })).toHaveCount(0);
  await expect(page.getByText("37.5 / 40")).toHaveCount(1);   // shown once, not twice
  const info = page.locator("div.rounded-2xl", { has: page.getByRole("heading", { name: "Midterm", level: 1 }) }).first();
  const card = page.locator("section", { has: page.getByText("Class statistics") });
  const [a, b] = await Promise.all([info.boundingBox(), card.boundingBox()]);
  expect(Math.abs(a!.width - b!.width)).toBeLessThan(2);   // same width as the info card above it
});

test("a bell curve from the class average and SD shows where I sit on it", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-mid", { assignments: [exam("a-mid", "Midterm", true)], submissions: midtermSubs });
  const bell = page.getByRole("img", { name: /^Bell curve fitted to the class average 35\.7 and SD 5\.1/ });
  await expect(bell).toBeVisible();
  // me = 37.5 → (37.5 − 35.7) / 5.07 ≈ +0.4 SD
  await expect(bell).toHaveAttribute("aria-label", /your score is 0\.4 SD above the average/);
  await expect(bell.getByText("You 37.5")).toBeVisible();
  await expect(page.getByText("You are 0.4 SD above the average")).toBeVisible();
});

test("no bell curve with a single score (SD is undefined)", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-mid", { assignments: [exam("a-mid", "Midterm", true)], submissions: [sub("a-mid", "69070401", 30)] });
  await expect(page.getByRole("img", { name: /Bell curve/ })).toHaveCount(0);
  await expect(stat(page, "Average")).toContainText("30.0");   // the figures are still there
});

test("everyone scored the same: no bell curve, but the range track takes its place", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-mid", {
    assignments: [exam("a-mid", "Midterm", true)],
    submissions: [sub("a-mid", "69070401", 30), sub("a-mid", "69070402", 30), sub("a-mid", "69070403", 30)],
  });
  await expect(page.getByRole("img", { name: /Bell curve/ })).toHaveCount(0);
  await expect(page.getByRole("img", { name: /lowest 30, average 30\.0, highest 30/ })).toBeVisible();
});

test("Thai UI shows the curve labels in Thai", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-mid", { assignments: [exam("a-mid", "Midterm", true)], submissions: midtermSubs, lang: "th" });
  await expect(page.getByRole("img", { name: /^โค้งระฆังคว่ำโดยประมาณ/ })).toBeVisible();
  await expect(page.getByText("คุณอยู่เหนือค่าเฉลี่ย 0.4 SD")).toBeVisible();
});

test("the teacher's comment on the exam still shows", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-mid", {
    assignments: [exam("a-mid", "Midterm", true)],
    submissions: midtermSubs.map((s) => (s.studentId === "69070401" ? { ...s, instructorComment: "Watch the loop questions" } : s)),
  });
  await expect(page.getByText("Teacher's comment")).toBeVisible();
  await expect(page.getByText("Watch the loop questions")).toBeVisible();
});

test("announced exam but I have no score: class numbers still show, and the 'waiting' box stays", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-mid", {
    assignments: [exam("a-mid", "Midterm", true)],
    submissions: midtermSubs.filter((s) => s.studentId !== "69070401"),
  });
  await expect(page.getByText("Waiting for your exam score")).toBeVisible();
  await expect(stat(page, "Average")).toContainText("35.3");   // (27+40+38+36)/4 = 35.25
  await expect(page.getByText("Your score", { exact: true })).toHaveCount(0);
});

test("before the teacher announces the results there are no class statistics at all", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-mid", { assignments: [exam("a-mid", "Midterm", false)], submissions: midtermSubs });
  await expect(page.getByText("Class statistics")).toHaveCount(0);
});

test("a normal assignment never gets exam statistics", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-hw", { assignments: [homework], submissions: midtermScores.map(([id, sc]) => sub("a-hw", id, sc)) });
  await expect(page.getByText("Class statistics")).toHaveCount(0);
});

test("one score only: SD is a dash, not zero", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-mid", { assignments: [exam("a-mid", "Midterm", true)], submissions: [sub("a-mid", "69070401", 30)] });
  await expect(stat(page, "SD")).toContainText("—");
  await expect(stat(page, "Average")).toContainText("30.0");
});

test("Evaluation lists a card per announced exam and skips the unannounced one", async ({ page }) => {
  await open(page, "/student/courses/c-es/evaluation", {
    assignments: [exam("a-mid", "Midterm", true), exam("a-fin", "Final", false, 60)],
    submissions: [...midtermSubs, ...midtermScores.map(([id, sc]) => sub("a-fin", id, sc))],
  });
  await expect(page.getByRole("heading", { name: "Exam statistics" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Midterm", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Final", level: 3 })).toHaveCount(0);
  // the compact (narrow) card uses the range track, not the bell curve
  await expect(page.getByRole("img", { name: /lowest 27, average 35.7, highest 40 out of 40; your score 37.5/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /Bell curve/ })).toHaveCount(0);
  await expect(page.getByText("Class statistics")).toHaveCount(1);
});

test("Evaluation has no exam section when no exam is announced", async ({ page }) => {
  await open(page, "/student/courses/c-es/evaluation", { assignments: [exam("a-mid", "Midterm", false)], submissions: midtermSubs });
  await expect(page.getByRole("heading", { name: "Exam statistics" })).toHaveCount(0);
});

test("Thai UI", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-mid", { assignments: [exam("a-mid", "Midterm", true)], submissions: midtermSubs, lang: "th" });
  const card = page.locator("section", { has: page.getByText("สถิติจากนักศึกษา") });
  await expect(card).toContainText("สถิติจากนักศึกษา 5 คน");
  await expect(card.getByText("คะแนนของคุณ")).toBeVisible();
  await expect(stat(page, "ต่ำสุด")).toContainText("27");
  await expect(card).toContainText("สูงกว่าค่าเฉลี่ยของห้อง 1.8 คะแนน");
});

// ── bell curve: information + motion ─────────────────────────────────────────

test("it says how many classmates I scored higher than — the real share, not the curve's guess", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-mid", { assignments: [exam("a-mid", "Midterm", true)], submissions: midtermSubs });
  // me 37.5; the others scored 27, 36, 38, 40 → two of the four are below me
  await expect(page.getByText("Better than 50% of your classmates").locator("visible=true")).toHaveCount(1);
  const bell = page.getByRole("img", { name: /^Bell curve/ });
  await expect(bell).toHaveAttribute("aria-label", /better than 50% of your classmates/);
  await expect(bell.getByText("You 37.5 · better than 50%")).toBeVisible();
  await expect(bell.getByText("Average 35.7")).toBeVisible();
  await expect(bell.getByText("−1 SD")).toBeVisible();   // +1 SD (40.8) is past the 40-point maximum, so it is not drawn
});

test("hovering the curve reads out a score, the share below it and its SD; leaving hides it", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-mid", { assignments: [exam("a-mid", "Midterm", true)], submissions: midtermSubs });
  const bell = page.getByRole("img", { name: /^Bell curve/ });
  const box = (await bell.boundingBox())!;
  await expect(page.getByText(/of the class scored lower/)).toHaveCount(0);
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  const tip = page.locator("div[aria-hidden='true']", { hasText: "of the class scored lower" });
  await expect(tip).toBeVisible();
  await expect(tip).toContainText(/Score \d+/);
  await expect(tip).toContainText(/SD/);
  await page.mouse.move(box.x + box.width * 0.5, box.y - 150);
  await expect(tip).toHaveCount(0);
});

test("the curve animates in, and Replay restarts it", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-mid", { assignments: [exam("a-mid", "Midterm", true)], submissions: midtermSubs });
  const anim = () => page.evaluate(() => {
    const p = document.querySelector(".hwai-bell-draw") as SVGPathElement;
    return { name: getComputedStyle(p).animationName, running: p.getAnimations().map((a) => a.playState) };
  });
  expect((await anim()).name).toBe("hwai-bell-draw");
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));   // let the first run end
  expect((await anim()).running.every((s) => s === "finished")).toBe(true);
  await page.getByRole("button", { name: "Replay" }).click();
  expect((await anim()).running).toContain("running");
});

test("reduced motion: no animation at all, the finished chart is simply there", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "/student/courses/c-es/classwork/a-mid", { assignments: [exam("a-mid", "Midterm", true)], submissions: midtermSubs });
  const s = await page.evaluate(() => {
    const p = document.querySelector(".hwai-bell-draw") as SVGPathElement;
    const m = document.querySelector(".hwai-bell-drop") as SVGGElement;
    return { curve: getComputedStyle(p).animationName, dash: getComputedStyle(p).strokeDasharray, marker: getComputedStyle(m).animationName, running: document.getAnimations().length };
  });
  expect(s).toEqual({ curve: "none", dash: "none", marker: "none", running: 0 });
  await expect(page.getByRole("img", { name: /^Bell curve/ }).getByText(/You 37\.5/)).toBeVisible();
});

test("Thai UI: the new labels are Thai", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-mid", { assignments: [exam("a-mid", "Midterm", true)], submissions: midtermSubs, lang: "th" });
  await expect(page.getByText("ดีกว่าเพื่อนร่วมห้อง 50%").locator("visible=true")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "เล่นอีกครั้ง" })).toBeVisible();
  await expect(page.getByRole("img", { name: /^โค้งระฆังคว่ำ/ }).getByText("คุณ 37.5 · ดีกว่า 50%")).toBeVisible();
});

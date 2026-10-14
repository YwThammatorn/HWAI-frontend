import { test, expect, Page } from "@playwright/test";

import { BASE } from "./base";
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

const bar = (page: Page, i: number) => page.getByTestId("hist-bar").nth(i);

// Scores 37.5, 27, 40, 38, 36 out of 40 → ten bins of 4 points: [24–28) holds 27 (1 student), [36–40] holds the other four.
test("a bar chart shows how many students scored in each range, and my own range is marked", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-mid", { assignments: [exam("a-mid", "Midterm", true)], submissions: midtermSubs });
  await expect(page.getByTestId("hist-bar")).toHaveCount(10);
  await expect(bar(page, 9)).toHaveAttribute("data-count", "4");
  await expect(bar(page, 6)).toHaveAttribute("data-count", "1");
  await expect(bar(page, 0)).toHaveAttribute("data-count", "0");
  const counts = await page.getByTestId("hist-bar").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-count"))));
  expect(counts.reduce((a, b) => a + b, 0)).toBe(5);   // every student is in exactly one bar
  // me = 37.5 → the 36–40 bar, and only that one, is mine
  await expect(page.locator("[data-testid=hist-bar][data-mine=true]")).toHaveCount(1);
  await expect(bar(page, 9)).toHaveAttribute("data-mine", "true");
  await expect(bar(page, 9)).toHaveAttribute("title", "36–40: 4 students");
  await expect(page.getByTestId("hist-you")).toHaveText("You are in 36–40 — 4 students are in this range (including you)");
  await expect(page.getByRole("group", { name: /Bar chart of how 5 students scored, average 35\.7; you are in 36–40 with 4 students/ })).toBeVisible();
});

test("the chart gives no one else's score, only counts per range", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-mid", { assignments: [exam("a-mid", "Midterm", true)], submissions: midtermSubs });
  const chart = page.getByTestId("score-histogram");
  for (const hidden of ["27", "38"])   // (36 is an axis label, so it can not be used here)
    await expect(chart.getByText(new RegExp("^" + hidden + "$"))).toHaveCount(0);
});

test("one score only: still a chart, one bar holds the one student", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-mid", { assignments: [exam("a-mid", "Midterm", true)], submissions: [sub("a-mid", "69070401", 30)] });
  await expect(bar(page, 7)).toHaveAttribute("data-count", "1");   // 30 / 40 → bin 7 (28–32)
  await expect(page.getByTestId("hist-you")).toContainText("1 student is in this range (including you)");
  await expect(stat(page, "Average")).toContainText("30.0");   // the figures are still there
});

test("everyone scored the same: all of them stack in one bar", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-mid", {
    assignments: [exam("a-mid", "Midterm", true)],
    submissions: [sub("a-mid", "69070401", 30), sub("a-mid", "69070402", 30), sub("a-mid", "69070403", 30)],
  });
  await expect(bar(page, 7)).toHaveAttribute("data-count", "3");
  const used = await page.getByTestId("hist-bar").evaluateAll((els) => els.filter((e) => e.getAttribute("data-count") !== "0").length);
  expect(used).toBe(1);
});

test("the maximum score belongs to the top bar, not past it", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-mid", {
    assignments: [exam("a-mid", "Midterm", true)],
    submissions: [sub("a-mid", "69070401", 40), sub("a-mid", "69070402", 0)],
  });
  await expect(bar(page, 9)).toHaveAttribute("data-count", "1");
  await expect(bar(page, 0)).toHaveAttribute("data-count", "1");
});

test("Thai UI shows the chart labels in Thai", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-mid", { assignments: [exam("a-mid", "Midterm", true)], submissions: midtermSubs, lang: "th" });
  await expect(page.getByTestId("hist-you")).toHaveText("คุณอยู่ช่วง 36–40 — มี 4 คนในช่วงนี้ (รวมคุณ)");
  await expect(page.getByText("จำนวนนักศึกษาในแต่ละช่วงคะแนน")).toBeVisible();
  await expect(page.getByText("คุณอยู่เหนือค่าเฉลี่ย")).toHaveCount(0);   // the bell curve's SD sentence is gone
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
  await expect(page.locator("[data-testid=hist-bar][data-mine=true]")).toHaveCount(0);   // nobody to mark
  await expect(page.getByTestId("hist-you")).toHaveCount(0);
});

test("before the teacher announces the results there are no class statistics at all", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-mid", { assignments: [exam("a-mid", "Midterm", false)], submissions: midtermSubs });
  await expect(page.getByText("Class statistics")).toHaveCount(0);
});

test("an announced ordinary assignment gets the class chart too; before it is announced there is nothing", async ({ page }) => {
  const hwSubs = midtermScores.map(([id, sc]) => sub("a-hw", id, sc));
  await open(page, "/student/courses/c-es/classwork/a-hw", { assignments: [homework], submissions: hwSubs });
  await expect(page.getByText("Class statistics")).toBeVisible();
  await expect(page.getByTestId("hist-bar")).toHaveCount(10);
  await expect(bar(page, 9)).toHaveAttribute("data-mine", "true");
  await expect(page.getByRole("heading", { name: "My Work" })).toBeVisible();   // the normal "My Work" card stays for a normal assignment
});

test("an ordinary assignment that is not announced shows no statistics", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-hw", { assignments: [{ ...homework, gradingFinalized: false }], submissions: midtermScores.map(([id, sc]) => sub("a-hw", id, sc)) });
  await expect(page.getByText("Class statistics")).toHaveCount(0);
  await expect(page.getByTestId("score-histogram")).toHaveCount(0);
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
  // the card is narrow here but still shows the bar chart, with my bar marked
  await expect(page.getByTestId("score-histogram")).toHaveCount(1);
  await expect(page.locator("[data-testid=hist-bar][data-mine=true]")).toHaveAttribute("data-count", "4");
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

// ── bar chart: information + motion ──────────────────────────────────────────

test("it still says how many classmates I scored higher than — the real share", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-mid", { assignments: [exam("a-mid", "Midterm", true)], submissions: midtermSubs });
  // me 37.5; the others scored 27, 36, 38, 40 → two of the four are below me
  await expect(page.getByText("Better than 50% of your classmates").locator("visible=true")).toHaveCount(1);
});

test("the bars animate in, staggered; reduced motion shows the finished chart with no animation", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-mid", { assignments: [exam("a-mid", "Midterm", true)], submissions: midtermSubs });
  const name = await bar(page, 9).locator(".hwai-hist-grow").evaluate((el) => getComputedStyle(el).animationName);
  expect(name).toBe("hwai-hist-grow");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "/student/courses/c-es/classwork/a-mid", { assignments: [exam("a-mid", "Midterm", true)], submissions: midtermSubs });
  const s = await page.evaluate(() => ({
    name: getComputedStyle(document.querySelector(".hwai-hist-grow")!).animationName,
    running: document.getAnimations().length,
  }));
  expect(s).toEqual({ name: "none", running: 0 });
  await expect(page.getByTestId("hist-you")).toBeVisible();
});

test("Thai UI: the classmates line is Thai", async ({ page }) => {
  await open(page, "/student/courses/c-es/classwork/a-mid", { assignments: [exam("a-mid", "Midterm", true)], submissions: midtermSubs, lang: "th" });
  await expect(page.getByText("ดีกว่าเพื่อนร่วมห้อง 50%").locator("visible=true")).toHaveCount(1);
});

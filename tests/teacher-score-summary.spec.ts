import { test, expect, Page } from "@playwright/test";
import { statsFromScores } from "../src/lib/examStats";
import { buildScoreBook } from "../src/lib/scoreBook";
import { buildScoreSummary } from "../src/lib/scoreSummary";

const BASE = "http://localhost:3000";

// 4/10/2569 — Score Book gets a "Class summary" view: how the section is doing, using the student's own
// stats card + bell curve (minus the "you" marker) plus what only a teacher needs.
//
// Seed, worked out by hand. Categories: Homework 40%, Exams 60%. HW 1 (/10, past due), Midterm (/50, exam, announced).
//   S1 Ann   HW 9, Mid 45 → 36 + 54 = 90 / 100 → 90%  A
//   S2 Ben   HW 5, Mid 20 → 20 + 24 = 44 / 100 → 44%  F
//   S3 Cat   HW pending,  Mid 35 → 42 / 60   → 70%  B   (only the exam counts yet)
//   S4 Dan   HW missing,  Mid 30 → 36 / 60   → 60%  C
// Class running grade: 90, 44, 70, 60 → mean 66, min 44, max 90, SD (n−1) = √(1112/3) = 19.3
// Follow-up: Ben (44% < 60) then Dan (1 missing). HW 1: 2 graded, 1 to grade, 1 missing → min 5, avg 7.0, max 9.
// Midterm: announced, 4/4, min 20, avg 32.5, max 45. Category averages: Homework 70%, Exams 65%.

const NOW = "2026-01-01T00:00:00.000Z";
const people = [["69070801", "Ann"], ["69070802", "Ben"], ["69070803", "Cat"], ["69070804", "Dan"]];

async function open(page: Page, lang: "en" | "th" = "en") {
  await page.addInitScript(([lang, people]) => {
    const NOW = "2026-01-01T00:00:00.000Z";
    localStorage.setItem("hwai_lang", lang as string);
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([{ id: "c-ss", name: "Summary Course", description: "", status: "active", coverColor: "#0F766E", sectionNumber: "1", code: "01076888", academicYear: 2569, term: 1, createdAt: NOW, updatedAt: NOW }]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([{ id: "t-ss", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-ss"] }]));
    const ppl = people as string[][];
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(ppl.map(([id, f], i) => ({ id: `cs-${i}`, studentId: id, firstName: f, lastName: "Test", email: `${id}@kmitl.ac.th`, program: "CE", status: "active" }))));
    localStorage.setItem("hwai_students_v1", JSON.stringify(ppl.map(([id, f], i) => ({ id: `r-${i}`, courseId: "c-ss", studentId: id, firstName: f, lastName: "Test", email: `${id}@kmitl.ac.th`, sequenceNumber: i + 1, enrollmentStatus: "enrolled" }))));
    localStorage.setItem("hwai_grading_categories_v1", JSON.stringify([
      { id: "cat-hw", courseId: "c-ss", name: "Homework", weight: 40, createdAt: NOW, updatedAt: NOW },
      { id: "cat-ex", courseId: "c-ss", name: "Exams", weight: 60, createdAt: NOW, updatedAt: NOW },
    ]));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify([]));
    const asg = (id: string, name: string, due: string | undefined, max: number, extra: object) => ({ id, courseId: "c-ss", name, description: "", dueDate: due, maxPoints: max, acceptsFiles: true, fileTypes: [], submissionType: "individual", maxGroupSize: null, rubricIds: [], createdAt: NOW, updatedAt: NOW, ...extra });
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([
      asg("hw1", "HW 1", "2026-01-10", 10, { categoryId: "cat-hw" }),
      asg("mid", "Midterm", undefined, 50, { categoryId: "cat-ex", isExam: true, gradingFinalized: true }),
    ]));
    const sub = (id: string, a: string, i: number, status: string, score: number | null) => ({ id, assignmentId: a, studentId: ppl[i][0], studentName: `${ppl[i][1]} Test`, email: `${ppl[i][0]}@kmitl.ac.th`, submittedAt: "2026-01-05T10:00:00.000Z", fileUrl: null, aiScore: score, instructorScore: status === "graded" ? score : null, instructorComment: "", externalUseConsent: true, status, updatedAt: NOW });
    localStorage.setItem("hwai_submissions_v1", JSON.stringify([
      sub("h1", "hw1", 0, "graded", 9), sub("h2", "hw1", 1, "graded", 5), sub("h3", "hw1", 2, "need_review", 6),
      sub("m1", "mid", 0, "graded", 45), sub("m2", "mid", 1, "graded", 20), sub("m3", "mid", 2, "graded", 35), sub("m4", "mid", 3, "graded", 30),
    ]));
  }, [lang, people] as const);
  await page.goto(`${BASE}/teacher/courses/c-ss/results`);
  await page.waitForLoadState("networkidle");
}

const openSummary = async (page: Page, lang: "en" | "th" = "en") => {
  await open(page, lang);
  await page.getByRole("tab", { name: lang === "en" ? "Class summary" : "สรุปผลทั้งห้อง" }).click();
};

test.describe("Class summary view", () => {
  test("the matrix is still the default, and the switch opens the summary", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("tab", { name: "Score matrix" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("score-summary")).toHaveCount(0);
    await page.getByRole("tab", { name: "Class summary" }).click();
    await expect(page.getByTestId("score-summary")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Class summary" })).toHaveAttribute("aria-selected", "true");
  });

  test("overall card: the class's running grade — average, min, max, SD, no 'you' marker", async ({ page }) => {
    await openSummary(page);
    const card = page.getByTestId("score-summary").locator("section").filter({ hasText: "Class running grade" }).first();
    await expect(card).toContainText("Class statistics · 4 students");
    await expect(card).toContainText("66.0");
    await expect(card.locator("dl")).toContainText("44%");
    await expect(card.locator("dl")).toContainText("90%");
    await expect(card.locator("dl")).toContainText("19.3");
    await expect(card.getByText("Your score")).toHaveCount(0);
    await expect(card.locator("svg[role=img]").first()).toBeVisible();   // the bell curve
  });

  test("grade distribution counts each letter", async ({ page }) => {
    await openSummary(page);
    for (const [l, n] of [["A", 1], ["B", 1], ["C", 1], ["D", 0], ["F", 1]] as const) {
      await expect(page.getByTestId(`grade-row-${l}`)).toContainText(`${n} ${n === 1 ? "student" : "students"}`);
    }
    await expect(page.getByTestId("grade-row-A")).toContainText("25%");
    await expect(page.getByTestId("grade-row-none")).toContainText("0");
  });

  test("follow-up lists Ben (grade under 60%) then Dan (missing work); 'View in matrix' lands on that student", async ({ page }) => {
    await openSummary(page);
    await expect(page.getByTestId("attention-count")).toHaveText("2");
    const items = page.getByTestId("attention-list").getByRole("listitem");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText("Ben Test");
    await expect(items.nth(0)).toContainText("44%");
    await expect(items.nth(1)).toContainText("Dan Test");
    await expect(items.nth(1)).toContainText("1 missing");
    await items.nth(1).getByRole("button", { name: /See Dan Test in the score matrix/ }).click();
    await expect(page.getByRole("tab", { name: "Score matrix" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("cell", { name: "69070804", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "69070801", exact: true })).toHaveCount(0);
  });

  test("by assignment: HW 1 still has one to grade, the Midterm is announced, with the right figures", async ({ page }) => {
    await openSummary(page);
    const hw = page.getByTestId("asg-row-hw1");
    await expect(hw).toContainText("1 to grade");
    await expect(hw).toContainText("2 / 4");
    await expect(hw).toContainText("1 missing");
    const c = (await hw.getByRole("cell").allInnerTexts()).map((x) => x.trim());
    expect(c.slice(3, 6)).toEqual(["5", "7.0", "9"]);
    const mid = page.getByTestId("asg-row-mid");
    await expect(mid).toContainText("Announced");
    await expect(mid).toContainText("4 / 4");
    const m = (await mid.getByRole("cell").allInnerTexts()).map((x) => x.trim());
    expect(m.slice(3, 6)).toEqual(["20", "32.5", "45"]);
    await expect(page.getByRole("cell", { name: /Homework · 40%.*Class average 70%/ })).toBeVisible();
    await expect(page.getByRole("cell", { name: /Exams · 60%.*Class average 65%/ })).toBeVisible();
  });

  test("the exam gets the full card, labelled Announced", async ({ page }) => {
    await openSummary(page);
    const card = page.getByRole("region", { name: "Exam statistics" }).locator("section");
    await expect(card).toContainText("Announced");
    await expect(card).toContainText("Class statistics · 4 students");
    await expect(card.locator("dl")).toContainText("20");
    await expect(card.locator("dl")).toContainText("32.5");
    await expect(card.locator("dl")).toContainText("45");
    await expect(card.locator("svg[role=img]").first()).toBeVisible();   // full-width, so the bell curve shows
  });

  test("Thai UI", async ({ page }) => {
    await openSummary(page, "th");
    await expect(page.getByText("การกระจายเกรด")).toBeVisible();
    await expect(page.getByText("ควรติดตาม", { exact: true })).toBeVisible();
    await expect(page.getByText("สรุปรายชิ้นงาน")).toBeVisible();
    await expect(page.getByText("สถิติการสอบ")).toBeVisible();
  });

  test("no view switch when there is nothing to summarise", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("hwai_lang", "en");
      localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
      localStorage.setItem("hwai_courses_v2", JSON.stringify([{ id: "c-e", name: "Empty", description: "", status: "active", coverColor: "#0F766E", sectionNumber: "1", code: "0", academicYear: 2569, term: 1, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }]));
    });
    await page.goto(`${BASE}/teacher/courses/c-e/results`);
    await expect(page.getByText("No students in this course yet")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Class summary" })).toHaveCount(0);
  });
});

test.describe("scoreSummary lib", () => {
  test("statsFromScores: empty → null, one score has no SD, sample SD otherwise", () => {
    expect(statsFromScores([])).toBeNull();
    expect(statsFromScores([7])).toMatchObject({ count: 1, min: 7, max: 7, mean: 7, sd: null });
    const s = statsFromScores([90, 44, 70, 60])!;
    expect(s.mean).toBe(66);
    expect(s.sd!).toBeCloseTo(19.25, 2);
    expect(s.scores).toEqual([90, 70, 60, 44]);
  });

  test("an empty class has no stats and no one to follow up", () => {
    const book = buildScoreBook({ students: [], assignments: [], categories: [], submissions: [], today: "2026-02-01" });
    const s = buildScoreSummary(book);
    expect(s.overall).toBeNull();
    expect(s.attention).toEqual([]);
    expect(s.ungraded).toBe(0);
    expect(s.gradeCounts).toEqual({ A: 0, B: 0, C: 0, D: 0, F: 0 });
  });

  test("a fully graded assignment that is not announced is 'ready'; announced wins over everything", () => {
    const a = (id: string, extra = {}) => ({ id, courseId: "c", name: id, description: "", dueDate: "2026-01-01", maxPoints: 10, acceptsFiles: true, fileTypes: [], submissionType: "individual", maxGroupSize: null, rubricIds: [], createdAt: NOW, updatedAt: NOW, ...extra }) as never;
    const sub = (assignmentId: string, studentId: string, status: string, v: number | null) => ({ id: `${assignmentId}${studentId}`, assignmentId, studentId, status, aiScore: v, instructorScore: status === "graded" ? v : null }) as never;
    const students = [{ studentId: "1", firstName: "A", lastName: "A" }, { studentId: "2", firstName: "B", lastName: "B" }];
    const book = buildScoreBook({
      students, categories: [], today: "2026-02-01",
      assignments: [a("done"), a("half"), a("shown", { gradingFinalized: true })],
      submissions: [sub("done", "1", "graded", 8), sub("done", "2", "graded", 6), sub("half", "1", "graded", 5), sub("half", "2", "need_review", 4), sub("shown", "1", "need_review", 3)],
    });
    const st = Object.fromEntries(buildScoreSummary(book).categories.flatMap((c) => c.assignments).map((x) => [x.assignment.id, x.state]));
    expect(st).toEqual({ done: "ready", half: "grading", shown: "announced" });
  });
});

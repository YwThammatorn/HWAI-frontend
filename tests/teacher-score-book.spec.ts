import { test, expect, Page } from "@playwright/test";
import fs from "fs";

const BASE = "http://localhost:3000";

// Score Book (21/9/2569): the teacher's Results page redesigned as a students × assignments matrix,
// grouped by grading category, with the weighted "total so far" and a letter grade.
//
// Seed, and the numbers worked out by hand:
//   Homework 30%: HW 1 (/100, past due), HW 2 (/50, past due)     Project 70%: Team Project (/100, group, open)
//   No category:  Extra (/10, open)
//   S1 Somchai   HW1 90, HW2 45 → 135/150 = 90%  → 27.0 ; Project 80 → 56.0        total 83.0 / 100  (A)
//   S2 Malee     HW1 70, HW2 25 →  95/150 = 63.3% → 19.0 ; Project 80 → 56.0        total 75.0 / 100  (B)
//   S3 Chai      HW1 50 graded, HW2 pending, Project pending  → 50% of 30 = 15.0    total 15.0 / 30   (D)
//   S4 Dao       HW1 pending, HW2 missing, Project not yet                          no total
//   S5 Ek        HW1 missing, HW2 missing, Project not yet                          no total
//   graded cells 7, pending 3, missing 3, of 20  → 35% graded; class average (83+75+50)/3 = 69.3

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-sb", name: "Programming", description: "", status: "active", source: "manual",
  coverColor: "#0F766E", iconColor: "#0F766E", courseTemplateId: "ct-sb", term: 1, academicYear: 2569,
  sectionNumber: "1", code: "01076112", schedule: "Mon", room: "811", createdAt: NOW, updatedAt: NOW,
};
const TEACHER = { id: "t-sb", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-sb"] };
const CATS = [
  { id: "cat-hw", courseId: "c-sb", name: "Homework", weight: 30, createdAt: NOW, updatedAt: NOW },
  { id: "cat-pj", courseId: "c-sb", name: "Project", weight: 70, createdAt: NOW, updatedAt: NOW },
];
const asg = (id: string, name: string, dueDate: string, maxPoints: number, extra: Record<string, unknown> = {}) => ({
  id, courseId: "c-sb", name, description: "", dueDate, maxPoints, acceptsFiles: true, fileTypes: [],
  submissionType: "individual", maxGroupSize: null, rubricIds: [], createdAt: NOW, updatedAt: NOW, ...extra,
});
const ASSIGNMENTS = [
  asg("hw1", "HW 1", "2026-01-10", 100, { categoryId: "cat-hw" }),
  asg("hw2", "HW 2", "2026-02-01", 50, { categoryId: "cat-hw" }),
  asg("proj", "Team Project", "2099-12-31", 100, { categoryId: "cat-pj", submissionType: "group", maxGroupSize: 2 }),
  asg("extra", "Extra", "2099-12-31", 10),
];
const STUDENTS = [
  ["69070101", "Somchai", "Jaidee", "Mr."], ["69070102", "Malee", "Suksan", "Miss"], ["69070103", "Chai", "Notitle", undefined],
  ["69070104", "Dao", "Pending", undefined], ["69070105", "Ek", "Missing", undefined],
] as const;
const ROSTER = STUDENTS.map(([studentId, firstName, lastName], i) => ({
  id: `r-${i}`, courseId: "c-sb", studentId, firstName, lastName, email: `${studentId}@kmitl.ac.th`,
  cohort: "CE69", sequenceNumber: i + 1, enrollmentStatus: "enrolled",
}));
const COHORT = STUDENTS.map(([studentId, firstName, lastName, title], i) => ({
  id: `cs-${i}`, studentId, title, firstName, lastName, email: `${studentId}@kmitl.ac.th`, cohort: "CE69", program: "CE", status: "active",
}));
const sub = (id: string, assignmentId: string, studentId: string, status: "graded" | "need_review" | "not_graded", score: number | null, extra: Record<string, unknown> = {}) => ({
  id, assignmentId, studentId, studentName: `Student ${studentId}`, email: `${studentId}@kmitl.ac.th`,
  submittedAt: "2026-01-05T10:00:00.000Z", fileUrl: null, aiScore: score, instructorScore: status === "graded" ? score : null,
  instructorComment: "", externalUseConsent: false, status, updatedAt: "2026-01-05T10:00:00.000Z", ...extra,
});
// HW 1 has a rubric (Correctness 70%/70pts, Style 30%/30pts). s-1-1 has real per-criterion scores
// (65 + 25 = 90, matching its total) — the "exact" case; s-1-2 was graded before criterionScores
// existed, so its breakdown has to be estimated from the weights (round(0.7*70)=49, round(0.3*70)=21).
const RUBRICS = [{
  id: "r-hw1", assignmentId: "hw1", name: "HW 1 rubric", createdAt: NOW, updatedAt: NOW,
  criteria: [
    { id: "crit-correct", name: "Correctness", description: "", maxPoints: 70, weight: 70, levels: [] },
    { id: "crit-style", name: "Style", description: "", maxPoints: 30, weight: 30, levels: [] },
  ],
}];
const SUBMISSIONS = [
  sub("s-1-1", "hw1", "69070101", "graded", 90, { criterionScores: { "crit-correct": 65, "crit-style": 25 } }),
  sub("s-1-2", "hw1", "69070102", "graded", 70), sub("s-1-3", "hw1", "69070103", "graded", 50), sub("s-1-4", "hw1", "69070104", "need_review", 60),
  sub("s-2-1", "hw2", "69070101", "graded", 45), sub("s-2-2", "hw2", "69070102", "graded", 25), sub("s-2-3", "hw2", "69070103", "not_graded", null),
  sub("s-p-1", "proj", "69070101", "graded", 80, { groupId: "g1" }), sub("s-p-2", "proj", "69070102", "graded", 80, { groupId: "g1" }), sub("s-p-3", "proj", "69070103", "need_review", 60),
];

type Opts = { lang?: "en" | "th"; role?: "teacher" | "student"; empty?: "assignments" | "students" };

async function seed(page: Page, o: Opts = {}) {
  await page.addInitScript((d) => {
    if (sessionStorage.getItem("sb_seeded")) return;   // addInitScript re-runs on every navigation
    sessionStorage.setItem("sb_seeded", "1");
    localStorage.setItem("hwai_lang", d.lang);
    localStorage.setItem("hwai_user", JSON.stringify(d.role === "student"
      ? { name: "Somchai", email: "69070101@kmitl.ac.th", role: "student", studentId: "69070101" }
      : { name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([d.course]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([d.teacher]));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(d.cohort));
    localStorage.setItem("hwai_students_v1", JSON.stringify(d.empty === "students" ? [] : d.roster));
    localStorage.setItem("hwai_grading_categories_v1", JSON.stringify(d.cats));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify(d.empty === "assignments" ? [] : d.assignments));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify(d.empty === "assignments" ? [] : d.rubrics));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(d.empty === "assignments" ? [] : d.submissions));
  }, { lang: o.lang ?? "en", role: o.role ?? "teacher", empty: o.empty, course: COURSE, teacher: TEACHER, cohort: COHORT, roster: ROSTER, cats: CATS, assignments: ASSIGNMENTS, rubrics: RUBRICS, submissions: SUBMISSIONS });
}

async function open(page: Page, o: Opts = {}, url = "/teacher/courses/c-sb/results") {
  await seed(page, o);
  await page.goto(`${BASE}${url}`);
  await page.waitForLoadState("networkidle");
}

// column indexes inside a student row: 0 ID · 1 Name · 2 HW 1 · 3 HW 2 · 4 Team Project · 5 Extra · 6 Total · 7 Grade
const COL = { id: 0, name: 1, hw1: 2, hw2: 3, proj: 4, extra: 5, total: 6, grade: 7 } as const;
const rowOf = (page: Page, studentId: string) => page.locator("main tbody tr", { hasText: studentId });
const cell = (page: Page, studentId: string, col: keyof typeof COL) => rowOf(page, studentId).locator("td").nth(COL[col]);
const ids = (page: Page) => page.locator("main tbody tr td:first-child").allTextContents();
const statValue = (page: Page, label: string) => page.getByText(label, { exact: true }).locator("xpath=following-sibling::p[1]");

test.describe("Score Book — layout", () => {
  test("columns are grouped by category with weights, then a No category group and the summary", async ({ page }) => {
    await open(page);
    const groups = await page.locator("main thead tr:first-child th[scope='colgroup']").allTextContents();
    expect(groups.map((g) => g.trim())).toEqual(["Homework · 30%", "Project · 70%", "No category", "Summary"]);
    const heads = page.locator("main thead tr:nth-child(2) th");
    await expect(heads).toHaveCount(8);
    await expect(heads.nth(2)).toContainText("HW 1");
    await expect(heads.nth(2)).toContainText("100 pts");
    await expect(heads.nth(3)).toContainText("50 pts");
    await expect(heads.nth(4)).toContainText("Team Project");
    await expect(heads.nth(4)).toContainText("group");
    await expect(heads.nth(4)).toHaveCSS("text-transform", "none"); // assignment names keep their own case
    await expect(page.getByRole("columnheader", { name: "Total" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Grade" })).toBeVisible();
  });

  test("assignment headers link to that assignment's grading page", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("link", { name: "HW 1" })).toHaveAttribute("href", "/teacher/courses/c-sb/assignments/hw1/grading");
  });

  test("students show their honorific from the central record", async ({ page }) => {
    await open(page);
    await expect(cell(page, "69070101", "name")).toContainText("Mr. Somchai Jaidee");
    await expect(cell(page, "69070102", "name")).toContainText("Miss Malee Suksan");
    await expect(cell(page, "69070103", "name")).toHaveText("Chai Notitle");
  });
});

test.describe("Score Book — cells", () => {
  test("graded cells carry the score and a colour band; the band follows the percentage", async ({ page }) => {
    await open(page);
    const s90 = cell(page, "69070101", "hw1").getByRole("link");
    await expect(s90).toHaveText("90");
    await expect(s90).toHaveClass(/s-ok-bg/);
    const s70 = cell(page, "69070102", "hw1").getByRole("link");
    await expect(s70).toHaveText("70");
    await expect(s70).toHaveClass(/s-info-bg/);
    const s50 = cell(page, "69070103", "hw1").getByRole("link");
    await expect(s50).toHaveText("50");
    await expect(s50).toHaveClass(/s-err-bg/);
    // HW 2 is out of 50: 45/50 = 90% is green, 25/50 = 50% is red
    await expect(cell(page, "69070101", "hw2").getByRole("link")).toHaveClass(/s-ok-bg/);
    await expect(cell(page, "69070102", "hw2").getByRole("link")).toHaveClass(/s-err-bg/);
  });

  test("pending, missing and not-yet cells are told apart", async ({ page }) => {
    await open(page);
    await expect(cell(page, "69070104", "hw1")).toContainText("Pending");        // handed in, awaiting grading
    await expect(cell(page, "69070103", "hw2")).toContainText("Pending");        // not_graded also counts as pending
    await expect(cell(page, "69070105", "hw1")).toContainText("Missing");        // past due, nothing handed in
    await expect(cell(page, "69070104", "hw2")).toContainText("Missing");
    await expect(cell(page, "69070104", "proj")).toHaveText("—");                // open, not handed in yet
    await expect(cell(page, "69070101", "extra")).toHaveText("—");
  });

  test("group work: every teammate shows the team's score, marked with a team glyph", async ({ page }) => {
    await open(page);
    for (const sid of ["69070101", "69070102"]) {
      const c = cell(page, sid, "proj");
      await expect(c.getByRole("link")).toContainText("80");
      await expect(c.getByLabel("Team score")).toBeVisible();
    }
    await expect(cell(page, "69070101", "hw1").getByLabel("Team score")).toHaveCount(0); // individual work has none
  });

  test("graded and pending cells open the submission on the recheck page", async ({ page }) => {
    await open(page);
    await expect(cell(page, "69070101", "hw1").getByRole("link")).toHaveAttribute("href", "/teacher/courses/c-sb/assignments/hw1/recheck?sub=s-1-1");
    await expect(cell(page, "69070104", "hw1").getByRole("link")).toHaveAttribute("href", "/teacher/courses/c-sb/assignments/hw1/recheck?sub=s-1-4");
    await expect(cell(page, "69070105", "hw1").getByRole("link")).toHaveCount(0);
  });
});

// The teacher asked for the Score Book's number to be grounded in the rubric, not just the total —
// each graded cell whose assignment has a rubric gets a small expand control that opens the
// per-criterion breakdown without leaving the page.
test.describe("Score Book — rubric breakdown", () => {
  const expandBtn = (page: Page, studentId: string, col: keyof typeof COL) => cell(page, studentId, col).getByRole("button");

  test("only graded cells on a ruled assignment get an expand control", async ({ page }) => {
    await open(page);
    await expect(expandBtn(page, "69070101", "hw1")).toBeVisible();   // hw1 has a rubric, this cell is graded
    await expect(expandBtn(page, "69070104", "hw1")).toHaveCount(0);  // pending — nothing graded to expand
    await expect(expandBtn(page, "69070105", "hw1")).toHaveCount(0);  // missing
    await expect(expandBtn(page, "69070101", "hw2")).toHaveCount(0);  // hw2 has no rubric at all
    await expect(expandBtn(page, "69070101", "proj")).toHaveCount(0); // neither does the project
  });

  test("clicking the score still opens recheck; the expand control opens a breakdown instead, without navigating", async ({ page }) => {
    await open(page);
    await expect(cell(page, "69070101", "hw1").getByRole("link")).toHaveAttribute("href", "/teacher/courses/c-sb/assignments/hw1/recheck?sub=s-1-1");
    await expandBtn(page, "69070101", "hw1").click();
    await expect(page).toHaveURL(/\/results$/); // did not navigate
    await expect(page.getByRole("dialog", { name: "HW 1" })).toBeVisible();
  });

  test("a submission with real per-criterion scores shows them exactly, no estimate notice", async ({ page }) => {
    await open(page);
    await expandBtn(page, "69070101", "hw1").click();
    const dialog = page.getByRole("dialog", { name: "HW 1" });
    await expect(dialog).toContainText("Mr. Somchai Jaidee");
    await expect(dialog).toContainText("69070101");
    await expect(dialog.getByRole("row", { name: /Correctness/ })).toContainText("70%");
    await expect(dialog.getByRole("row", { name: /Correctness/ })).toContainText("65 / 70");
    await expect(dialog.getByRole("row", { name: /^Style/ })).toContainText("30%");
    await expect(dialog.getByRole("row", { name: /^Style/ })).toContainText("25 / 30");
    await expect(dialog.getByRole("row", { name: /Total/ })).toContainText("90 / 100");
    await expect(dialog.getByText(/Estimated/i)).toHaveCount(0);
  });

  test("a submission graded before criterionScores existed is estimated from the weights, and says so", async ({ page }) => {
    await open(page);
    await expandBtn(page, "69070102", "hw1").click();
    const dialog = page.getByRole("dialog", { name: "HW 1" });
    await expect(dialog.getByText(/Estimated from the criteria weights/i)).toBeVisible();
    await expect(dialog.getByRole("row", { name: /Correctness/ })).toContainText("49 / 70");  // round(0.7 * 70)
    await expect(dialog.getByRole("row", { name: /^Style/ })).toContainText("21 / 30");        // round(0.3 * 70)
    await expect(dialog.getByRole("row", { name: /Total/ })).toContainText("70 / 100");
  });

  test("closes on Escape and on the close button", async ({ page }) => {
    await open(page);
    await expandBtn(page, "69070101", "hw1").click();
    const dialog = page.getByRole("dialog", { name: "HW 1" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expandBtn(page, "69070101", "hw1").click();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("Thai UI: column labels and the estimate notice", async ({ page }) => {
    await open(page, { lang: "th" });
    await expandBtn(page, "69070102", "hw1").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("เกณฑ์", { exact: true })).toBeVisible();
    await expect(dialog.getByText("น้ำหนัก", { exact: true })).toBeVisible();
    await expect(dialog.getByText("คะแนน", { exact: true })).toBeVisible();
    await expect(dialog.getByText("รวม", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/ประมาณจากน้ำหนักของเกณฑ์/)).toBeVisible();
  });
});

test.describe("Score Book — totals", () => {
  test("weighted total so far, what it is out of, and the letter", async ({ page }) => {
    await open(page);
    await expect(cell(page, "69070101", "total")).toContainText("83.0 / 100");
    await expect(cell(page, "69070101", "grade")).toHaveText("A");
    await expect(cell(page, "69070102", "total")).toContainText("75.0 / 100");
    await expect(cell(page, "69070102", "grade")).toHaveText("B");
    // only Homework has graded work for Chai, so the total is out of 30, not 100
    await expect(cell(page, "69070103", "total")).toContainText("15.0 / 30");
    await expect(cell(page, "69070103", "grade")).toHaveText("D");
    for (const sid of ["69070104", "69070105"]) {
      await expect(cell(page, sid, "total")).toHaveText("—");
      await expect(cell(page, sid, "grade")).toHaveText("—");
    }
  });

  test("footer: class average per assignment and overall", async ({ page }) => {
    await open(page);
    const foot = page.locator("main tfoot tr td");
    await expect(foot.first()).toContainText("Class average");
    await expect(foot.nth(1)).toHaveText("70%");   // HW 1: (90+70+50)/3
    await expect(foot.nth(2)).toHaveText("70%");   // HW 2: (90+50)/2
    await expect(foot.nth(3)).toHaveText("80%");   // Team Project
    await expect(foot.nth(4)).toHaveText("—");     // Extra: nothing graded
    await expect(foot.nth(5)).toHaveText("69.3%"); // (83 + 75 + 50) / 3
  });

  test("summary cards", async ({ page }) => {
    await open(page);
    await expect(statValue(page, "Students")).toHaveText("5");
    await expect(statValue(page, "Graded")).toHaveText("35%");
    await expect(statValue(page, "Class average")).toHaveText("69%");
    await expect(statValue(page, "Awaiting grading")).toHaveText("3");
    await statValue(page, "Awaiting grading").click();
    await expect(page).toHaveURL(/\/teacher\/courses\/c-sb\/grading$/);
  });

  test("the teacher's total is the very number the student sees on the Evaluation page", async ({ page, browser }) => {
    await open(page);
    await expect(cell(page, "69070101", "total")).toContainText("83.0");
    const ctx = await browser.newContext();
    const sp = await ctx.newPage();
    await seed(sp, { role: "student" });
    await sp.goto(`${BASE}/student/courses/c-sb/evaluation`);
    await sp.waitForLoadState("networkidle");
    await expect(sp.getByText("Total so far").locator("xpath=following-sibling::p[1]")).toContainText("83.0%");
    await ctx.close();
  });
});

test.describe("Score Book — search, sort, filter", () => {
  test("search matches name, ID, email and honorific, and says how many were found", async ({ page }) => {
    await open(page);
    const box = page.getByRole("combobox", { name: "Search students" });
    await box.fill("malee");
    await expect.poll(() => ids(page)).toEqual(["69070102"]);
    await expect(page.getByText("1 of 5 students")).toBeVisible();
    await box.fill("69070105");
    await expect.poll(() => ids(page)).toEqual(["69070105"]);
    await box.fill("miss"); // Miss Malee — and Ek Missing
    await expect.poll(() => ids(page)).toEqual(["69070102", "69070105"]);
    await box.fill("zzzz");
    await expect(page.getByText("No results found")).toBeVisible();
    await box.fill("");
    await expect.poll(async () => (await ids(page)).length).toBe(5);
  });

  test("starts in roster order; Total sorts high → low, then low → high, then back", async ({ page }) => {
    await open(page);
    expect(await ids(page)).toEqual(["69070101", "69070102", "69070103", "69070104", "69070105"]);
    const total = page.getByRole("columnheader", { name: "Total" });
    await total.getByRole("button").click();
    await expect(total).toHaveAttribute("aria-sort", "descending");
    expect(await ids(page)).toEqual(["69070101", "69070102", "69070103", "69070104", "69070105"]);
    await total.getByRole("button").click();
    await expect(total).toHaveAttribute("aria-sort", "ascending");
    // graded students in ascending order, ungraded ones still at the bottom
    expect(await ids(page)).toEqual(["69070103", "69070102", "69070101", "69070104", "69070105"]);
    await total.getByRole("button").click();
    await expect(total).toHaveAttribute("aria-sort", "none");
    expect(await ids(page)).toEqual(["69070101", "69070102", "69070103", "69070104", "69070105"]);
  });

  test("Student ID and Name sort too, one column at a time", async ({ page }) => {
    await open(page);
    const id = page.getByRole("columnheader", { name: "Student ID" });
    await id.getByRole("button").click();
    await id.getByRole("button").click();
    expect((await ids(page))[0]).toBe("69070105");
    const name = page.getByRole("columnheader", { name: "Name" });
    await name.getByRole("button").click();
    await expect(id).toHaveAttribute("aria-sort", "none");
    // Chai, Dao, Ek, Malee, Somchai
    expect(await ids(page)).toEqual(["69070103", "69070104", "69070105", "69070102", "69070101"]);
  });

  test("category filter narrows the columns but not the totals", async ({ page }) => {
    await open(page);
    await page.getByRole("combobox", { name: "Filter by category" }).selectOption({ label: "Project (70%)" });
    await expect(page.locator("main thead tr:nth-child(2) th")).toHaveCount(5);   // ID, Name, Team Project, Total, Grade
    await expect(page.getByRole("link", { name: "HW 1" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Team Project" })).toBeVisible();
    await expect(rowOf(page, "69070101").locator("td").nth(3)).toContainText("83.0 / 100");
    await page.getByRole("combobox", { name: "Filter by category" }).selectOption({ label: "No category" });
    await expect(page.getByRole("link", { name: "Extra" })).toBeVisible();
  });
});

test.describe("Score Book — export", () => {
  test("Export CSV downloads every student with the same numbers as the screen", async ({ page }) => {
    await open(page);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
    expect(download.suggestedFilename()).toBe("01076112-score-book.csv");
    const text = fs.readFileSync((await download.path())!, "utf8");
    expect(text.charCodeAt(0)).toBe(0xfeff); // BOM so Thai opens correctly in Excel
    const lines = text.slice(1).split("\r\n");
    expect(lines[0]).toBe("Student ID,Title,First name,Last name,HW 1 (/100),HW 2 (/50),Team Project (/100),Extra (/10),Homework 30% (%),Project 70% (%),Total so far,Grade");
    expect(lines[1]).toBe("69070101,Mr.,Somchai,Jaidee,90,45,80,,90.0,80.0,83.0,A");
    expect(lines[2]).toBe("69070102,Miss,Malee,Suksan,70,25,80,,63.3,80.0,75.0,B");
    expect(lines[3]).toBe("69070103,,Chai,Notitle,50,pending,pending,,50.0,,15.0,D");
    expect(lines[4]).toBe("69070104,,Dao,Pending,pending,missing,,,,,,");
    expect(lines[5]).toBe("69070105,,Ek,Missing,missing,missing,,,,,,");
  });
});

test.describe("Score Book — wide matrix, empty states, Thai", () => {
  test("ID and Name stay put, and Total / Grade stay in view, while the matrix scrolls sideways", async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 800 });
    await open(page);
    const scroller = page.locator("main div.overflow-auto");
    expect(await scroller.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    await scroller.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    const box = await scroller.boundingBox();
    const idCell = await cell(page, "69070101", "id").boundingBox();
    const gradeCell = await cell(page, "69070101", "grade").boundingBox();
    expect(Math.abs(idCell!.x - box!.x)).toBeLessThan(3);                                   // pinned left
    expect(Math.abs(gradeCell!.x + gradeCell!.width - (box!.x + box!.width))).toBeLessThan(20); // pinned right
    await expect(cell(page, "69070101", "name")).toBeVisible();
  });

  test("no assignments → empty state; no students → empty state", async ({ page }) => {
    await open(page, { empty: "assignments" });
    await expect(page.getByText("No assignments yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "Create Assignment" })).toHaveAttribute("href", "/teacher/courses/c-sb/assignments/new");
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeDisabled();
  });

  test("no students → empty state that leads to the roster", async ({ page }) => {
    await open(page, { empty: "students" });
    await expect(page.getByText("No students in this course yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to Students" })).toHaveAttribute("href", "/teacher/courses/c-sb/students");
  });

  test("Thai UI", async ({ page }) => {
    await open(page, { lang: "th" });
    await expect(page.getByRole("heading", { level: 1, name: "สมุดคะแนน" })).toBeVisible();
    await expect(page.getByRole("button", { name: "ส่งออก CSV" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "รวม" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "เกรด" })).toBeVisible();
    await expect(cell(page, "69070104", "hw1")).toContainText("รอตรวจ");
    await expect(cell(page, "69070105", "hw1")).toContainText("ไม่ส่ง");
    await expect(page.getByRole("columnheader", { name: /ไม่มีหมวด/ })).toBeVisible();
  });
});

// End-to-end: grading a submission on the recheck page persists the per-criterion scores, and the
// Score Book's breakdown then shows exactly what was typed — not a weight-based guess.
test.describe("Score Book — a real recheck feeds the breakdown", () => {
  test("editing a criterion on recheck and saving shows that exact score in the Score Book", async ({ page }) => {
    await seed(page);
    // s-1-4 (student 69070104, hw1) starts as need_review with aiScore 60 and no stored criterionScores.
    await page.goto(`${BASE}/teacher/courses/c-sb/assignments/hw1/recheck?sub=s-1-4`);
    await page.waitForLoadState("networkidle");
    const correctness = page.locator("div.rounded-xl", { hasText: "Correctness" }).getByRole("spinbutton");
    await expect(correctness).toHaveValue("42"); // round(0.7 * 60), the weight-split starting point
    await correctness.fill("60");
    await page.getByRole("button", { name: "Save Changes" }).click();

    await page.goto(`${BASE}/teacher/courses/c-sb/results`);
    await page.waitForLoadState("networkidle");
    const chip = cell(page, "69070104", "hw1").getByRole("link");
    await expect(chip).toHaveText("78"); // 60 (edited) + 18 (untouched Style, round(0.3*60))
    await cell(page, "69070104", "hw1").getByRole("button").click();
    const dialog = page.getByRole("dialog", { name: "HW 1" });
    await expect(dialog.getByRole("row", { name: /Correctness/ })).toContainText("60 / 70");
    await expect(dialog.getByRole("row", { name: /^Style/ })).toContainText("18 / 30");
    await expect(dialog.getByRole("row", { name: /Total/ })).toContainText("78 / 100");
    await expect(dialog.getByText(/Estimated/i)).toHaveCount(0); // it's a real recorded score now, not a guess
  });
});

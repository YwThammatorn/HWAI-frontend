import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// Assignments (planning) / Grading (checking) split, 21/9/2569.
//   Sidebar:  Overview · Assignments · Grading · Score Book
//   /assignments        planning only — no grading stats, no Start Grading
//   /grading            course-level queue with the four stat cards that used to live on Assignments

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-gs", name: "Programming", description: "", status: "active", source: "manual",
  coverColor: "#0F766E", iconColor: "#0F766E", courseTemplateId: "ct-gs", term: 1, academicYear: 2569,
  sectionNumber: "1", code: "01076112", schedule: "Mon", room: "811", createdAt: NOW, updatedAt: NOW,
};
const TEACHER = { id: "t-gs", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-gs"] };
const CATEGORY = { id: "cat-hw", courseId: "c-gs", name: "Homework", weight: 40, createdAt: NOW, updatedAt: NOW };

const assignment = (id: string, name: string, dueDate: string, extra: Record<string, unknown> = {}) => ({
  id, courseId: "c-gs", name, description: `${name} description`, dueDate, maxPoints: 100, categoryId: "cat-hw",
  acceptsFiles: true, fileTypes: ["pdf"], submissionType: "individual", maxGroupSize: null, rubricIds: [],
  createdAt: NOW, updatedAt: NOW, ...extra,
});
const sub = (id: string, assignmentId: string, studentId: string, status: string, score: number | null) => ({
  id, assignmentId, studentId, studentName: `Student ${studentId}`, email: `${studentId}@kmitl.ac.th`,
  submittedAt: "2026-01-05T10:00:00.000Z", fileUrl: null, aiScore: score, instructorScore: status === "graded" ? score : null,
  instructorComment: "", externalUseConsent: false, status, updatedAt: "2026-01-05T10:00:00.000Z",
});

const ASSIGNMENTS = [
  assignment("a-done", "Done Quiz", "2026-01-10", { rubricIds: ["r-done"] }),
  assignment("a-review", "Review Me", "2099-12-31"),
  assignment("a-late", "Late One", "2026-01-05"),
  assignment("a-wait", "Waiting Project", "2099-12-31", { submissionType: "group", maxGroupSize: 3 }),
];
const RUBRICS = [{
  id: "r-done", assignmentId: "a-done", name: "Done rubric", createdAt: NOW, updatedAt: NOW,
  criteria: [{ id: "c1", name: "Quality", description: "", maxPoints: 100, weight: 100, levels: [{ label: "A", description: "" }, { label: "B", description: "" }] }],
}];
const SUBMISSIONS = [
  sub("s1", "a-done", "64070701", "graded", 90), sub("s2", "a-done", "64070702", "graded", 70),
  sub("s3", "a-review", "64070701", "need_review", 80), sub("s4", "a-review", "64070702", "graded", 60), sub("s5", "a-review", "64070703", "not_graded", null),
  sub("s6", "a-late", "64070701", "not_graded", null),
];
const ROSTER = ["64070701", "64070702", "64070703", "64070704"].map((studentId, i) => ({
  id: `r-${i}`, courseId: "c-gs", studentId, firstName: "Student", lastName: studentId, email: `${studentId}@kmitl.ac.th`,
  cohort: "CE64", sequenceNumber: i + 1, enrollmentStatus: "enrolled",
}));

async function seed(page: Page, opts: { lang?: "en" | "th"; empty?: boolean } = {}) {
  await page.addInitScript((d) => {
    // addInitScript re-runs on every navigation — seed once so in-test changes survive
    if (sessionStorage.getItem("gs_seeded")) return;
    sessionStorage.setItem("gs_seeded", "1");
    localStorage.setItem("hwai_lang", d.lang);
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([d.course]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([d.teacher]));
    localStorage.setItem("hwai_students_v1", JSON.stringify(d.roster));
    localStorage.setItem("hwai_grading_categories_v1", JSON.stringify([d.category]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify(d.empty ? [] : d.assignments));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify(d.empty ? [] : d.rubrics));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(d.empty ? [] : d.submissions));
  }, { lang: opts.lang ?? "en", empty: !!opts.empty, course: COURSE, teacher: TEACHER, category: CATEGORY, assignments: ASSIGNMENTS, rubrics: RUBRICS, submissions: SUBMISSIONS, roster: ROSTER });
}

async function open(page: Page, url: string, opts: { lang?: "en" | "th"; empty?: boolean } = {}) {
  await seed(page, opts);
  await page.goto(`${BASE}/teacher/courses/c-gs${url}`);
  await page.waitForLoadState("networkidle");
}

const statValue = (page: Page, label: string) => page.getByText(label, { exact: true }).locator("xpath=following-sibling::p[1]");
const courseNav = (page: Page) => page.getByRole("navigation", { name: "Programming" });
const rowNames = (page: Page) => page.locator("main li .min-w-0.flex-1 > a").allTextContents();
// one planning row on the Assignments page (the list's own header and the search dropdown also carry a border-b)
const planRow = (page: Page, name: string) => page.locator("main div[class*='last:border-b-0']", { hasText: name }).first();

test.describe("Sidebar", () => {
  test("course menu reads Overview · Assignments · Grading · Score Book", async ({ page }) => {
    await open(page, "");
    const labels = await courseNav(page).getByRole("link").allTextContents();
    const at = (l: string) => labels.findIndex((x) => x.trim() === l);
    expect(at("Overview")).toBeGreaterThanOrEqual(0);
    expect(at("Assignments")).toBe(at("Overview") + 1);
    expect(at("Grading")).toBe(at("Assignments") + 1);
    expect(at("Score Book")).toBe(at("Grading") + 1);
    expect(labels.map((x) => x.trim())).not.toContain("Results");
    await expect(courseNav(page).getByRole("link", { name: "Grading" })).toHaveAttribute("href", "/teacher/courses/c-gs/grading");
    await expect(courseNav(page).getByRole("link", { name: "Score Book" })).toHaveAttribute("href", "/teacher/courses/c-gs/results");
  });

  test("Thai labels", async ({ page }) => {
    await open(page, "", { lang: "th" });
    await expect(courseNav(page).getByRole("link", { name: "ตรวจงาน" })).toBeVisible();
    await expect(courseNav(page).getByRole("link", { name: "สมุดคะแนน" })).toBeVisible();
  });

  // exactly one item is highlighted, and it is the right one, on every nested route
  const CASES: [string, string][] = [
    ["/assignments", "Assignments"],
    ["/assignments/new", "Assignments"],
    ["/assignments/a-review", "Assignments"],
    ["/assignments/a-review/edit", "Assignments"],
    ["/grading", "Grading"],
    ["/assignments/a-review/grading", "Grading"],
    ["/assignments/a-review/recheck?sub=s3", "Grading"],
    ["/results", "Score Book"],
    ["/assignments/a-done/results", "Score Book"],
  ];
  for (const [url, expected] of CASES) {
    test(`${url} highlights only ${expected}`, async ({ page }) => {
      await open(page, url);
      const current = courseNav(page).locator("a[aria-current='page']");
      await expect(current).toHaveCount(1);
      await expect(current).toHaveText(expected);
    });
  }
});

test.describe("Assignments page is planning only", () => {
  test("no grading stat cards, no Start Grading / View Submissions / average", async ({ page }) => {
    await open(page, "/assignments");
    for (const gone of ["Total Assignments", "Pending Review", "Start Grading", "View Submissions", "Avg Score", "All Graded", "Not Graded"]) {
      await expect(page.getByText(gone, { exact: false })).toHaveCount(0);
    }
    await expect(page.getByRole("heading", { level: 1, name: "Assignments" })).toBeVisible();
  });

  test("each row shows planning info: due date, type, files, category weight and rubric status", async ({ page }) => {
    await open(page, "/assignments");
    const done = planRow(page, "Done Quiz");
    await expect(done).toContainText("Due Jan 10, 2026");
    await expect(done).toContainText("Past due");
    await expect(done).toContainText("PDF");
    await expect(done).toContainText("Homework (40%)");
    await expect(done).toContainText("Rubric · 1 criteria");
    const wait = planRow(page, "Waiting Project");
    await expect(wait).toContainText("Group");
    await expect(wait).toContainText("≤ 3 members");
    await expect(wait).toContainText("No rubric");
  });

  test("clicking the row opens the detail page (the Grade → link was removed, redundant with it); the row menu still has Edit / Delete", async ({ page }) => {
    await open(page, "/assignments");
    let row = planRow(page, "Review Me");
    await expect(row.getByRole("link", { name: /Grade/ })).toHaveCount(0);
    // Click somewhere in the row that isn't the title link or the action menu — still navigates to
    // detail. The due-date calendar icon is always rendered and well clear of the action cluster.
    await row.locator("svg").first().click();
    await expect(page).toHaveURL("/teacher/courses/c-gs/assignments/a-review");
    await page.goBack();
    row = planRow(page, "Review Me");
    await row.getByRole("button", { name: /Actions for Review Me/ }).click();
    await expect(page.getByRole("menuitem", { name: "Edit" })).toHaveAttribute("href", "/teacher/courses/c-gs/assignments/a-review/edit");
    await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
  });

  test("Manage Collaborators goes to the collaborators page and Create Assignment to the form", async ({ page }) => {
    await open(page, "/assignments");
    await expect(page.getByRole("link", { name: "Manage Collaborators" })).toHaveAttribute("href", "/teacher/courses/c-gs/collaborators");
    await expect(page.getByRole("link", { name: "Create Assignment" }).first()).toHaveAttribute("href", "/teacher/courses/c-gs/assignments/new");
  });

  test("search filters the list", async ({ page }) => {
    await open(page, "/assignments");
    await page.getByRole("combobox", { name: "Search assignments" }).fill("late");
    await expect(page.locator("main div[class*='last:border-b-0']")).toHaveCount(1);
    await expect(planRow(page, "Late One")).toBeVisible();
    await expect(page.getByText("Review Me")).toHaveCount(0);
  });
});

test.describe("Course Grading page", () => {
  test("the four stat cards moved here and count the same way as before", async ({ page }) => {
    await open(page, "/grading");
    await expect(statValue(page, "Total Assignments")).toHaveText("4");
    await expect(statValue(page, "Graded")).toHaveText("1");          // only Done Quiz is fully graded
    await expect(statValue(page, "Pending Review")).toHaveText("1");  // one need_review submission
    await expect(statValue(page, "Overdue")).toHaveText("1");         // Late One: past due with an ungraded submission
  });

  test("queue order: needs review → overdue → waiting → completed", async ({ page }) => {
    await open(page, "/grading");
    expect(await rowNames(page)).toEqual(["Review Me", "Late One", "Waiting Project", "Done Quiz"]);
  });

  test("row actions: Start Grading, View Results (+ Review) when complete, Awaiting when nobody submitted", async ({ page }) => {
    await open(page, "/grading");
    const li = (name: string) => page.locator("main li", { hasText: name });
    await expect(li("Review Me").getByRole("link", { name: "Start Grading" })).toHaveAttribute("href", "/teacher/courses/c-gs/assignments/a-review/grading");
    await expect(li("Done Quiz").getByRole("link", { name: "View Results" })).toHaveAttribute("href", "/teacher/courses/c-gs/assignments/a-done/results");
    await expect(li("Done Quiz").getByRole("link", { name: "Review", exact: true })).toHaveAttribute("href", "/teacher/courses/c-gs/assignments/a-done/grading");
    await expect(li("Done Quiz").getByRole("link", { name: "Start Grading" })).toHaveCount(0);
    await expect(li("Waiting Project")).toContainText("Awaiting submissions");
    await expect(li("Waiting Project").getByRole("link", { name: "Start Grading" })).toHaveCount(0);
  });

  test("progress shows submitted x / enrolled, the split, and the average of graded work", async ({ page }) => {
    await open(page, "/grading");
    const review = page.locator("main li", { hasText: "Review Me" });
    await expect(review).toContainText("3 / 4 submitted");
    await expect(review).toContainText("Graded 1 · Needs review 1 · Not graded 1");
    await expect(review).toContainText("Avg 60%");                 // only the graded one (60/100)
    await expect(review.getByRole("img", { name: "1 graded, 1 need review, 1 not graded" })).toBeVisible();
    await expect(page.locator("main li", { hasText: "Done Quiz" })).toContainText("Avg 80%");
    await expect(page.locator("main li", { hasText: "Waiting Project" })).toContainText("No submissions yet");
  });

  test("filter tabs carry counts and narrow the queue", async ({ page }) => {
    await open(page, "/grading");
    await expect(page.getByRole("tab", { name: /^All\s*4$/ })).toBeVisible();
    await page.getByRole("tab", { name: /Needs review/ }).click();
    expect(await rowNames(page)).toEqual(["Review Me"]);
    await page.getByRole("tab", { name: /Completed/ }).click();
    expect(await rowNames(page)).toEqual(["Done Quiz"]);
    await page.getByRole("tab", { name: /Awaiting submissions/ }).click();
    expect(await rowNames(page)).toEqual(["Waiting Project"]);
    await page.getByRole("tab", { name: /Not graded/ }).click();
    expect(await rowNames(page)).toEqual(["Review Me", "Late One"]);
    await expect(page.getByText("Showing 2 of 4 assignments")).toBeVisible();
  });

  test("search narrows the queue and offers suggestions; no match says so", async ({ page }) => {
    await open(page, "/grading");
    const box = page.getByRole("combobox", { name: "Search assignments" });
    await box.fill("Wait");
    await expect(page.getByRole("option", { name: "Waiting Project" })).toBeVisible();
    expect(await rowNames(page)).toEqual(["Waiting Project"]);
    await box.fill("zzzz");
    await expect(page.getByText('No assignments match "zzzz"')).toBeVisible();
  });

  test("meta line: overdue chip, type badge, category weight", async ({ page }) => {
    await open(page, "/grading");
    const late = page.locator("main li", { hasText: "Late One" });
    await expect(late).toContainText("Overdue");
    await expect(late).toContainText("Homework (40%)");
    await expect(page.locator("main li", { hasText: "Waiting Project" })).toContainText("Group");
  });

  test("bridge to the Score Book", async ({ page }) => {
    await open(page, "/grading");
    await expect(page.getByRole("link", { name: /Open Score Book/ })).toHaveAttribute("href", "/teacher/courses/c-gs/results");
  });

  test("no assignments → empty state that leads to Create Assignment", async ({ page }) => {
    await open(page, "/grading", { empty: true });
    await expect(page.getByText("Nothing to grade yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "Create Assignment" })).toHaveAttribute("href", "/teacher/courses/c-gs/assignments/new");
    await expect(statValue(page, "Total Assignments")).toHaveText("0");
  });

  test("Thai UI", async ({ page }) => {
    await open(page, "/grading", { lang: "th" });
    await expect(page.getByRole("heading", { level: 1, name: "ตรวจงาน" })).toBeVisible();
    await expect(page.getByRole("link", { name: "เริ่มตรวจงาน" }).first()).toBeVisible();
    await expect(page.getByText("รอนักศึกษาส่งงาน").first()).toBeVisible();
  });
});

// ── Sub-task 2: assignment detail = planning, per-assignment grading = stats + submissions ──────────────

test.describe("Assignment detail is planning only", () => {
  test("shows the brief, the details card and the rubric — and no submissions table or stats", async ({ page }) => {
    await open(page, "/assignments/a-done");
    await expect(page.getByRole("heading", { level: 1, name: "Done Quiz" })).toBeVisible();
    await expect(page.getByText("Done Quiz description")).toBeVisible();
    const details = page.getByRole("complementary", { name: "Details" });
    await expect(details).toContainText("Jan 10, 2026");
    await expect(details.getByText("Max points").locator("xpath=following-sibling::dd")).toHaveText("100");
    await expect(details).toContainText("Homework (40%)");
    await expect(details).toContainText("Individual");
    await expect(details).toContainText("PDF");
    await expect(page.getByText("Past due — Due Jan 10, 2026")).toBeVisible();
    // gone: stat cards, submissions table, search, status filter
    for (const gone of ["Submissions", "Average Grade", "Search students...", "Filter: All Status", "Student Name"]) {
      await expect(page.getByText(gone, { exact: false })).toHaveCount(0);
    }
    // Rubric card is no longer a <table> either (student-style cards, 23/9/2569) — no tables on this
    // planning-only page at all now.
    await expect(page.locator("main table")).toHaveCount(0);
  });

  test("rubric card lists criteria with weights and a 100% total; a missing rubric is flagged", async ({ page }) => {
    await open(page, "/assignments/a-done");
    const rubric = page.getByRole("region", { name: "Rubric" });
    await expect(rubric).toContainText("Quality");
    await expect(rubric).toContainText("1 criteria");
    // Rubric card is now the same student-style layout (card-per-criterion, not a table) — 23/9/2569.
    await expect(rubric.getByText(/Total 100%/)).toBeVisible();
    await expect(rubric.getByRole("link", { name: "Edit Rubric" })).toHaveAttribute("href", "/teacher/courses/c-gs/assignments/a-done/edit");

    await page.goto(`${BASE}/teacher/courses/c-gs/assignments/a-review`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("No rubric yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add Rubric" })).toHaveAttribute("href", "/teacher/courses/c-gs/assignments/a-review/edit");
  });

  test("Go to grading carries the needs-review count and Edit Assignment goes to the form", async ({ page }) => {
    await open(page, "/assignments/a-review");
    const go = page.getByRole("link", { name: /Go to grading/ });
    await expect(go).toHaveAttribute("href", "/teacher/courses/c-gs/assignments/a-review/grading");
    await expect(go.getByLabel("1 need review")).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit Assignment" })).toHaveAttribute("href", "/teacher/courses/c-gs/assignments/a-review/edit");
    // an assignment with nothing to review has no badge
    await page.goto(`${BASE}/teacher/courses/c-gs/assignments/a-done`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("link", { name: /Go to grading/ }).getByLabel(/need review/)).toHaveCount(0);
  });

  test("group assignment shows its member limit", async ({ page }) => {
    await open(page, "/assignments/a-wait");
    await expect(page.getByRole("complementary", { name: "Details" })).toContainText("≤ 3 members");
    await expect(page.getByRole("complementary", { name: "Details" })).toContainText("Group");
  });

  test("Thai UI", async ({ page }) => {
    await open(page, "/assignments/a-done", { lang: "th" });
    await expect(page.getByRole("link", { name: /ไปตรวจงาน/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "เกณฑ์การให้คะแนน" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "รายละเอียด" })).toBeVisible();
  });
});

test.describe("Per-assignment grading page took over the stats and the submissions list", () => {
  // the four cards sit in the grid above the table ("Submitted" is also a column header, so scope to the grid)
  const statCard = (page: Page, label: string) => page.locator("main div.grid > div").filter({ has: page.getByText(label, { exact: true }) });

  test("stat cards: processed, submitted x / enrolled, needs review, average", async ({ page }) => {
    await open(page, "/assignments/a-review/grading");
    await expect(statCard(page, "Processed")).toContainText("1");
    await expect(statCard(page, "Submitted")).toContainText("3");
    await expect(statCard(page, "Submitted")).toContainText("/ 4 · 1 pending");
    await expect(statCard(page, "Needs Review")).toContainText("1");
    await expect(statCard(page, "Avg. Score")).toBeVisible();
  });

  test("lists every submission with a Grade link to the recheck page, including not-yet-graded rows", async ({ page }) => {
    // (23/9/2569 round 3) The link is one consistent label shown on every row regardless of status —
    // was gated on need_review/graded, hidden until an AI score existed.
    await open(page, "/assignments/a-review/grading");
    await expect(page.locator("main tbody tr")).toHaveCount(3);
    await expect(page.getByRole("link", { name: "Grade", exact: true }).first()).toHaveAttribute("href", "/teacher/courses/c-gs/assignments/a-review/recheck?sub=s3");
    const notGraded = page.locator("main tbody tr", { hasText: "Student 64070703" });
    await expect(notGraded.getByRole("link", { name: "Grade", exact: true })).toHaveAttribute("href", "/teacher/courses/c-gs/assignments/a-review/recheck?sub=s5");
    await expect(page.getByText("Showing 1–3 of 3 submissions")).toBeVisible();
  });

  test("status filter carries counts and narrows the table", async ({ page }) => {
    await open(page, "/assignments/a-review/grading");
    await expect(page.getByRole("tab", { name: /^All\s*3$/ })).toBeVisible();
    await page.getByRole("tab", { name: /Needs review/ }).click();
    await expect(page.locator("main tbody tr")).toHaveCount(1);
    await expect(page.getByText("Student 64070701")).toBeVisible();
    await page.getByRole("tab", { name: /Not graded/ }).click();
    await expect(page.getByText("Student 64070703")).toBeVisible();
    await expect(page.getByText("Showing 1–1 of 1 submissions")).toBeVisible();
    await page.getByRole("tab", { name: /^Graded\s*1$/ }).click();
    await expect(page.getByText("Student 64070702")).toBeVisible();
  });

  test("search narrows by name or email; no match says so and clearing restores", async ({ page }) => {
    await open(page, "/assignments/a-review/grading");
    const box = page.getByRole("combobox", { name: "Search students" });
    await box.fill("64070702");
    await expect(page.locator("main tbody tr")).toHaveCount(1);
    await box.fill("zzzz");
    await expect(page.getByText("No results found")).toBeVisible();
    await box.fill("");
    await expect(page.locator("main tbody tr")).toHaveCount(3);
  });

  test("filtering by status and back doesn't change the row count", async ({ page }) => {
    // Score is read-only in this table (23/9/2569) — this used to check that a live-typed instructor
    // score survived a filter round trip; there's no more live editing to lose, so this now just
    // guards the filter tabs themselves against losing rows on the way back to "All".
    await open(page, "/assignments/a-review/grading");
    await expect(page.locator("main tbody tr")).toHaveCount(3);
    await page.getByRole("tab", { name: /Graded/ }).click();
    await page.getByRole("tab", { name: /^All/ }).click();
    await expect(page.locator("main tbody tr")).toHaveCount(3);
  });

  test("breadcrumb goes Courses / course / Grading / assignment", async ({ page }) => {
    await open(page, "/assignments/a-review/grading");
    const crumbs = page.locator("main div.flex.items-center").first();
    await expect(crumbs.getByRole("link", { name: "Grading" })).toHaveAttribute("href", "/teacher/courses/c-gs/grading");
    await expect(crumbs.getByRole("link", { name: "Review Me" })).toHaveAttribute("href", "/teacher/courses/c-gs/assignments/a-review");
  });
});

// Screenshots for the project report (section 3.4 "UI design"), one PNG per figure, grouped by role.
//   node report-ui/capture.mjs [admin|teacher|student ...]      (needs the app on http://localhost:3000)
// The data is the English mock set the console commands [10] → [14] → [15] → [16] in test-data/seed-commands.txt load,
// so what you see is the same demo class (c-mock-1, 42 students) used everywhere else.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const OUT = path.resolve("report-ui/shots");
const DOC = fs.readFileSync("test-data/seed-commands.txt", "utf8").split(/\r?\n/);
const only = new Set(process.argv.slice(2));

// line numbers of the English command of [10], [14], [15], [16] — looked up by the label above them so edits to the doc don't break this
function commandAfter(label) {
  const i = DOC.findIndex((l) => l.startsWith(label));
  if (i < 0) throw new Error("no " + label);
  const j = DOC.findIndex((l, k) => k > i && /^fetch\(.*-en\.json/.test(l));
  return DOC[j];
}
const SEED = ["[10]", "[14]", "[15]", "[16]"].map(commandAfter);

const USERS = {
  admin: { name: "Dev Admin", email: "admin@kmitl.ac.th", role: "admin" },
  teacher: { name: "สมศักดิ์ เจริญสุข", email: "somsak.c@kmitl.ac.th", accountEmail: "somsak.c@kmitl.ac.th", role: "teacher", roles: ["admin", "teacher", "student"] },
  student: { name: "สมชาย ใจดี", email: "69070101@kmitl.ac.th", role: "student", studentId: "69070101" },
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("  [page error]", e.message.slice(0, 120)));

async function seed() {
  await page.goto(`${BASE}/login`);
  await page.evaluate(() => localStorage.clear());
  for (const cmd of SEED) {
    const js = cmd.replace(/location\.reload\(\);/g, "").trim().replace(/;$/, "");
    await page.evaluate(`(async () => { await (${js}); })()`);
    await page.waitForTimeout(1200);   // some commands chain fetches without returning them
  }
  const n = await page.evaluate(() => ({
    courses: JSON.parse(localStorage.getItem("hwai_courses_v2") || "[]").length,
    cohort: JSON.parse(localStorage.getItem("hwai_cohort_students_v1") || "[]").length,
    asg: JSON.parse(localStorage.getItem("hwai_assignments_v1") || "[]").length,
    subs: JSON.parse(localStorage.getItem("hwai_submissions_v1") || "[]").length,
    lang: localStorage.getItem("hwai_lang"),
  }));
  console.log("seeded", JSON.stringify(n));
}

async function as(role) {
  await page.goto(`${BASE}/login`);
  await page.evaluate(([u]) => { localStorage.setItem("hwai_user", JSON.stringify(u)); localStorage.setItem("hwai_lang", "en"); localStorage.setItem("hwai-nav-theme", "teal"); }, [USERS[role]]);   // teal (green) chrome instead of the default navy
}

let count = 0;
/** open `url` as `role` (already signed in), run `prep`, save shots/<name>.png */
async function shot(name, url, prep, opts = {}) {
  await page.goto(`${BASE}${url}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  if (prep) await prep(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: !!opts.fullPage });
  count++;
  console.log("  ✓", name);
}

const want = (role) => only.size === 0 || only.has(role);

await seed();

if (want("admin")) {
  console.log("admin");
  await as("admin");
  await shot("admin-01-users-teachers", "/admin");
  await shot("admin-02-add-teacher", "/admin", async (p) => { await p.getByRole("button", { name: /Add Teacher/ }).click(); await p.waitForTimeout(500); });
  await shot("admin-03-import-teachers", "/admin", async (p) => { await p.getByRole("button", { name: /Import CSV/ }).click(); await p.waitForTimeout(500); });
  await shot("admin-04-users-students", "/admin", async (p) => { await p.getByRole("tab", { name: "Students" }).or(p.getByRole("button", { name: "Students" })).first().click(); await p.waitForTimeout(600); });
  await shot("admin-05-courses", "/admin/courses");
  await shot("admin-06-new-course", "/admin/courses", async (p) => { await p.getByRole("button", { name: /New Course/ }).or(p.getByRole("link", { name: /New Course/ })).first().click(); await p.waitForLoadState("networkidle"); await p.waitForTimeout(500); });
  await shot("admin-07-curriculum", "/admin/curriculum");
  await shot("admin-08-curriculum-courses", "/admin/curriculum", async (p) => { await p.getByText("2569 – present").first().click(); await p.waitForTimeout(700); });
}

const C = "/teacher/courses/c-mock-1";
const top = (p, name) => p.getByRole("heading", { name }).first().scrollIntoViewIfNeeded();
if (want("teacher")) {
  console.log("teacher");
  await as("teacher");
  await shot("teacher-01-my-courses", "/teacher/courses");
  await shot("teacher-02-course-overview", C);
  await shot("teacher-03-assignments", C + "/assignments");
  await shot("teacher-04-assignment-detail", C + "/assignments/a-mock-1");
  await shot("teacher-05-new-assignment", C + "/assignments/new");
  await shot("teacher-06-new-assignment-rubric", C + "/assignments/new", async (p) => { await p.getByRole("heading", { name: /Grading Rubric/ }).first().scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -80)); });
  await shot("teacher-07-course-grading", C + "/grading");
  await shot("teacher-08-assignment-grading", C + "/assignments/a-mock-1/grading");
  await shot("teacher-08b-grade-adjustment", C + "/assignments/a-mock-1/grading", async (p) => { await p.getByRole("heading", { name: /Grade Adjustment/ }).scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, 40)); });
  await shot("teacher-09-rubric-card", C + "/assignments/a-mock-1/grading", async (p) => { await p.getByTestId("grading-rubric").scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -90)); await p.getByTestId("grading-rubric").getByRole("button", { name: /Show all level descriptions/ }).click(); });
  await shot("teacher-10-recheck", C + "/assignments/a-mock-1/grading", async (p) => { await p.getByRole("link", { name: /^Grade/ }).first().click(); await p.waitForLoadState("networkidle"); });
  await shot("teacher-11-exam-scores", C + "/assignments/a-mock-9/grading", async (p) => { await p.getByRole("heading", { name: "Exam scores" }).evaluate((el) => el.scrollIntoView({ block: "start" })); await p.evaluate(() => window.scrollBy(0, -100)); });
  await shot("teacher-12-import-exam-csv", C + "/assignments/a-mock-9/grading", async (p) => {
    await p.getByRole("button", { name: /Import CSV/ }).click();
    await p.locator("input[type=file]").setInputFiles("report-ui/exam-demo.csv");
    await p.waitForTimeout(800);
  });
  await shot("teacher-13-score-book", C + "/results");
  await shot("teacher-14-class-summary", C + "/results", async (p) => { await p.getByRole("tab", { name: /Class summary/ }).or(p.getByRole("button", { name: /Class summary/ })).first().click(); await p.waitForTimeout(900); });
  await shot("teacher-15-clo", C + "/clo");
  await shot("teacher-16-students", C + "/students");
}

if (want("student")) {
  console.log("student");
  await as("student");
  await shot("student-01-home", "/student");
  await shot("student-02-my-courses", "/student/courses");
  await shot("student-03-classwork", "/student/courses/c-mock-1/classwork");
  await shot("student-04-assignment-graded", "/student/courses/c-mock-1/classwork/a-mock-4");
  await shot("student-05-group-assignment", "/student/courses/c-mock-1/classwork/a-mock-3");
  await shot("student-06-exam-result", "/student/courses/c-mock-1/classwork/a-mock-5");
  await shot("student-07-evaluation", "/student/courses/c-mock-1/evaluation");
}

console.log("done,", count, "shots");
await browser.close();

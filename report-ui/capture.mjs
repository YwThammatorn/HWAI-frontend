// Screenshots for the project report (section 3.4 "UI design"), one PNG per figure, grouped by role.
//   node report-ui/capture.mjs [admin|teacher|student ...]      (needs the app on http://localhost:3000, or REPORT_BASE=http://localhost:3100)
// Run it against a PRODUCTION server (next start -p 3100) — the Next dev badge would sit over the sidebar.
//
// Who is signed in (16/10/2569, the user's choice):
//   teacher  chompoonuch.te@kmitl.ac.th   the UX/UI course c-mock-4 (21 assignments, 6 teams, 5 CLOs …)
//   teacher  kiatnarong.to@kmitl.ac.th    only for what UX/UI does not have: exams (c-mock-1's midterm and final)
//   student  <demo id>@kmitl.ac.th         the demo student of the local real class. His data is REAL (name from the git-ignored
//                                         public/local-data/real-class.json), so he is swapped in for 69070101 in the browser only,
//                                         at capture time: nothing about him is written into a committed file, and the screenshots
//                                         (git-ignored too) are the only place his name appears.
// The data is the English mock set the console commands [10] → [14] → [15] → [16] → [21] in test-data/seed-commands.txt load.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.REPORT_BASE ?? "http://localhost:3000";
const OUT = path.resolve("report-ui/shots");
fs.mkdirSync(OUT, { recursive: true });
const DOC = fs.readFileSync("test-data/seed-commands.txt", "utf8").split(/\r?\n/);
const only = new Set(process.argv.slice(2));

// the English command under a label like "[10]": the first line after it that is a one-line command naming an -en file
function commandAfter(label) {
  const i = DOC.findIndex((l) => l.startsWith(label));
  if (i < 0) throw new Error("no " + label);
  const j = DOC.findIndex((l, k) => k > i && /-en\.json/.test(l) && /^(fetch\(|const get=)/.test(l));
  if (j < 0) throw new Error("no English command under " + label);
  return DOC[j];
}
const SEED = ["[10]", "[14]", "[15]", "[16]", "[21]"].map(commandAfter);

const USERS = {
  admin: { name: "Dev Admin", email: "admin@kmitl.ac.th", role: "admin" },
  teacher: { name: "ชมพูนุท เต็งเจริญ", email: "chompoonuch.te@kmitl.ac.th", role: "teacher" },
  examTeacher: { name: "เกียรติณรงค์ ทองประเสริฐ", email: "kiatnarong.to@kmitl.ac.th", accountEmail: "kiatnarong.to@kmitl.ac.th", role: "teacher", roles: ["admin", "teacher", "student"] },
  student: null,   // filled from the local real class after seeding
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
    // a one-expression command is awaited; a command made of several statements (const get=…; …) runs as a block
    await page.evaluate(js.startsWith("fetch(") ? `(async () => { await (${js}); })()` : `(async () => { ${js}; })()`);
    await page.waitForTimeout(1500);   // some commands chain fetches without returning them
  }
  // the demo student of the local real class takes the place of 69070101 everywhere (roster rows, cohort, marks, teams) — same swap as command [23]
  USERS.student = await page.evaluate(async () => {
    const r = await fetch("/local-data/real-class.json");
    if (!r.ok) throw new Error("public/local-data/real-class.json is missing — build it first (see the header of scripts/build-local-class.ts)");
    const d = await r.json();
    const get = (k) => JSON.parse(localStorage.getItem(k) || "[]"), set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    const from = d.demo.from, to = d.demo.studentId, nm = d.demo.name.split(" ");
    const mine = d.cohortStudents.find((s) => s.studentId === to);
    set("hwai_cohort_students_v1", [...get("hwai_cohort_students_v1").filter((s) => s.studentId !== from && s.studentId !== to), mine]);
    set("hwai_students_v1", get("hwai_students_v1").map((s) => (s.studentId === from ? { ...s, studentId: to, firstName: nm[0], lastName: nm.slice(1).join(" "), email: d.demo.email } : s)));
    set("hwai_submissions_v1", get("hwai_submissions_v1").map((s) => (s.studentId === from ? { ...s, studentId: to, studentName: d.demo.name, email: d.demo.email } : s)));
    set("hwai_student_groups_v1", get("hwai_student_groups_v1").map((g) => ({ ...g, memberStudentIds: (g.memberStudentIds || []).map((i) => (i === from ? to : i)) })));
    localStorage.setItem("hwai_demo_student", JSON.stringify({ studentId: to, name: d.demo.name }));
    return { name: d.demo.name, email: d.demo.email, role: "student", studentId: to };
  });
  const n = await page.evaluate(() => ({
    courses: JSON.parse(localStorage.getItem("hwai_courses_v2") || "[]").length,
    cohort: JSON.parse(localStorage.getItem("hwai_cohort_students_v1") || "[]").length,
    asg: JSON.parse(localStorage.getItem("hwai_assignments_v1") || "[]").length,
    subs: JSON.parse(localStorage.getItem("hwai_submissions_v1") || "[]").length,
    lang: localStorage.getItem("hwai_lang"),
  }));
  console.log("seeded", JSON.stringify(n), "· demo student", USERS.student.studentId);
}

async function as(role) {
  await page.goto(`${BASE}/login`);
  await page.evaluate(([u]) => { localStorage.setItem("hwai_user", JSON.stringify(u)); localStorage.setItem("hwai_lang", "en"); }, [USERS[role]]);
}
/** move the app's clock so that it is `iso` now (null = real time again) */
const clock = (iso) => page.evaluate((v) => {
  if (v === null) localStorage.removeItem("hwai_clock_offset_min");
  else localStorage.setItem("hwai_clock_offset_min", String(Math.round((new Date(v).getTime() - Date.now()) / 60000)));
}, iso);

let count = 0;
/** open `url` (already signed in), run `prep`, save shots/<name>.png */
async function shot(name, url, prep, opts = {}) {
  await page.goto(`${BASE}${url}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600);
  try { if (prep) await prep(page); } catch (e) { console.log("  ! prep failed for", name, "—", String(e.message).split("\n")[0].slice(0, 110)); }
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: !!opts.fullPage });
  count++;
  console.log("  ✓", name);
}

const want = (role) => only.size === 0 || only.has(role);
const center = (text) => (p) => p.getByText(text).first().evaluate((el) => el.scrollIntoView({ block: "center" }));

await seed();

if (want("admin")) {
  console.log("admin");
  await as("admin");
  await shot("admin-01-users-teachers", "/admin");
  await shot("admin-02-add-teacher", "/admin", async (p) => { await p.getByRole("button", { name: /Add Teacher/ }).click(); await p.waitForTimeout(500); });
  await shot("admin-03-import-teachers", "/admin", async (p) => { await p.getByRole("button", { name: /Import CSV/ }).first().click(); await p.waitForTimeout(500); });
  await shot("admin-04-users-students", "/admin", async (p) => { await p.getByRole("tab", { name: "Students" }).or(p.getByRole("button", { name: "Students" })).first().click(); await p.waitForTimeout(600); });
  await shot("admin-05-courses", "/admin/courses");
  await shot("admin-06-new-course", "/admin/courses", async (p) => { await p.getByRole("button", { name: /New Course/ }).or(p.getByRole("link", { name: /New Course/ })).first().click(); await p.waitForLoadState("networkidle"); await p.waitForTimeout(500); });
  await shot("admin-07-curriculum", "/admin/curriculum");
  await shot("admin-08-curriculum-courses", "/admin/curriculum", async (p) => { await p.getByText("2569 – present").first().click(); await p.waitForTimeout(700); });
}

const U = "/teacher/courses/c-mock-4";    // UX/UI — chompoonuch
const M = "/teacher/courses/c-mock-1";    // Programming — kiatnarong (the exams)
if (want("teacher")) {
  console.log("teacher");
  await as("teacher");
  await shot("teacher-01-my-courses", "/teacher/courses");
  await shot("teacher-02-course-overview", U);
  await shot("teacher-03-assignments", U + "/assignments");
  await shot("teacher-04-assignment-detail", U + "/assignments/a-mock-10");
  await shot("teacher-05-new-assignment", U + "/assignments/new");
  await shot("teacher-06-new-assignment-rubric", U + "/assignments/new", async (p) => { await p.getByRole("heading", { name: /Grading Rubric/ }).first().scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -80)); });
  // the AI Rubric Assistant: English interface, Thai brief (the Final project's own) → the assistant writes the criteria in Thai, the language of the brief.
  // Step 1 = what should it assess, step 2 = the criteria it suggests
  await page.goto(`${BASE}${U}/assignments/new`);
  await page.waitForLoadState("networkidle");
  try {
    await page.getByPlaceholder("เช่น รายงานการวิจัยผู้ใช้").fill("โปรเจกต์ UX/UI ปลายภาค (Final Project)");
    await page.getByPlaceholder(/อธิบายวัตถุประสงค์/).fill("ออกแบบและสร้าง Prototype ของแอปพลิเคชันที่เลือกใน Figma ให้ครบ Core User Flow พร้อม Design System (Color/Typography Styles และ Components) แล้วส่งลิงก์ไฟล์ Figma กับ Prototype");
    await page.getByRole("button", { name: /AI Rubric Assistant/ }).first().click();
    const dlg = page.getByRole("dialog");
    await dlg.waitFor();
    await dlg.getByRole("button", { name: /Fill from assignment/ }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, "teacher-06b-ai-rubric-brief.png") });
    count++; console.log("  ✓ teacher-06b-ai-rubric-brief");
    await dlg.getByRole("button", { name: "Generate criteria" }).click();
    await dlg.getByRole("button", { name: "Apply Suggestions" }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, "teacher-06c-ai-rubric-results.png") });
    count++; console.log("  ✓ teacher-06c-ai-rubric-results");
  } catch (e) { console.log("  ! AI rubric assistant failed —", String(e.message).slice(0, 130)); }
  await shot("teacher-21-edit-assignment", U + "/assignments/a-uxui-17/edit");
  await shot("teacher-07-course-grading", U + "/grading");

  // the grading window: the clock is moved to half an hour after Hooked / Reorder / Usability Testing were due (28 Sep, 23:59), inside the one late hour — those three are not announced, so they are the ones that show the lock
  await clock("2026-09-29T00:30:00+07:00");
  await shot("teacher-07b-grading-locked", U + "/grading", center("Reorder / Redesign UI"));
  await shot("teacher-08c-assignment-grading-locked", U + "/assignments/a-uxui-17/grading");
  await clock(null);

  await shot("teacher-08-assignment-grading", U + "/assignments/a-uxui-17/grading");
  await shot("teacher-08b-grade-adjustment", U + "/assignments/a-uxui-17/grading", async (p) => { await p.getByRole("heading", { name: /Grade Adjustment/ }).scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, 40)); });
  await shot("teacher-09-rubric-card", U + "/assignments/a-uxui-17/grading", async (p) => { await p.getByTestId("grading-rubric").scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -90)); await p.getByTestId("grading-rubric").getByRole("button", { name: /level descriptions/ }).first().click(); });
  await shot("teacher-10-recheck", U + "/assignments/a-uxui-17/grading", async (p) => { await p.getByRole("link", { name: /^Grade/ }).first().click(); await p.waitForLoadState("networkidle"); });
  await shot("teacher-22-grading-result", U + "/assignments/a-uxui-8/results");

  await shot("teacher-13-score-book", U + "/results");
  await shot("teacher-14-class-summary", U + "/results", async (p) => { await p.getByRole("tab", { name: /Class summary/ }).or(p.getByRole("button", { name: /Class summary/ })).first().click(); await p.waitForTimeout(900); });
  await shot("teacher-15-clo", U + "/clo");
  await shot("teacher-16-students", U + "/students");
  await shot("teacher-23-add-student", U + "/students", async (p) => {
    await p.getByRole("button", { name: /Add Student/ }).first().click();
    await p.getByRole("dialog").getByLabel(/Student ID/).fill("68020101");
    await p.waitForTimeout(600);
  });
  await shot("teacher-17-import-students-excel", U + "/students", async (p) => {
    await p.getByRole("button", { name: /Import Excel/ }).click();
    await p.locator("input[type=file]").setInputFiles("report-ui/registrar-demo.xls");
    await p.getByTestId("sheet-info").waitFor();
    await p.waitForTimeout(500);
  });
  await shot("teacher-18-rubrics-library", U + "/rubrics", async (p) => {
    // two rubrics are put in the library first, so the page is shown with something in it
    for (const id of ["a-mock-10", "a-uxui-13"]) await p.getByTestId("subject-" + id).getByRole("button", { name: "Save to library" }).click();
    await p.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll("*").forEach((e) => { if (e.scrollTop > 0) e.scrollTop = 0; }); });
    await p.waitForTimeout(600);
  });
  await shot("teacher-19-rubrics-compare", U + "/rubrics", async (p) => {
    await p.getByRole("tab", { name: /Compare rubrics/ }).or(p.getByRole("button", { name: /Compare rubrics/ })).first().click();
    for (const id of ["a-uxui-6", "a-uxui-7", "a-uxui-12"]) { await p.getByTestId("cmp-add").click(); await p.getByTestId("cmp-opt-" + id).click(); }
    await p.waitForTimeout(900);
  });
  await shot("teacher-20-calibration", U + "/calibration");

  // the calibration round itself: the teacher scores 3 samples of "Usability Testing" (not announced yet, so the AI can still re-grade) and disagrees with the AI
  await page.goto(`${BASE}${U}/calibration`);
  await page.waitForLoadState("networkidle");
  try {
    await page.locator("#cal-asg").selectOption({ label: "Usability Testing" });
    await page.locator("#cal-n").selectOption("3");
    const levels = page.locator("main button", { hasText: /^(ดีมาก|พอใช้|ต้องปรับปรุง|ไม่ผ่าน) · \d/ });   // the rubric's own level wording is Thai; 4 buttons per criterion
    for (let i = 0; i < 3; i++) {
      for (const idx of [3, 4, 9]) await levels.nth(idx).click();             // criterion 1: Fail · criterion 2: Excellent · criterion 3: Fair
      if (i < 2) await page.getByRole("button", { name: "Next", exact: true }).click();
    }
    await page.getByRole("button", { name: "Compare with the AI" }).click();
    await page.getByTestId("cal-table").waitFor({ timeout: 8000 });
    await page.getByTestId("cal-table").evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.evaluate(() => window.scrollBy(0, -140));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, "teacher-20b-calibration-result.png") });
    count++; console.log("  ✓ teacher-20b-calibration-result");
    const edit = page.locator("[data-testid^=edit-rubric-]").first();
    if (await edit.count()) {
      await edit.scrollIntoViewIfNeeded();
      await edit.click();
      await page.getByRole("dialog").waitFor();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT, "teacher-20c-edit-rubric-popup.png") });
      count++; console.log("  ✓ teacher-20c-edit-rubric-popup");
    } else console.log("  ! no 'Edit rubric' suggestion appeared — popup not captured");
  } catch (e) { console.log("  ! calibration round failed —", String(e.message).split("\n")[0].slice(0, 120)); }

  // exams do not exist in UX/UI: the programming course and its teacher
  await as("examTeacher");
  await shot("teacher-11-exam-scores", M + "/assignments/a-mock-9/grading", async (p) => { await p.getByRole("heading", { name: /Exam scores/ }).evaluate((el) => el.scrollIntoView({ block: "start" })); await p.evaluate(() => window.scrollBy(0, -20)); });
  await shot("teacher-11b-exam-midterm", M + "/assignments/a-mock-5/grading", async (p) => { await p.getByRole("heading", { name: /Exam scores/ }).evaluate((el) => el.scrollIntoView({ block: "start" })); await p.evaluate(() => window.scrollBy(0, -20)); });
  await shot("teacher-12-import-exam-csv", M + "/assignments/a-mock-9/grading", async (p) => {
    await p.getByRole("button", { name: /Import CSV/ }).click();
    await p.locator("input[type=file]").setInputFiles("report-ui/exam-demo.csv");
    await p.waitForTimeout(800);
  });
}

if (want("student")) {
  console.log("student");
  await as("student");
  await shot("student-01-home", "/student");
  await shot("student-02-my-courses", "/student/courses");
  await shot("student-03-classwork", "/student/courses/c-mock-4/classwork");
  await shot("student-04-assignment-graded", "/student/courses/c-mock-4/classwork/a-uxui-13");
  await shot("student-05-group-assignment", "/student/courses/c-mock-4/classwork/a-uxui-8");
  // a group project that is still open and has no team yet (clock set to 5 Oct): the "Form a team" step
  await clock("2026-10-05T12:00:00+07:00");
  await shot("student-05b-form-team", "/student/courses/c-mock-1/classwork/a-mock-3", async (p) => { await p.getByRole("button", { name: /Form a team/ }).click(); await p.getByRole("dialog").waitFor(); await p.waitForTimeout(500); });
  await clock(null);
  await shot("student-06-exam-result", "/student/courses/c-mock-1/classwork/a-mock-5");
  await shot("student-07-evaluation", "/student/courses/c-mock-4/evaluation");
}

console.log("done,", count, "shots");
await browser.close();

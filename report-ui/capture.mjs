// Screenshots for the project report (section 3.4 "UI design"), one PNG per figure, grouped by role.
//   node report-ui/capture.mjs [admin|teacher|student ...]      (needs the app on http://localhost:3000, or REPORT_BASE=http://localhost:3100)
// Run it against a PRODUCTION server (next start -p 3100) — the Next dev badge would sit over the sidebar.
//
// Who is signed in (16/10/2569, the user's choice):
//   teacher  chompoonuch.te@kmitl.ac.th   the UX/UI course c-mock-4 (21 assignments, 6 teams, 5 CLOs …)
//   teacher  kiatnarong.to@kmitl.ac.th    only for what UX/UI does not have: exams (c-mock-1's midterm and final)
//   student  the demo student of the local real class (git-ignored public/local-data/real-class.json): swapped in for 69070101 at capture time, browser data only
//   TA       <demo id>@kmitl.ac.th         the demo student of the local real class (git-ignored public/local-data/real-class.json + ta-demo.json),
//                                         swapped in for 69070101 in the browser only, removed from the TA course and appointed TA there
//                                         (command [30]). His real name appears in the student and TA chapters' screenshots (git-ignored too).
// The app's clock is held at 16 Oct 2569 (Playwright context clock) so dates and the Overdue / grading-window states match the old report.
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
  student: null,   // set by seed()
  ta: null,        // set by makeTa()
};

const browser = await chromium.launch();
// 11/11/2569: the page is 1280 wide at 2x (2560 px pictures) instead of 1600 at 1.5x: UI text is ~25% larger on paper at the same figure width, and the picture is sharper. REPORT_W / REPORT_H / REPORT_DSF override it.
const VW = Number(process.env.REPORT_W ?? 1280), VH = Number(process.env.REPORT_H ?? 800), DSF = Number(process.env.REPORT_DSF ?? 2);
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DSF });
await ctx.addInitScript(() => { document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(s); }); });
const BASE_TIME = "2026-10-16T10:00:00+07:00";
await ctx.clock.install({ time: new Date(BASE_TIME) });   // every Date in the app starts at 16 Oct 2026 and keeps running
await ctx.clock.resume();
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
  USERS.student = { name: "สมชาย ใจดี", email: "69070101@kmitl.ac.th", role: "student", studentId: "69070101" };
  const n = await page.evaluate(() => ({
    courses: JSON.parse(localStorage.getItem("hwai_courses_v2") || "[]").length,
    cohort: JSON.parse(localStorage.getItem("hwai_cohort_students_v1") || "[]").length,
    asg: JSON.parse(localStorage.getItem("hwai_assignments_v1") || "[]").length,
    subs: JSON.parse(localStorage.getItem("hwai_submissions_v1") || "[]").length,
    lang: localStorage.getItem("hwai_lang"),
  }));
  console.log("seeded", JSON.stringify(n), "· student", USERS.student.studentId);
}

/** TA chapter only: the real demo student takes the place of 69070101 everywhere (roster rows, cohort, marks, teams — same swap as command [23]),
 *  then command [30] removes him from the TA course and appoints him TA there (a TA must not be enrolled in that subject that term). */
async function swapInDemo() {
  return await page.evaluate(async () => {
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
    return { name: d.demo.name, email: d.demo.email, role: "student", studentId: to };
  });
}
async function makeTa() {
  USERS.ta = await swapInDemo();
  const cmd = DOC[DOC.findIndex((l, k) => k > DOC.findIndex((x) => x.startsWith("[30]")) && l.startsWith("fetch("))];
  const js = cmd.replace(/location[.]reload[(][)];?/g, "").trim().replace(/;$/, "");
  await page.evaluate(`(async () => { await (${js}); })()`);
  await page.waitForTimeout(1500);
  console.log("TA", USERS.ta.studentId, "now TA of c-mock-4");
}

async function as(role) {
  await page.goto(`${BASE}/login`);
  await page.evaluate(([u]) => { localStorage.setItem("hwai_user", JSON.stringify(u)); localStorage.setItem("hwai_lang", "en"); }, [USERS[role]]);
}
/** move the app's clock so that it is `iso` now (null = real time again) */
const clock = (iso) => page.evaluate((v) => {
  if (v === null) localStorage.removeItem("hwai_clock_offset_min");   // null = the base time (16 Oct 2026), not the machine's real date
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
  if (opts.height) { await page.setViewportSize({ width: VW, height: Math.round((opts.height * VH) / 900) }); await page.waitForTimeout(500); }
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: !!opts.fullPage });
  if (opts.height) await page.setViewportSize({ width: VW, height: VH });
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

// the report teacher also has three empty sections/terms of the UX/UI subject in the full mock (c-mock-12 / 26 / 32, 0 students): left out of HER list
// (browser data only, after the admin pages are shot) so her My Courses shows the one course the whole chapter is about
async function trimTeacher() {
  await page.evaluate(() => {
    const k = "hwai_managed_teachers_v1";
    const t = JSON.parse(localStorage.getItem(k) || "[]");
    localStorage.setItem(k, JSON.stringify(t.map((x) => (x.email === "chompoonuch.te@kmitl.ac.th" ? { ...x, courseIds: ["c-mock-4"] } : x))));
  });
}
const U = "/teacher/courses/c-mock-4";    // UX/UI — chompoonuch
const M = "/teacher/courses/c-mock-1";    // Programming — kiatnarong (the exams)
if (want("teacher")) {
  console.log("teacher");
  await trimTeacher();
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

  // grading opens only after submissions close (due date, or the close date of the late policy): the clock is moved to the evening of 28 Sep, before Reorder / Usability Testing
  // are due (23:59), so the not-yet-open state shows. Those assignments are not announced, so they are the ones that show the lock.
  await clock("2026-09-28T20:00:00+07:00");
  await shot("teacher-07b-grading-locked", U + "/grading", center("Reorder / Redesign UI"));
  await shot("teacher-08c-assignment-grading-locked", U + "/assignments/a-uxui-17/grading", undefined, { height: 1000 });
  await clock(null);

  // one assignment's grading page (11/11/2569: one screen — summary strip, list on the left, details on the right). Usability Testing = an individual assignment, 30 students.
  // The viewport is taller (1600x1000) so the two panels are not cut in the middle of a row.
  const G = U + "/assignments/a-uxui-18/grading";
  await shot("teacher-08-assignment-grading", G, undefined, { height: 1000 });
  await shot("teacher-08b-grading-student-detail", G, async (p) => { await p.locator("[data-row-key]").nth(1).click(); await p.waitForTimeout(600); }, { height: 1000 });
  await shot("teacher-09-rubric-tab", G, async (p) => { await p.getByRole("tab", { name: "Rubric" }).click(); await p.waitForTimeout(600); }, { height: 1000 });
  await shot("teacher-10-recheck", G, async (p) => { await p.locator("[data-row-key]").nth(1).getByRole("link", { name: /^Grade/ }).click(); await p.waitForLoadState("networkidle"); });
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
  // Calibration (11/11/2569: no AI "strictness" offset any more). The button on a grading page opens it on that assignment; the teacher scores a blind sample,
  // compares with what the AI gave, reads what the rubric itself may need, and can let the AI grade again with the rubric as it is now.
  await shot("teacher-20-calibration", G, async (p) => { await p.getByTestId("calibrate-ai").click(); await p.waitForLoadState("networkidle"); await p.waitForTimeout(1500); });
  await page.waitForTimeout(500);
  try {
    // 5 samples: score each criterion of each one (a different level now and then, so the comparison has something to show)
    const samples = page.getByRole("button", { name: /^Sample [0-9]+$/ });
    const nSamples = await samples.count();
    // sample 1: pick a level for each criterion, then bring the "score the samples" step to the top and take a taller picture
    await samples.nth(0).click();
    await page.waitForTimeout(250);
    const g0 = page.getByRole("radiogroup");
    for (let k = 0; k < await g0.count(); k++) await g0.nth(k).getByRole("radio").nth(k % 2).click();
    // clicking the last criterion scrolled the criteria panel down: bring every inner scroller back to its top, then the step to the top of the page
    await page.evaluate(() => document.querySelectorAll("*").forEach((e) => { if (e !== document.scrollingElement && e.scrollTop > 0) e.scrollTop = 0; }));
    await page.locator("section[aria-labelledby=cal-2]").evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.setViewportSize({ width: VW, height: Math.round((1100 * VH) / 900) });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, "teacher-20a-calibration-score-sample.png") });
    await page.setViewportSize({ width: VW, height: VH });
    for (let i = 0; i < nSamples; i++) {
      await samples.nth(i).click();
      await page.waitForTimeout(250);
      const groups = page.getByRole("radiogroup");
      const g = await groups.count();
      for (let k = 0; k < g; k++) await groups.nth(k).getByRole("radio").nth((i + k) % 2).click();
    }
    await page.getByTestId("cal-progress").getByText(/of [0-9]+ samples fully scored/).waitFor();
    await page.getByRole("button", { name: "Compare with the AI" }).click();
    await page.waitForTimeout(1500);
    await page.locator("section[aria-labelledby=cal-3]").evaluate((el) => el.scrollIntoView());
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, "teacher-20b-calibration-result.png") });
    console.log("  ✓ teacher-20a-calibration-score-sample, teacher-20b-calibration-result");
    await page.getByTestId("cal-regrade").scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, "teacher-20c-calibration-regrade.png") });
    console.log("  ✓ teacher-20c-calibration-regrade");
    const edit = page.locator("[data-testid^=edit-rubric-]").first();
    if (await edit.count()) {
      await edit.scrollIntoViewIfNeeded();
      await edit.click();
      await page.getByRole("dialog").waitFor();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT, "teacher-20d-edit-rubric-popup.png") });
      console.log("  ✓ teacher-20d-edit-rubric-popup");
    } else console.log("  ! no 'Edit rubric' suggestion appeared — popup not captured");
  } catch (e) { console.log("  ! calibration round failed —", String(e.message).slice(0, 160)); }

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
  // the student chapter shows the demo student of the local real class again (user's call, 11/11/2569): swapped in for 69070101, still enrolled everywhere
  USERS.student = await swapInDemo();
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

// ── Teaching Assistant (11/11/2569) ─────────────────────────────────────────────────────────────────────────────
// A fresh seed, then the real demo student replaces 69070101, is taken out of UX/UI and appointed its TA ([30]). The teacher's Collaborators page
// shows the appointment; then the same person signs in as a student and puts on the TA hat.
if (want("ta")) {
  console.log("ta");
  await seed();
  await makeTa();
  await trimTeacher();
  await as("teacher");
  await shot("ta-01-collaborators", U + "/collaborators");
  await as("ta");
  await shot("ta-02-hat-switch", "/student", async (p) => { await p.getByTestId("hat-switch").click(); await p.waitForTimeout(500); });
  await page.goto(`${BASE}/student`);
  await page.waitForLoadState("networkidle");
  await page.getByTestId("hat-switch").click();
  await page.getByRole("menuitemradio", { name: /TA/ }).click();
  await page.waitForLoadState("networkidle");
  await shot("ta-03-my-courses", "/teacher/courses");
  await shot("ta-04-course-overview", U);
  await shot("ta-05-course-grading", U + "/grading");
  await shot("ta-06-assignment-grading", U + "/assignments/a-uxui-18/grading", undefined, { height: 1000 });
  await shot("ta-07-grade", U + "/assignments/a-uxui-18/grading", async (p) => { await p.locator("[data-row-key]").nth(1).getByRole("link", { name: /^Grade/ }).click(); await p.waitForLoadState("networkidle"); });
  await shot("ta-08-score-book", U + "/results");
  await shot("ta-09-students", U + "/students");
}

console.log("done,", count, "shots");
await browser.close();

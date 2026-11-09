// Step-by-step pictures of "the rubric changed while grading → regrade with the new rubric" (10/11/2569).
// Runs against `next dev` on :3000 with the committed English mock (UX/UI class). Output (git-ignored): report-ui/ta-steps-10-nov/NN-*.png
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(path.resolve("node_modules/@playwright/test"));

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = path.resolve("report-ui/ta-steps-10-nov");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const DOC = fs.readFileSync("test-data/seed-commands.txt", "utf8").split(/\r?\n/);
function commandAfter(label) {
  const i = DOC.findIndex((l) => l.startsWith(label));
  const j = DOC.findIndex((l, k) => k > i && /-en\.json/.test(l) && /^(fetch\(|const get=)/.test(l));
  if (i < 0 || j < 0) throw new Error("no command " + label);
  return DOC[j];
}
const SEED = ["[2]", "[10]", "[14]", "[15]", "[16]", "[21]"].map(commandAfter);
const C = "/teacher/courses/c-mock-4";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1480, height: 900 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(s); }); });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`);
await page.evaluate(() => localStorage.clear());
for (const cmd of SEED) {
  const js = cmd.replace(/location\.reload\(\);/g, "").trim().replace(/;$/, "");
  await page.evaluate(js.startsWith("fetch(") ? `(async () => { await (${js}); })()` : `(async () => { ${js}; })()`);
  await page.waitForTimeout(1200);
}
await page.evaluate(() => {
  localStorage.setItem("hwai_lang", "en");
  localStorage.setItem("hwai_nav_theme", "teal");
  localStorage.setItem("hwai_user", JSON.stringify({ name: "ชมพูนุท เต็งเจริญ", email: "chompoonuch.te@kmitl.ac.th", role: "teacher" }));
});
fs.mkdirSync(OUT, { recursive: true });
const DOC2 = fs.readFileSync("test-data/seed-commands.txt", "utf8").split(/\r?\n/);
const after = (label) => { const i = DOC2.findIndex((l) => l.startsWith(label)); const j = DOC2.findIndex((l, k) => k > i && l.startsWith("fetch(")); return DOC2[j]; };
const run = async (cmd) => { const js = cmd.replace(/location\.reload\(\);?/g, "").trim().replace(/;$/, ""); await page.evaluate(`(async () => { await (${js}); })()`); await page.waitForTimeout(1500); };
await run(after("[24]"));
await run(after("[30]"));
const TA_ID = JSON.parse(fs.readFileSync("public/local-data/ta-demo.json", "utf8")).studentId;     // the real id lives only in that git-ignored file
const state = await page.evaluate((TA_ID) => {
  const g = (k) => JSON.parse(localStorage.getItem(k) || "[]");
  const me = g("hwai_cohort_students_v1").find((s) => s.studentId === TA_ID);
  return { me: !!me, roles: g("hwai_section_roles_v1").filter((r) => me && r.accountId === me.id), enrolledC4: g("hwai_students_v1").filter((r) => r.courseId === "c-mock-4" && r.studentId === TA_ID).length, enrolledC1: g("hwai_students_v1").filter((r) => r.courseId === "c-mock-1" && r.studentId === TA_ID).length };
}, TA_ID);
console.log(JSON.stringify(state));
// sign in as that student (student hat), like the login page does
await page.evaluate((TA_ID) => { const me = JSON.parse(localStorage.getItem("hwai_cohort_students_v1")).find((s) => s.studentId === TA_ID); localStorage.setItem("hwai_user", JSON.stringify({ name: `${me.firstName} ${me.lastName}`, email: me.email, role: "student", studentId: TA_ID })); }, TA_ID);
let n = 0;
const shot = async (name, o = {}) => { await page.waitForTimeout(800); await page.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${name}.png`, ...o }); console.log(n, name); };
await page.goto(`${BASE}/student`); await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(1500);
await page.getByTestId("hat-switch").click();
await shot("student-hat-switch-menu", { clip: { x: 900, y: 0, width: 580, height: 260 } });
await page.getByRole("menuitemradio", { name: /TA/ }).click();
await page.waitForLoadState("networkidle").catch(() => {});
await shot("ta-my-courses");
await page.goto(`${BASE}${C}`); await page.waitForLoadState("networkidle").catch(() => {});
await shot("ta-course-overview-sidebar");
await page.goto(`${BASE}${C}/grading`); await page.waitForLoadState("networkidle").catch(() => {});
await shot("ta-course-grading");
await page.goto(`${BASE}${C}/assignments/a-uxui-18/grading`); await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(1200);
await shot("ta-assignment-grading");
await page.goto(`${BASE}${C}/results`); await page.waitForLoadState("networkidle").catch(() => {});
await shot("ta-score-book-no-export");
await page.goto(`${BASE}${C}/students`); await page.waitForLoadState("networkidle").catch(() => {});
await shot("ta-students-read-only");
await page.goto(`${BASE}${C}/settings`); await page.waitForLoadState("networkidle").catch(() => {});
await shot("ta-blocked-settings-goes-to-my-courses");
await page.goto(`${BASE}/teacher/courses/c-mock-1/grading`); await page.waitForLoadState("networkidle").catch(() => {});
await shot("ta-other-course-goes-to-my-courses");
await browser.close();

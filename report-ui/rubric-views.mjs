// Every place the app shows a rubric, one screenshot each (24/10/2569) — to compare the formats before unifying them.
// Output: report-ui/rubric-views-24-oct/*.png (git-ignored). Needs the app on :3100 (RUBRIC_BASE to change).
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.RUBRIC_BASE ?? "http://localhost:3100";
const DARK = process.env.THEME === "dark";
const OUT = path.resolve(DARK ? "report-ui/rubric-views-24-oct/dark" : "report-ui/rubric-views-24-oct");
fs.mkdirSync(OUT, { recursive: true });
const DOC = fs.readFileSync("test-data/seed-commands.txt", "utf8").split(/\r?\n/);
function commandAfter(label) {
  const i = DOC.findIndex((l) => l.startsWith(label));
  const j = DOC.findIndex((l, k) => k > i && /-en\.json/.test(l) && /^(fetch\(|const get=)/.test(l));
  if (i < 0 || j < 0) throw new Error("no command " + label);
  return DOC[j];
}
const SEED = ["[10]", "[14]", "[15]", "[16]", "[21]"].map(commandAfter);
const USERS = {
  teacher: { name: "ชมพูนุท เต็งเจริญ", email: "chompoonuch.te@kmitl.ac.th", role: "teacher" },
  student: { name: "นักศึกษา", email: "66010102@kmitl.ac.th", role: "student", studentId: "66010102" },
};
const C = "c-mock-4", A = "a-uxui-13", SUB = "sub-a-uxui-13-66010102";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1480, height: 1500 } });
await ctx.addInitScript(() => { document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(s); }); });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`);
await page.evaluate(() => localStorage.clear());
for (const cmd of SEED) {
  const js = cmd.replace(/location\.reload\(\);/g, "").trim().replace(/;$/, "");
  await page.evaluate(js.startsWith("fetch(") ? `(async () => { await (${js}); })()` : `(async () => { ${js}; })()`);
  await page.waitForTimeout(1500);
}
await page.evaluate((d) => { localStorage.setItem("hwai_lang", "th"); if (d) localStorage.setItem("hwai-theme", "dark"); }, DARK);

async function as(who, url) {
  await page.evaluate((u) => localStorage.setItem("hwai_user", JSON.stringify(u)), USERS[who]);
  await page.goto(`${BASE}${url}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1200);
  // dark mode is switched off in the app (ThemeProvider forces light), so for the dark shots the attribute is set after the page has loaded
  if (DARK) { await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark")); await page.waitForTimeout(300); }
}
const shot = async (name, opts = {}) => { await page.screenshot({ path: `${OUT}/${name}.png`, ...opts }); console.log("shot", name); };
const T = `/teacher/courses/${C}`;
const only = process.argv[2];
const run = async (name, fn) => { if (only && !name.startsWith(only)) return; try { await fn(); } catch (e) { console.log("FAIL", name, String(e).split("\n")[0]); } };

await run("01", async () => { await as("teacher", `${T}/assignments/${A}`); await page.getByText(/เกณฑ์|rubric/i).first().scrollIntoViewIfNeeded(); await shot("01-teacher-assignment-detail"); });
await run("02", async () => { await as("teacher", `${T}/assignments/${A}/grading`); await shot("02-teacher-grading-detail-panel"); });
await run("03", async () => { await as("teacher", `${T}/assignments/${A}/recheck?sub=${SUB}`); await shot("03-teacher-recheck"); });
await run("04", async () => { await as("teacher", `${T}/assignments/${A}/edit`); await shot("04-teacher-edit-assignment-editor"); });
await run("05", async () => { await as("teacher", `${T}/rubrics`); await shot("05-teacher-rubric-library"); });
await run("06", async () => { await as("teacher", `${T}/calibration`); await shot("06-teacher-calibration"); });
await run("07", async () => { await as("teacher", `${T}/results`); await page.getByRole("button", { name: /ดูคะแนนรายเกณฑ์/ }).first().click(); await page.waitForTimeout(600); await shot("07-teacher-scorebook-breakdown-popup"); });
await run("08", async () => { await as("student", `/student/courses/${C}/classwork/${A}`); await shot("08-student-classwork"); });
await run("09", async () => { await as("student", `/student/courses/${C}/evaluation`); await shot("09-student-evaluation"); });
await run("10", async () => { await as("teacher", `${T}/assignments/${A}/edit`); await page.getByRole("button", { name: /ใช้ rubric|rubric ที่มี|เลือก rubric|จาก rubric|Use/i }).first().click(); await page.waitForTimeout(600); await shot("10-teacher-rubric-picker-popup"); });
const scrollTo = (loc) => loc.first().evaluate((el) => el.scrollIntoView({ block: "start" }));
await run("11", async () => { await as("teacher", `${T}/assignments/${A}/edit`); await scrollTo(page.getByRole("heading", { name: /เกณฑ์การให้คะแนน \(Rubric\)/ })); await page.waitForTimeout(400); await shot("11-teacher-editor-rubric-section"); });
await run("12", async () => { await as("teacher", `${T}/assignments/${A}/grading`); await page.getByRole("button", { name: /แสดงคำอธิบายระดับทั้งหมด/ }).click(); await page.waitForTimeout(400); await scrollTo(page.getByTestId("grading-rubric")); await page.waitForTimeout(300); await shot("12-teacher-grading-panel-levels-open"); });
await run("13", async () => { await as("teacher", `${T}/rubrics`); await page.getByText("เทียบ rubric", { exact: true }).first().click(); for (let i = 0; i < 3; i++) { await page.getByRole("button", { name: /เพิ่มรายการเทียบ/ }).first().click(); await page.waitForTimeout(500); await page.locator("[data-testid^=cmp-opt-]:not([disabled])").first().click(); await page.waitForTimeout(500); } await shot("13-teacher-rubric-compare-tab"); });
await run("14", async () => { await as("student", `/student/courses/${C}/evaluation`); await page.getByText("UI design", { exact: true }).first().click(); await page.waitForTimeout(500); await shot("14-student-evaluation-expanded"); });
await run("15", async () => { await as("teacher", `${T}/assignments/new`); await page.getByRole("button", { name: /จากงานก่อนหน้า/ }).first().click(); await page.waitForTimeout(700); await shot("15-teacher-rubric-picker-popup"); });
await run("16", async () => { await as("teacher", `${T}/calibration`); await page.getByRole("button", { name: /แก้ rubric|Edit rubric/i }).first().click(); await page.waitForTimeout(700); await shot("16-teacher-rubric-edit-popup"); });
await browser.close();

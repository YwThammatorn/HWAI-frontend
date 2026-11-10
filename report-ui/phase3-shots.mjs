// Phase 3 pictures (10/11/2569): TA assigned work — the teacher's "Assign work to TAs" page, and the TA's My Courses / Overview (queue) / Grading / Score Book.
//   node report-ui/phase3-shots.mjs <base-url> <out-dir>      (production server; English mock set like capture.mjs; made-up TA 69070105, no real data)
// Run against the new build for the "after" set; against an old build the TA pages show everything and the teacher page does not exist (it is skipped).
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = path.resolve(process.argv[3] ?? "report-ui/shots-phase3"); fs.mkdirSync(OUT, { recursive: true });
const DOC = fs.readFileSync("test-data/seed-commands.txt", "utf8").split(/\r?\n/);
const commandAfter = (label) => { const i = DOC.findIndex((l) => l.startsWith(label)); const j = DOC.findIndex((l, k) => k > i && /-en\.json/.test(l) && /^(fetch\(|const get=)/.test(l)); return DOC[j]; };
const SEED = ["[10]", "[14]", "[15]", "[16]", "[21]"].map(commandAfter);
const TA_ID = "69070105";
const VW = 1440, VH = 900;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(s); }); });
await ctx.clock.install({ time: new Date("2026-10-16T10:00:00+07:00") }); await ctx.clock.resume();
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("[page error]", e.message.slice(0, 140)));
await page.goto(`${BASE}/login`);
await page.evaluate(() => localStorage.clear());
for (const cmd of SEED) {
  const js = cmd.replace(/location\.reload\(\);/g, "").trim().replace(/;$/, "");
  await page.evaluate(js.startsWith("fetch(") ? `(async () => { await (${js}); })()` : `(async () => { ${js}; })()`);
  await page.waitForTimeout(1500);
}
// appoint the made-up TA on UX/UI, and (new build only) give them work: the same records the console command [30] and the teacher's page write
const info = await page.evaluate(({ id, withWork }) => {
  const get = (k) => JSON.parse(localStorage.getItem(k) || "[]"), set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const me = get("hwai_cohort_students_v1").find((s) => s.studentId === id);
  if (!me) return null;
  set("hwai_section_roles_v1", [...get("hwai_section_roles_v1"), { id: crypto.randomUUID(), accountId: me.id, courseId: "c-mock-4", role: "ta" }]);
  if (withWork) set("hwai_grading_assignments_v1", [{ id: "ga-demo", courseId: "c-mock-4", taAccountId: me.id, scope: { type: "assignments", assignmentIds: ["a-uxui-12", "a-uxui-13", "a-uxui-17", "a-uxui-18"] } }]);
  return { name: `${me.firstName} ${me.lastName}`, email: me.email };
}, { id: TA_ID, withWork: process.env.OLD_BUILD !== "1" });
if (!info) throw new Error("TA candidate " + TA_ID + " not in the cohort");
const U = "/teacher/courses/c-mock-4";
async function shot(name, url, prep) {
  await page.goto(`${BASE}${url}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(900);
  try { if (prep) await prep(page); } catch (e) { console.log("  ! prep", name, String(e.message).split("\n")[0].slice(0, 120)); }
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log("  ✓", name);
}
const as = (u) => page.evaluate((x) => { localStorage.setItem("hwai_user", JSON.stringify(x)); localStorage.setItem("hwai_lang", "en"); }, u);
await as({ name: "Chompoonuch", email: "chompoonuch.te@kmitl.ac.th", role: "teacher" });
await shot("teacher-collaborators", `${U}/collaborators`);
if (process.env.OLD_BUILD !== "1") {
  await shot("teacher-assign-work", `${U}/grading-split`);
  await shot("teacher-assign-work-popup", `${U}/grading-split`, async (p) => { await p.getByTestId(`assign-open-${TA_ID}`).click(); await p.waitForTimeout(500); });
}
await as({ name: info.name, email: info.email, role: "ta", studentId: TA_ID });
await shot("ta-03-my-courses", "/teacher/courses");
await shot("ta-04-course-overview", U);
await shot("ta-05-course-grading", `${U}/grading`);
await shot("ta-08-score-book", `${U}/results`);
await shot("ta-10-not-mine-redirect", `${U}/assignments/a-uxui-1/grading`);
await browser.close();

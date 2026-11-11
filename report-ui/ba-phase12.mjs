// Before / after pictures of what Phase 1 + Phase 2 (10/11/2569) changed on screen. Usage: node report-ui/ba-phase12.mjs <base-url> <out-dir>
// Run it once against the old build (HEAD) and once against the new one, then: python report-ui/before-after-pdf.py <before> <after> report-ui/phase12-captions.json <out.pdf>
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const [BASE, OUTARG] = process.argv.slice(2);
const OUT = path.resolve(OUTARG); fs.mkdirSync(OUT, { recursive: true });
const DOC = fs.readFileSync("test-data/seed-commands.txt", "utf8").split(/\r?\n/);
const commandAfter = (label) => { const i = DOC.findIndex((l) => l.startsWith(label)); const j = DOC.findIndex((l, k) => k > i && /-en\.json/.test(l) && /^(fetch\(|const get=)/.test(l)); return DOC[j]; };
const SEED = ["[10]", "[14]", "[15]", "[16]", "[21]"].map(commandAfter);
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
const as = (u) => page.evaluate((x) => { localStorage.setItem("hwai_user", JSON.stringify(x)); localStorage.setItem("hwai_lang", "en"); }, u);
const TEACHER = { name: "Chompoonuch", email: "chompoonuch.te@kmitl.ac.th", role: "teacher" };
const STUDENT = { name: "สมชาย ใจดี", email: "69070101@kmitl.ac.th", role: "student", studentId: "69070101" };
const U = "/teacher/courses/c-mock-4";
async function shot(name, url, prep) {
  await page.goto(`${BASE}${url}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(900);
  try { if (prep) await prep(page); } catch (e) { console.log("  ! prep", name, String(e.message).split("\n")[0].slice(0, 120)); }
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log("  ✓", name);
}
await as(TEACHER);
await shot("teacher-10-recheck", `${U}/assignments/a-uxui-13/recheck?sub=sub-a-uxui-13-66010102`);
await shot("teacher-20a-calibration-sample", `${U}/calibration`, async (p) => {
  await p.locator("#cal-asg").selectOption({ label: "UI design" }); await p.waitForTimeout(800);
  await p.locator("section[aria-labelledby=cal-2]").evaluate((el) => el.scrollIntoView({ block: "start" })); await p.waitForTimeout(500);
});
await shot("teacher-20b-calibration-result", `${U}/calibration`, async (p) => {
  const samples = p.locator("[data-testid^=sample-]"); const n = await samples.count();
  for (let i = 0; i < n; i++) {
    await samples.nth(i).click(); await p.waitForTimeout(250);
    const g = p.getByRole("radiogroup");
    for (let k = 0; k < await g.count(); k++) await g.nth(k).getByRole("radio").nth((i + k) % 2).click();
  }
  await p.getByRole("button", { name: "Compare with the AI" }).click(); await p.waitForTimeout(1500);
  await p.locator("section[aria-labelledby=cal-3]").evaluate((el) => el.scrollIntoView()); await p.waitForTimeout(500);
});
await as(STUDENT);
await shot("student-04-assignment-graded", "/student/courses/c-mock-4/classwork/a-uxui-13");
await shot("student-06-exam-result", "/student/courses/c-mock-1/classwork/a-mock-5");
await shot("student-07-evaluation", "/student/courses/c-mock-4/evaluation");
await browser.close();

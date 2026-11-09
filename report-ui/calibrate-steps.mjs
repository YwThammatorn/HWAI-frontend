// Step-by-step pictures of "the rubric changed while grading → regrade with the new rubric" (10/11/2569).
// Runs against `next dev` on :3000 with the committed English mock (UX/UI class). Output (git-ignored): report-ui/calibrate-steps-10-nov/NN-*.png
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(path.resolve("node_modules/@playwright/test"));

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = path.resolve("report-ui/calibrate-steps-10-nov");
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
const MODE = process.env.MODE ?? "after";
fs.mkdirSync(OUT, { recursive: true });
let n = 0;
const shot = async (name, opts = {}) => { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${name}.png`, ...opts }); console.log(n, name); };
// 1) the Grading page: the button
await page.goto(`${BASE}${C}/assignments/a-uxui-18/grading`);
await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(1500);
await page.getByTestId("calibrate-ai").evaluate((el) => { el.style.outline = "3px solid #e11d48"; el.style.outlineOffset = "3px"; });
await shot("grading-page-button", { clip: { x: 234, y: 63, width: 1246, height: 200 } });
await page.getByTestId("calibrate-ai").click();
await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(1800);
await shot("calibration-opens-on-this-assignment");
await page.evaluate(() => window.scrollBy(0, 520));
await shot("sample-and-blind-test");
// score: pick the first sample, then each criterion's level
const samples = page.getByRole("button", { name: /^Sample \d+$/ });
const count = await samples.count();
console.log("samples", count);
for (let i = 0; i < count; i++) {
  await samples.nth(i).click();
  await page.waitForTimeout(250);
  const groups = page.getByRole("radiogroup");
  const g = await groups.count();
  if (i === 0) { await page.evaluate(() => window.scrollBy(0, 250)); await shot("score-one-sample-levels"); }
  for (let k = 0; k < g; k++) {
    const radios = groups.nth(k).getByRole("radio");
    await radios.nth((i + k) % 2).click();
  }
}
await page.evaluate(() => window.scrollBy(0, 400));
await shot("all-samples-scored-compare-button");
await page.getByTestId("cal-progress").getByText("5 of 5 samples fully scored").waitFor();
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Compare with the AI" }).click();
await page.waitForTimeout(800);
page.on("pageerror", (e) => console.log("PAGEERR", String(e).slice(0, 300)));
await page.waitForTimeout(1500); await page.screenshot({ path: `${OUT}/dbg.png` }); console.log(JSON.stringify(await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_calibrations_v1") ?? "[]").map((r) => ({ id: r.id.slice(0, 6), a: r.assignmentId, done: !!r.completedAt, levels: Object.keys(r.teacherLevels).length, at: r.createdAt })))));
await page.locator("section[aria-labelledby=cal-3]").evaluate((el) => el.scrollIntoView());
await shot("result-compare-and-suggestions");
await page.getByTestId("cal-regrade").scrollIntoViewIfNeeded();
await shot("grade-again-panel");
await browser.close();

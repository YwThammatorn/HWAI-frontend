// Step-by-step pictures of "the rubric changed while grading → regrade with the new rubric" (10/11/2569).
// Runs against `next dev` on :3000 with the committed English mock (UX/UI class). Output (git-ignored): report-ui/grading-workspace-10-nov/NN-*.png
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(path.resolve("node_modules/@playwright/test"));

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = path.resolve("report-ui/grading-workspace-10-nov");
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
await page.goto(`${BASE}${C}/assignments/a-uxui-18/grading`);
await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/${MODE}-1-first-screen.png` });
await page.screenshot({ path: `${OUT}/${MODE}-2-full-page.png`, fullPage: true });
console.log(await page.evaluate(() => { const e = document.querySelector("main")?.parentElement; return JSON.stringify({ scrollH: e?.scrollHeight, clientH: e?.clientHeight }); }));
await browser.close();

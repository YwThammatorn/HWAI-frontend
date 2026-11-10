// Phase 2 pictures (10/11/2569): Grading Review with the student's frozen frames + the AI's reason chips, and Calibration with the same frames.
//   REPORT_BASE=http://localhost:3100 node report-ui/phase2-shots.mjs      (production server; seeds the English mock set like capture.mjs)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const BASE = process.env.REPORT_BASE ?? "http://localhost:3100";
const OUT = path.resolve(process.env.REPORT_OUT ?? "report-ui/shots-phase2"); fs.mkdirSync(OUT, { recursive: true });
const DOC = fs.readFileSync("test-data/seed-commands.txt", "utf8").split(/\r?\n/);
const commandAfter = (label) => { const i = DOC.findIndex((l) => l.startsWith(label)); const j = DOC.findIndex((l, k) => k > i && /-en\.json/.test(l) && /^(fetch\(|const get=)/.test(l)); return DOC[j]; };
const SEED = ["[10]", "[14]", "[15]", "[16]", "[21]"].map(commandAfter);
const VW = Number(process.env.REPORT_W ?? 1280), VH = Number(process.env.REPORT_H ?? 800), DSF = Number(process.env.REPORT_DSF ?? 1);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DSF });
await ctx.addInitScript(() => { document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(s); }); });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("[page error]", e.message.slice(0, 160)));
await page.goto(`${BASE}/login`);
await page.evaluate(() => localStorage.clear());
for (const cmd of SEED) {
  const js = cmd.replace(/location\.reload\(\);/g, "").trim().replace(/;$/, "");
  await page.evaluate(js.startsWith("fetch(") ? `(async () => { await (${js}); })()` : `(async () => { ${js}; })()`);
  await page.waitForTimeout(1500);
}
await page.evaluate(() => { localStorage.setItem("hwai_user", JSON.stringify({ name: "Chompoonuch", email: "chompoonuch.te@kmitl.ac.th", role: "teacher" })); localStorage.setItem("hwai_lang", "en"); });
// a Figma-link piece the AI graded
const sid = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_submissions_v1")).find((s) => s.assignmentId === "a-uxui-13" && s.aiEvidence)?.id);
console.log("submission", sid);
await page.goto(`${BASE}/teacher/courses/c-mock-4/assignments/a-uxui-13/recheck?sub=${sid}`);
await page.waitForLoadState("networkidle"); await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, `recheck-${VW}-a.png`) });
await page.getByTestId("ref-" + (await page.evaluate((id) => Object.keys(JSON.parse(localStorage.getItem("hwai_submissions_v1")).find((s) => s.id === id).aiEvidence)[0], sid)) + "-0").click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, `recheck-${VW}-b-chip.png`) });
await page.goto(`${BASE}/teacher/courses/c-mock-4/calibration`);
await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
await page.locator("#cal-asg").selectOption({ label: "UI design" }); await page.waitForTimeout(800);
await page.getByTestId("frame-viewer").scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -120)); await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, `calibration-${VW}.png`) });
await browser.close();

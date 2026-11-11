// Step-by-step pictures of "the rubric changed while grading → regrade with the new rubric" (10/11/2569).
// Runs against `next dev` on :3000 with the committed English mock (UX/UI class). Output (git-ignored): report-ui/regrade-steps-10-nov/NN-*.png
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(path.resolve("node_modules/@playwright/test"));

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = path.resolve("report-ui/regrade-steps-10-nov");
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

let n = 0;
const shot = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${name}.png` }); console.log(n, name); };
const go = async (u) => { await page.goto(`${BASE}${u}`); await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(1200); };

// 0) find an assignment that is not announced, AI-graded and has waiting work: "Usability Testing" on the course Grading page
await go(`${C}/grading`);
await shot("course-grading-before");
await page.getByRole("link", { name: "Usability Testing" }).first().click();
await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(1200);
const asg = page.url().match(/assignments\/([^/]+)\/grading/)?.[1];
await shot("assignment-grading-graded-work");

// 1) change the rubric on the Edit page
await go(`${C}/assignments/${asg}/edit`);
await page.getByLabel("Points").nth(0).scrollIntoViewIfNeeded();
const pts = page.getByLabel("Points").nth(0);
const old = parseInt(await pts.inputValue(), 10) || 5;
await pts.fill(String(old + 2));
await shot("edit-rubric-points-changed");

// 2) save: the popup says grading restarts, with the two ways forward
await page.getByRole("button", { name: "Save Changes" }).click();
await page.getByRole("dialog").waitFor();
await shot("save-popup-restart-or-regrade");

// 3) "Save, regrade later": scores are cleared, the marker is set
await page.getByTestId("confirm-restart").click();
await page.waitForTimeout(1500);

// 4) the course Grading page now says "Regrade with new rubric (n)" on that card
await go(`${C}/grading`);
await shot("course-grading-regrade-button");

// 5) the assignment's own Grading page: banner + button
await go(`${C}/assignments/${asg}/grading`);
await shot("assignment-grading-banner");

// 6) the grading screen itself: the same banner, with the work as pictures and the three-block score
const grade = page.locator('a[href*="/recheck"]').first();
await grade.click();
await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(1500);
await shot("grading-screen-banner");

// 7) press it: what will be regraded, with which rubric
await page.getByTestId("regrade-new-rubric").click();
await page.getByRole("dialog").waitFor();
await shot("regrade-preview-popup");

// 8) confirm: the AI grades again under the new rubric, the banner disappears
await page.getByTestId("ai-preview-confirm").click();
await page.getByTestId("regrade-banner").waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
await shot("grading-screen-after-regrade");
await go(`${C}/assignments/${asg}/grading`);
await shot("assignment-grading-after-regrade");

await browser.close();
console.log("assignment:", asg, "points", old, "->", old + 2);

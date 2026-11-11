// Before | After for the grading-flow changes of 10/11/2569 (course Grading cards, the grading screen, Pending in the primary colour).
// BEFORE = last commit (git worktree on `next dev --webpack -p 3002`), AFTER = this tree on :3000.  Output (git-ignored): report-ui/fixes-9-nov/*.png
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(path.resolve("node_modules/@playwright/test"));

const AFTER = process.env.AFTER ?? "http://localhost:3000";
const BEFORE = process.env.BEFORE ?? "http://localhost:3002";
const OUT = path.resolve("report-ui/grading-10-nov");
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
if (!ONLY) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT + "/parts", { recursive: true });
const DOC = fs.readFileSync("test-data/seed-commands.txt", "utf8").split(/\r?\n/);
function commandAfter(label) {
  const i = DOC.findIndex((l) => l.startsWith(label));
  const j = DOC.findIndex((l, k) => k > i && /-en\.json/.test(l) && /^(fetch\(|const get=)/.test(l));
  if (i < 0 || j < 0) throw new Error("no command " + label);
  return DOC[j];
}
const SEED = ["[2]", "[10]", "[14]", "[15]", "[16]", "[21]"].map(commandAfter);
const USERS = {
  teacher: { name: "ชมพูนุท เต็งเจริญ", email: "chompoonuch.te@kmitl.ac.th", role: "teacher" },
  student: { name: "สมชาย ใจดี", email: "69070101@kmitl.ac.th", role: "student", studentId: "69070101" },
  admin: { name: "Admin", email: "admin@kmitl.ac.th", role: "admin" },
};
const C = "/teacher/courses/c-mock-4", A = `${C}/assignments/a-uxui-13`;
const grid = (p, text) => p.locator(`text=${text}`).first().locator("xpath=ancestor::div[contains(@class,'grid')][1]");

// [id, who, url, caption, async (page) => ({ loc } | { clip }), optional prep(page)]
const SHOTS = [
  ["01-course-grading", "teacher", `${C}/grading`, "Course Grading: one stat card per assignment (was a list row), the whole card opens its grading page", async () => ({ clip: { x: 234, y: 240, width: 1246, height: 660 } })],
  ["02-grading-screen", "teacher", null, "Grading screen: thumbnails for what was submitted, a link preview card, the three-block score and the status chip, icon zoom buttons", async () => ({ clip: { x: 234, y: 63, width: 1246, height: 837 } }),
    async (p) => { await p.locator('a[href*="/recheck"]').first().click(); await p.waitForURL(/recheck/, { timeout: 30000 }); await p.waitForLoadState("networkidle").catch(() => {}); await p.waitForTimeout(2500); }, `${A}/grading`],
  ["03-score-book-pending", "teacher", `${C}/results`, "Score Book: Pending is the primary colour (teal), Missing stays red", async () => ({ clip: { x: 240, y: 400, width: 1240, height: 420 } })],
];

const browser = await chromium.launch();
async function capture(base, tag) {
  const ctx = await browser.newContext({ viewport: { width: 1480, height: 900 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(s); }); });
  const page = await ctx.newPage();
  await page.goto(`${base}/login`);
  await page.evaluate(() => localStorage.clear());
  for (const cmd of SEED) {
    const js = cmd.replace(/location\.reload\(\);/g, "").trim().replace(/;$/, "");
    await page.evaluate(js.startsWith("fetch(") ? `(async () => { await (${js}); })()` : `(async () => { ${js}; })()`);
    await page.waitForTimeout(1300);
  }
  await page.evaluate(() => { localStorage.setItem("hwai_lang", "en"); localStorage.setItem("hwai_nav_theme", "teal"); });
  for (const [id, who, url0, , find, prep, url1] of SHOTS) {
    const url = url0 ?? url1;
    if (ONLY && !ONLY.includes(id)) continue;
    try {
      await page.evaluate((u) => { if (u) localStorage.setItem("hwai_user", JSON.stringify(u)); else localStorage.removeItem("hwai_user"); }, who ? USERS[who] : null);
      await page.goto(`${base}${url}`);
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(1500);
      if (prep) await prep(page);
      const t = await find(page);
      const file = `${OUT}/parts/${id}-${tag}.png`;
      if (t.loc) { await t.loc.scrollIntoViewIfNeeded(); await t.loc.screenshot({ path: file }); } else await page.screenshot({ path: file, clip: t.clip });
    } catch (e) { console.log("skip", id, tag, String(e).split("\n")[0].slice(0, 90)); }
  }
  await ctx.close();
}
await capture(BEFORE, "before");
await capture(AFTER, "after");

const composer = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
const b64 = (f) => (fs.existsSync(f) ? "data:image/png;base64," + fs.readFileSync(f).toString("base64") : "");
const done = [];
for (const [id, , , caption] of SHOTS) {
  if (ONLY && !ONLY.includes(id)) continue;
  const bf = `${OUT}/parts/${id}-before.png`, af = `${OUT}/parts/${id}-after.png`;
  if (!fs.existsSync(bf) || !fs.existsSync(af)) { console.log("no pair", id); continue; }
  await composer.setContent(`<body style="margin:0;background:#EEF2F7;font-family:'Prompt','Leelawadee UI',Tahoma,sans-serif;color:#1A2D45">
  <div style="padding:20px 28px 4px;font-size:19px;font-weight:700">${caption}</div>
  <div style="display:flex;flex-direction:column;gap:10px;padding:8px 28px 22px">
    ${["before", "after"].map((t) => `<div><div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin:0 0 4px;color:${t === "before" ? "#8C2535" : "#1A6645"}">${t === "before" ? "Before (last commit)" : "After"}</div>
    <img src="${b64(t === "before" ? bf : af)}" style="max-width:1440px;max-height:560px;border:1px solid #C8D6E0;border-radius:8px;display:block;background:#fff"/></div>`).join("")}
  </div></body>`);
  await composer.waitForTimeout(250);
  await composer.screenshot({ path: `${OUT}/${id}.png`, fullPage: true });
  done.push(id);
}
await browser.close();
console.log(done.join("\n"));

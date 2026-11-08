// Before | After for every fix of 9/11/2569 (login panel, Score Book line, icon meaning, outline-only icons, drop areas …).
// BEFORE = last commit (git worktree on `next dev --webpack -p 3002`), AFTER = this tree on :3000.  Output (git-ignored): report-ui/fixes-9-nov/*.png
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(path.resolve("node_modules/@playwright/test"));

const AFTER = process.env.AFTER ?? "http://localhost:3000";
const BEFORE = process.env.BEFORE ?? "http://localhost:3002";
const OUT = path.resolve("report-ui/fixes-9-nov");
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
  ["01-login-panel", null, "/login", "Login: the big faint mark in the corner of the brand panel is gone", async () => ({ clip: { x: 0, y: 0, width: 640, height: 470 } })],
  ["02-score-book-line", "teacher", `${C}/results`, "Score Book: the line before the first assignment is 1px in the Class average row too (was 2px there only)",
    async (p) => { const l = p.locator("main tfoot"); await l.scrollIntoViewIfNeeded(); const b = await l.boundingBox(); return { clip: { x: Math.max(0, b.x), y: Math.max(0, b.y - 70), width: 720, height: 130 } }; }],
  ["03-avg-score-card-grading", "teacher", `${A}/grading`, "Grading page, summary cards: the Avg. Score star is an outline like the other three icons", async (p) => ({ loc: grid(p, "AVG. SCORE") })],
  ["04-avg-score-card-results", "teacher", `${A}/results`, "Results page, summary cards: same four cards", async (p) => ({ loc: grid(p, "AVG. SCORE") })],
  ["05-ai-rubric-buttons", "teacher", `${C}/assignments/new`, "New assignment: the AI Rubric Assistant star is an outline; Import Rubric is an upload arrow (was a download arrow)",
    async (p) => { const l = p.getByRole("button", { name: /AI Rubric Assistant/i }).first(); await l.scrollIntoViewIfNeeded(); const b = await l.boundingBox(); return { clip: { x: Math.max(0, b.x - 20), y: Math.max(0, b.y - 18), width: 760, height: b.height + 36 } }; }],
  ["06-assignment-menu", "teacher", `${C}/assignments`, "Assignments list: the ⋮ menu is an outline glyph (was filled)",
    async (p) => { const l = p.getByRole("button", { name: /Actions/i }).first(); await l.scrollIntoViewIfNeeded(); const b = await l.boundingBox(); return { clip: { x: Math.max(0, b.x - 700), y: Math.max(0, b.y - 40), width: 760, height: 110 } }; }],
  ["07-curriculum-rows", "admin", "/admin/curriculum", "Curriculum: a course-template row deletes with the red bin (was a red cross), Import CSV is an upload arrow",
    async (p) => ({ clip: { x: 240, y: 380, width: 1240, height: 400 } }), async (p) => { await p.getByText(/Revised 2568/).first().click(); await p.waitForTimeout(900); }],
  ["08-import-drop-area", "admin", "/admin/curriculum", "Import popup: the drop area's icon is an upload arrow in a tile, the template is a download arrow",
    async () => ({ clip: { x: 380, y: 140, width: 720, height: 620 } }),
    async (p) => { await p.getByText(/Revised 2568/).first().click(); await p.waitForTimeout(900); await p.getByRole("button", { name: "Import CSV" }).first().click(); await p.waitForTimeout(700); }],
  ["09-admin-edit-row", "admin", "/admin/users", "Admin users, a row being edited: Cancel is a plain cross (was red)",
    async (p) => ({ loc: p.locator("tr", { has: p.getByRole("button", { name: /^Cancel$/ }) }).first() }),
    async (p) => { await p.getByRole("button", { name: /^Edit /i }).first().click(); await p.waitForTimeout(600); }],
  ["10-score-book-export", "teacher", `${C}/results`, "Score Book: Export CSV is the download arrow (was a file-with-arrow)", async () => ({ clip: { x: 240, y: 80, width: 1240, height: 160 } })],
  ["11-roster-import", "teacher", `${C}/students`, "Roster: Import is the upload arrow (was a file-plus)", async () => ({ clip: { x: 240, y: 80, width: 1240, height: 200 } })],
  ["12-assignment-form-icons", "teacher", `${C}/assignments/new`, "New assignment: section icons are --accent (were the pale --accent-bright)", async () => ({ clip: { x: 240, y: 280, width: 1240, height: 120 } })],
  ["13-student-greeting", "student", "/student", "Student home: the 👋 emoji is gone", async () => ({ clip: { x: 240, y: 60, width: 1240, height: 120 } })],
  ["14-top-bar-role-switcher", "teacher", "/teacher/courses", "Top bar: the role switcher's chevron is an outline glyph (was marked filled)", async () => ({ clip: { x: 760, y: 0, width: 720, height: 64 } })],
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
  for (const [id, who, url, , find, prep] of SHOTS) {
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

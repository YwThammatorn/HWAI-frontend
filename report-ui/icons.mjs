// Before | After pictures of the icon work (23/10/2569) + a sheet of the shared icon set.
// Output: report-ui/icons-23-oct/compare/*.png and 00-icon-set.png (git-ignored, like the decks).
//   AFTER  = this working tree, served by `next dev` on :3000   (ICONS_AFTER)
//   BEFORE = the last commit (git worktree at .before), served by `next dev -p 3002`   (ICONS_BEFORE)
// Both servers load the same committed English mock, so only the code differs. No real student appears (command [24] is never run).
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const AFTER = process.env.ICONS_AFTER ?? "http://localhost:3000";
const BEFORE = process.env.ICONS_BEFORE ?? "http://localhost:3002";
const OUT = path.resolve("report-ui/icons-23-oct");
const PARTS = OUT + "/parts", COMPARE = OUT + "/compare";
fs.mkdirSync(PARTS, { recursive: true }); fs.mkdirSync(COMPARE, { recursive: true });
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
  student: { name: "สมชาย ใจดี", email: "69070101@kmitl.ac.th", role: "student", studentId: "69070101" },
  admin: { name: "Admin", email: "admin@kmitl.ac.th", role: "admin" },
};
const U = "c-mock-4";
// name, who, url, what to crop at 2x (a CSS selector) or null for the whole viewport
const PAGES = [
  ["01-top-bar", "teacher", "/teacher/courses", { x: 0, y: 0, width: 1480, height: 64 }, "Top bar: the logo is one component now (was copied into 7 places); avatar colours come from tokens"],
  ["02-sign-in", null, "/login", { x: 0, y: 0, width: 700, height: 420 }, "Sign-in, brand panel"],
  ["03-stat-cards", "teacher", `/teacher/courses/${U}/assignments/a-uxui-13/grading`, { x: 240, y: 190, width: 1230, height: 190 }, "Stat cards: icon sizes now come from the scale (lg 20 / sm 14)"],
  ["04-queue-rows", "teacher", `/teacher/courses/${U}/grading`, { x: 240, y: 120, width: 1230, height: 480 }, "Grading queue: stat-card icons, type badges (10 → 12 px), buttons"],
  ["05-roster-header", "teacher", `/teacher/courses/${U}/students`, { x: 240, y: 150, width: 1230, height: 330 }, "Roster: sortable headers use the shared arrow icons (stroke 3 → 2)"],
  ["06-my-courses", "teacher", "/teacher/courses", { x: 240, y: 90, width: 700, height: 460 }, "Course card: the course icon is a glyph of the shared set"],
  ["07-teacher-sidebar", "teacher", `/teacher/courses/${U}`, "aside", "Teacher sidebar (zoom): a CSS override drew every item icon at 18px whatever size it asked for; now the size prop decides (16)"],
  ["08-student-sidebar", "student", `/student/courses/${U}/classwork`, "aside", "Student sidebar (zoom): same fix — sub-item icons asked for 14px and were drawn at 18px"],
  ["09-admin-sidebar", "admin", "/admin/users", "aside", "Admin sidebar (zoom): was an explicit 18px, now 16 like the other two"],
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
    await page.waitForTimeout(1500);
  }
  await page.evaluate(() => { localStorage.setItem("hwai_lang", "en"); localStorage.setItem("hwai_nav_theme", "teal"); });
  for (const [name, who, url, crop] of PAGES) {
    await page.evaluate((u) => { if (u) localStorage.setItem("hwai_user", JSON.stringify(u)); else localStorage.removeItem("hwai_user"); }, who ? USERS[who] : null);
    await page.goto(`${base}${url}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1200);
    const file = `${PARTS}/${name}-${tag}.png`;
    if (typeof crop === "string") {
      await page.locator(crop).first().screenshot({ path: file });
    } else {
      await page.screenshot({ path: file, clip: crop });
    }
  }
  await ctx.close();
}

await capture(BEFORE, "before");
await capture(AFTER, "after");

// ── compose each pair: BEFORE | AFTER ──
const composer = await (await browser.newContext({ viewport: { width: 1800, height: 1000 } })).newPage();
const b64 = (f) => "data:image/png;base64," + fs.readFileSync(f).toString("base64");
for (const [name, , , crop, caption] of PAGES) {
  const zoom = typeof crop === "string";
  const html = `<body style="margin:0;background:#EEF2F7;font-family:'Prompt','Leelawadee UI',Tahoma,sans-serif;color:#1A2D45">
  <div style="padding:22px 28px 6px;font-size:22px;font-weight:700">${caption}</div>
  <div style="display:flex;flex-direction:${zoom ? "row" : "column"};gap:${zoom ? 24 : 14}px;padding:12px 28px 28px;align-items:${zoom ? "flex-start" : "stretch"};justify-content:${zoom ? "center" : "flex-start"}">
    ${["before", "after"].map((t) => `<div>
      <div style="font-size:14px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin:0 0 6px;color:${t === "before" ? "#8C2535" : "#1A6645"}">${t === "before" ? "Before (last commit)" : "After (central Icon)"}</div>
      <img src="${b64(`${PARTS}/${name}-${t}.png`)}" style="${zoom ? "max-height:760px;" : "width:100%;max-width:1700px;"}border:1px solid #C8D6E0;border-radius:8px;display:block;background:#fff"/>
    </div>`).join("")}
  </div></body>`;
  await composer.setContent(html);
  await composer.waitForTimeout(300);
  await composer.screenshot({ path: `${COMPARE}/${name}.png`, fullPage: true });
}

// ── the shared icon set, drawn from components/Icon.tsx itself ──
const src = fs.readFileSync("src/components/Icon.tsx", "utf8");
const block = src.slice(src.indexOf("const ICONS = {") + 15, src.indexOf("} satisfies Record"));
const keys = [...block.matchAll(/^  "?([\w-]+)"?: /gm)];
const icons = keys.map((k, i) => {
  const body = block.slice(k.index + k[0].length, i + 1 < keys.length ? keys[i + 1].index : block.length).trim().replace(/,\s*$/, "");
  return [k[1], body.replace(/^\(\s*/, "").replace(/\s*\)$/, "").replace(/<>|<\/>/g, "").replace(/\{[^}]*\}/g, "")];
});
const cell = ([n, svg]) => `<div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 4px;border:1px solid #E0E8F0;border-radius:10px;background:#fff">
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1A2D45" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svg}</svg>
  <span style="font-size:11px;color:#4A6478">${n}</span></div>`;
const sizes = [["xs", 12], ["sm", 14], ["md", 16], ["lg", 20], ["xl", 24]];
const checkSvg = '<polyline points="20 6 9 17 4 12" />';
await composer.setViewportSize({ width: 1500, height: 900 });
await composer.setContent(`<body style="margin:0;padding:28px;background:#EEF2F7;font-family:'Prompt','Leelawadee UI',Tahoma,sans-serif;color:#1A2D45">
  <div style="font-size:24px;font-weight:700">The shared icon set — ${icons.length} glyphs, one component (components/Icon.tsx)</div>
  <div style="margin:6px 0 18px;color:#4A6478;font-size:15px">24 grid · outline · stroke 2 · round caps · colour from the text colour</div>
  <div style="display:grid;grid-template-columns:repeat(12,1fr);gap:8px">${icons.map(cell).join("")}</div>
  <div style="display:flex;gap:40px;margin-top:26px">
    <div style="background:#fff;border:1px solid #E0E8F0;border-radius:10px;padding:16px 20px">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px;text-transform:uppercase;letter-spacing:.06em">Five sizes</div>
      <div style="display:flex;gap:26px;align-items:flex-end">${sizes.map(([n, px]) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px"><svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="#0F766E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${checkSvg}</svg><span style="font-size:12px;color:#4A6478">${n} · ${px}px</span></div>`).join("")}</div>
    </div>
    <div style="background:#fff;border:1px solid #E0E8F0;border-radius:10px;padding:16px 20px">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px;text-transform:uppercase;letter-spacing:.06em;color:#8C2535">Before: five stroke widths for the same glyph</div>
      <div style="display:flex;gap:22px;align-items:flex-end">${[1.5, 1.8, 2, 2.5, 3].map((w) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1A2D45" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${checkSvg}</svg><span style="font-size:12px;color:#4A6478">${w}</span></div>`).join("")}</div>
    </div>
    <div style="background:#fff;border:1px solid #E0E8F0;border-radius:10px;padding:16px 20px">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px;text-transform:uppercase;letter-spacing:.06em;color:#1A6645">After: always 2</div>
      <div style="display:flex;gap:22px;align-items:flex-end">${[2, 2, 2, 2, 2].map((w) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1A2D45" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${checkSvg}</svg><span style="font-size:12px;color:#4A6478">${w}</span></div>`).join("")}</div>
    </div>
  </div></body>`);
await composer.waitForTimeout(300);
await composer.screenshot({ path: `${COMPARE}/00-icon-set.png`, fullPage: true });
await browser.close();
console.log("done", fs.readdirSync(COMPARE));

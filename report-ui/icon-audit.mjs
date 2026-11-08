// Every icon the app draws, laid out side by side (9/11/2569): walks the screens of all three roles on the committed English mock,
// records each <Icon> (name, size, colour token, filled, what it sits in) and saves one picture of its surroundings per distinct look.
// Output (git-ignored): report-ui/icon-audit-9-nov/ — usage.json, crops/*.png, sheet-*.png.   Needs `next dev` on :3000.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(path.resolve("node_modules/@playwright/test"));

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = path.resolve("report-ui/icon-audit-9-nov");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT + "/crops", { recursive: true });

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
const C = "c-mock-4", A = "a-uxui-13";
// [role, url, optional steps: list of button/tab names to click one by one (each shown, then Escape)]
const PAGES = [
  [null, "/login", []], [null, "/register", []],
  ["admin", "/admin/users", ["Import CSV", "Add"]], ["admin", "/admin/courses", ["Add Course", "New Course"]], ["admin", "/admin/curriculum", ["@open", "Import CSV", "New Curriculum"]],
  ["teacher", "/teacher/courses", []], ["teacher", "/teacher/courses/new", []],
  ["teacher", `/teacher/courses/${C}`, []], ["teacher", `/teacher/courses/${C}/announcements`, ["New", "Add"]],
  ["teacher", `/teacher/courses/${C}/assignments`, []], ["teacher", `/teacher/courses/${C}/assignments/${A}`, []],
  ["teacher", `/teacher/courses/${C}/assignments/${A}/edit`, []], ["teacher", `/teacher/courses/${C}/assignments/${A}/grading`, []],
  ["teacher", `/teacher/courses/${C}/assignments/${A}/results`, []], ["teacher", `/teacher/courses/${C}/assignments/new`, []],
  ["teacher", `/teacher/courses/${C}/calibration`, []], ["teacher", `/teacher/courses/${C}/clo`, ["Add", "New"]],
  ["teacher", `/teacher/courses/${C}/collaborators`, []], ["teacher", `/teacher/courses/${C}/grading`, ["Grade with AI"]],
  ["teacher", `/teacher/courses/${C}/grading-split`, []], ["teacher", `/teacher/courses/${C}/materials`, ["Add", "New"]],
  ["teacher", `/teacher/courses/${C}/results`, []], ["teacher", `/teacher/courses/${C}/rubrics`, []],
  ["teacher", `/teacher/courses/${C}/settings`, []], ["teacher", `/teacher/courses/${C}/students`, ["Import", "Add Student"]],
  ["teacher", `/teacher/courses/${C}/weekly-plan`, ["Add", "New"]],
  ["student", "/student", []], ["student", "/student/courses", []], ["student", `/student/courses/${C}`, []],
  ["student", `/student/courses/${C}/announcements`, []], ["student", `/student/courses/${C}/classwork`, []],
  ["student", `/student/courses/${C}/evaluation`, []], ["student", `/student/courses/${C}/materials`, []],
  ["student", `/student/courses/${C}/weekly-plan`, []],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1480, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(s); }); });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`);
await page.evaluate(() => localStorage.clear());
for (const cmd of SEED) {
  const js = cmd.replace(/location\.reload\(\);/g, "").trim().replace(/;$/, "");
  await page.evaluate(js.startsWith("fetch(") ? `(async () => { await (${js}); })()` : `(async () => { ${js}; })()`);
  await page.waitForTimeout(1200);
}
await page.evaluate(() => { localStorage.setItem("hwai_lang", "en"); localStorage.setItem("hwai_nav_theme", "teal"); });

const usage = [];           // every icon found: {page, state, name, px, color, filled, kind, ...}
const seenLook = new Map();  // signature -> crop file
let cropN = 0;

/** read every visible <Icon>; mark an ancestor to crop; returns the rows */
async function collect(pageName, state) {
  const rows = await page.evaluate(() => {
    document.querySelectorAll("[data-aud]").forEach((e) => e.removeAttribute("data-aud"));
    const probe = document.createElement("i"); document.body.appendChild(probe);
    const tokens = {};
    for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch { continue; } for (const r of rules) { if (r.selectorText === ":root" || r.selectorText === ":root:not([data-theme=\"dark\"])") for (const p of r.style) if (p.startsWith("--")) tokens[p] = true; } }
    const rgbToTok = {};
    for (const t of Object.keys(tokens)) { probe.style.color = ""; probe.style.color = `var(${t})`; const c = getComputedStyle(probe).color; if (c && c.startsWith("rgb")) (rgbToTok[c] = rgbToTok[c] || []).push(t); }
    probe.remove();
    const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && !el.closest("[hidden]"); };
    const out = [];
    [...document.querySelectorAll("svg[data-icon]")].filter(vis).forEach((el, i) => {
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      const btn = el.closest("button"), link = el.closest("a");
      const par = el.parentElement, pcs = getComputedStyle(par), pr = par.getBoundingClientRect();
      const bg = pcs.backgroundColor;
      const tile = bg !== "rgba(0, 0, 0, 0)" && parseFloat(pcs.borderTopLeftRadius) > 0 && pr.width <= 64 && pr.height <= 64 && !btn && !link;
      let anc = el, lvl = 0;
      while (anc.parentElement && lvl < 5) { const ar = anc.getBoundingClientRect(); if (ar.width >= 150 && ar.height >= 34) break; anc = anc.parentElement; lvl++; }
      let ar = anc.getBoundingClientRect(); if (ar.width > 640 || ar.height > 220) { anc = anc.firstElementChild?.contains(el) ? anc.firstElementChild : el.parentElement; ar = anc.getBoundingClientRect(); }
      el.setAttribute("data-aud", String(i)); anc.setAttribute("data-aud-ctx", String(i));
      out.push({
        i, name: el.getAttribute("data-icon"), px: Math.round(r.width), color: cs.color, tok: (rgbToTok[cs.color] || ["?"]).join(" "), filled: cs.fill !== "none",
        kind: btn ? "button" : link ? "link" : tile ? "tile" : "bare", tileBg: tile ? bg : "", tileTok: tile ? (rgbToTok[bg] || ["?"]).join(" ") : "",
        tilePx: tile ? Math.round(pr.width) : 0, text: (anc.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
      });
    });
    return out;
  });
  for (const r of rows) {
    r.page = pageName; r.state = state;
    const sig = [r.name, r.px, r.tok, r.filled, r.kind, r.tileTok, r.tilePx].join("|");
    r.sig = sig;
    if (!seenLook.has(sig)) {
      const file = `crops/${String(++cropN).padStart(3, "0")}.png`;
      try { await page.locator(`[data-aud-ctx="${r.i}"]`).first().screenshot({ path: `${OUT}/${file}`, timeout: 4000 }); seenLook.set(sig, file); } catch { seenLook.set(sig, ""); }
    }
    usage.push(r);
  }
}

async function visit([who, url, steps]) {
  await page.evaluate((u) => { if (u) localStorage.setItem("hwai_user", JSON.stringify(u)); else localStorage.removeItem("hwai_user"); }, who ? USERS[who] : null);
  await page.goto(`${BASE}${url}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1300);
  await collect(url, "page");
  for (const s of steps) {
    try {
      if (s === "@open") { await page.getByText(/Revised 2568/).first().click({ timeout: 2000 }); await page.waitForTimeout(700); await collect(url, "open"); continue; }
      const b = page.getByRole("button", { name: new RegExp("^" + s, "i") }).first();
      if (!(await b.count())) continue;
      await b.click({ timeout: 2000 }); await page.waitForTimeout(800);
      await collect(url, `after "${s}"`);
      await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    } catch { /* a step that does not exist on this screen */ }
  }
  return page.url();
}
for (const p of PAGES) { try { await visit(p); } catch (e) { console.log("skip", p[1], String(e).slice(0, 80)); } }

// screens that need a real id taken from a link
async function viaLink(who, from, hrefPart, label) {
  await page.evaluate((u) => localStorage.setItem("hwai_user", JSON.stringify(u)), USERS[who]);
  await page.goto(`${BASE}${from}`); await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(1000);
  const href = await page.locator(`a[href*="${hrefPart}"]`).first().getAttribute("href").catch(() => null);
  if (!href) { console.log("no link", label); return; }
  await page.goto(`${BASE}${href}`); await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(1300);
  await collect(href, "page");
}
await viaLink("teacher", `/teacher/courses/${C}/assignments/${A}/grading`, "/recheck", "recheck");
await viaLink("student", `/student/courses/${C}/classwork`, "/classwork/", "student classwork detail");
await browser.close();

fs.writeFileSync(OUT + "/usage.json", JSON.stringify({ usage, looks: [...seenLook] }, null, 1));
console.log("icons seen:", usage.length, "distinct looks:", seenLook.size, "names:", new Set(usage.map((u) => u.name)).size);

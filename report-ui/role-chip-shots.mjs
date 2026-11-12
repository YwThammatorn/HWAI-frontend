// Pictures of the top bar's role chip for every role (11/11/2569): teacher (a menu), student / admin (a badge), TA hat; light page, 2x. Output: report-ui/shots-role-chip/
//   node report-ui/role-chip-shots.mjs <base-url> [out-dir]      (production server)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = path.resolve(process.argv[3] ?? "report-ui/shots-role-chip"); fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 400 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const as = async (u, url) => {
  await page.goto(`${BASE}/login`);
  await page.evaluate((x) => { localStorage.setItem("hwai_user", JSON.stringify(x)); localStorage.setItem("hwai_lang", "en"); }, u);
  await page.goto(`${BASE}${url}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(600);
};
const top = { x: 1000, y: 0, width: 600, height: 80 };
for (const [name, u, url] of [
  ["teacher", { name: "Chompoonuch Te", email: "chompoonuch.te@kmitl.ac.th", role: "teacher" }, "/teacher/courses"],
  ["student", { name: "Somchai", email: "69070101@kmitl.ac.th", role: "student", studentId: "69070101" }, "/student"],
  ["admin", { name: "Dev Admin", email: "admin@kmitl.ac.th", role: "admin" }, "/admin"],
]) { await as(u, url); await page.screenshot({ path: path.join(OUT, `${name}.png`), clip: top }); }
await browser.close();
console.log("done");

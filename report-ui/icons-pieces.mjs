// Screenshots of the shared pieces in use (IconTile, IconButton, Avatar, StatCard / MetricCard, EmptyState, Pagination) on the current tree.
// Output: report-ui/icons-23-oct/pieces/*.png (git-ignored). Needs `next dev` on :3000 (ICONS_AFTER).
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const AFTER = process.env.ICONS_AFTER ?? "http://localhost:3000";
const OUT = path.resolve("report-ui/icons-23-oct/pieces");
fs.mkdirSync(OUT, { recursive: true });
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
// name, who, url, clip (CSS px) , note
const SHOTS = [
  ["01-course-overview-strip", "teacher", `/teacher/courses/${U}`, { x: 240, y: 330, width: 1230, height: 260 }],
  ["02-assignment-cards", "teacher", `/teacher/courses/${U}/assignments/a-uxui-13/grading`, { x: 240, y: 190, width: 1230, height: 190 }],
  ["03-queue-cards-and-buttons", "teacher", `/teacher/courses/${U}/grading`, { x: 240, y: 120, width: 1230, height: 560 }],
  ["04-roster-avatars-actions", "teacher", `/teacher/courses/${U}/students`, { x: 240, y: 150, width: 1230, height: 520 }],
  ["05-collaborators", "teacher", `/teacher/courses/${U}/collaborators`, { x: 240, y: 90, width: 1230, height: 560 }],
  ["06-admin-users", "admin", "/admin/users", { x: 0, y: 60, width: 1480, height: 700 }],
  ["07-admin-dashboard-cards", "admin", "/admin", { x: 0, y: 60, width: 1480, height: 360 }],
  ["08-student-courses", "student", "/student/courses", { x: 0, y: 60, width: 1480, height: 520 }],
  ["09-notifications", "teacher", "/teacher/notifications", { x: 240, y: 60, width: 1230, height: 640 }],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1480, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(s); }); });
const page = await ctx.newPage();
await page.goto(`${AFTER}/login`);
await page.evaluate(() => localStorage.clear());
for (const cmd of SEED) {
  const js = cmd.replace(/location\.reload\(\);/g, "").trim().replace(/;$/, "");
  await page.evaluate(js.startsWith("fetch(") ? `(async () => { await (${js}); })()` : `(async () => { ${js}; })()`);
  await page.waitForTimeout(1500);
}
await page.evaluate(() => { localStorage.setItem("hwai_lang", "en"); });
for (const [name, who, url, clip] of SHOTS) {
  await page.evaluate((u) => localStorage.setItem("hwai_user", JSON.stringify(u)), USERS[who]);
  await page.goto(`${AFTER}${url}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${name}.png`, clip });
}
await browser.close();
console.log("done", fs.readdirSync(OUT));

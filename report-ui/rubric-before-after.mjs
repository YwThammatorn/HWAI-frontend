// Before | after contact sheets for the rubric unification (8/11/2569). Needs rubric-views-24-oct/before/*.png (old look) and rubric-views-24-oct/*.png (new).
// Output: rubric-views-24-oct/compare-*.png (git-ignored).
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const D = path.resolve("report-ui/rubric-views-24-oct").split(path.sep).join("/");
// [number, label, where, file, scale, before {x,y,w,h}, after {x,y,w,h}]
const CARDS = [
  [1, "อ่านเกณฑ์: การ์ดระดับ", "อาจารย์ › หน้างาน", "01-teacher-assignment-detail", 0.9, [270, 395, 785, 560], [270, 395, 785, 700]],
  [2, "อ่านเกณฑ์ + สถิติรายระดับ", "อาจารย์ › ตรวจงาน (กางทุกเกณฑ์)", "12-teacher-grading-panel-levels-open", 0.7, [270, 65, 1160, 640], [270, 65, 1160, 640]],
  [3, "เลือกระดับ", "อาจารย์ › ตรวจ/แก้คะแนน", "03-teacher-recheck", 1, [1050, 63, 430, 840], [1050, 63, 430, 840]],
  [4, "เลือกระดับ", "อาจารย์ › ปรับเทียบ AI", "06-teacher-calibration", 1, [1000, 740, 400, 480], [1000, 740, 400, 560]],
  [5, "อ่านเกณฑ์: ของนักศึกษา (ระดับของคุณ)", "นักศึกษา › งานในชั้นเรียน", "08-student-classwork", 0.9, [270, 922, 745, 578], [270, 922, 745, 578]],
  [6, "ตารางย่อใน popup", "Popup ให้ AI ตรวจ", "10-ai-preview-popup", 1, [404, 113, 672, 680], [404, 105, 672, 690]],
  [7, "ตารางย่อใน popup", "Popup สมุดคะแนน", "07-teacher-scorebook-breakdown-popup", 1, [548, 580, 384, 340], [548, 570, 384, 360]],
  [8, "แถบสีระดับในหน้าเทียบ rubric", "อาจารย์ › เกณฑ์การให้คะแนน › เทียบ rubric", "13-teacher-rubric-compare-tab", 2.2, [400, 570, 300, 270], [400, 570, 300, 270]],
];
const crop = (f, s, [x, y, w, h], dir) => `<div style="width:${w * s}px;height:${h * s}px;overflow:hidden;border:1px solid #cbd5e1;border-radius:10px;position:relative;background:#fff"><img src="file:///${D}/${dir}${f}.png" style="position:absolute;left:-${x * s}px;top:-${y * s}px;width:${1480 * s}px"></div>`;
const row = ([n, label, where, f, s, b, a]) => `<section style="margin-bottom:34px"><div style="font:600 19px/1.35 'Noto Sans Thai',system-ui,sans-serif;margin-bottom:8px"><span style="display:inline-block;min-width:30px;padding:2px 9px;border-radius:999px;background:#0f766e;color:#fff;margin-right:8px;text-align:center">${n}</span>${label} <span style="font-weight:400;font-size:15px;color:#475569">· ${where}</span></div><div style="display:flex;gap:24px;align-items:flex-start"><figure style="margin:0"><figcaption style="font:600 14px system-ui;color:#b45309;margin-bottom:4px">ก่อน</figcaption>${crop(f, s, b, "before/")}</figure><figure style="margin:0"><figcaption style="font:600 14px system-ui;color:#0f766e;margin-bottom:4px">หลัง</figcaption>${crop(f, s, a, "")}</figure></div></section>`;
const sheets = { "compare-1-teacher": CARDS.slice(0, 4), "compare-2-student-popups": CARDS.slice(4, 7), "compare-3-compare-tab": CARDS.slice(7) };
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1700, height: 800 } });
for (const [name, cs] of Object.entries(sheets)) {
  if (process.argv[2] && !name.includes(process.argv[2])) continue;       // e.g. `node … compare-3` for one sheet
  fs.writeFileSync(`${D}/${name}.html`, `<body style="margin:0;padding:24px;background:#f1f5f9">${cs.map(row).join("")}</body>`);
  await page.goto(`file:///${D}/${name}.html`);
  await page.waitForLoadState("load"); await page.waitForTimeout(600);
  await page.screenshot({ path: `${D}/${name}.png`, fullPage: true }); console.log(name);
}
await b.close();
for (const n of Object.keys(sheets)) fs.rmSync(`${D}/${n}.html`, { force: true });

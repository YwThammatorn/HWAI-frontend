// Contact sheets of rubric-views-24-oct: each view cropped to the rubric part and numbered (24/10/2569). Output: rubric-views-24-oct/sheet-*.png
import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
const D = path.resolve("report-ui/rubric-views-24-oct").split(path.sep).join("/");
// [number, label, where, file, x, y, w, h]
const CARDS = [
  [1, "การ์ดระดับ 4 ช่อง (เทาล้วน)", "อาจารย์ › หน้างาน (assignment detail)", "01-teacher-assignment-detail", 270, 395, 785, 560],
  [2, "แถบการกระจาย + การ์ดระดับสี (กางออก)", "อาจารย์ › ตรวจงาน (grading detail)", "12-teacher-grading-panel-levels-open", 270, 65, 1160, 640],
  [3, "การ์ดระดับเรียงลงทีละใบ (เลือกได้)", "อาจารย์ › ตรวจ/แก้คะแนน (recheck)", "03-teacher-recheck", 1050, 63, 430, 840],
  [4, "ตารางแก้ไข: 4 ช่องมีจุดสี + ช่องกรอก", "อาจารย์ › สร้าง/แก้งาน (editor)", "11-teacher-editor-rubric-section", 270, 415, 1160, 520],
  [5, "ตาราง: เกณฑ์ | ระดับ ดี › … | คะแนน", "Popup ให้ AI ตรวจ (AI preview)", "10-ai-preview-popup", 404, 113, 672, 680],
  [6, "ตาราง: เกณฑ์ | น้ำหนัก | คะแนน", "Popup สมุดคะแนน (Score Book)", "07-teacher-scorebook-breakdown-popup", 548, 602, 384, 296],
  [7, "แถบความคืบหน้า + การ์ด 2×2 มี “ระดับของคุณ”", "นักศึกษา › งานในชั้นเรียน (classwork)", "08-student-classwork", 270, 922, 745, 578],
  [8, "การ์ดระดับเรียงลงทีละใบ (ไม่มีสี)", "อาจารย์ › ปรับเทียบ AI (calibration)", "06-teacher-calibration", 1000, 740, 400, 480],
  [9, "รายการสรุป “n เกณฑ์ · n คะแนน · เฉลี่ย %” (ไม่เห็นเกณฑ์)", "Popup ใช้ rubric จากงานก่อนหน้า (picker)", "15-teacher-rubric-picker-popup", 404, 346, 672, 810],
  [10, "รายการสรุปแบบเดียวกัน (ไม่เห็นเกณฑ์)", "อาจารย์ › เกณฑ์การให้คะแนน (library)", "05-teacher-rubric-library", 270, 540, 1160, 440],
];
const card = ([n, label, where, f, x, y, w, h]) => `<figure style="margin:0;width:${w}px"><figcaption style="font:600 18px/1.35 'Noto Sans Thai',system-ui,sans-serif;margin-bottom:8px"><span style="display:inline-block;min-width:30px;padding:2px 9px;border-radius:999px;background:#0f766e;color:#fff;margin-right:8px;text-align:center">${n}</span>${label}<br><span style="font-weight:400;font-size:15px;color:#475569">${where}</span></figcaption><div style="width:${w}px;height:${h}px;overflow:hidden;border:1px solid #cbd5e1;border-radius:10px;position:relative;background:#fff"><img src="file:///${D}/${f}.png" style="position:absolute;left:-${x}px;top:-${y}px"></div></figure>`;
const sheets = { "sheet-1-teacher-pages": CARDS.slice(0, 4), "sheet-2-popups-student": CARDS.slice(4, 7), "sheet-3-calibration-picker-library": CARDS.slice(7) };
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1700, height: 800 } });
for (const [name, cs] of Object.entries(sheets)) {
  fs.writeFileSync(`${D}/${name}.html`, `<body style="margin:0;padding:24px;background:#f1f5f9"><div style="display:flex;flex-wrap:wrap;gap:28px;align-items:flex-start">${cs.map(card).join("")}</div></body>`); await page.goto(`file:///${D}/${name}.html`);
  await page.waitForLoadState("load"); await page.waitForTimeout(500);
  await page.screenshot({ path: `${D}/${name}.png`, fullPage: true }); console.log(name);
}
await b.close();

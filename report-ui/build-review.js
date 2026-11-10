// Review copy of the 3.4 chapter (NOT for the thesis): every figure with a status tag, new text in green, changed words in yellow, removed words in red strikethrough.
// Compares report-ui/build-report.js (now) with the committed version (git HEAD = the 16/10 text), and each new shot with report-ui/shots-16-oct/.
//   NODE_PATH=C:/Users/ASUS/report-tools/node_modules node report-ui/build-review.js <imgdiff.json> [out.docx]
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType } = require("docx");

const root = path.resolve(__dirname, "..");
const NEW_SRC = fs.readFileSync(path.join(__dirname, "build-report.js"), "utf8").replace(/\r\n/g, "\n");
const OLD_SRC = execSync("git show HEAD:report-ui/build-report.js", { cwd: root, maxBuffer: 1 << 26 }).toString("utf8").replace(/\r\n/g, "\n");
const IMGDIFF = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const OUT = path.join(__dirname, process.argv[3] || "HWAI-UI-Report-11-11-changes.docx");
const FONT = "Angsana New";

function parse(src) {
  const items = [];
  const re = /out\.push\((?:\.\.\.figure\("([^"]+)",\s*"([^"]+)",\s*"([^"]*)"\)|(h1|h2|body)\("([^"]*)"(?:, true)?\))\);/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[1]) items.push({ type: "figure", id: m[1], title: m[2], text: m[3] });
    else items.push({ type: m[4], text: m[5] });
  }
  return items;
}
const newItems = parse(NEW_SRC), oldItems = parse(OLD_SRC);
const ID_OLD = { "teacher-08b-grading-student-detail": "teacher-08b-grade-adjustment", "teacher-09-rubric-tab": "teacher-09-rubric-card", "teacher-20d-edit-rubric-popup": "teacher-20c-edit-rubric-popup" };
const OLD_ID_SHOT = (id) => ID_OLD[id] || id;
const oldFig = new Map(oldItems.filter((x) => x.type === "figure").map((x) => [x.id, x]));
const oldTexts = oldItems.filter((x) => x.type !== "figure").map((x) => x.text);

const seg = new Intl.Segmenter("th", { granularity: "word" });
const words = (t) => [...seg.segment(t)].map((x) => x.segment);
// LCS word diff → [{t, kind: "same"|"add"|"del"}]
function diff(a, b) {
  const A = words(a), B = words(b), n = A.length, m = B.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ t: A[i], k: "same" }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) { out.push({ t: A[i], k: "del" }); i++; }
    else { out.push({ t: B[j], k: "add" }); j++; }
  }
  while (i < n) out.push({ t: A[i++], k: "del" });
  while (j < m) out.push({ t: B[j++], k: "add" });
  return out;
}
const merge = (parts) => { const r = []; for (const p of parts) { const l = r[r.length - 1]; if (l && l.k === p.k) l.t += p.t; else r.push({ ...p }); } return r; };

const SZ = 34;
const tr = (text, o = {}) => new TextRun({ text, font: FONT, size: SZ, ...o });
const para = (children, o = {}) => new Paragraph({ children, spacing: { after: 100, line: 300 }, ...o });
const diffRuns = (a, b) => merge(diff(a, b)).map((p) => p.k === "same" ? tr(p.t) : p.k === "add" ? tr(p.t, { highlight: "yellow" }) : tr(p.t, { strike: true, color: "C00000" }));
const tag = (text, hl) => tr(` ${text} `, { bold: true, highlight: hl, size: 30 });

function imgStatus(id) {
  const d = IMGDIFF[id];
  if (d === null || d === undefined) return { label: "ภาพใหม่", hl: "green", rank: 3 };
  if (d >= 1) return { label: "หน้าจอเปลี่ยนเกือบทั้งหน้า (UI ใหม่)", hl: "red", rank: 3 };
  if (d >= 0.1) return { label: `ภาพต่างมาก (${Math.round(d * 100)}% ของพิกเซล)`, hl: "yellow", rank: 2 };
  if (d >= 0.02) return { label: `ภาพต่างเล็กน้อย (${(d * 100).toFixed(0)}%) เช่น ไอคอน/ระยะห่าง/ข้อมูล`, hl: "lightGray", rank: 1 };
  return { label: "ภาพเกือบเหมือนเดิม", hl: null, rank: 0 };
}

const out = [];
const stats = { newFig: [], rewritten: [], textSame: [], imgBig: [], imgSmall: [], imgSame: [] };
let fig = 1;
const blocks = [];

for (const it of newItems) {
  if (it.type === "h1" || it.type === "h2") { blocks.push(para([tr(it.text, { bold: true, size: 40 })], { spacing: { before: 280, after: 120 } })); continue; }
  if (it.type === "body") {
    const same = oldTexts.includes(it.text);
    const near = oldItems.find((x) => x.type === "body" && x.text.slice(0, 22) === it.text.slice(0, 22));
    if (same) blocks.push(para([tr(it.text, { color: "808080" })]));
    else if (near) { blocks.push(para([tag("ข้อความส่วนนำ: แก้ไข", "yellow")])); blocks.push(para(diffRuns(near.text, it.text))); stats.rewritten.push("ข้อความส่วนนำของ 3.4 (เพิ่มบทบาท TA และข้อความว่าชื่อเป็นข้อมูลจำลอง)"); }
    else { blocks.push(para([tag("ข้อความ: ใหม่", "green")])); blocks.push(para([tr(it.text, { highlight: "green" })])); stats.rewritten.push("ข้อความเปิดบท 3.4.4 (ใหม่)"); }
    continue;
  }
  // figure
  fig += 1;
  const num = `รูปที่ 3.${fig - 1}`;
  const old = oldFig.get(OLD_ID_SHOT(it.id));
  const st = imgStatus(it.id);
  const head = [tr(`${num} · ${it.title}  `, { bold: true, size: 34 })];
  let textBlock;
  if (!old) { head.push(tag("ข้อความ+ภาพ: ใหม่", "green")); textBlock = para([tr(it.text, { highlight: "green" })]); stats.newFig.push(`${num} ${it.title}`); }
  else if (old.text === it.text) { head.push(tag("ข้อความ: ไม่เปลี่ยน", null)); textBlock = para([tr(it.text, { color: "808080" })]); stats.textSame.push(it.id); }
  else { head.push(tag("ข้อความ: แก้ไข", "yellow")); textBlock = para(diffRuns(old.text, it.text)); stats.rewritten.push(`${num} ${it.title}`); }
  if (old) (st.rank >= 3 ? stats.imgBig : st.rank >= 1 ? stats.imgSmall : stats.imgSame).push(`${num} ${it.title}`);
  blocks.push(para(head, { keepNext: true, spacing: { before: 240, after: 80 } }));
  blocks.push(para([tag("ภาพ: " + st.label, st.hl)], { keepNext: true }));
  blocks.push(textBlock);
  const img = fs.readFileSync(path.join(__dirname, "shots", it.id + ".png"));
  const pw = img.readUInt32BE(16), ph = img.readUInt32BE(20), W = 420;
  blocks.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new ImageRun({ type: "png", data: img, transformation: { width: W, height: Math.round((W * ph) / pw) }, altText: { title: it.title, description: it.title, name: it.id } })] }));
}

const li = (arr) => arr.map((x) => para([tr("• " + x)], { spacing: { after: 40 } }));
const head = [
  para([tr("ไฟล์ตรวจทานการเปลี่ยนแปลงของบท 3.4 (ไม่ใช่ฉบับวางในเล่ม)", { bold: true, size: 44 })]),
  para([tr("เทียบกับฉบับ 16 ต.ค. 2569", { size: 32 })]),
  para([tag("เขียว = ใหม่", "green"), tr("  "), tag("เหลือง = คำที่เพิ่ม/แก้", "yellow"), tr("  "), tr("คำที่ถูกลบ", { strike: true, color: "C00000" }), tr("  "), tr("ตัวอักษรเทา = ข้อความไม่เปลี่ยน", { color: "808080" })]),
  para([tr("หมายเหตุเรื่องภาพ: ทุกภาพถูกแคปใหม่ทั้งหมด (ข้อมูลจำลอง ชื่อนักศึกษา วันที่ และ UI ที่ปรับหลัง 16 ต.ค.) ตัวเลขเปอร์เซ็นต์คือสัดส่วนพิกเซลที่ต่างจากภาพเดิมเทียบแบบหยาบ (วัดจากชุดที่แคปที่ความกว้างเดียวกับภาพเดิมเพื่อไม่ให้ขนาดหน้าจอทำให้เพี้ยน ส่วนภาพในไฟล์นี้เป็นชุดความละเอียดสูงที่ 1600px กว้าง 2 เท่า) ใช้ประกอบการตัดสินใจเท่านั้น ควรเปิดดูภาพจริงของรูปที่ติดป้ายเหลือง/แดง", { color: "595959" })]),
  para([tr("สรุป", { bold: true, size: 38 })], { spacing: { before: 200 } }),
  para([tr(`รูปใหม่ ${stats.newFig.length} รูป`, { bold: true })]), ...li(stats.newFig),
  para([tr(`ข้อความที่เขียนใหม่/แก้ไข ${stats.rewritten.length} จุด`, { bold: true })], { spacing: { before: 120 } }), ...li(stats.rewritten),
  para([tr(`ข้อความเดิม แต่ภาพเปลี่ยนมาก/UI ใหม่ ${stats.imgBig.length} รูป`, { bold: true })], { spacing: { before: 120 } }), ...li(stats.imgBig),
  para([tr(`ข้อความเดิม ภาพต่างเล็กน้อย ${stats.imgSmall.length} รูป · ภาพเกือบเหมือนเดิม ${stats.imgSame.length} รูป`, { bold: true })], { spacing: { before: 120 } }),
];
const doc = new Document({
  creator: "HWAI Agent", title: "ตรวจทานการเปลี่ยนแปลงบท 3.4",
  styles: { default: { document: { run: { font: FONT, size: SZ, language: { value: "th-TH", eastAsia: "th-TH", bidirectional: "th-TH" } } } } },
  sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1200, bottom: 1200, left: 1400, right: 1200 } } }, children: [...head, ...blocks] }],
});
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log("wrote", OUT, (buf.length / 1e6).toFixed(1) + " MB"); console.log(stats.rewritten.join(" ; "), "||", stats.imgBig.join(" ; ")); console.log(JSON.stringify({ new: stats.newFig.length, rewritten: stats.rewritten.length, textSame: stats.textSame.length, imgBig: stats.imgBig.length, imgSmall: stats.imgSmall.length, imgSame: stats.imgSame.length })); });

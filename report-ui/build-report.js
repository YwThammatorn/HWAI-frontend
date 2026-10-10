// Builds report-ui/HWAI-UI-Report.docx — section 3.4 "การออกแบบหน้า UI": one block per role, each figure =
// a short Thai description, the screenshot from shots/, and a caption "รูปที่ 3.N หน้า ...".
//   node report-ui/capture.mjs   (screenshots)   then   node report-ui/build-report.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType, HeadingLevel, PageBreak,
} = require("docx");

const SHOTS = path.join(__dirname, "shots");
// Angsana New ships with Windows/Office, so it renders the same everywhere. It is set once as the document default
// (Normal style) — change it there in Word to switch the whole report to TH SarabunPSK etc.
const FONT = "Angsana New";
const BODY = 36;      // 18 pt (half-points)
const H1 = 40, H2 = 36;

// A4, left margin 3 cm (binding), others 2.54 cm → text width 14.65 cm
const IMG_W = 555, IMG_H = Math.round((555 * 9) / 16);   // screenshots are 16:9 (1600x900 viewport)

// Word only breaks Thai text at spaces unless its Thai dictionary kicks in (it did not when exporting headless), which leaves
// ragged half-empty lines. A zero-width space between words (from ICU's Thai segmenter) gives it break points everywhere.
const seg = new Intl.Segmenter("th", { granularity: "word" });
const breakable = (t) => [...seg.segment(t)].map((x) => x.segment).join("​").replace(/ ​|​ /g, " ");
const run = (text, o = {}) => new TextRun({ text: breakable(text), ...o });
const hrun = (text, size) => new TextRun({ text: breakable(text), font: FONT, size, bold: true, color: "000000" });
const body = (text, keepNext = false) => new Paragraph({
  keepNext, keepLines: true, children: [run(text)], alignment: AlignmentType.LEFT, indent: { firstLine: 720 }, spacing: { after: 120, line: 320 },
});
const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [hrun(text, H1)], spacing: { before: 240, after: 120 }, keepNext: true });
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [hrun(text, H2)], indent: { left: 360 }, spacing: { before: 240, after: 120 }, keepNext: true });

let fig = 0;
function figure(file, title, text) {
  fig += 1;
  const img = fs.readFileSync(path.join(SHOTS, file + ".png"));
  return [
    body(text, true),   // keep the description on the same page as its screenshot
    new Paragraph({
      alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 60 },
      children: [new ImageRun({ type: "png", data: img, transformation: { width: IMG_W, height: IMG_H }, altText: { title, description: title, name: file } })],
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [run(`รูปที่ 3.${fig} หน้า ${title}`, { bold: true })] }),
  ];
}

const out = [];
out.push(h1("3.4 การออกแบบหน้า UI"));
out.push(body("ระบบ HWAI Agent แบ่งหน้าจอการใช้งานตามบทบาทของผู้ใช้ 3 บทบาท ได้แก่ ผู้ดูแลระบบ (Admin) อาจารย์ (Teacher) และนักศึกษา (Student) โดยแต่ละบทบาทมีเมนูด้านซ้ายและหน้าจอที่ออกแบบให้เหมาะกับหน้าที่ของตนเอง รูปหน้าจอทั้งหมดในหัวข้อนี้แสดงข้อมูลตัวอย่างของวิชา การเขียนโปรแกรมคอมพิวเตอร์ (01076112) ที่มีนักศึกษา 42 คน"));

/* ───────────── Admin ───────────── */
out.push(h2("3.4.1 หน้า UI ของ Admin"));
out.push(body("ผู้ดูแลระบบใช้เมนูด้านซ้าย 3 เมนู ได้แก่ User Management สำหรับจัดการบัญชีอาจารย์และนักศึกษา Courses สำหรับเปิดรายวิชา แบ่งกลุ่ม (section) และมอบหมายอาจารย์ผู้สอน และ Curriculum สำหรับจัดการหลักสูตรและรายวิชาที่เปิดสอนภายใต้แต่ละหลักสูตร"));
out.push(...figure("admin-01-users-teachers", "User Management (Teachers)",
  "หน้า User Management ทำหน้าที่บริหารจัดการบัญชีผู้ใช้ระดับอาจารย์ (Teacher Role) ด้านบนแสดงจำนวนอาจารย์และนักศึกษาทั้งหมดในระบบ ด้านล่างเป็นแท็บ Teachers และ Students ตารางรายชื่ออาจารย์แสดงคำนำหน้า ชื่อ อีเมล และสถานะการใช้งาน มีช่องค้นหา และปุ่มจัดการต่อแถว ได้แก่ แก้ไข ลบ และปิดการใช้งานบัญชี รองรับการเพิ่มข้อมูล 2 รูปแบบ คือ การกรอกเพิ่มทีละคน (Add Teacher) และการนำเข้าข้อมูลชุดใหญ่ผ่านไฟล์ CSV (Import CSV)"));
out.push(...figure("admin-02-add-teacher", "Add Teacher",
  "เมื่อกดปุ่ม Add Teacher ระบบแสดงหน้าต่างป๊อปอัปสำหรับเพิ่มอาจารย์ทีละคน โดยกรอกตำแหน่งทางวิชาการ (ไม่บังคับ) ชื่อ-นามสกุล และอีเมล ซึ่งเป็นช่องที่ต้องกรอก"));
out.push(...figure("admin-03-import-teachers", "Import Teachers",
  "หน้าต่าง Import Teachers ใช้นำเข้ารายชื่ออาจารย์จำนวนมากจากไฟล์ CSV โดยลากไฟล์มาวางหรือกดเลือกไฟล์ ไฟล์ต้องมีคอลัมน์ name และ email (คอลัมน์ title ไม่บังคับ) และมีปุ่ม Download สำหรับดาวน์โหลดไฟล์ต้นแบบ"));
out.push(...figure("admin-04-users-students", "User Management (Students)",
  "แท็บ Students ทำหน้าที่บริหารจัดการบัญชีผู้ใช้ระดับนักศึกษา (Student Role) แบ่งเป็นรายการนักศึกษาที่ยังใช้งาน (Active) และพ้นสภาพ (Inactive) มีตัวกรองตามหลักสูตร ปุ่ม Deactivate batch สำหรับปิดการใช้งานนักศึกษาทั้งรุ่น ปุ่ม Import CSV และ Add Student สำหรับเพิ่มข้อมูล ตารางแสดงรหัสนักศึกษา ชื่อ อีเมล หลักสูตร และสถานะ และสามารถกดหัวคอลัมน์เพื่อเรียงลำดับข้อมูลได้"));
out.push(...figure("admin-05-courses", "Course Management",
  "หน้า Course Management แสดงรายวิชาที่เปิดสอนทั้งหมด ด้านบนสรุปจำนวนรายวิชาทั้งหมด รายวิชาที่เปิดอยู่ และรายวิชาที่เก็บถาวร มีตัวกรองตามหลักสูตร ปีการศึกษา ภาคการศึกษา และสถานะ รายวิชาถูกจัดกลุ่มตามหลักสูตร แล้วแยกเป็นวิชาและกลุ่มเรียน (Section) แต่ละกลุ่มแสดงปีการศึกษา ภาคการศึกษา อาจารย์ผู้สอน และจำนวนนักศึกษา พร้อมปุ่มเพิ่มกลุ่มเรียน แก้ไข เก็บถาวร และลบ"));
out.push(...figure("admin-06-new-course", "New Course",
  "หน้าต่าง New Course ใช้สร้างรายวิชาใหม่ โดยกรอกชื่อวิชา คำอธิบาย เลือกหลักสูตรและภาคการศึกษาเพื่อผูกกับรายวิชาต้นแบบของหลักสูตร (ไม่บังคับ) ค้นหาและเลือกอาจารย์ผู้สอนหลัก และเปิดหลายกลุ่มเรียนพร้อมกันได้ในครั้งเดียว"));
out.push(...figure("admin-07-curriculum", "Curriculum Management",
  "หน้า Curriculum Management ทำหน้าที่จัดการหลักสูตรของแต่ละสาขา ด้านบนสรุปจำนวนหลักสูตรทั้งหมด หลักสูตรที่ยังใช้งาน และจำนวนรายวิชาต้นแบบ รายการหลักสูตรแบ่งเป็นหลักสูตรที่ใช้งานอยู่ (Active) และหลักสูตรที่เลิกใช้แล้ว (Retired) แต่ละหลักสูตรแสดงรหัสสาขา (CE, CECS, CEI) ช่วงปีที่ใช้ และจำนวนรายวิชา พร้อมปุ่มสร้างหลักสูตรใหม่"));
out.push(...figure("admin-08-curriculum-courses", "รายวิชาในหลักสูตร",
  "เมื่อกดขยายหลักสูตร ระบบแสดงรายวิชาต้นแบบ (Course Template) ทั้งหมดของหลักสูตรนั้น พร้อมรหัสวิชา สามารถเพิ่มรายวิชาทีละรายการด้วยปุ่ม Add course หรือนำเข้าหลายรายวิชาพร้อมกันผ่านไฟล์ CSV และแก้ไขหรือนำรายวิชาออกจากหลักสูตรได้"));

/* ───────────── Teacher ───────────── */
out.push(new Paragraph({ children: [new PageBreak()] }));
out.push(h2("3.4.2 หน้า UI ของ Teacher"));
out.push(body("อาจารย์เริ่มต้นที่หน้ารายวิชาของตนเอง เมื่อเข้าไปในแต่ละรายวิชาจะมีเมนูด้านซ้ายสำหรับจัดการวิชานั้น ได้แก่ Overview Assignments Grading Score Book CLO Students Collaborators และ Settings"));
out.push(...figure("teacher-01-my-courses", "My Courses",
  "หน้า My Courses ทำหน้าที่แสดงรายการรายวิชาทั้งหมดที่อาจารย์ได้รับมอบหมายให้เป็นผู้รับผิดชอบการเรียนการสอนในแต่ละภาคการศึกษา แต่ละการ์ดแสดงรหัสวิชา ชื่อวิชา กลุ่มเรียน ภาคการศึกษา เวลาเรียน ห้องเรียน จำนวนนักศึกษา และจำนวนงานที่กำลังเปิดอยู่ แยกแท็บ Active และ Archived มีช่องค้นหารายวิชา อาจารย์กดเข้าการ์ดเพื่อจัดการรายวิชานั้น"));
out.push(...figure("teacher-02-course-overview", "Overview ของรายวิชา",
  "หน้า Overview สรุปภาพรวมของรายวิชา ประกอบด้วยคำอธิบายรายวิชา (แก้ไขได้ในหน้านี้) จำนวนนักศึกษา จำนวนงาน และสถานะการตรวจงาน รายละเอียดวิชา เช่น รหัสวิชา กลุ่มเรียน เวลาเรียน ห้อง และผู้สอน รวมถึงหมวดคะแนน (Grading Categories) ที่กำหนดสัดส่วนคะแนนของวิชา เช่น งานที่มอบหมาย 40% สอบกลางภาค 25% และสอบปลายภาค 35% รวมกันต้องได้ 100%"));
out.push(...figure("teacher-03-assignments", "Assignments",
  "หน้า Assignments แสดงรายการชิ้นงานทั้งหมดของรายวิชา แต่ละงานแสดงชื่อ คำอธิบายสั้น ๆ กำหนดส่ง (หากเลยกำหนดจะแสดงสถานะ Past due) คะแนนเต็ม รูปแบบการส่ง (รายบุคคลหรือกลุ่ม) ประเภทไฟล์ หมวดคะแนน และจำนวนเกณฑ์ใน Rubric มีช่องค้นหา ปุ่ม Create Assignment สำหรับสร้างงานใหม่ และปุ่ม Manage Collaborators"));
out.push(...figure("teacher-04-assignment-detail", "รายละเอียดชิ้นงาน",
  "หน้ารายละเอียดชิ้นงานแสดงโจทย์ (Assignment brief) และเกณฑ์การให้คะแนน (Rubric) ซึ่งแต่ละเกณฑ์แสดงสัดส่วน คะแนน และคำอธิบายของทุกระดับ (Excellent, Fair, Needs Improvement, Fail) ด้านขวาแสดงรายละเอียด เช่น วันครบกำหนด คะแนนเต็ม หมวดคะแนน และประเภทไฟล์ที่รับ อาจารย์กด Edit Assignment เพื่อแก้ไขงาน หรือกด Go to grading เพื่อไปตรวจงาน"));
out.push(...figure("teacher-05-new-assignment", "New Assignment",
  "หน้า New Assignment ใช้สร้างชิ้นงานใหม่ แบ่งเป็นส่วนข้อมูลทั่วไป (ชื่องาน) คำอธิบายพร้อมแนบไฟล์ รูปภาพ หรือลิงก์ตัวอย่างงาน การตั้งค่าการส่งงาน ได้แก่ งานประเภทสอบ การรับไฟล์จากนักศึกษา ประเภทไฟล์ (Figma, PDF, Image) และรูปแบบรายบุคคลหรือกลุ่ม รวมถึงวันครบกำหนดและหมวดคะแนน"));
out.push(...figure("teacher-06-new-assignment-rubric", "การสร้าง Rubric",
  "ส่วน Grading Rubric ใช้กำหนดเกณฑ์ที่ HWAI Agent จะใช้ตรวจงาน แต่ละเกณฑ์มีคะแนนของตนเอง คำอธิบายสำหรับนักศึกษา และคำอธิบายของแต่ละระดับ ผลรวมคะแนนของเกณฑ์จะกลายเป็นคะแนนเต็มของชิ้นงาน อาจารย์สามารถใช้ AI Rubric Assistant ช่วยร่างเกณฑ์จากโจทย์ ปุ่ม Generate ช่วยเขียนคำอธิบายระดับ และนำเข้า Rubric ที่มีอยู่แล้วได้"));
out.push(...figure("teacher-07-course-grading", "Grading (ภาพรวมทั้งรายวิชา)",
  "หน้า Grading ของรายวิชาแสดงคิวการตรวจงานของทุกชิ้นงาน ด้านบนสรุปจำนวนงานทั้งหมด งานที่ตรวจแล้ว งานที่รอตรวจสอบ และงานที่เลยกำหนด มีแท็บกรองตามสถานะ ในแต่ละงานแสดงจำนวนที่ส่งแล้ว ค่าเฉลี่ย และแถบสัดส่วนงานที่ตรวจแล้วกับที่ยังไม่ตรวจ อาจารย์กด Start Grading เพื่อเข้าตรวจงานนั้น"));
out.push(...figure("teacher-08-assignment-grading", "Grading ของชิ้นงาน",
  "หน้าตรวจงานของแต่ละชิ้นงานแสดงความคืบหน้าของการตรวจ ได้แก่ จำนวนงานที่ตรวจแล้ว ส่งแล้ว รอตรวจสอบ และคะแนนเฉลี่ย พร้อมความคืบหน้ารวมของการวิเคราะห์งานโดย AI เมื่อตรวจครบทุกงาน อาจารย์กด Finish & announce เพื่อประกาศผลให้นักศึกษาเห็นคะแนนของตนเอง"));
out.push(...figure("teacher-08b-grade-adjustment", "ตารางปรับคะแนน (Grade Adjustment)",
  "ตาราง Grade Adjustment แสดงงานของนักศึกษาแต่ละคน พร้อมวันที่ส่ง คะแนน และสถานะ (Graded, Needs review, Not graded) มีตัวกรองตามสถานะและช่องค้นหา อาจารย์กดปุ่ม Grade เพื่อตรวจและแก้ไขคะแนนรายเกณฑ์ หรือกด Re-grade เพื่อให้ AI ตรวจงานชิ้นนั้นใหม่ทั้งชิ้น"));
out.push(...figure("teacher-09-rubric-card", "การ์ดเกณฑ์การให้คะแนนในหน้า Grading",
  "การ์ด Grading rubric ในหน้า Grading แสดงเกณฑ์ทั้งหมดของงานเพื่อให้อาจารย์เห็นควบคู่กับการตรวจ แต่ละเกณฑ์แสดงแถบสัดส่วนจำนวนนักศึกษาในแต่ละระดับ คะแนนเต็ม และค่าเฉลี่ยของห้อง เมื่อกดขยายจะแสดงคำอธิบายของแต่ละระดับพร้อมจำนวนนักศึกษาที่อยู่ในระดับนั้น ทำให้เห็นว่าห้องเรียนทำเกณฑ์ใดได้ดีหรือยังอ่อน"));
out.push(...figure("teacher-10-recheck", "Grading Review (ตรวจงานรายคน)",
  "หน้า Grading Review ใช้ตรวจงานของนักศึกษาทีละคน ด้านซ้ายแสดงไฟล์งานที่นักศึกษาส่ง พร้อมปุ่มย่อขยาย ด้านขวาแสดงระดับความเชื่อมั่นของ AI และคะแนนรายเกณฑ์พร้อมคำแนะนำจาก AI (AI Feedback) อาจารย์แก้ไขคะแนนของแต่ละเกณฑ์ได้ แล้วกด Save Changes เพื่อบันทึก หรือ Reset to Default เพื่อกลับไปใช้คะแนนจาก AI"));
out.push(...figure("teacher-11-exam-scores", "กรอกคะแนนสอบ",
  "สำหรับงานประเภทสอบ (เช่น สอบกลางภาคและสอบปลายภาค) นักศึกษาไม่ต้องส่งไฟล์ หน้า Grading จึงแสดงตาราง Exam scores ที่มีรายชื่อนักศึกษาทุกคนในวิชา อาจารย์กรอกคะแนนของแต่ละคนในช่องคะแนน ช่องที่เว้นว่างหมายถึงยังไม่มีคะแนน แล้วกด Save scores เพื่อบันทึก"));
out.push(...figure("teacher-12-import-exam-csv", "นำเข้าคะแนนสอบด้วย CSV",
  "อาจารย์กด Import CSV เพื่อนำเข้าคะแนนสอบจากไฟล์ ระบบจับคู่รหัสนักศึกษาในไฟล์กับรายชื่อนักศึกษาที่ลงทะเบียนในวิชา แล้วแสดงตัวอย่างผลก่อนกรอกจริง แต่ละแถวบอกสถานะ เช่น พร้อมกรอก (Will fill) ข้าม (ไม่มีคะแนน) หรือผิดพลาดพร้อมเหตุผล (คะแนนเกินช่วง ไม่ได้ลงทะเบียนในวิชานี้ รหัสซ้ำ) เมื่อกด Fill ระบบกรอกเฉพาะแถวที่ถูกต้องลงตาราง และอาจารย์ต้องกด Save scores อีกครั้งเพื่อบันทึก"));
out.push(...figure("teacher-13-score-book", "Score Book (ตารางคะแนน)",
  "หน้า Score Book แสดงคะแนนของนักศึกษาทุกคนในทุกชิ้นงานเป็นตารางเดียว มีสรุปจำนวนนักศึกษา เปอร์เซ็นต์งานที่ตรวจแล้ว คะแนนเฉลี่ยของห้อง และจำนวนงานที่รอตรวจ แต่ละช่องคะแนนมีสีตามช่วงคะแนน (80% ขึ้นไป 60–79% ต่ำกว่า 60% รอตรวจ และไม่ส่ง) คอลัมน์สรุปแสดงคะแนนรวมและเกรด สามารถกรองตามหมวดคะแนน เรียงลำดับ ค้นหา และส่งออกเป็นไฟล์ CSV ได้"));
out.push(...figure("teacher-14-class-summary", "Class summary (สรุปผลทั้งห้อง)",
  "แท็บ Class summary สรุปผลของทั้งห้องจากข้อมูลชุดเดียวกับ Score Book แสดงคะแนนสะสมเฉลี่ยของห้องพร้อมกราฟระฆังคว่ำ (กราฟการแจกแจงปกติ) และค่าสถิติ ได้แก่ คะแนนต่ำสุด เฉลี่ย สูงสุด และส่วนเบี่ยงเบนมาตรฐาน (SD) เพื่อให้อาจารย์เห็นภาพรวมการกระจายของคะแนน"));
out.push(...figure("teacher-15-clo", "Course Learning Outcomes (CLO)",
  "หน้า CLO ใช้กำหนดผลลัพธ์การเรียนรู้ของรายวิชา (Course Learning Outcomes) คือสิ่งที่นักศึกษาควรทำได้เมื่อเรียนจบ แต่ละรายการมีรหัส CLO และข้อความ อาจารย์เพิ่ม แก้ไข และลบได้ ส่วนการเชื่อม CLO กับเกณฑ์การให้คะแนนของงานอยู่ในแผนพัฒนาครั้งต่อไป"));
out.push(...figure("teacher-16-students", "Student Roster (รายชื่อนักศึกษา)",
  "หน้า Students แสดงรายชื่อนักศึกษาที่ลงทะเบียนในรายวิชา พร้อมป้ายหลักสูตรของกลุ่มเรียน (หนึ่งกลุ่มเรียนรับนักศึกษาได้เพียงหลักสูตรเดียว) ตารางแสดงรหัสนักศึกษา ชื่อ อีเมล หลักสูตร และสถานะ (Enrolled) มีช่องค้นหาและเรียงลำดับ อาจารย์เพิ่มนักศึกษาทีละคนด้วยรหัสนักศึกษา (Add Student) หรือนำเข้าจากไฟล์ CSV (Import CSV) และสามารถถอนนักศึกษาออกจากวิชาหรือลบรายการได้"));

/* ───────────── Student ───────────── */
out.push(new Paragraph({ children: [new PageBreak()] }));
out.push(h2("3.4.3 หน้า UI ของ Student"));
out.push(body("นักศึกษาเริ่มต้นที่หน้าแรก (Home) ซึ่งสรุปงานที่ใกล้ครบกำหนดและรายวิชาของตนเอง เมื่อเข้าไปในแต่ละรายวิชาจะมีเมนู Classwork สำหรับดูและส่งงาน และ Evaluation สำหรับดูผลการประเมิน"));
out.push(...figure("student-01-home", "Home ของนักศึกษา",
  "หน้า Home ต้อนรับนักศึกษาด้วยชื่อและแสดงหลักสูตรที่สังกัด ส่วน Upcoming assignments แสดงงานที่กำลังจะถึงกำหนดส่งเรียงตามวัน ปฏิทิน (Calendar) ทำจุดไว้ในวันที่มีงานครบกำหนดและกดดูงานของวันนั้นได้ และส่วน My Courses แสดงรายวิชาที่ลงทะเบียนในภาคการศึกษาปัจจุบันพร้อมจำนวนงาน อาจารย์ผู้สอน เวลาเรียน และห้อง"));
out.push(...figure("student-02-my-courses", "My Courses ของนักศึกษา",
  "หน้า My Courses แยกรายวิชาเป็น 2 ส่วน ได้แก่ รายวิชาปัจจุบัน (Current courses) ของภาคการศึกษาที่กำลังเรียน แสดงเป็นการ์ดพร้อมรหัสวิชา ชื่อ กลุ่มเรียน เวลาเรียน ห้อง และจำนวนงาน และรายวิชาที่เรียนผ่านมาแล้ว (Completed courses) จัดกลุ่มตามภาคการศึกษา แสดงเปอร์เซ็นต์และเกรดที่ได้ของแต่ละวิชา"));
out.push(...figure("student-03-classwork", "Classwork",
  "หน้า Classwork แสดงงานทั้งหมดของรายวิชาจัดกลุ่มตามสถานะ ได้แก่ ใกล้ครบกำหนด (Due soon) ยังไม่ส่ง (Not submitted) และรอคะแนน (Awaiting score) แต่ละงานแสดงกำหนดส่ง รูปแบบรายบุคคลหรือกลุ่ม และสถานะ ด้านขวาแสดงหมวดคะแนน (Grading Categories) และสัดส่วนของรายวิชาให้นักศึกษาทราบว่าคะแนนแต่ละส่วนคิดอย่างไร"));
out.push(...figure("student-05-group-assignment", "งานกลุ่มและการส่งงาน",
  "หน้ารายละเอียดงานแสดงโจทย์ กำหนดส่ง คะแนนเต็ม และเกณฑ์การให้คะแนน (Grading Rubric) ให้นักศึกษาทราบก่อนลงมือทำ สำหรับงานกลุ่ม นักศึกษาต้องกด Form a team เพื่อสร้างทีมจากเพื่อนในกลุ่มเรียนเดียวกันก่อนส่งงาน จากนั้นส่งงานได้ที่ส่วน My Work โดยแนบลิงก์หรือไฟล์ PDF แล้วกด Submit"));
out.push(...figure("student-04-assignment-graded", "ผลคะแนนของงานที่ประกาศผลแล้ว",
  "เมื่ออาจารย์ประกาศผลแล้ว ส่วน My Work แสดงสถานะ Graded และคะแนนที่ได้ ส่วน Grading Rubric แสดงคะแนนที่ได้ในแต่ละเกณฑ์พร้อมแถบสัดส่วน และไฮไลต์ระดับที่นักศึกษาทำได้ (Your level) เพื่อให้เห็นว่าตนเองอยู่ระดับใดและต้องปรับปรุงด้านไหน ก่อนอาจารย์ประกาศผล นักศึกษาจะเห็นเพียงว่างานอยู่ระหว่างการตรวจ"));
out.push(...figure("student-06-exam-result", "ผลสอบเทียบกับห้อง",
  "สำหรับงานสอบที่ประกาศผลแล้ว ระบบแสดงคะแนนของนักศึกษาเทียบกับสถิติของห้อง ได้แก่ คะแนนที่ได้และเปอร์เซ็นต์ จำนวนคะแนนที่สูงกว่าค่าเฉลี่ย กราฟระฆังคว่ำที่ทำเครื่องหมายตำแหน่งของนักศึกษา เปอร์เซ็นต์เพื่อนร่วมห้องที่ได้คะแนนต่ำกว่า และค่าต่ำสุด เฉลี่ย สูงสุด และ SD ของห้อง โดยไม่แสดงคะแนนของเพื่อนรายบุคคล"));
out.push(...figure("student-07-evaluation", "Evaluation (ผลการประเมิน)",
  "หน้า Evaluation สรุปผลการเรียนของนักศึกษาในรายวิชา แสดงเปอร์เซ็นต์งานที่ตรวจแล้ว จำนวนงานที่รอตรวจ และคะแนนรวมถ่วงน้ำหนักตามหมวดคะแนน (Total so far) พร้อมเกรดเมื่อคิดจากหมวดที่ตรวจแล้ว ตารางด้านล่างแสดงคะแนนของแต่ละงานแยกตามหมวด ใช้สีบอกช่วงคะแนนและสถานะ (รอตรวจ หรือไม่ส่ง) และกดขยายดูคะแนนรายเกณฑ์ได้"));

const doc = new Document({
  creator: "HWAI Agent",
  title: "การออกแบบหน้า UI",
  // language th-TH on the default run lets Word break Thai lines at word boundaries (otherwise it only breaks at spaces)
  styles: { default: { document: { run: { font: FONT, size: BODY, language: { value: "th-TH", eastAsia: "th-TH", bidirectional: "th-TH" } } } } },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1700, right: 1440 } } },
    children: out,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  const file = path.join(__dirname, process.argv[2] || "HWAI-UI-Report.docx");
  fs.writeFileSync(file, buf);
  console.log("wrote", file, (buf.length / 1048576).toFixed(1) + " MB,", fig, "figures");
});

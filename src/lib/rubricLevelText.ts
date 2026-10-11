// What each lower level of a criterion actually looks like (11/10/2569).
//
// The UX/UI rubric file (UXUI_Final_Rubric_draft1.xlsx) does not describe "Fair / Needs Improvement / Fail" with a stock
// phrase: every level of every criterion says what the grader would SEE — how much is present or missing, and what that
// costs the reader ("ขาดจำนวนมาก ทำให้หน้าจอไม่สมบูรณ์"). The three steps below follow that pattern for every other criterion
// in the templates: level 2 = mostly there with a named gap, level 1 = several gaps, level 0 = missing or unusable.
// Level 3 (the best) stays in rubricTemplates.ts as the criterion's `excellent` text. Pure data, no React.

import type { Bi } from "./rubricTemplates";

type Three = [string, string, string];
export interface RestLevels { th: Three; en: Three }

/** Key = the criterion's English name (or its `key` for the quiz / exam frames, which depend on the topic). */
const FIXED: Record<string, RestLevels> = {
  // ── programming ────────────────────────────────────────────────────────────────────────────────────────────────
  "Program correctness": {
    th: [
      "ผลลัพธ์ถูกต้องในโจทย์ส่วนใหญ่ แต่ผิดพลาดบางกรณี เช่น กรณีขอบหรือข้อมูลนำเข้าที่ไม่ปกติ",
      "ผลลัพธ์ผิดในหลายโจทย์ หรือโปรแกรมทำงานได้เฉพาะกรณีง่าย ๆ",
      "โปรแกรมรันไม่ได้หรือให้ผลลัพธ์ผิดเกือบทุกข้อ ไม่ตรงกับโจทย์ที่กำหนด",
    ],
    en: [
      "Output is correct on most tasks, but some cases fail — typically edge cases or unusual input.",
      "Output is wrong on several tasks, or the program only works for the simple cases.",
      "The program does not run, or its output is wrong almost everywhere and does not match the task.",
    ],
  },
  "Code readability": {
    th: [
      "ตั้งชื่อและจัดรูปแบบอ่านเข้าใจได้เป็นส่วนใหญ่ แต่มีบางจุดที่ชื่อสื่อความหมายไม่พอหรือรูปแบบไม่สม่ำเสมอ",
      "ชื่อตัวแปรไม่สื่อความหมายหลายจุด การย่อหน้าไม่สม่ำเสมอ และแทบไม่มี comment ทำให้ต้องเดาว่าโค้ดทำอะไร",
      "อ่านโค้ดไม่รู้เรื่อง — ตั้งชื่อตามใจ ไม่มีโครงสร้างหรือการจัดรูปแบบเลย",
    ],
    en: [
      "Mostly readable, but a few names say too little or the formatting drifts in places.",
      "Many names are unclear, indentation is uneven and there are almost no comments, so a reader must guess what the code does.",
      "The code cannot be followed — arbitrary names, and no structure or formatting at all.",
    ],
  },
  "Error handling": {
    th: [
      "จัดการ input ผิดพลาดที่พบบ่อยได้ แต่ยังมีกรณีผิดปกติบางกรณีที่ทำให้โปรแกรมหยุดหรือแจ้งข้อผิดพลาดไม่ชัดเจน",
      "จัดการ error เฉพาะบางจุด input ผิดรูปแบบยังทำให้โปรแกรมหยุดทำงานได้ง่าย",
      "ไม่มีการจัดการ error — input ผิดเพียงเล็กน้อยก็ทำให้โปรแกรมหยุดทำงาน",
    ],
    en: [
      "Common bad input is handled, but a few unusual cases still stop the program or give an unclear message.",
      "Errors are handled in a few places only; badly formed input can still crash the program.",
      "No error handling — even slightly wrong input stops the program.",
    ],
  },
  "Program structure": {
    th: [
      "แบ่งฟังก์ชันได้พอสมควร แต่บางฟังก์ชันยาวหรือทำหลายหน้าที่ และมีโค้ดซ้ำเล็กน้อย",
      "โค้ดส่วนใหญ่รวมอยู่ในไม่กี่ฟังก์ชันหรือไฟล์เดียว มีโค้ดซ้ำหลายจุด ทำให้แก้ไขหรือต่อยอดยาก",
      "ไม่มีการแบ่งโครงสร้าง — โค้ดทั้งหมดอยู่รวมกัน นำกลับมาใช้ซ้ำหรือทดสอบแยกส่วนไม่ได้",
    ],
    en: [
      "Split into functions reasonably, but some functions are long or do several jobs, and a little code is repeated.",
      "Most of the code sits in a few functions or one file, with repetition in many places, so it is hard to change or extend.",
      "No structure — all the code is in one block that cannot be reused or tested in parts.",
    ],
  },
  "Teamwork": {
    th: [
      "มีการแบ่งงานและสมาชิกส่วนใหญ่มีส่วนร่วม แต่เอกสารแบ่งงานไม่ละเอียดหรือ commit กระจุกอยู่ที่บางคน",
      "สมาชิกบางคนมีส่วนร่วมน้อยมากเมื่อดูจากประวัติ commit และไม่มีเอกสารแบ่งงานที่ชัดเจน",
      "งานเกือบทั้งหมดทำโดยคนเดียว ไม่มีหลักฐานการแบ่งงานหรือการทำงานร่วมกัน",
    ],
    en: [
      "Work is split and most members contribute, but the work-split document is thin or commits cluster on a few people.",
      "Some members barely contribute according to the commit history, and there is no clear work-split document.",
      "Almost all the work was done by one person, with no evidence of splitting the work or collaborating.",
    ],
  },
  "Feature correctness": {
    th: [
      "ฟังก์ชันหลักส่วนใหญ่ทำงานถูกต้อง แต่มีบางฟังก์ชันผิดพลาดบางกรณี หรือเชื่อมต่อกันไม่ราบรื่น",
      "ฟังก์ชันหลักที่กำหนดขาดหรือทำงานผิดหลายข้อ ระบบยังใช้งานต่อเนื่องจนจบไม่ได้",
      "ฟังก์ชันหลักแทบไม่ทำงาน หรือระบบไม่สามารถรันได้",
    ],
    en: [
      "Most required features work, but a few fail in some cases or do not connect smoothly.",
      "Several required features are missing or wrong, so the system cannot be used from start to finish.",
      "Hardly any required feature works, or the system cannot run.",
    ],
  },
  "Function correctness": {
    th: [
      "ฟังก์ชันส่วนใหญ่คืนค่าถูกต้อง แต่บางฟังก์ชันผิดในกรณีขอบหรือจัดการพารามิเตอร์ไม่ครบ",
      "หลายฟังก์ชันคืนค่าผิดหรือไม่คืนค่าตามที่กำหนด",
      "ฟังก์ชันเกือบทั้งหมดทำงานไม่ได้หรือไม่ตรงกับที่กำหนด",
    ],
    en: [
      "Most functions return the right value, but some fail on edge cases or mishandle a parameter.",
      "Several functions return the wrong value, or not the value that was asked for.",
      "Almost no function works or matches what was specified.",
    ],
  },
  "Style and documentation": {
    th: [
      "มี docstring ในฟังก์ชันส่วนใหญ่ แต่บางฟังก์ชันขาดหรืออธิบายไม่ครบ ชื่อและรูปแบบสม่ำเสมอเป็นส่วนใหญ่",
      "มี docstring เพียงไม่กี่ฟังก์ชัน และชื่อหรือรูปแบบไม่สม่ำเสมอหลายจุด",
      "ไม่มี docstring และไม่มีรูปแบบการเขียนที่เป็นระบบ",
    ],
    en: [
      "Most functions have a docstring, but some are missing or incomplete; naming and formatting are mostly consistent.",
      "Only a few functions have a docstring, and naming or formatting is inconsistent in many places.",
      "No docstrings and no consistent style.",
    ],
  },
  "Test cases": {
    th: [
      "มีกรณีทดสอบสำหรับกรณีปกติของทุกฟังก์ชัน แต่กรณีขอบยังขาดบางส่วน",
      "มีกรณีทดสอบเพียงบางฟังก์ชัน และแทบไม่มีกรณีขอบ",
      "ไม่มีกรณีทดสอบ หรือกรณีทดสอบไม่สามารถใช้ตรวจฟังก์ชันได้จริง",
    ],
    en: [
      "Normal cases are tested for every function, but some edge cases are missing.",
      "Only some functions are tested, and edge cases are almost absent.",
      "No test cases, or the tests cannot actually check the functions.",
    ],
  },
  // ── earlier-term subjects ──────────────────────────────────────────────────────────────────────────────────────
  "Correctness of answers and proofs": {
    th: [
      "คำตอบและการพิสูจน์ถูกต้องเป็นส่วนใหญ่ แต่มีช่องว่างทางตรรกะเล็กน้อยในบางข้อ",
      "การพิสูจน์มีช่องว่างทางตรรกะหรือข้ามขั้นตอนสำคัญหลายข้อ และคำตอบผิดหลายข้อ",
      "คำตอบและการพิสูจน์ผิดเป็นส่วนใหญ่ หรือสิ่งที่เขียนไม่ใช่การพิสูจน์",
    ],
    en: [
      "Answers and proofs are mostly correct, with a small logical gap in some items.",
      "Proofs have logical gaps or skip key steps in several items, and several answers are wrong.",
      "Answers and proofs are mostly wrong, or what is written is not a proof.",
    ],
  },
  "Reasoning steps": {
    th: [
      "แสดงขั้นตอนเรียงลำดับเป็นส่วนใหญ่ แต่บางขั้นไม่ได้อ้างทฤษฎีบทที่ใช้",
      "ขั้นตอนข้ามไปมาหรือขาดหายหลายจุด ผู้อ่านตามไม่ทัน",
      "ไม่แสดงขั้นตอนการให้เหตุผล ให้เพียงคำตอบ",
    ],
    en: [
      "Steps are shown in order for the most part, but some do not cite the theorem used.",
      "Steps jump around or are missing in many places, so a reader cannot follow.",
      "No reasoning steps shown — only the answers.",
    ],
  },
  "Mathematical notation": {
    th: [
      "ใช้สัญลักษณ์ถูกต้องเป็นส่วนใหญ่ มีการสลับหรือใช้ไม่สม่ำเสมอบางจุด",
      "ใช้สัญลักษณ์ผิดหรือไม่สม่ำเสมอหลายจุดจนต้องเดาความหมาย",
      "สัญลักษณ์ผิดจนอ่านความหมายทางคณิตศาสตร์ไม่ได้",
    ],
    en: [
      "Notation is mostly correct, with a mix-up or an inconsistency here and there.",
      "Notation is wrong or inconsistent in many places, so the meaning has to be guessed.",
      "Notation is so wrong that the mathematics cannot be read.",
    ],
  },
  "Algorithm correctness": {
    th: [
      "ผ่านชุดทดสอบส่วนใหญ่ แต่ล้มเหลวในบางกรณีขอบ เช่น ข้อมูลว่างหรือค่าซ้ำ",
      "ผ่านเฉพาะชุดทดสอบง่าย ๆ และผิดในหลายกรณี",
      "อัลกอริทึมให้ผลผิดเกือบทุกชุดทดสอบ หรือรันไม่ได้",
    ],
    en: [
      "Passes most tests but fails some edge cases, such as empty input or repeated values.",
      "Passes only the easy tests and is wrong in many cases.",
      "The algorithm gives wrong results on almost every test, or does not run.",
    ],
  },
  "Data-structure choice and complexity analysis": {
    th: [
      "เลือกโครงสร้างข้อมูลได้เหมาะสม แต่วิเคราะห์ความซับซ้อนคลาดเคลื่อนบางส่วน",
      "โครงสร้างข้อมูลที่เลือกไม่เหมาะกับโจทย์ หรือวิเคราะห์ความซับซ้อนผิดหลายจุด",
      "ไม่ได้เลือกโครงสร้างข้อมูลอย่างมีเหตุผล และไม่วิเคราะห์ความซับซ้อน",
    ],
    en: [
      "The data structure is a suitable choice, but the complexity analysis is partly off.",
      "The data structure does not suit the problem, or the complexity analysis is wrong in several places.",
      "The data structure is not chosen with any reasoning, and there is no complexity analysis.",
    ],
  },
  "Code quality and testing": {
    th: [
      "โค้ดอ่านได้และมีชุดทดสอบ แต่ครอบคลุมกรณีสำคัญไม่ครบ",
      "โค้ดอ่านยาก และมีชุดทดสอบเพียงไม่กี่กรณี",
      "โค้ดอ่านไม่ได้ และไม่มีชุดทดสอบ",
    ],
    en: [
      "The code is readable and has tests, but they miss some important cases.",
      "The code is hard to read and has only a few test cases.",
      "The code cannot be read and there are no tests.",
    ],
  },
  "Circuit correctness": {
    th: [
      "วงจรทำงานถูกต้องในส่วนใหญ่ของ truth table แต่ผิดในบางกรณี",
      "วงจรให้ output ผิดหลายแถวของ truth table",
      "วงจรไม่ทำงานตามข้อกำหนด หรือออกแบบไม่สมบูรณ์",
    ],
    en: [
      "The circuit matches most of the truth table but is wrong in a few cases.",
      "The circuit gives the wrong output on several rows of the truth table.",
      "The circuit does not meet the specification, or the design is incomplete.",
    ],
  },
  "Simplification and design efficiency": {
    th: [
      "ลดรูปสมการได้ แต่ยังเหลือเกตที่ลดได้อีกบางส่วน",
      "ลดรูปไม่ครบหรือผิดบางขั้น ใช้เกตมากกว่าที่จำเป็นอย่างชัดเจน",
      "ไม่ได้ลดรูป หรือการลดรูปทำให้วงจรผิด",
    ],
    en: [
      "The equations are simplified, but some gates could still be removed.",
      "Simplification is incomplete or wrong at some step, and clearly more gates are used than needed.",
      "No simplification, or the simplification breaks the circuit.",
    ],
  },
  "Simulation and verification": {
    th: [
      "จำลองและตรวจผลกับกรณีส่วนใหญ่ แต่บันทึกผลไม่ครบ",
      "จำลองเพียงบางกรณีและไม่ได้เทียบกับ truth table",
      "ไม่มีการจำลองหรือบันทึกผลการตรวจสอบ",
    ],
    en: [
      "The circuit is simulated and checked on most cases, but the results are not all recorded.",
      "Only a few cases are simulated and they are not compared with the truth table.",
      "No simulation, and no record of any verification.",
    ],
  },
  "Correctness of the design / assembly program": {
    th: [
      "ทำงานถูกต้องกับคำสั่งส่วนใหญ่ แต่ผิดในบางคำสั่งหรือบางกรณี",
      "หลายคำสั่งทำงานผิด หรือ datapath/โปรแกรมไม่ครบตามที่กำหนด",
      "การออกแบบหรือโปรแกรมทำงานไม่ได้ตามที่กำหนด",
    ],
    en: [
      "Works correctly for most instructions but is wrong for a few instructions or cases.",
      "Several instructions misbehave, or the datapath/program does not cover everything required.",
      "The design or program does not work as specified.",
    ],
  },
  "Performance analysis": {
    th: [
      "คำนวณ CPI หรือจำนวนรอบได้ แต่เปรียบเทียบทางเลือกไม่ครบหรือคำนวณผิดเล็กน้อย",
      "วิเคราะห์ประสิทธิภาพผิดหลายจุดหรือไม่ได้เปรียบเทียบทางเลือก",
      "ไม่มีการวิเคราะห์ประสิทธิภาพ",
    ],
    en: [
      "CPI or cycle counts are worked out, but the alternatives are not all compared or a calculation slips.",
      "The performance analysis is wrong in several places, or alternatives are not compared.",
      "No performance analysis.",
    ],
  },
  "Explanation and lab report": {
    th: [
      "รายงานอธิบายแนวคิดและผลการทดลองได้ แต่ข้อสรุปไม่ชัดเจนในบางส่วน",
      "รายงานขาดผลการทดลองหรือข้อสรุป และอธิบายแนวคิดไม่ครบ",
      "ไม่มีรายงาน หรือรายงานอ่านไม่เข้าใจ",
    ],
    en: [
      "The report explains the idea and the results, but some conclusions are unclear.",
      "The report is missing results or conclusions and does not explain the idea fully.",
      "No report, or the report cannot be understood.",
    ],
  },
  "Data-model correctness": {
    th: [
      "ER และ schema ครอบคลุมข้อกำหนดเป็นส่วนใหญ่ แต่ normalization ยังไม่ครบหรือมีความสัมพันธ์ที่ผิดบางจุด",
      "ขาดเอนทิตีหรือความสัมพันธ์สำคัญหลายส่วน และมีข้อมูลซ้ำซ้อน",
      "แบบจำลองข้อมูลไม่สอดคล้องกับข้อกำหนด หรือไม่มี schema",
    ],
    en: [
      "The ER model and schema cover most requirements, but normalisation is incomplete or a relationship is wrong.",
      "Several important entities or relationships are missing, and data is duplicated.",
      "The data model does not match the requirements, or there is no schema.",
    ],
  },
  "SQL correctness and efficiency": {
    th: [
      "SQL ถูกต้องในข้อส่วนใหญ่ แต่บางข้อได้ผลไม่ครบหรือเขียนไม่มีประสิทธิภาพ",
      "SQL ผิดหลายข้อ หรือได้ผลที่ไม่ตรงกับโจทย์",
      "SQL รันไม่ได้หรือผิดเกือบทุกข้อ",
    ],
    en: [
      "SQL is correct on most items, but some give incomplete results or are written inefficiently.",
      "SQL is wrong on several items, or returns results that do not match the question.",
      "SQL does not run or is wrong on almost every item.",
    ],
  },
  "Documentation and test data": {
    th: [
      "มีเอกสารและข้อมูลทดสอบ แต่ไม่ครอบคลุมกรณีสำคัญทั้งหมด",
      "เอกสารสั้นมากและข้อมูลทดสอบน้อยจนตรวจผลไม่ได้",
      "ไม่มีเอกสารและข้อมูลทดสอบ",
    ],
    en: [
      "Documentation and test data exist, but do not cover every important case.",
      "The documentation is very thin and the test data too small to check the results.",
      "No documentation and no test data.",
    ],
  },
  "Completeness of requirements and design documents": {
    th: [
      "requirement ครบเป็นส่วนใหญ่ แต่ตรวจสอบย้อนกลับไม่ครบหรือเอกสารออกแบบบางส่วนไม่สอดคล้อง",
      "requirement ขาดหลายข้อ และเอกสารออกแบบขัดแย้งกันเอง",
      "ไม่มี requirement ที่ชัดเจน หรือเอกสารออกแบบไม่เกี่ยวข้องกับงาน",
    ],
    en: [
      "Requirements are mostly complete, but traceability is partial or some design documents disagree.",
      "Several requirements are missing, and the design documents contradict each other.",
      "No clear requirements, or the design documents are unrelated to the work.",
    ],
  },
  "UML diagram quality": {
    th: [
      "แผนภาพส่วนใหญ่ถูกต้อง มีสัญลักษณ์ผิดเล็กน้อยหรือบางส่วนอ่านยาก",
      "สัญลักษณ์ UML ผิดหลายจุดหรือขาดแผนภาพสำคัญ",
      "ไม่มีแผนภาพ UML หรือไม่เป็นไปตามมาตรฐาน",
    ],
    en: [
      "Most diagrams are correct, with a small notation error or a part that is hard to read.",
      "UML notation is wrong in many places, or an important diagram is missing.",
      "No UML diagrams, or they do not follow the standard.",
    ],
  },
  "Teamwork and Git use": {
    th: [
      "แบ่งงานและใช้ Git ได้ แต่ commit message หรือ branch ไม่เป็นระบบ",
      "ส่วนใหญ่ commit ตรงเข้า main โดยไม่ใช้ branch และสมาชิกบางคนแทบไม่มีส่วนร่วม",
      "ไม่ได้ใช้ Git อย่างมีความหมาย หรืองานทำโดยคนเดียว",
    ],
    en: [
      "Work is split and Git is used, but commit messages or branches are not systematic.",
      "Most commits go straight to main with no branches, and some members barely contribute.",
      "Git is not used in any meaningful way, or one person did all the work.",
    ],
  },
  "System-program correctness": {
    th: [
      "โปรแกรมทำงานถูกต้องในสถานการณ์ทดสอบส่วนใหญ่ แต่ล้มเหลวในบางสถานการณ์",
      "ล้มเหลวในหลายสถานการณ์ทดสอบ เช่น การสร้างหรือการจบ process",
      "โปรแกรมไม่ทำงานตามที่กำหนด",
    ],
    en: [
      "The program works in most test scenarios but fails in a few.",
      "It fails in several test scenarios, for example creating or ending a process.",
      "The program does not work as specified.",
    ],
  },
  "Resource management and synchronization": {
    th: [
      "synchronization ถูกต้องเป็นส่วนใหญ่ แต่ยังพบ race condition ในบางสถานการณ์",
      "เกิด race condition หรือ deadlock ได้ง่ายหลายจุด",
      "ไม่มีการ synchronize หรือจัดการทรัพยากรเลย",
    ],
    en: [
      "Synchronisation is mostly right, but a race condition still shows up in some scenarios.",
      "Race conditions or deadlocks can happen easily in several places.",
      "No synchronisation or resource management at all.",
    ],
  },
  "Analysis of results": {
    th: [
      "วิเคราะห์ผลและอธิบายพฤติกรรมของระบบได้บางส่วน แต่ยังขาดเหตุผลรองรับ",
      "อธิบายผลผิด หรือเพียงคัดลอกผลลัพธ์โดยไม่วิเคราะห์",
      "ไม่มีการวิเคราะห์ผล",
    ],
    en: [
      "The results are analysed and the behaviour partly explained, but reasons are missing.",
      "The explanation is wrong, or the results are only copied out without analysis.",
      "No analysis of the results.",
    ],
  },
  // ── UX research ────────────────────────────────────────────────────────────────────────────────────────────────
  "User interviews": {
    th: [
      "สัมภาษณ์ได้ใกล้ครบจำนวนที่กำหนด มีคำถามปลายเปิดบางส่วน แต่ยังลงลึกไม่พอ",
      "สัมภาษณ์น้อยกว่าที่กำหนดมาก และคำถามส่วนใหญ่เป็นคำถามปิด",
      "ไม่มีหลักฐานการสัมภาษณ์ผู้ใช้",
    ],
    en: [
      "Close to the required number of interviews, with some open questions, but not deep enough.",
      "Far fewer interviews than required, and most questions are closed.",
      "No evidence of any user interview.",
    ],
  },
  "User persona": {
    th: [
      "Persona ครบเป็นส่วนใหญ่ แต่เป้าหมายหรือปัญหาของผู้ใช้ยังกว้างเกินไป",
      "Persona ขาดหลายส่วน หรือไม่สอดคล้องกับข้อมูลที่สัมภาษณ์",
      "ไม่มี Persona หรือสร้างโดยไม่อิงข้อมูลผู้ใช้",
    ],
    en: [
      "Personas are mostly complete, but users' goals or problems are too broad.",
      "Personas miss several parts, or do not agree with the interview data.",
      "No personas, or they were made up without user data.",
    ],
  },
  "Insights and conclusions": {
    th: [
      "ระบุ Pain Points ได้ แต่ Insight ยังไม่ชี้ทางออกแบบอย่างชัดเจน",
      "สรุปได้เพียงสิ่งที่ผู้ใช้พูดตรง ๆ ไม่ได้วิเคราะห์ต่อ",
      "ไม่มี Insight หรือสรุปที่ไม่เกี่ยวกับข้อมูลที่เก็บมา",
    ],
    en: [
      "Pain points are identified, but the insights do not clearly point to a design direction.",
      "Only restates what users said, with no further analysis.",
      "No insights, or conclusions unrelated to the data collected.",
    ],
  },
};

/** The quiz and exam frames are filled with the subject's topic, so their wording is a function of it. */
const TOPIC: Record<string, (t: Bi) => RestLevels> = {
  "quiz-understanding": (t) => ({
    th: [
      `ตอบเรื่อง${t.th}ได้ถูกต้องเป็นส่วนใหญ่ แต่ยังมีบางประเด็นที่ตอบไม่ครบหรือเข้าใจคลาดเคลื่อนเล็กน้อย`,
      `เข้าใจแนวคิดเรื่อง${t.th}เพียงบางส่วน ตอบผิดหรือสับสนในหลายประเด็นหลัก`,
      `ไม่เข้าใจแนวคิดเรื่อง${t.th}ที่ถามเกือบทั้งหมด`,
    ],
    en: [
      `Answers on ${t.en} are mostly correct, but some points are incomplete or slightly misunderstood.`,
      `Only part of ${t.en} is understood; several core points are wrong or confused.`,
      `Almost none of the ideas asked about in ${t.en} are understood.`,
    ],
  }),
  "quiz-accuracy": () => ({
    th: ["คำตอบถูกต้องเป็นส่วนใหญ่ มีข้อผิดพลาดเล็กน้อยไม่กี่ข้อ", "คำตอบผิดหลายข้อ รวมถึงข้อพื้นฐาน", "คำตอบส่วนใหญ่ผิดหรือไม่ได้ตอบ"],
    en: ["Most answers are correct, with a few small mistakes.", "Many answers are wrong, including basic ones.", "Most answers are wrong or left blank."],
  }),
  "quiz-reasoning": () => ({
    th: [
      "อธิบายเหตุผลได้เป็นส่วนใหญ่ แต่บางข้อข้ามขั้นตอนหรือไม่อ้างหลักการ",
      "อธิบายเหตุผลเพียงบางข้อ และเหตุผลที่ให้ไม่ชัดเจนหรือไม่ถูกหลักการ",
      "ไม่มีเหตุผลประกอบคำตอบ — ตอบเฉพาะผลลัพธ์",
    ],
    en: [
      "Reasoning is given for most answers, but some skip steps or do not name the principle.",
      "Reasoning is given for only some answers, and it is vague or unsound.",
      "No reasoning — only bare answers.",
    ],
  }),
  "exam-theory": (t) => ({
    th: [
      `อธิบายทฤษฎีเรื่อง${t.th}ได้ถูกต้องเป็นส่วนใหญ่ แต่ยังขาดบางหัวข้อหรือเชื่อมโยงแนวคิดไม่ครบ`,
      `อธิบายทฤษฎีเรื่อง${t.th}ผิดหรือไม่ครบในหลายหัวข้อหลัก`,
      `ไม่สามารถอธิบายทฤษฎีเรื่อง${t.th}ที่ถามได้`,
    ],
    en: [
      `The theory of ${t.en} is mostly explained correctly, but some topics are missing or not connected.`,
      `The theory of ${t.en} is wrong or incomplete on several main topics.`,
      `The theory of ${t.en} that was asked about cannot be explained.`,
    ],
  }),
  "exam-apply": () => ({
    th: [
      "แก้โจทย์ง่ายได้ถูกต้อง แต่โจทย์ที่ซับซ้อนเลือกวิธีไม่เหมาะหรือทำไม่จบ",
      "แก้ได้เฉพาะโจทย์ง่ายบางข้อ และเลือกวิธีผิดในโจทย์ส่วนใหญ่",
      "ไม่สามารถนำหลักการไปแก้โจทย์ได้",
    ],
    en: [
      "Easy problems are solved correctly, but complex ones get an unsuitable method or are left unfinished.",
      "Only a few easy problems are solved, and the method is wrong for most.",
      "The principles cannot be applied to solve the problems.",
    ],
  }),
  "exam-accuracy": () => ({
    th: [
      "แสดงวิธีทำครบเป็นส่วนใหญ่ มีความผิดพลาดเล็กน้อยในการคำนวณหรือขั้นตอนบางจุด",
      "ข้ามขั้นตอนหลายข้อ หรือคำนวณผิดจนคำตอบสุดท้ายผิดหลายข้อ",
      "ไม่แสดงวิธีทำ และคำตอบสุดท้ายส่วนใหญ่ผิด",
    ],
    en: [
      "Working is mostly shown, with small slips in some calculations or steps.",
      "Many steps are skipped, or calculation errors make several final answers wrong.",
      "No working shown, and most final answers are wrong.",
    ],
  }),
};

/** Levels 2 / 1 / 0 for a criterion, or undefined when the template has no wording for it. */
export function restLevelsFor(key: string, topic?: Bi): RestLevels | undefined {
  const fn = TOPIC[key];
  if (fn) return fn(topic ?? { th: "เนื้อหาที่สอบ", en: "the examined material" });
  return FIXED[key];
}

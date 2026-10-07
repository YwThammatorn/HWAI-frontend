// Rubric templates (4/10/2569). The 4-level, level-scored rubric format of the UX/UI Final Project rubric file
// (UXUI_Final_Rubric_draft1.xlsx) — codes C1…, each criterion described at four levels — plus subject-specific
// rubrics written in the same shape. One source for two consumers: the AI Rubric Assistant (suggestions that fit what
// the teacher typed) and the mock-data generator (every rubric in the demo data). Pure data + functions, no React.

export type RubricLang = "th" | "en";
export interface Bi { th: string; en: string }
type Four = [string, string, string, string];

/** Best → worst. Level 3 / 2 / 1 / 0 in the rubric file. */
export const LEVEL_LABELS: Record<RubricLang, Four> = {
  th: ["ดีมาก", "พอใช้", "ต้องปรับปรุง", "ไม่ผ่าน"],
  en: ["Excellent", "Fair", "Needs Improvement", "Fail"],
};

/** Share of a criterion's full marks each level is worth (the file's "level → score" sheet: 100 / 66.67 / 33.33 / 0 %). */
export const LEVEL_FRACTIONS = [1, 2 / 3, 1 / 3, 0] as const;

/** 15 → 15 / 10 / 5 / 0; 10 → 10 / 7 / 3 / 0 (a whole number of points, rounded). */
export function levelPoints(max: number, levelIndex: number): number {
  return Math.round(max * LEVEL_FRACTIONS[levelIndex]);
}

export interface CriterionSpec {
  name: Bi;
  /** one line on what the criterion measures */
  description: Bi;
  /** relative share of the assignment's points */
  weight: number;
  /** all four level descriptions (the rubric file's own wording); otherwise derived from `aspect` + `excellent` */
  levels?: { th: Four; en: Four };
  aspect?: Bi;
  excellent?: Bi;
}

export interface BuiltLevel { label: string; description: string }
export interface BuiltCriterion { name: string; description: string; maxPoints: number; weight: number; levels: BuiltLevel[] }

/** Whole-number split of `total` in proportion to `weights` (largest remainder), every criterion at least 1. */
export function allocatePoints(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / sum) * total);
  const out = raw.map((v) => Math.max(1, Math.floor(v)));
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k][1]]++;
  for (let k = 0; left < 0; k = (k + 1) % order.length) { const i = order[order.length - 1 - k][1]; if (out[i] > 1) { out[i]--; left++; } }
  return out;
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function derivedLevels(spec: CriterionSpec, lang: RubricLang): Four {
  if (spec.levels) return spec.levels[lang];
  const a = spec.aspect![lang];
  return lang === "th"
    ? [spec.excellent!.th, `${a} โดยรวมทำได้ดี แต่ยังมีข้อบกพร่องเล็กน้อยบางจุด`, `${a} มีข้อบกพร่องหลายจุด ยังไม่ตรงตามที่กำหนดอย่างชัดเจน`, `${a} ไม่เป็นไปตามที่กำหนด หรือไม่สามารถประเมินได้`]
    : [spec.excellent!.en, `${cap(a)} — mostly sound, with only minor gaps.`, `${cap(a)} — several gaps; clearly falls short of what was asked.`, `${cap(a)} — does not meet what was asked, or cannot be assessed.`];
}

/** Criteria ready to store: names carry the file's codes (C1, C2 …), points follow the weights, four levels each. */
export function buildCriteria(specs: CriterionSpec[], totalPoints: number, lang: RubricLang): BuiltCriterion[] {
  const pts = allocatePoints(totalPoints, specs.map((s) => s.weight));
  return specs.map((s, i) => ({
    name: `C${i + 1} · ${s.name[lang]}`,
    description: s.description[lang],
    maxPoints: pts[i],
    weight: Math.round((pts[i] / totalPoints) * 100),
    levels: derivedLevels(s, lang).map((description, li) => ({ label: LEVEL_LABELS[lang][li], description })),
  }));
}

const spec = (nameTh: string, nameEn: string, aspectTh: string, aspectEn: string, goodTh: string, goodEn: string, weight: number): CriterionSpec => ({
  name: { th: nameTh, en: nameEn },
  description: { th: aspectTh, en: aspectEn },
  aspect: { th: aspectTh, en: lower(aspectEn) },
  excellent: { th: goodTh, en: goodEn },
  weight,
});

// ---------------------------------------------------------------------------------------------------------------------
// UX/UI Final Project — the rubric file, verbatim for the Thai wording (7 criteria, weights 15/15/10/15/15/15/15)
// ---------------------------------------------------------------------------------------------------------------------
export const UXUI_FINAL: CriterionSpec[] = [
  {
    name: { th: "ความครบถ้วนขององค์ประกอบและความสมจริงของเนื้อหา", en: "Screen Completeness & Content Realism" },
    description: { th: "Screen Completeness & Content Realism", en: "How complete the screens' elements are and how realistic the content is" },
    weight: 15,
    levels: {
      th: [
        "องค์ประกอบที่จำเป็นตามหน้าจอและงานที่กำหนดครบถ้วน เนื้อหามีความสมจริง ไม่พึ่ง Lorem Ipsum หรือข้อมูลตัวแทนมากเกินไป",
        "องค์ประกอบส่วนใหญ่ครบ มีรายละเอียดหรือเนื้อหาบางส่วนที่ยังไม่สมบูรณ์",
        "มีองค์ประกอบสำคัญขาดหลายส่วน หรือมีเนื้อหาตัวแทน/Placeholder ที่เห็นได้ชัด",
        "ขาดองค์ประกอบสำคัญจำนวนมาก ทำให้หน้าจอไม่สมบูรณ์หรือไม่สามารถสื่อการใช้งานได้",
      ],
      en: [
        "All elements required by the screens and the assigned tasks are present, and the content is realistic, relying little on Lorem Ipsum or stand-in data.",
        "Most elements are present; some details or content are still incomplete.",
        "Several important elements are missing, or obvious placeholder content remains.",
        "Many important elements are missing, so the screens are incomplete or cannot convey how the product is used.",
      ],
    },
  },
  {
    name: { th: "การจัดวางและความสมดุลของหน้าจอ", en: "Layout & Balance" },
    description: { th: "Layout & Balance", en: "How balanced the screen layout is" },
    weight: 15,
    levels: {
      th: [
        "การจัดวางมีความสมดุล ใช้พื้นที่เหมาะสมกับเนื้อหาและวัตถุประสงค์ของหน้าจอ ไม่มีพื้นที่ว่างหรือความหนาแน่นที่รบกวนการใช้งาน",
        "โดยรวมสมดุล แต่มีบางบริเวณที่แน่นหรือโล่งเกินไปเล็กน้อย",
        "มีปัญหาความสมดุลหลายบริเวณ ทำให้การอ่านหรือการใช้งานบางส่วนไม่สะดวก",
        "การจัดวางไม่สมดุลอย่างชัดเจน และส่งผลต่อความเข้าใจหรือการใช้งาน",
      ],
      en: [
        "The layout is balanced and uses space appropriately for the content and the screen's purpose, with no empty areas or density that get in the way of use.",
        "Generally balanced, but a few areas are slightly too crowded or too empty.",
        "Balance problems in several areas make some reading or use inconvenient.",
        "The layout is clearly unbalanced and hurts understanding or use.",
      ],
    },
  },
  {
    name: { th: "ระยะห่าง การจัดแนว และรูปแบบ Grid", en: "Spacing, Alignment & Grid Pattern" },
    description: { th: "Spacing, Alignment & Grid Pattern", en: "Consistency of spacing, alignment and grid" },
    weight: 10,
    levels: {
      th: [
        "ระยะห่าง การจัดแนว และ Grid มีรูปแบบที่ชัดเจนและสม่ำเสมอ องค์ประกอบต่าง ๆ อยู่ในแนวที่เป็นระบบ",
        "โดยรวมมีรูปแบบสม่ำเสมอ แต่พบความคลาดเคลื่อนเล็กน้อยบางจุด",
        "พบความไม่สม่ำเสมอของระยะห่างหรือการจัดแนวหลายจุด และเริ่มทำให้ UI ดูไม่เป็นระบบ",
        "ไม่มีรูปแบบของระยะห่าง/การจัดแนวที่ชัดเจน และทำให้ UI ดูไม่เป็นระบบ",
      ],
      en: [
        "Spacing, alignment and grid follow a clear, consistent pattern, and elements sit on systematic lines.",
        "Generally consistent, with small deviations in a few places.",
        "Spacing or alignment is inconsistent in several places, and the UI starts to look unsystematic.",
        "There is no clear spacing/alignment pattern, and the UI looks unsystematic.",
      ],
    },
  },
  {
    name: { th: "ความสม่ำเสมอของ Component และ Design System", en: "Component Consistency & Design System" },
    description: { th: "Component Consistency & Design System", en: "Consistent use of components, styles and a design system" },
    weight: 15,
    levels: {
      th: [
        "ใช้ Color Styles, Typography Styles และ Components/Variants อย่างเป็นระบบ องค์ประกอบที่มีหน้าที่เดียวกันมีรูปแบบสอดคล้องกันทุกหน้าจอ",
        "โดยรวมมีความสม่ำเสมอ แต่มีความแตกต่างเล็กน้อยบางองค์ประกอบ หรือมีบางส่วนที่ไม่ได้ใช้ Style/Component",
        "พบความแตกต่างของ Component, สี หรือ Typography หลายจุดโดยไม่มีเหตุผลที่ชัดเจน",
        "แต่ละหน้าจอมีรูปแบบแตกต่างกันอย่างชัดเจน ไม่มี Design System หรือรูปแบบร่วมที่สม่ำเสมอ",
      ],
      en: [
        "Color styles, typography styles and components/variants are used systematically; elements with the same function look the same on every screen.",
        "Generally consistent, with minor differences in some elements or some parts that do not use a style/component.",
        "Components, colors or typography differ in several places without a clear reason.",
        "Each screen looks clearly different; there is no design system or shared pattern.",
      ],
    },
  },
  {
    name: { th: "ลำดับความสำคัญทางสายตา", en: "Visual Hierarchy" },
    description: { th: "Visual Hierarchy", en: "How clearly the screen shows what matters most" },
    weight: 15,
    levels: {
      th: [
        "สามารถแยก Primary/Secondary information และ Primary Action ได้ชัดเจน ขนาด สี น้ำหนัก และตำแหน่งช่วยนำสายตาได้เหมาะสม",
        "ลำดับความสำคัญโดยรวมชัดเจน แต่มีบางส่วนที่แยกความสำคัญได้ไม่ชัด",
        "มีหลายส่วนที่มีความสำคัญทางสายตาใกล้เคียงกัน ทำให้ผู้ใช้ไม่รู้ว่าควรสนใจหรือทำสิ่งใดก่อน",
        "ไม่มีลำดับความสำคัญที่ชัดเจน ทำให้ยากต่อการทำความเข้าใจหน้าจอ",
      ],
      en: [
        "Primary and secondary information and the primary action are clearly distinguishable; size, color, weight and position guide the eye appropriately.",
        "The hierarchy is clear overall, but some parts do not distinguish importance well.",
        "Several parts have similar visual weight, so users cannot tell what to look at or do first.",
        "There is no clear hierarchy, which makes the screen hard to understand.",
      ],
    },
  },
  {
    name: { th: "ตัวอักษร สี และ Accessibility", en: "Typography, Color & Accessibility" },
    description: { th: "Typography, Color & Accessibility", en: "Readable type, consistent color, sufficient contrast" },
    weight: 15,
    levels: {
      th: [
        "ตัวอักษรอ่านง่าย ขนาดและน้ำหนักเหมาะสม สีมีความสม่ำเสมอ Contrast เพียงพอ และไม่ใช้สีเพียงอย่างเดียวในการสื่อความหมาย",
        "โดยรวมอ่านง่ายและเข้าถึงได้ แต่มีปัญหาเล็กน้อยบางจุด เช่น ขนาดตัวอักษรหรือ Contrast บางส่วน",
        "มีปัญหาด้านการอ่านหรือ Accessibility หลายจุด เช่น ตัวอักษรเล็ก Contrast ต่ำ หรือใช้สีที่สื่อความหมายไม่ชัด",
        "มีปัญหาด้าน Typography/Color/Contrast อย่างรุนแรงจนกระทบการอ่านหรือการใช้งาน",
      ],
      en: [
        "Text is easy to read with suitable size and weight, colors are consistent, contrast is sufficient, and color is not the only way meaning is conveyed.",
        "Generally readable and accessible, with minor problems such as text size or contrast in places.",
        "Several reading or accessibility problems, such as small text, low contrast, or colors that convey meaning unclearly.",
        "Severe typography/color/contrast problems that hurt reading or use.",
      ],
    },
  },
  {
    name: { th: "การเชื่อมโยง Flow และความสมบูรณ์ของ Interaction", en: "Prototype Flow & Interaction Completeness" },
    description: { th: "Prototype Flow & Interaction Completeness", en: "Whether the prototype's core flow works end to end" },
    weight: 15,
    levels: {
      th: [
        "Core User Flow สามารถทำงานตั้งแต่ต้นจนจบได้ ไม่มี Dead End และ Interaction ที่จำเป็นเชื่อมโยงถูกต้อง",
        "Core Flow ทำงานได้เกือบครบ แต่มีปัญหาเล็กน้อย เช่น Link หรือ Transition บางจุด",
        "มีปัญหาหลายจุดใน Flow เช่น Link ผิด ขาดการเชื่อมต่อ หรือเกิด Dead End",
        "ไม่สามารถทำ Core User Flow ให้สำเร็จได้ หรือ Prototype ขาดการเชื่อมโยงที่จำเป็น",
      ],
      en: [
        "The core user flow works from start to finish with no dead ends, and the necessary interactions are linked correctly.",
        "The core flow almost fully works, with small issues such as a link or transition in places.",
        "Several flow problems, such as wrong links, missing connections or dead ends.",
        "The core user flow cannot be completed, or the prototype lacks necessary connections.",
      ],
    },
  },
];

// ---------------------------------------------------------------------------------------------------------------------
// Programming (c-mock-1 and the AI assistant)
// ---------------------------------------------------------------------------------------------------------------------
const CORRECT = spec("ความถูกต้องของโปรแกรม", "Program correctness", "การทำงานของโปรแกรมให้ผลลัพธ์ถูกต้องตามโจทย์", "the program's output matching the task",
  "โปรแกรมทำงานได้ผลลัพธ์ถูกต้องครบทุกข้อตามโจทย์ รวมถึงกรณีขอบ", "The program produces correct output for every task, including edge cases.", 60);
const READABLE = spec("ความอ่านง่ายของโค้ด", "Code readability", "การตั้งชื่อ การจัดรูปแบบ และ comment ของโค้ด", "naming, formatting and comments in the code",
  "ตั้งชื่อสื่อความหมาย จัดรูปแบบสม่ำเสมอ และมี comment เท่าที่จำเป็น", "Names are meaningful, formatting is consistent, and comments are used where needed.", 20);
const ERRORS = spec("การจัดการ Error", "Error handling", "การรับมือ input ผิดพลาดและกรณีผิดปกติ", "handling of bad input and unusual cases",
  "จัดการ input ผิดพลาดและกรณีผิดปกติได้อย่างเหมาะสม โปรแกรมไม่หยุดทำงานกะทันหัน", "Bad input and unusual cases are handled sensibly; the program never stops unexpectedly.", 20);
const STRUCTURE = spec("การออกแบบโครงสร้างโปรแกรม", "Program structure", "การแบ่งฟังก์ชันและโมดูลของโปรแกรม", "how the program is split into functions and modules",
  "แบ่งฟังก์ชัน/โมดูลอย่างเหมาะสม แต่ละส่วนมีหน้าที่ชัดเจนและนำกลับมาใช้ซ้ำได้", "Functions/modules are split sensibly; each part has a clear job and can be reused.", 30);
const TEAMWORK = spec("การทำงานร่วมกันเป็นทีม", "Teamwork", "การแบ่งงานและการมีส่วนร่วมของสมาชิกในทีม", "how work is shared and every member contributes",
  "มีเอกสารแบ่งงานชัดเจน สมาชิกทุกคนมีส่วนร่วมและประวัติการส่งงาน (commit) สอดคล้องกัน", "A clear work-split document exists, every member contributes, and the commit history agrees.", 20);
const FUNCTIONAL = spec("ความถูกต้องของฟังก์ชันการทำงาน", "Feature correctness", "ฟังก์ชันหลักของระบบที่กำหนดทำงานได้ถูกต้อง", "the required features working correctly",
  "ฟังก์ชันหลักทุกข้อที่กำหนดทำงานได้ถูกต้องและต่อเนื่องกันเป็นระบบ", "Every required feature works correctly and fits together as one system.", 50);

export const PY_EXERCISE: CriterionSpec[] = [CORRECT, READABLE, ERRORS];
/** A lab on writing functions: correct functions, docstrings and style, test cases. */
export const LAB_FUNCTIONS: CriterionSpec[] = [
  spec("ความถูกต้องของฟังก์ชัน", "Function correctness", "ฟังก์ชันที่เขียนทำงานได้ผลลัพธ์ถูกต้องตามที่กำหนด", "the functions returning correct results",
    "ทุกฟังก์ชันรับพารามิเตอร์และคืนค่าถูกต้องตามที่กำหนด รวมถึงกรณีขอบ", "Every function takes its parameters and returns the right value, including edge cases.", 50),
  spec("รูปแบบและเอกสารประกอบ", "Style and documentation", "docstring และรูปแบบการเขียนของฟังก์ชัน", "docstrings and the style of the functions",
    "มี docstring อธิบายการทำงานของทุกฟังก์ชัน ตั้งชื่อและจัดรูปแบบสม่ำเสมอ", "Every function has a docstring; naming and formatting are consistent.", 25),
  spec("กรณีทดสอบ", "Test cases", "กรณีทดสอบที่เขียนเพื่อตรวจฟังก์ชัน", "the test cases written to check the functions",
    "มีกรณีทดสอบครอบคลุมทั้งกรณีปกติและกรณีขอบของทุกฟังก์ชัน", "Test cases cover both normal and edge cases for every function.", 25),
];
export const PROGRAM_MINI_PROJECT: CriterionSpec[] = [{ ...CORRECT, weight: 50 }, { ...ERRORS, weight: 30 }, { ...READABLE, weight: 20 }];
export const PROGRAM_GROUP_PROJECT: CriterionSpec[] = [FUNCTIONAL, STRUCTURE, TEAMWORK];
/** What the AI assistant suggests for code / lab work (100 points). */
export const PROGRAMMING_AI: CriterionSpec[] = [{ ...CORRECT, weight: 40 }, { ...STRUCTURE, weight: 20 }, { ...READABLE, weight: 20 }, { ...ERRORS, weight: 20 }];

// ---------------------------------------------------------------------------------------------------------------------
// Quizzes and exams: one frame, filled with the subject's topic
// ---------------------------------------------------------------------------------------------------------------------
export function quizCriteria(topic: Bi): CriterionSpec[] {
  return [
    spec(`ความเข้าใจแนวคิด${topic.th}`, `Understanding of ${topic.en}`, `ความเข้าใจแนวคิดเรื่อง${topic.th}`, `understanding of ${topic.en}`,
      `ตอบคำถามเรื่อง${topic.th}ได้ถูกต้องครบถ้วน แสดงความเข้าใจแนวคิดอย่างชัดเจน`, `Answers on ${topic.en} are correct and complete and show clear understanding.`, 40),
    spec("ความถูกต้องของคำตอบ", "Answer accuracy", "ความถูกต้องของคำตอบแต่ละข้อ", "the accuracy of each answer",
      "คำตอบถูกต้องเกือบทุกข้อ ไม่มีข้อผิดพลาดสำคัญ", "Almost every answer is correct, with no major mistakes.", 30),
    spec("การให้เหตุผลและอธิบายคำตอบ", "Reasoning and explanation", "การอธิบายเหตุผลประกอบคำตอบ", "the reasoning given with each answer",
      "อธิบายเหตุผลประกอบคำตอบได้ชัดเจน เป็นลำดับ และอ้างอิงหลักการที่ถูกต้อง", "Reasoning is clear, in order, and based on the right principles.", 30),
  ];
}
export function examCriteria(topic: Bi): CriterionSpec[] {
  return [
    spec(`ความเข้าใจทฤษฎี${topic.th}`, `Understanding of ${topic.en} theory`, `ความเข้าใจทฤษฎีและหลักการเรื่อง${topic.th}`, `understanding of the theory and principles of ${topic.en}`,
      `อธิบายทฤษฎีและหลักการเรื่อง${topic.th}ได้ถูกต้อง ครบถ้วน และเชื่อมโยงกันเป็นระบบ`, `Theory and principles of ${topic.en} are explained correctly, completely and coherently.`, 30),
    spec("การประยุกต์และการแก้โจทย์", "Applying and solving problems", "การนำหลักการไปแก้โจทย์ปัญหา", "applying the principles to solve problems",
      "เลือกวิธีและนำหลักการไปแก้โจทย์ได้เหมาะสม ครอบคลุมโจทย์ทั้งง่ายและซับซ้อน", "Chooses suitable methods and applies the principles to both easy and complex problems.", 40),
    spec("ความถูกต้องของการคำนวณและการเขียนตอบ", "Accuracy of working and written answers", "ความถูกต้องของขั้นตอนและคำตอบสุดท้าย", "the accuracy of the working and the final answers",
      "แสดงวิธีทำครบถ้วน ขั้นตอนถูกต้อง และคำตอบสุดท้ายถูกต้อง", "Working is shown in full, the steps are correct, and the final answers are right.", 30),
  ];
}
/** What the AI assistant suggests for exams / quizzes (100 points). */
export const EXAM_AI: CriterionSpec[] = examCriteria({ th: "เนื้อหาที่สอบ", en: "the examined material" });

// ---------------------------------------------------------------------------------------------------------------------
// Earlier-term subjects: topic + the lab criteria that fit the subject
// ---------------------------------------------------------------------------------------------------------------------
export type SubjectKey = "programming" | "discrete" | "dsa" | "logic" | "arch" | "db" | "se" | "os";
export const SUBJECTS: Record<SubjectKey, { topic: Bi; lab: CriterionSpec[] }> = {
  programming: { topic: { th: "การเขียนโปรแกรม", en: "programming" }, lab: PY_EXERCISE },
  discrete: {
    topic: { th: "โครงสร้างไม่ต่อเนื่อง", en: "discrete structures" },
    lab: [
      spec("ความถูกต้องของคำตอบและการพิสูจน์", "Correctness of answers and proofs", "ความถูกต้องของคำตอบและการพิสูจน์", "the correctness of answers and proofs",
        "คำตอบและการพิสูจน์ถูกต้องครบทุกข้อ ไม่มีช่องว่างทางตรรกะ", "Answers and proofs are correct on every item, with no logical gaps.", 50),
      spec("ขั้นตอนการให้เหตุผล", "Reasoning steps", "ความชัดเจนของขั้นตอนการให้เหตุผล", "the clarity of the reasoning steps",
        "แสดงขั้นตอนการให้เหตุผลเรียงลำดับ ชัดเจน และอ้างอิงทฤษฎีบทที่ใช้", "Reasoning is shown step by step, clearly, citing the theorems used.", 30),
      spec("การใช้สัญลักษณ์ทางคณิตศาสตร์", "Mathematical notation", "การใช้สัญลักษณ์และการเขียนทางคณิตศาสตร์", "the use of mathematical notation",
        "ใช้สัญลักษณ์และรูปแบบการเขียนถูกต้องสม่ำเสมอ", "Notation and writing conventions are correct and consistent.", 20),
    ],
  },
  dsa: {
    topic: { th: "โครงสร้างข้อมูลและอัลกอริทึม", en: "data structures and algorithms" },
    lab: [
      spec("ความถูกต้องของอัลกอริทึม", "Algorithm correctness", "ความถูกต้องของอัลกอริทึมที่เขียน", "the correctness of the algorithm",
        "อัลกอริทึมให้ผลถูกต้องกับทุกชุดทดสอบ รวมถึงกรณีขอบ", "The algorithm gives correct results on every test, including edge cases.", 45),
      spec("การเลือกโครงสร้างข้อมูลและวิเคราะห์ความซับซ้อน", "Data-structure choice and complexity analysis", "การเลือกโครงสร้างข้อมูลและการวิเคราะห์ความซับซ้อน", "the choice of data structure and the complexity analysis",
        "เลือกโครงสร้างข้อมูลได้เหมาะสมและวิเคราะห์ความซับซ้อนของเวลา/หน่วยความจำได้ถูกต้อง", "Picks a suitable data structure and analyses time/space complexity correctly.", 35),
      spec("คุณภาพโค้ดและการทดสอบ", "Code quality and testing", "ความอ่านง่ายของโค้ดและชุดทดสอบ", "code readability and the test set",
        "โค้ดอ่านง่าย มีชุดทดสอบครอบคลุมกรณีสำคัญ", "Code is readable and the tests cover the important cases.", 20),
    ],
  },
  logic: {
    topic: { th: "ตรรกะดิจิทัล", en: "digital logic" },
    lab: [
      spec("ความถูกต้องของวงจร", "Circuit correctness", "ความถูกต้องของวงจรที่ออกแบบ", "the correctness of the designed circuit",
        "วงจรทำงานตรงตาม truth table / ข้อกำหนดทุกกรณี", "The circuit matches the truth table / specification in every case.", 50),
      spec("การลดรูปและประสิทธิภาพของการออกแบบ", "Simplification and design efficiency", "การลดรูปสมการและความประหยัดของวงจร", "how the logic is simplified and how economical the circuit is",
        "ลดรูปสมการได้เหมาะสม ใช้เกตและอุปกรณ์อย่างประหยัด", "Equations are simplified well and gates/parts are used economically.", 30),
      spec("การจำลองและตรวจสอบผล", "Simulation and verification", "การจำลองวงจรและการตรวจสอบผล", "the circuit simulation and verification of results",
        "จำลองวงจรและตรวจสอบผลกับกรณีทดสอบครบถ้วน พร้อมบันทึกผล", "The circuit is simulated and verified against complete test cases, with results recorded.", 20),
    ],
  },
  arch: {
    topic: { th: "สถาปัตยกรรมคอมพิวเตอร์", en: "computer architecture" },
    lab: [
      spec("ความถูกต้องของการออกแบบ/โปรแกรมแอสเซมบลี", "Correctness of the design / assembly program", "ความถูกต้องของการออกแบบหรือโปรแกรมแอสเซมบลี", "the correctness of the design or assembly program",
        "การออกแบบหรือโปรแกรมแอสเซมบลีทำงานถูกต้องตามที่กำหนดทุกคำสั่ง", "The design or assembly program behaves correctly for every instruction required.", 45),
      spec("การวิเคราะห์ประสิทธิภาพ", "Performance analysis", "การวิเคราะห์ประสิทธิภาพของสิ่งที่ออกแบบ", "the performance analysis of what was designed",
        "วิเคราะห์ประสิทธิภาพ (เช่น CPI, จำนวนรอบ) ได้ถูกต้องและเปรียบเทียบทางเลือกได้", "Performance (CPI, cycle count) is analysed correctly and alternatives are compared.", 35),
      spec("การอธิบายและรายงานผลการทดลอง", "Explanation and lab report", "ความชัดเจนของรายงานผลการทดลอง", "the clarity of the lab report",
        "รายงานอธิบายแนวคิด ผลการทดลอง และข้อสรุปได้ชัดเจน", "The report explains the idea, the results and the conclusions clearly.", 20),
    ],
  },
  db: {
    topic: { th: "ระบบฐานข้อมูล", en: "database systems" },
    lab: [
      spec("ความถูกต้องของแบบจำลองข้อมูล", "Data-model correctness", "ความถูกต้องของแผนภาพ ER และ schema", "the correctness of the ER diagram and schema",
        "แบบจำลอง ER และ schema ถูกต้อง ครอบคลุมข้อกำหนด และผ่านการทำ normalization", "The ER model and schema are correct, cover the requirements, and are normalised.", 35),
      spec("ความถูกต้องและประสิทธิภาพของคำสั่ง SQL", "SQL correctness and efficiency", "ความถูกต้องและประสิทธิภาพของคำสั่ง SQL", "the correctness and efficiency of the SQL",
        "คำสั่ง SQL ให้ผลถูกต้องทุกข้อ และเขียนอย่างมีประสิทธิภาพ", "SQL gives correct results on every item and is written efficiently.", 45),
      spec("เอกสารและข้อมูลทดสอบ", "Documentation and test data", "เอกสารประกอบและข้อมูลทดสอบ", "the documentation and test data",
        "มีเอกสารอธิบายและข้อมูลทดสอบที่ครอบคลุมกรณีสำคัญ", "Documentation and test data cover the important cases.", 20),
    ],
  },
  se: {
    topic: { th: "วิศวกรรมซอฟต์แวร์", en: "software engineering" },
    lab: [
      spec("ความครบถ้วนของ requirement และเอกสารออกแบบ", "Completeness of requirements and design documents", "ความครบถ้วนของ requirement และเอกสารออกแบบ", "the completeness of requirements and design documents",
        "requirement ครบถ้วน ตรวจสอบย้อนกลับได้ และเอกสารออกแบบสอดคล้องกัน", "Requirements are complete and traceable, and the design documents agree with them.", 40),
      spec("คุณภาพของแผนภาพ UML", "UML diagram quality", "ความถูกต้องและอ่านง่ายของแผนภาพ UML", "the correctness and readability of the UML diagrams",
        "แผนภาพ UML ถูกต้องตามมาตรฐาน อ่านง่าย และสื่อการออกแบบได้ครบ", "UML diagrams follow the standard, read easily, and convey the whole design.", 35),
      spec("การทำงานร่วมกันและการใช้ Git", "Teamwork and Git use", "การแบ่งงานและการใช้ Git ในทีม", "how work is shared and Git is used in the team",
        "แบ่งงานชัดเจน ใช้ branch/commit อย่างเป็นระบบ และทุกคนมีส่วนร่วม", "Work is split clearly, branches/commits are used systematically, and everyone contributes.", 25),
    ],
  },
  os: {
    topic: { th: "ระบบปฏิบัติการ", en: "operating systems" },
    lab: [
      spec("ความถูกต้องของโปรแกรมระบบ", "System-program correctness", "ความถูกต้องของโปรแกรมที่เกี่ยวกับ process/thread", "the correctness of the process/thread program",
        "โปรแกรมจัดการ process/thread ทำงานถูกต้องตามที่กำหนดในทุกสถานการณ์ทดสอบ", "The process/thread program works correctly in every test scenario.", 45),
      spec("การจัดการทรัพยากรและ synchronization", "Resource management and synchronization", "การจัดการทรัพยากรและการประสานงานระหว่าง process", "resource management and synchronisation between processes",
        "จัดการทรัพยากรและ synchronization ได้ถูกต้อง ไม่เกิด race condition หรือ deadlock", "Resources and synchronisation are handled correctly, with no race conditions or deadlocks.", 35),
      spec("การวิเคราะห์ผลการทดลอง", "Analysis of results", "การวิเคราะห์และอธิบายผลการทดลอง", "the analysis and explanation of the results",
        "วิเคราะห์ผลการทดลองและอธิบายพฤติกรรมของระบบได้ถูกต้อง", "Experimental results are analysed and the system's behaviour is explained correctly.", 20),
    ],
  },
};

/** UX research (the seed assignment of the demo course): interviews, personas, insights. */
export const UX_RESEARCH: CriterionSpec[] = [
  spec("การสัมภาษณ์ผู้ใช้", "User interviews", "คุณภาพและความลึกของการสัมภาษณ์ผู้ใช้งาน", "the quality and depth of the user interviews",
    "สัมภาษณ์ผู้ใช้ครบตามจำนวนที่กำหนด คำถามเปิดกว้างและเก็บข้อมูลเชิงลึกได้จริง", "Interviews cover the required number of users, with open questions that gather real insight.", 30),
  spec("User Persona", "User persona", "ความครบถ้วนและความแม่นยำของ Persona", "the completeness and accuracy of the personas",
    "Persona ครบทุกส่วน สอดคล้องกับข้อมูลที่สัมภาษณ์ และสะท้อนเป้าหมายกับปัญหาของผู้ใช้", "Personas are complete, consistent with the interviews, and reflect users' goals and problems.", 40),
  spec("Insight และสรุปผล", "Insights and conclusions", "ความลึกและความเข้าใจของ Pain Points และ Insights", "the depth of the pain points and insights",
    "วิเคราะห์ Pain Points และสรุป Insight ที่นำไปออกแบบต่อได้จริง", "Pain points are analysed and the insights drawn can really feed the design.", 30),
];

// ---------------------------------------------------------------------------------------------------------------------
// The AI Rubric Assistant: pick the template that fits what the teacher typed
// ---------------------------------------------------------------------------------------------------------------------
export interface AiTemplate { id: "uxui" | "exam" | "programming"; criteria: CriterionSpec[] }

const has = (brief: string, words: string[]) => words.some((w) => brief.includes(w));
const isUxUi = (b: string) => /\b(ux|ui|gui)\b/i.test(b) || has(b.toLowerCase(), ["figma", "prototype", "wireframe", "usability", "design system", "user interface", "user experience", "ส่วนติดต่อผู้ใช้", "ออกแบบหน้าจอ", "ประสบการณ์ผู้ใช้", "โปรโตไทป์"]);
const isExam = (b: string) => /\b(exam|quiz|test|midterm|final exam)\b/i.test(b) || has(b, ["สอบ", "แบบทดสอบ", "ควิซ", "ข้อสอบ"]);
const isCode = (b: string) => /\b(code|coding|program|programming|python|java|javascript|c\+\+|lab|algorithm|sql|debug|function)\b/i.test(b) || has(b, ["โปรแกรม", "โค้ด", "แล็บ", "เขียนโค้ด", "ฟังก์ชัน", "อัลกอริทึม", "ฐานข้อมูล"]);

/** null → nothing specific matched: the assistant falls back to its general-purpose suggestions. UX/UI wins over exams, exams over code. */
export function pickAiTemplate(brief: string): AiTemplate | null {
  if (isUxUi(brief)) return { id: "uxui", criteria: UXUI_FINAL };
  if (isExam(brief)) return { id: "exam", criteria: EXAM_AI };
  if (isCode(brief)) return { id: "programming", criteria: PROGRAMMING_AI };
  return null;
}

// Step-by-step screenshots of "Grade with AI": popup with work waiting, then the "continue" popup with nothing waiting.
// Output: report-ui/ai-popup-24-oct/*.png (git-ignored). Needs the app on :3100 (AI_POPUP_BASE to change).
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AI_POPUP_BASE ?? "http://localhost:3100";
const OUT = path.resolve("report-ui/ai-popup-24-oct");
fs.mkdirSync(OUT, { recursive: true });
const NOW = "2026-01-01T00:00:00.000Z";
const PEOPLE = [["69071101", "สมชาย"], ["69071102", "สมหญิง"], ["69071103", "ธนา"], ["69071104", "มาลี"], ["69071105", "ปิติ"]];
const levels = [{ label: "ดีมาก", description: "" }, { label: "ดี", description: "" }, { label: "ต้องปรับปรุง", description: "" }];
const RUBRIC = { id: "r1", assignmentId: "as1", name: "Rubric หน้า Landing page", createdAt: NOW, updatedAt: NOW, aiOffsets: { k1: 1 },
  criteria: [{ id: "k1", name: "Layout", description: "", maxPoints: 60, weight: 60, levels }, { id: "k2", name: "Accessibility", description: "", maxPoints: 40, weight: 40, levels }] };

async function open(browser, lastNeedsReview) {
  const ctx = await browser.newContext({ viewport: { width: 1480, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(([people, rubric, reviewed]) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    const NOW = "2026-01-01T00:00:00.000Z";
    localStorage.setItem("hwai_lang", "th");
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([{ id: "c-rs", name: "UX/UI Design", description: "", status: "active", source: "manual", coverColor: "#2DD4BF", iconColor: "#2DD4BF", courseTemplateId: "ct-rs", term: 1, academicYear: 2569, sectionNumber: "1", code: "01076555", schedule: "-", room: "-", createdAt: NOW, updatedAt: NOW }]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([{ id: "t1", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-rs"] }]));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(people.map(([id, f], i) => ({ id: `cs-${i}`, studentId: id, firstName: f, lastName: "ทดสอบ", email: `${id}@kmitl.ac.th`, program: "CE", status: "active" }))));
    localStorage.setItem("hwai_students_v1", JSON.stringify(people.map(([id, f], i) => ({ id: `r-${i}`, courseId: "c-rs", studentId: id, firstName: f, lastName: "ทดสอบ", email: `${id}@kmitl.ac.th`, sequenceNumber: i + 1, enrollmentStatus: "enrolled" }))));
    localStorage.setItem("hwai_grading_categories_v1", "[]");
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([{ id: "as1", courseId: "c-rs", name: "Landing page", description: "", dueDate: "2026-01-10", maxPoints: 100, acceptsFiles: true, fileTypes: ["pdf"], submissionType: "individual", maxGroupSize: null, rubricIds: ["r1"], createdAt: NOW, updatedAt: NOW }]));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify([rubric]));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(people.map(([id, f], i) => {
      const base = { id: `sub-${id}`, assignmentId: "as1", studentId: id, studentName: `${f} ทดสอบ`, email: `${id}@kmitl.ac.th`, submittedAt: "2026-01-05T10:00:00.000Z", fileUrl: null, externalUseConsent: false, instructorComment: "", updatedAt: NOW };
      if (i < 4) return { ...base, aiScore: 50 + i, instructorScore: 50 + i, status: "graded", criterionScores: { k1: 30, k2: 20 + i } };
      return reviewed ? { ...base, aiScore: 55, instructorScore: null, status: "need_review", aiCriterionScores: { k1: 30, k2: 25 } } : { ...base, aiScore: null, instructorScore: null, status: "not_graded" };
    })));
  }, [PEOPLE, RUBRIC, lastNeedsReview]);
  return page;
}
const row = (page) => page.locator("main li", { hasText: "Landing page" });
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });
const settle = (page) => page.waitForLoadState("networkidle").then(() => page.waitForTimeout(600));

const browser = await chromium.launch();
// A) work is waiting for the AI
let page = await open(browser, false);
await page.goto(`${BASE}/teacher/courses/c-rs/grading`); await settle(page);
await shot(page, "A1-queue-grade-with-ai-button");
await row(page).getByRole("button", { name: /ตรวจด้วย AI/ }).click(); await settle(page);
await shot(page, "A2-popup-work-waiting");
await page.getByTestId("ai-preview-confirm").click();
await page.waitForURL(/assignments\/as1\/grading$/); await settle(page);
await shot(page, "A3-after-confirm-assignment-grading");
// B) continue: nothing waits any more
page = await open(browser, true);
await page.goto(`${BASE}/teacher/courses/c-rs/grading`); await settle(page);
await shot(page, "B1-queue-continue-button");
await row(page).getByRole("button", { name: /ตรวจด้วย AI/ }).click(); await settle(page);
await shot(page, "B2-popup-nothing-waiting");
await page.getByTestId("ai-preview-confirm").click();
await page.waitForURL(/assignments\/as1\/grading$/); await settle(page);
await shot(page, "B3-after-open-grading");
await browser.close();
console.log(fs.readdirSync(OUT));

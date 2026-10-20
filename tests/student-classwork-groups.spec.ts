import { test, expect, Page } from "@playwright/test";

import { BASE } from "./base";

// 14/10/2569 — the student's classwork list: an "Overdue" group of its own (it used to be mixed into "Due soon"), and every group folds.
// Only what needs the student stays open at first — Overdue, Due soon, Not submitted; Awaiting score and Submitted are closed.
// What the student opens or closes is remembered, per course, in this browser.

const NOW = "2026-01-01T00:00:00.000Z";
const ymd = (daysFromToday: number) => { const d = new Date(Date.now() + daysFromToday * 86_400_000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const COURSE = { id: "c-cg", name: "Data Structures", description: "", status: "active", source: "manual", coverColor: "#F97316", iconColor: "#F97316", createdAt: NOW, updatedAt: NOW };
const asg = (id: string, name: string, dueDate: string | undefined, extra: Record<string, unknown> = {}) => ({
  id, courseId: "c-cg", name, description: "", dueDate, maxPoints: 10, submissionType: "individual", attachments: [], gradingFinalized: true, createdAt: NOW, updatedAt: NOW, ...extra,
});
const ASSIGNMENTS = [
  asg("a-late", "Late lab", ymd(-3)),                // nothing handed in, due date passed
  asg("a-late2", "Later lab", ymd(-1)),
  asg("a-soon", "Tomorrow lab", ymd(1)),             // due within 3 days
  asg("a-far", "Far lab", ymd(30)),
  asg("a-sent", "Handed-in lab", ymd(5)),
  asg("a-exam", "Midterm exam", undefined, { isExam: true, acceptsFiles: false }),
];
const mine = (assignmentId: string, extra: Record<string, unknown> = {}) => ({
  id: `sub-${assignmentId}`, assignmentId, studentId: "64070501", studentName: "S", email: "s1@kmitl.ac.th", submittedAt: "2026-01-10T10:00:00.000Z", fileUrl: null,
  aiScore: null, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "need_review", updatedAt: NOW, ...extra,
});

async function open(page: Page, opts: { lang?: "en" | "th"; extra?: Record<string, string> } = {}) {
  await page.addInitScript((d) => {
    if (sessionStorage.getItem("cg_seeded")) return;
    sessionStorage.setItem("cg_seeded", "1");
    localStorage.setItem("hwai_lang", d.lang);
    localStorage.setItem("hwai_user", JSON.stringify({ name: "S", email: "s1@kmitl.ac.th", role: "student", studentId: "64070501" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([d.course]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify(d.assignments));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(d.subs));
    localStorage.setItem("hwai_students_v1", JSON.stringify([{ id: "sr-1", courseId: "c-cg", studentId: "64070501", firstName: "S", lastName: "S", email: "s1@kmitl.ac.th", cohort: "CE69" }]));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify([{ id: "cs-1", studentId: "64070501", firstName: "S", lastName: "S", email: "s1@kmitl.ac.th", cohort: "CE69", program: "CE" }]));
    for (const [k, v] of Object.entries(d.extra)) localStorage.setItem(k, v);
  }, { lang: opts.lang ?? "en", course: COURSE, assignments: ASSIGNMENTS, subs: [mine("a-sent")], extra: opts.extra ?? {} });
  await page.goto(`${BASE}/student/courses/c-cg/classwork`);
  await page.waitForLoadState("networkidle");
}
const toggle = (page: Page, label: string) => page.getByRole("button", { name: new RegExp(`^${label} \\(`) });
const cardNames = (page: Page, group: string) => page.getByTestId(group).locator("a p.font-semibold").evaluateAll((els) => els.map((e) => (e.textContent ?? "").trim()));

test("work whose due date has passed has its own group, oldest first, apart from 'Due soon'", async ({ page }) => {
  await open(page);
  expect(await cardNames(page, "group-overdue")).toEqual(["Late lab", "Later lab"]);
  expect(await cardNames(page, "group-dueSoon")).toEqual(["Tomorrow lab"]);
  expect(await cardNames(page, "group-notSubmitted")).toEqual(["Far lab"]);
  await expect(toggle(page, "Overdue")).toContainText("Overdue (2)");
  // top to bottom: the most urgent first
  const heads = await page.locator("main h2 button, h2 button").evaluateAll((els) => els.map((e) => (e.textContent ?? "").trim()));
  expect(heads.filter((h) => /\(\d+\)$/.test(h)).slice(0, 5)).toEqual(["Overdue (2)", "Due soon (1)", "Not submitted (1)", "Awaiting score (1)", "Submitted (1)"]);
});

test("Overdue, Due soon and Not submitted start open; Awaiting score and Submitted start closed", async ({ page }) => {
  await open(page);
  for (const g of ["Overdue", "Due soon", "Not submitted"]) await expect(toggle(page, g)).toHaveAttribute("aria-expanded", "true");
  for (const g of ["Awaiting score", "Submitted"]) await expect(toggle(page, g)).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("Late lab")).toBeVisible();
  await expect(page.getByText("Handed-in lab")).toHaveCount(0);       // folded away, still counted in the heading
  await expect(page.getByText("Midterm exam")).toHaveCount(0);
});

test("a group opens and closes by its heading, with the keyboard too", async ({ page }) => {
  await open(page);
  await toggle(page, "Submitted").click();
  await expect(toggle(page, "Submitted")).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Handed-in lab")).toBeVisible();
  await toggle(page, "Overdue").focus();
  await page.keyboard.press("Enter");
  await expect(toggle(page, "Overdue")).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("Late lab")).toHaveCount(0);
  await expect(page.getByText("Tomorrow lab")).toBeVisible();          // the others are not affected
});

test("what the student opened or closed is remembered for this course after a reload", async ({ page }) => {
  await open(page);
  await toggle(page, "Submitted").click();
  await toggle(page, "Not submitted").click();
  await page.reload();
  await expect(toggle(page, "Submitted")).toHaveAttribute("aria-expanded", "true");
  await expect(toggle(page, "Not submitted")).toHaveAttribute("aria-expanded", "false");
  await expect(toggle(page, "Overdue")).toHaveAttribute("aria-expanded", "true");        // untouched → still the default
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_classwork_open_v1") ?? "{}"));
  expect(stored["c-cg"]).toMatchObject({ submitted: true, notSubmitted: false });
});

test("a broken saved value falls back to the defaults instead of breaking the page", async ({ page }) => {
  await open(page, { extra: { hwai_classwork_open_v1: "{not json" } });
  await expect(toggle(page, "Overdue")).toHaveAttribute("aria-expanded", "true");
  await expect(toggle(page, "Submitted")).toHaveAttribute("aria-expanded", "false");
});

test("Thai UI: the group is called เลยกำหนด", async ({ page }) => {
  await open(page, { lang: "th" });
  await expect(page.getByRole("button", { name: /^เลยกำหนด \(2\)/ })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: /^ส่งแล้ว \(1\)/ })).toHaveAttribute("aria-expanded", "false");
});

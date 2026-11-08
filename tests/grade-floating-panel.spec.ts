import { test, expect, Page, BrowserContext } from "@playwright/test";

import { BASE } from "./base";

// 14/10/2569 — a submitted link opens in another tab, and the teacher cannot grade what is in one tab from a page in another. So the
// grading part can float in its own small window, as Google Meet's call does. Chrome / Edge have Document Picture-in-Picture for that
// (not available in headless runs, so it is checked by hand); everywhere else, and here, it is a small popup window that holds the SAME
// panel — the state stays in the Grade page, so a click in the small window is a click in the page.

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-fp", name: "Programming", description: "", status: "active", source: "manual", coverColor: "#2DD4BF", iconColor: "#2DD4BF",
  courseTemplateId: "ct-fp", term: 1, academicYear: 2569, sectionNumber: "1", code: "01076112", schedule: "Mon", room: "811", createdAt: NOW, updatedAt: NOW,
};
const TEACHER = { id: "t-fp", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-fp"] };
const lv = (label: string) => ({ label, description: `${label} wording` });
const LEVELS = [lv("Excellent"), lv("Fair"), lv("Needs work"), lv("Fail")];
const ASSIGNMENT = {
  id: "a-fp", courseId: "c-fp", name: "Web project", description: "", dueDate: "2026-01-05", maxPoints: 12, submissionType: "individual",
  maxGroupSize: null, acceptsFiles: true, fileTypes: [], rubricIds: ["r-fp"], gradingMode: "manual", createdAt: NOW, updatedAt: NOW,
};
const RUBRIC = {
  id: "r-fp", assignmentId: "a-fp", name: "Rubric", createdAt: NOW, updatedAt: NOW,
  criteria: [
    { id: "c1", name: "C1 · Design / การออกแบบ", description: "", maxPoints: 9, weight: 75, levels: LEVELS },
    { id: "c2", name: "C2 · Content / เนื้อหา", description: "", maxPoints: 3, weight: 25, levels: LEVELS },
  ],
};
const sub = (id: string, attachments: unknown[]) => ({
  id, assignmentId: "a-fp", studentId: id, studentName: `Student ${id}`, email: `${id}@kmitl.ac.th`, submittedAt: "2026-01-05T10:00:00.000Z",
  fileUrl: null, attachments, aiScore: null, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "not_graded", updatedAt: NOW,
});
const LINK = (to: string) => ({ id: "l1", kind: "link", name: to, source: "url", ref: to });
const SUBS = (to: string) => [sub("with-link", [LINK(to)]), sub("no-link", [])];

/** `pip: false` takes Document Picture-in-Picture away (headless Chrome may or may not have it); `blockPopups` makes window.open return nothing, as a blocker does. */
async function open(page: Page, subId: string, opts: { lang?: "en" | "th"; blockPopups?: boolean } = {}) {
  await page.addInitScript((d) => {
    Object.defineProperty(window, "documentPictureInPicture", { value: undefined, configurable: true });
    if (d.blockPopups) window.open = () => null;
    if (sessionStorage.getItem("fp_seeded")) return;
    sessionStorage.setItem("fp_seeded", "1");
    localStorage.setItem("hwai_lang", d.lang);
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([d.course]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([d.teacher]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([d.assignment]));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify([d.rubric]));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(d.subs));
  }, { lang: opts.lang ?? "en", blockPopups: !!opts.blockPopups, course: COURSE, teacher: TEACHER, assignment: ASSIGNMENT, rubric: RUBRIC, subs: SUBS(`${BASE}/login`) });
  await page.goto(`${BASE}/teacher/courses/c-fp/assignments/a-fp/recheck?sub=${subId}`);
  await page.waitForLoadState("networkidle");
}

const level = (p: Page, criterion: string, label: string) => p.getByRole("radiogroup", { name: `Level for ${criterion}` }).getByRole("radio", { name: new RegExp("\\b" + label + "\\b") });
const stored = (p: Page, id: string) => p.evaluate((sid) => (JSON.parse(localStorage.getItem("hwai_submissions_v1") ?? "[]") as { id: string; status: string; instructorScore: number | null; criterionScores?: Record<string, number> }[]).find((s) => s.id === sid)!, id);

/** The small window: the page opened under the name the Grade screen gives it. */
async function smallWindow(context: BrowserContext): Promise<Page> {
  let found: Page | undefined;
  await expect.poll(async () => {
    for (const p of context.pages()) { if (await p.evaluate(() => window.name).catch(() => "") === "hwai-grade-panel") { found = p; return true; } }
    return false;
  }, { timeout: 15_000 }).toBe(true);
  await found!.waitForLoadState("domcontentloaded");
  return found!;
}

test("a submitted link offers 'open and grade in a small window'; a file submission does not", async ({ page }) => {
  await open(page, "with-link");
  await expect(page.getByTestId("open-link")).toHaveText("Open link and grade in a small window");
  await expect(page.getByTestId("grade-float-open")).toBeVisible();
  await page.goto(`${BASE}/teacher/courses/c-fp/assignments/a-fp/recheck?sub=no-link`);
  await expect(page.getByTestId("grade-float-open")).toHaveCount(0);
});

test("opening the link opens it in its own tab and floats the grading part in a small window; a click there is a click in the page", async ({ page, context }) => {
  await open(page, "with-link");
  await page.getByTestId("open-link").click();
  const small = await smallWindow(context);

  // the page hands the panel over: a note where it was, the cards in the small window
  await expect(page.getByTestId("grade-floating-note")).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Level for Design" })).toHaveCount(0);
  await expect(small.getByRole("radiogroup", { name: "Level for Design" })).toBeVisible();
  await expect(small.getByText("Grading Review")).toBeVisible();
  // it looks like the app (the stylesheets came along), not a bare page
  expect(await small.evaluate(() => getComputedStyle(document.querySelector("button[role=radio]")!).borderTopLeftRadius)).not.toBe("0px");

  await level(small, "Design", "Fair").click();
  await level(small, "Content", "Excellent").click();
  await expect(small.getByTestId("crit-score-c1")).toContainText("6 / 9");
  await expect(small.getByText("9 / 12")).toBeVisible();

  // bring it back: the same marks are in the page
  await page.getByTestId("grade-float-return").click();
  await expect(page.getByTestId("grade-floating-note")).toHaveCount(0);
  await expect(level(page, "Design", "Fair")).toHaveAttribute("aria-checked", "true");
  await expect(level(page, "Content", "Excellent")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("crit-score-c1")).toContainText("6 / 9");
  await expect.poll(async () => small.isClosed()).toBe(true);                       // the small window went away with it
});

test("saving from the small window saves the submission", async ({ page, context }) => {
  await open(page, "with-link");
  await page.getByTestId("open-link").click();
  const small = await smallWindow(context);
  await level(small, "Design", "Excellent").click();
  await level(small, "Content", "Fair").click();
  await small.getByRole("button", { name: /save changes/i }).click();
  await expect.poll(async () => (await stored(page, "with-link")).status).toBe("graded");
  const s = await stored(page, "with-link");
  expect(s.criterionScores).toEqual({ c1: 9, c2: 2 });
  expect(s.instructorScore).toBe(11);
});

test("closing the small window puts the panel back in the page, and the toolbar button can float it again", async ({ page, context }) => {
  await open(page, "with-link");
  await page.getByTestId("open-link").click();
  const small = await smallWindow(context);
  await level(small, "Design", "Fail").click();
  await small.close();
  await expect(page.getByTestId("grade-floating-note")).toHaveCount(0);
  await expect(level(page, "Design", "Fail")).toHaveAttribute("aria-checked", "true");    // nothing was lost with the window

  await page.getByTestId("grade-float-open").click();
  const again = await smallWindow(context);
  await expect(page.getByTestId("grade-floating-note")).toBeVisible();
  await expect(level(again, "Design", "Fail")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("grade-float-open").click();                                      // the same button brings it back
  await expect(page.getByTestId("grade-floating-note")).toHaveCount(0);
});

test("when the browser blocks the small window the teacher is told, and grading in the page still works", async ({ page }) => {
  await open(page, "with-link", { blockPopups: true });
  await page.getByTestId("grade-float-open").click();
  await expect(page.getByTestId("grade-float-blocked")).toContainText("The browser blocked the small window");
  await expect(page.getByTestId("grade-floating-note")).toHaveCount(0);
  await level(page, "Design", "Fair").click();
  await expect(page.getByTestId("crit-score-c1")).toContainText("6 / 9");
});

test("Thai UI", async ({ page }) => {
  await open(page, "with-link", { lang: "th" });
  await expect(page.getByTestId("open-link")).toHaveText("เปิดลิงก์และตรวจในก้อนเล็ก");
  await expect(page.getByTestId("grade-float-open")).toHaveText("ส่วนตรวจลอยในหน้าต่างเล็ก");
});

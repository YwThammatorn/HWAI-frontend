import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import { currentAcademicTerm, courseTermStatus } from "../src/lib/academicTerm";

const BASE = "http://localhost:3000";

// 26/9/2569 — student My Courses shows the courses of the current term as cards, and the courses of finished
// terms (plus withdrawn / archived ones) apart under "Completed courses", grouped by term, with the final result.
// "Current term" comes from today's date for now (lib/academicTerm.ts); the admin-set academic calendar is later.
// Every browser test pins the clock so the term does not depend on the day the suite runs.

const NOW = "2026-01-01T00:00:00.000Z";
const course = (id: string, name: string, year: number | undefined, term: number | undefined, extra: Record<string, unknown> = {}) => ({
  id, name, description: "", status: "active", source: "manual", coverColor: "#0F766E", iconColor: "#0F766E", code: `0107${id.slice(-3)}`, sectionNumber: "1",
  ...(year ? { academicYear: year } : {}), ...(term ? { term } : {}), createdAt: NOW, updatedAt: NOW, ...extra,
});
const COURSES = [
  course("c-101", "Now Course", 2569, 1),
  course("c-102", "Next Term Course", 2569, 2),
  course("c-103", "Last Term Course", 2568, 2),
  course("c-104", "Older Course", 2568, 1),
  course("c-105", "Undated Course", undefined, undefined),
  course("c-106", "Archived Now", 2569, 1, { status: "archived" }),
  course("c-107", "Dropped Course", 2569, 1),
  course("c-108", "Ungraded Old", 2568, 1),
];
const roster = (courseId: string, status = "enrolled") => ({ id: `r-${courseId}`, courseId, studentId: "69070401", firstName: "Ann", lastName: "S", email: "69070401@kmitl.ac.th", sequenceNumber: 1, enrollmentStatus: status });
const ROSTERS = COURSES.map((c) => roster(c.id, c.id === "c-107" ? "withdrawn" : "enrolled"));

// c-103: coursework 80/100 (60%) + exam 60/100 (40%) → 72 = B ; c-104: one graded assignment, 90 → A
const cats = (cid: string) => [{ id: `g1-${cid}`, courseId: cid, name: "Coursework", weight: 60, createdAt: NOW, updatedAt: NOW }, { id: `g2-${cid}`, courseId: cid, name: "Exams", weight: 40, createdAt: NOW, updatedAt: NOW }];
const asg = (id: string, cid: string, cat: string, finalized = true) => ({ id, courseId: cid, name: id, description: "", dueDate: "2025-12-01", maxPoints: 100, categoryId: cat, acceptsFiles: false, fileTypes: [], submissionType: "individual", maxGroupSize: null, rubricIds: [], gradingFinalized: finalized, createdAt: NOW });
const sub = (aid: string, score: number) => ({ id: `s-${aid}`, assignmentId: aid, studentId: "69070401", studentName: "Ann S", email: "69070401@kmitl.ac.th", submittedAt: NOW, fileUrl: null, aiScore: null, instructorScore: score, instructorComment: "", externalUseConsent: true, status: "graded", updatedAt: NOW });
const DATA = {
  hwai_grading_categories_v1: [...cats("c-103"), ...cats("c-104"), ...cats("c-108")],
  hwai_assignments_v1: [asg("a1", "c-103", "g1-c-103"), asg("a2", "c-103", "g2-c-103"), asg("a3", "c-104", "g1-c-104"), asg("a4", "c-108", "g1-c-108", false)],
  hwai_submissions_v1: [sub("a1", 80), sub("a2", 60), sub("a3", 90), sub("a4", 95)],   // a4 is graded but the results are not announced
};

async function open(page: Page, path: string, opts: { at?: string; lang?: "en" | "th" } = {}) {
  await page.clock.install({ time: new Date(opts.at ?? "2026-09-26T10:00:00") });
  await page.addInitScript(([lang, courses, rosters, data]) => {
    if (sessionStorage.getItem("mc")) return;
    sessionStorage.setItem("mc", "1");
    localStorage.setItem("hwai_lang", lang as string);
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Ann S", email: "69070401@kmitl.ac.th", role: "student", studentId: "69070401" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify(courses));
    localStorage.setItem("hwai_students_v1", JSON.stringify(rosters));
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) localStorage.setItem(k, JSON.stringify(v));
  }, [opts.lang ?? "en", COURSES, ROSTERS, DATA] as const);
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");
}
const currentSection = (page: Page) => page.getByRole("region", { name: /Current courses|รายวิชาที่เรียนอยู่/ });
const pastSection = (page: Page) => page.getByRole("region", { name: /Completed courses|รายวิชาที่เรียนผ่านไปแล้ว/ });

test.describe("current term from the date", () => {
  test("the usual Thai academic calendar: Aug–Dec term 1, Jan–May term 2, Jun–Jul term 3", () => {
    const at = (iso: string) => currentAcademicTerm(new Date(iso + "T12:00:00"));
    expect(at("2026-08-01")).toEqual({ year: 2569, term: 1 });
    expect(at("2026-12-31")).toEqual({ year: 2569, term: 1 });
    expect(at("2027-01-01")).toEqual({ year: 2569, term: 2 });      // same academic year, second term
    expect(at("2027-05-31")).toEqual({ year: 2569, term: 2 });
    expect(at("2027-06-01")).toEqual({ year: 2569, term: 3 });
    expect(at("2027-07-31")).toEqual({ year: 2569, term: 3 });
    expect(at("2027-08-01")).toEqual({ year: 2570, term: 1 });
  });

  test("a course is past / current / future / unknown against that term; archived is always past", () => {
    const now = new Date("2026-09-26T12:00:00");
    const st = (c: Parameters<typeof courseTermStatus>[0]) => courseTermStatus(c, now);
    expect(st({ status: "active", academicYear: 2568, term: 2 })).toBe("past");
    expect(st({ status: "active", academicYear: 2569, term: 1 })).toBe("current");
    expect(st({ status: "active", academicYear: 2569, term: 2 })).toBe("future");
    expect(st({ status: "active", academicYear: 2569, term: "summer" })).toBe("future");
    expect(st({ status: "active", academicYear: 2568, term: "summer" })).toBe("past");
    expect(st({ status: "active" })).toBe("unknown");
    expect(st({ status: "archived", academicYear: 2569, term: 1 })).toBe("past");
  });
});

test.describe("My Courses page", () => {
  test("current-term cards on top; finished, archived and withdrawn courses under 'Completed courses'", async ({ page }) => {
    await open(page, "/student/courses");
    await expect(page.getByText("Term 1/2569 · 3 courses")).toBeVisible();
    // current = this term + a later term + a course with no term at all
    const current = currentSection(page);
    for (const name of ["Now Course", "Next Term Course", "Undated Course"]) await expect(current.getByText(name, { exact: true })).toBeVisible();
    for (const name of ["Last Term Course", "Older Course", "Archived Now", "Dropped Course", "Ungraded Old"]) await expect(current.getByText(name, { exact: true })).toHaveCount(0);

    const past = pastSection(page);
    for (const name of ["Last Term Course", "Older Course", "Archived Now", "Dropped Course", "Ungraded Old"]) await expect(past.getByText(name, { exact: true })).toBeVisible();
    await expect(past.getByRole("heading", { name: "Completed courses" })).toBeVisible();
  });

  test("completed courses are grouped by term, newest first", async ({ page }) => {
    await open(page, "/student/courses");
    const groups = pastSection(page).getByRole("group");
    await expect(groups).toHaveCount(3);
    await expect(groups.nth(0)).toHaveAccessibleName("Term 1/2569");    // archived + withdrawn ones of this term
    await expect(groups.nth(1)).toHaveAccessibleName("Term 2/2568");
    await expect(groups.nth(2)).toHaveAccessibleName("Term 1/2568");
    await expect(groups.nth(0).getByRole("link")).toHaveCount(2);
    await expect(groups.nth(1).getByRole("link")).toHaveCount(1);
    await expect(groups.nth(2).getByRole("link")).toHaveCount(2);
  });

  test("each finished course shows its weighted total and grade; only announced scores count; a withdrawn one has no grade", async ({ page }) => {
    await open(page, "/student/courses");
    const row = (name: string) => pastSection(page).getByRole("link", { name: new RegExp(name) });
    await expect(row("Last Term Course")).toContainText("72.0%");                       // 80×60% + 60×40%
    await expect(row("Last Term Course").getByLabel("Grade B")).toBeVisible();
    await expect(row("Older Course")).toContainText("90.0%");                           // only the graded category counts (so far)
    await expect(row("Older Course").getByLabel("Grade A")).toBeVisible();
    await expect(row("Ungraded Old")).toContainText("No grade yet");                    // graded, but results not announced
    await expect(row("Archived Now")).toContainText("No grade yet");                    // nothing graded
    await expect(row("Dropped Course")).toContainText("Withdrawn");
    await expect(row("Dropped Course").getByLabel(/^Grade/)).toHaveCount(0);
  });

  test("a finished course opens like any other", async ({ page }) => {
    await open(page, "/student/courses");
    await pastSection(page).getByRole("link", { name: /Last Term Course/ }).click();
    await expect(page).toHaveURL(/\/student\/courses\/c-103\/classwork/);
  });

  test("when the term changes, courses move: in January the 2569 term-1 course is completed and term 2 is current", async ({ page }) => {
    await open(page, "/student/courses", { at: "2027-01-10T10:00:00" });
    await expect(page.getByText("Term 2/2569 · 2 courses")).toBeVisible();        // Next Term Course + Undated
    await expect(currentSection(page).getByText("Next Term Course", { exact: true })).toBeVisible();
    await expect(currentSection(page).getByText("Now Course", { exact: true })).toHaveCount(0);
    await expect(pastSection(page).getByText("Now Course", { exact: true })).toBeVisible();
    await expect(pastSection(page).getByRole("group", { name: "Term 1/2569" })).toBeVisible();
  });

  test("no course this term says so, and the completed ones are still there", async ({ page }) => {
    await open(page, "/student/courses", { at: "2031-09-01T10:00:00" });
    // everything dated is over by 2574; only the course with no term at all is left as current
    await expect(currentSection(page).getByText("Undated Course", { exact: true })).toBeVisible();
    await expect(pastSection(page).getByText("Last Term Course", { exact: true })).toBeVisible();
  });

  test("Thai UI", async ({ page }) => {
    await open(page, "/student/courses", { lang: "th" });
    await expect(page.getByText("เทอม 1/2569 · 3 รายวิชา")).toBeVisible();
    await expect(page.getByRole("heading", { name: "รายวิชาที่เรียนผ่านไปแล้ว" })).toBeVisible();
    await expect(pastSection(page).getByRole("group", { name: "เทอม 2/2568" })).toBeVisible();
    await expect(pastSection(page).getByText("ถอนแล้ว", { exact: true })).toBeVisible();
  });
});

test.describe("Student home", () => {
  test("the 'My Courses' box lists this term's courses only and links to the full page", async ({ page }) => {
    await open(page, "/student");
    const box = page.locator("div.rounded-2xl", { has: page.getByRole("heading", { name: "My Courses" }) }).last();
    await expect(box.getByText("Now Course", { exact: true })).toBeVisible();
    await expect(box.getByText("Last Term Course", { exact: true })).toHaveCount(0);
    await expect(box.getByText("Dropped Course", { exact: true })).toHaveCount(0);
    await box.getByRole("link", { name: "View all" }).click();
    await expect(page).toHaveURL(/\/student\/courses$/);
  });
});

test.describe("term-history mock (console command [14])", () => {
  const rd = (f: string) => JSON.parse(fs.readFileSync(`public/mock-data/${f}`, "utf8"));

  test("it refers to real courses: this term's c-mock-1, three finished 2568 courses, one withdrawn", async () => {
    const courses = new Map<string, { academicYear: number; term: number; status: string }>(rd("courses-mockup.json").map((c: { id: string }) => [c.id, c]));
    for (const f of ["student-history-mockup.json", "student-history-mockup-en.json"]) {
      const h = rd(f);
      const byCourse = new Map<string, string>(h.courseStudents.map((r: { courseId: string; enrollmentStatus: string }) => [r.courseId, r.enrollmentStatus]));
      expect([...byCourse.keys()].sort()).toEqual(["c-mock-1", "c-mock-17", "c-mock-18", "c-mock-19", "c-mock-6"]);
      expect(byCourse.get("c-mock-6")).toBe("withdrawn");
      expect(courses.get("c-mock-1")).toMatchObject({ academicYear: 2569, term: 1, status: "active" });
      for (const id of ["c-mock-17", "c-mock-18", "c-mock-19"]) expect(courses.get(id)).toMatchObject({ academicYear: 2568, status: "archived" });
      // every graded item has an announced (finalized) assignment and a category of its own course
      for (const a of h.assignments) expect(a.gradingFinalized).toBe(true);
      const cat = new Map(h.gradingCategories.map((c: { id: string; courseId: string }) => [c.id, c.courseId]));
      for (const a of h.assignments) expect(cat.get(a.categoryId)).toBe(a.courseId);
      // weights add up to 100 per course
      for (const id of ["c-mock-17", "c-mock-18", "c-mock-19"]) {
        expect(h.gradingCategories.filter((c: { courseId: string }) => c.courseId === id).reduce((n: number, c: { weight: number }) => n + c.weight, 0)).toBe(100);
      }
    }
  });

  test("the results come out as A, C and B", async () => {
    const h = rd("student-history-mockup.json");
    const result = (courseId: string) => {
      const cats = h.gradingCategories.filter((c: { courseId: string }) => c.courseId === courseId);
      let total = 0;
      for (const c of cats) {
        const items = h.assignments.filter((a: { categoryId: string }) => a.categoryId === c.id);
        const earned = items.reduce((n: number, a: { id: string }) => n + h.submissions.find((s: { assignmentId: string }) => s.assignmentId === a.id).instructorScore, 0);
        total += (earned / items.reduce((n: number, a: { maxPoints: number }) => n + a.maxPoints, 0)) * c.weight;
      }
      return total;
    };
    expect(result("c-mock-17")).toBeCloseTo(87.6, 1);   // A
    expect(result("c-mock-18")).toBeCloseTo(62.7, 1);   // C
    expect(result("c-mock-19")).toBeCloseTo(73.4, 1);   // B
  });
});

import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";

const BASE = "http://localhost:3000";

// Text sizes (21/9/2569): the admin pages are the reference. Page titles and stat numbers are 30px,
// panel titles 18px, table headers 14px. Teacher and student pages must not render anything bigger
// than admin's page title, and table headers must not fall below admin's 14px.

const ROOT = path.join(__dirname, "..", "public", "mock-data");
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const SEED = {
  cur: read("curriculum-mockup.json"), courses: read("courses-mockup.json"),
  teachers: read("teachers-mockup.json"), flow: read("student-flow-mockup.json"),
};
const USERS = {
  admin: { name: "Admin", email: "admin@kmitl.ac.th", role: "admin" },
  teacher: { name: "Somsak", email: "somsak.c@kmitl.ac.th", role: "teacher" },
  student: { name: "Somchai", email: "69070101@kmitl.ac.th", role: "student", studentId: "69070101" },
};

async function seed(page: Page, role: keyof typeof USERS) {
  await page.addInitScript((d) => {
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_curriculum_versions_v1", JSON.stringify(d.seed.cur.curriculumVersions));
    localStorage.setItem("hwai_course_templates_v1", JSON.stringify(d.seed.cur.courseTemplates));
    localStorage.setItem("hwai_courses_v2", JSON.stringify(d.seed.courses));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify(d.seed.teachers));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(d.seed.flow.cohortStudents));
    localStorage.setItem("hwai_students_v1", JSON.stringify(d.seed.flow.courseStudents));
    localStorage.setItem("hwai_grading_categories_v1", JSON.stringify(d.seed.flow.gradingCategories));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify(d.seed.flow.assignments));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify(d.seed.flow.rubrics));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(d.seed.flow.submissions));
    localStorage.setItem("hwai_user", JSON.stringify(d.user));
  }, { seed: SEED, user: USERS[role] });
}

async function open(page: Page, role: keyof typeof USERS, url: string) {
  await seed(page, role);
  await page.goto(`${BASE}${url}`);
  await page.waitForLoadState("networkidle");
}

/** Largest rendered font size (px) of any visible HTML text inside <main>.
 *  SVG <text> is skipped on purpose: chart labels (e.g. the donut gauge on the grading page) are sized in the
 *  chart's own coordinate space, not on the page's type scale. */
const maxFont = (page: Page) => page.evaluate(() => {
  const main = document.querySelector("main") ?? document.body;
  let max = 0;
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || el instanceof SVGElement || !(n.textContent ?? "").trim()) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    max = Math.max(max, parseFloat(getComputedStyle(el).fontSize));
  }
  return max;
});
const size = (loc: ReturnType<Page["locator"]>) => loc.first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

const C = "/teacher/courses/c-mock-1";
const TEACHER_PAGES = [
  "/teacher/courses", C, `${C}/students`, `${C}/assignments`, `${C}/assignments/new`, `${C}/assignments/a-mock-1`,
  `${C}/assignments/a-mock-1/grading`, `${C}/assignments/a-mock-1/results`, `${C}/collaborators`, `${C}/results`, `${C}/settings`,
];
const STUDENT_PAGES = [
  "/student", "/student/courses", "/student/courses/c-mock-1/classwork", "/student/courses/c-mock-1/classwork/a-mock-1",
  "/student/courses/c-mock-1/evaluation",
];

let adminTitle = 0;
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await open(page, "admin", "/admin/users");
  adminTitle = await size(page.locator("h1"));
  await page.close();
});

test("the admin page title is the 30px reference", () => {
  expect(adminTitle).toBe(30);
});

test.describe("Teacher pages stay within admin's size ceiling", () => {
  for (const url of TEACHER_PAGES) {
    test(`${url.replace(C, "…c1")}`, async ({ page }) => {
      await open(page, "teacher", url);
      expect(await maxFont(page)).toBeLessThanOrEqual(adminTitle);
    });
  }
});

test.describe("Student pages stay within admin's size ceiling", () => {
  for (const url of STUDENT_PAGES) {
    test(`${url.replace("/student/courses/c-mock-1", "…c1")}`, async ({ page }) => {
      await open(page, "student", url);
      expect(await maxFont(page)).toBeLessThanOrEqual(adminTitle);
    });
  }
});

test.describe("Same titles as admin", () => {
  test("teacher My Courses and Assignments page titles match the admin title", async ({ page }) => {
    await open(page, "teacher", "/teacher/courses");
    expect(await size(page.locator("h1"))).toBe(adminTitle);
    await page.goto(`${BASE}${C}/assignments`);
    await page.waitForLoadState("networkidle");
    expect(await size(page.locator("main h1"))).toBe(adminTitle);
    await page.goto(`${BASE}${C}/assignments/new`);
    await page.waitForLoadState("networkidle");
    expect(await size(page.locator("main h1"))).toBe(adminTitle);
  });

  test("teacher course-card names are panel-title size (18px)", async ({ page }) => {
    await open(page, "teacher", "/teacher/courses");
    expect(await size(page.locator("[data-course-banner] h3"))).toBe(18);
  });

  test("student course-card names are panel-title size (18px)", async ({ page }) => {
    await open(page, "student", "/student/courses");
    expect(await size(page.locator("[data-course-banner] h3"))).toBe(18);
  });

  test("student evaluation total is a stat number (30px), not bigger", async ({ page }) => {
    await open(page, "student", "/student/courses/c-mock-1/evaluation");
    expect(await size(page.getByText("Total so far").locator("xpath=following-sibling::p[1]"))).toBe(30);
  });
});

test.describe("Table headers are admin's 14px", () => {
  const cases: [string, string][] = [
    ["collaborators", `${C}/collaborators`],
    ["grading list", `${C}/assignments/a-mock-1/grading`],
    ["results", `${C}/assignments/a-mock-1/results`],
    ["roster", `${C}/students`],
  ];
  for (const [name, url] of cases) {
    test(name, async ({ page }) => {
      await open(page, "teacher", url);
      const heads = await page.locator("main th").evaluateAll((els) =>
        els.filter((e) => (e.textContent ?? "").trim() && e.getBoundingClientRect().width > 0)
          .map((e) => ({ size: parseFloat(getComputedStyle(e).fontSize), height: e.getBoundingClientRect().height })));
      expect(heads.length).toBeGreaterThan(0);
      for (const h of heads) {
        expect(h.size).toBe(14);
        expect(h.height).toBeLessThan(56); // one line — a wrapped header ("การดำเนิน / การ") would be ~65px+
      }
    });
  }
});

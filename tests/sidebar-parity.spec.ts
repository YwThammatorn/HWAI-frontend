import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// 25–26/9/2569 — the Teacher and Student portal sidebars are built from the same SidebarParts, so
// they keep the same width, item sizes and (inside a course) the same header block: back link,
// course code, course name, section.

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-sp", name: "Computer Programming", code: "01076036", sectionNumber: "1", description: "", status: "active",
  coverColor: "#0F766E", createdAt: NOW, updatedAt: NOW,
};
const ROLES = [
  { role: "teacher", user: { name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }, path: "/teacher/courses/c-sp/students", mainPath: "/teacher/courses", label: "Teacher navigation", item: "Students" },
  { role: "student", user: { name: "Ann", email: "69070401@kmitl.ac.th", role: "student", studentId: "69070401" }, path: "/student/courses/c-sp/classwork", mainPath: "/student", label: "Student navigation", item: "Classwork" },
] as const;

async function open(page: Page, r: (typeof ROLES)[number], path: string) {
  await page.addInitScript((d) => {
    if (sessionStorage.getItem("sp_seeded")) return;
    sessionStorage.setItem("sp_seeded", "1");
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify(d.user));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([d.course]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([{ id: "t-sp", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-sp"] }]));
    localStorage.setItem("hwai_students_v1", JSON.stringify([{ id: "r-sp", courseId: "c-sp", studentId: "69070401", firstName: "Ann", lastName: "S", email: "69070401@kmitl.ac.th", sequenceNumber: 1, enrollmentStatus: "enrolled" }]));
  }, { user: r.user, course: COURSE });
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");
  return page.getByRole("complementary", { name: r.label });
}

const css = (l: ReturnType<Page["locator"]>, prop: string) => l.evaluate((e, p) => getComputedStyle(e)[p as never] as string, prop);

async function courseMetrics(page: Page, r: (typeof ROLES)[number]) {
  const aside = await open(page, r, r.path);
  await expect(aside).toBeVisible();
  const code = aside.getByText("01076036", { exact: true });
  const name = aside.getByText("Computer Programming", { exact: true });
  const section = aside.getByText("Section 1", { exact: true });
  const back = aside.getByRole("link", { name: "Back to main" });
  await expect(code).toBeVisible();
  await expect(section).toBeVisible();
  const item = aside.getByRole("link", { name: r.item });
  return {
    width: (await aside.boundingBox())!.width,
    codeSize: await css(code, "fontSize"),
    codeWeight: await css(code, "fontWeight"),
    nameSize: await css(name, "fontSize"),
    sectionSize: await css(section, "fontSize"),
    backSize: await css(back, "fontSize"),
    backHref: await back.getAttribute("href"),
    itemSize: await css(item, "fontSize"),
    itemHeight: (await item.boundingBox())!.height,
    iconSize: (await item.locator("svg").boundingBox())!.width,
    hasMainCaption: await aside.getByText("Main", { exact: true }).count(),
  };
}

async function mainMetrics(page: Page, r: (typeof ROLES)[number]) {
  const aside = await open(page, r, r.mainPath);
  await expect(aside.getByText("Main", { exact: true })).toBeVisible();
  const item = aside.getByRole("link").first();
  return {
    width: (await aside.boundingBox())!.width,
    itemSize: await css(item, "fontSize"),
    itemHeight: (await item.boundingBox())!.height,
    iconSize: (await item.locator("svg").boundingBox())!.width,
  };
}

test("inside a course, teacher and student sidebars share the header block and item sizes", async ({ browser }) => {
  const results = [];
  for (const r of ROLES) {
    const ctx = await browser.newContext();
    results.push(await courseMetrics(await ctx.newPage(), r));
    await ctx.close();
  }
  const [teacher, student] = results;
  // same numbers, apart from where "Back to main" leads
  expect({ ...student, backHref: "" }).toEqual({ ...teacher, backHref: "" });
  expect(teacher.backHref).toBe("/teacher/courses");
  expect(student.backHref).toBe("/student");
  // the code is the big line, the name sits under it, no "Main" list inside a course
  expect(parseFloat(teacher.codeSize)).toBeGreaterThan(parseFloat(teacher.nameSize));
  expect(teacher.codeWeight).toBe("700");
  expect(teacher.hasMainCaption).toBe(0);
  expect(teacher.itemHeight).toBeGreaterThanOrEqual(44);
});

test("outside a course, teacher and student sidebars share width and item sizes", async ({ browser }) => {
  const results = [];
  for (const r of ROLES) {
    const ctx = await browser.newContext();
    results.push(await mainMetrics(await ctx.newPage(), r));
    await ctx.close();
  }
  expect(results[1]).toEqual(results[0]);
});

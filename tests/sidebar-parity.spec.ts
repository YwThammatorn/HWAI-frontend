import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// 25/9/2569 — the Teacher and Student portal sidebars are built from the same SidebarParts, so they
// keep the same width, "Main" caption, course heading and item sizes.

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-sp", name: "Computer Programming", description: "", status: "active", source: "manual",
  coverColor: "#0F766E", iconColor: "#0F766E", createdAt: NOW, updatedAt: NOW,
};
const ROLES = [
  { role: "teacher", user: { name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }, path: "/teacher/courses/c-sp/students", label: "Teacher navigation", item: "Students" },
  { role: "student", user: { name: "Ann", email: "69070401@kmitl.ac.th", role: "student", studentId: "69070401" }, path: "/student/courses/c-sp/classwork", label: "Student navigation", item: "Classwork" },
] as const;

async function open(page: Page, r: (typeof ROLES)[number]) {
  await page.addInitScript((d) => {
    if (sessionStorage.getItem("sp_seeded")) return;
    sessionStorage.setItem("sp_seeded", "1");
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify(d.user));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([d.course]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([{ id: "t-sp", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-sp"] }]));
    localStorage.setItem("hwai_students_v1", JSON.stringify([{ id: "r-sp", courseId: "c-sp", studentId: "69070401", firstName: "Ann", lastName: "S", email: "69070401@kmitl.ac.th", sequenceNumber: 1, enrollmentStatus: "enrolled" }]));
  }, { user: r.user, course: COURSE });
  await page.goto(`${BASE}${r.path}`);
  await page.waitForLoadState("networkidle");
  return page.getByRole("complementary", { name: r.label });
}

async function metrics(page: Page, r: (typeof ROLES)[number]) {
  const aside = await open(page, r);
  await expect(aside).toBeVisible();
  await expect(aside.getByText("Main", { exact: true })).toBeVisible();
  const heading = aside.getByText("Computer Programming", { exact: true });
  const item = aside.getByRole("link", { name: r.item });
  const css = (l: typeof heading, prop: string) => l.evaluate((e, p) => getComputedStyle(e)[p as never] as string, prop);
  return {
    width: (await aside.boundingBox())!.width,
    headingSize: await css(heading, "fontSize"),
    headingWeight: await css(heading, "fontWeight"),
    itemSize: await css(item, "fontSize"),
    itemHeight: (await item.boundingBox())!.height,
    iconSize: await item.locator("svg").getAttribute("width"),
  };
}

test("teacher and student sidebars share width, course heading and item sizes", async ({ browser }) => {
  const results = [];
  for (const r of ROLES) {
    const ctx = await browser.newContext();
    results.push(await metrics(await ctx.newPage(), r));
    await ctx.close();
  }
  expect(results[1]).toEqual(results[0]);
  // and the course name really is a heading (bigger and bolder than the small items below it)
  expect(parseFloat(results[0].headingSize)).toBeGreaterThan(parseFloat(results[0].itemSize));
  expect(results[0].headingWeight).toBe("600");
  expect(results[0].itemHeight).toBeGreaterThanOrEqual(44);
});

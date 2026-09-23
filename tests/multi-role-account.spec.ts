import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// One sign-in, three roles (20/9/2569): somsak.c@kmitl.ac.th holds admin + teacher +
// student(69070101) and switches between them — see src/lib/accounts.ts.

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-mr", name: "Programming", description: "", status: "active",
  coverColor: "#2DD4BF", courseTemplateId: "ct-mr", term: 1, academicYear: 2569,
  sectionNumber: "1", code: "01076112", schedule: "Mon 9:00-12:00", room: "811", createdAt: NOW, updatedAt: NOW,
};
const TEACHER = {
  id: "t-mr", title: "Asst. Prof. Dr.", name: "Somsak Charoensuk", email: "somsak.c@kmitl.ac.th",
  role: "teacher", status: "active", courseIds: ["c-mr"],
};
const COHORT = [{
  id: "cs-mr", studentId: "69070101", title: "Mr.", firstName: "Somchai", lastName: "Jaidee",
  email: "69070101@kmitl.ac.th", cohort: "CE69", program: "CE", status: "active",
}];
const ROSTER = [{
  id: "s-mr", courseId: "c-mr", studentId: "69070101", firstName: "Somchai", lastName: "Jaidee",
  email: "69070101@kmitl.ac.th", cohort: "CE69", sequenceNumber: 1, enrollmentStatus: "enrolled",
}];

async function seedData(page: Page, opts: { legacyUser?: boolean } = {}) {
  await page.addInitScript((data) => {
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_courses_v2", JSON.stringify([data.course]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([data.teacher]));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(data.cohort));
    localStorage.setItem("hwai_students_v1", JSON.stringify(data.roster));
    // A session saved before multi-role existed — must still pick up the roles on load. Seed once so a later switch survives reloads.
    if (data.legacyUser && !sessionStorage.getItem("mr_seeded")) {
      sessionStorage.setItem("mr_seeded", "1");
      localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak C", email: "somsak.c@kmitl.ac.th", role: "teacher" }));
    }
  }, { course: COURSE, teacher: TEACHER, cohort: COHORT, roster: ROSTER, legacyUser: !!opts.legacyUser });
}

async function signIn(page: Page, email: string, password = "password123") {
  await page.goto(`${BASE}/login`);
  await page.getByPlaceholder("you@kmitl.ac.th").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

const switcher = (page: Page) => page.getByRole("button", { name: "Switch role", exact: true });
const storedUser = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("hwai_user") ?? "null"));

async function switchTo(page: Page, role: "Admin" | "Teacher" | "Student") {
  await switcher(page).click();
  await page.getByRole("menuitemradio", { name: new RegExp(role) }).click();
}

test.describe("Multi-role account — somsak.c holds admin, teacher and student", () => {
  test.beforeEach(async ({ page }) => { await seedData(page); });

  test("signing in lands on the default role (teacher) and the menu lists exactly the three held roles", async ({ page }) => {
    await signIn(page, "somsak.c@kmitl.ac.th");
    await expect(page).toHaveURL(/\/teacher\/courses/, { timeout: 20_000 });
    await expect(page.getByText("Somsak Charoensuk").first()).toBeVisible();

    await switcher(page).click();
    const items = page.getByRole("menuitemradio");
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText("Admin");
    await expect(items.nth(1)).toContainText("Teacher");
    await expect(items.nth(2)).toContainText("Student");
    await expect(items.nth(1)).toHaveAttribute("aria-checked", "true");
    // each role shows the identity it acts as
    await expect(items.nth(2)).toContainText("69070101@kmitl.ac.th");
    await expect(items.nth(1)).toContainText("somsak.c@kmitl.ac.th");
  });

  test("Student acts as 69070101 (own courses + name), Admin opens user management, Teacher restores somsak.c", async ({ page }) => {
    await signIn(page, "somsak.c@kmitl.ac.th");
    await expect(page).toHaveURL(/\/teacher\/courses/, { timeout: 20_000 });

    await switchTo(page, "Student");
    await expect(page).toHaveURL(/\/student/, { timeout: 20_000 });
    await expect(page.getByText("Somchai Jaidee").first()).toBeVisible();
    await expect(page.getByText("Programming").first()).toBeVisible();
    expect(await storedUser(page)).toMatchObject({
      role: "student", studentId: "69070101", email: "69070101@kmitl.ac.th",
      accountEmail: "somsak.c@kmitl.ac.th", roles: ["admin", "teacher", "student"],
    });

    await switchTo(page, "Admin");
    await expect(page).toHaveURL(/\/admin\/users/, { timeout: 20_000 });
    expect(await storedUser(page)).toMatchObject({ role: "admin", email: "somsak.c@kmitl.ac.th", name: "Somsak Charoensuk" });
    expect((await storedUser(page)).studentId).toBeUndefined();

    await switchTo(page, "Teacher");
    await expect(page).toHaveURL(/\/teacher\/courses/, { timeout: 20_000 });
    await expect(page.getByText("Programming").first()).toBeVisible();
    expect(await storedUser(page)).toMatchObject({ role: "teacher", email: "somsak.c@kmitl.ac.th" });
  });

  test("the active role survives a reload", async ({ page }) => {
    await signIn(page, "somsak.c@kmitl.ac.th");
    await expect(page).toHaveURL(/\/teacher\/courses/, { timeout: 20_000 });
    await switchTo(page, "Student");
    await expect(page).toHaveURL(/\/student/, { timeout: 20_000 });

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/student/);
    await expect(switcher(page)).toBeVisible();
    await switcher(page).click();
    await expect(page.getByRole("menuitemradio", { name: /Student/ })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("menuitemradio")).toHaveCount(3);
  });

  test("signing in directly as the student 69070101 stays a plain student (no role menu)", async ({ page }) => {
    await signIn(page, "69070101@kmitl.ac.th", "pass");
    await expect(page).toHaveURL(/\/student/, { timeout: 20_000 });
    await expect(switcher(page)).toHaveCount(0); // only the dev-only "Switch role (dev)" preview may exist
    const u = await storedUser(page);
    expect(u.role).toBe("student");
    expect(u.roles).toBeUndefined();
    expect(u.accountEmail).toBeUndefined();
  });

  test("another teacher account is not multi-role", async ({ page }) => {
    await signIn(page, "prasert.d@kmitl.ac.th");
    await expect(page).toHaveURL(/\/teacher\/courses/, { timeout: 20_000 });
    await expect(switcher(page)).toHaveCount(0);
    expect((await storedUser(page)).roles).toBeUndefined();
  });
});

test.describe("Multi-role account — sessions saved before the feature", () => {
  test("an existing somsak.c teacher session gains the other roles on load", async ({ page }) => {
    await seedData(page, { legacyUser: true });
    await page.goto(`${BASE}/teacher/courses`);
    await page.waitForLoadState("networkidle");
    await switcher(page).click();
    await expect(page.getByRole("menuitemradio")).toHaveCount(3);
    await page.getByRole("menuitemradio", { name: /Student/ }).click(); // menu is already open
    await expect(page).toHaveURL(/\/student/, { timeout: 20_000 });
    expect(await storedUser(page)).toMatchObject({ role: "student", studentId: "69070101" });
  });
});

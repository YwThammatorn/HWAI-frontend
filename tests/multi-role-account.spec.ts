import { test, expect, Page } from "@playwright/test";

import { BASE } from "./base";

// One sign-in, two roles (8/11/2569): kiatnarong.to@kmitl.ac.th holds admin + teacher and switches
// between them — see src/lib/accounts.ts. No student role: in HWAI-backend a staff email can't also be
// a student (that needs the student's own id and email), so the earlier student persona is gone.

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-mr", name: "Programming", description: "", status: "active",
  coverColor: "#2DD4BF", courseTemplateId: "ct-mr", term: 1, academicYear: 2569,
  sectionNumber: "1", code: "01076112", schedule: "Mon 9:00-12:00", room: "811", createdAt: NOW, updatedAt: NOW,
};
const TEACHER = {
  // Teacher names are always Thai regardless of the language toggle (30/9/2569) — matches the
  // hardcoded name in src/lib/accounts.ts for this same kiatnarong.to account.
  id: "t-mr", title: "ผศ.", name: "เกียรติณรงค์ ทองประเสริฐ", email: "kiatnarong.to@kmitl.ac.th",
  status: "active", courseIds: ["c-mr"],
};
const COHORT = [{
  id: "cs-mr", studentId: "69070101", title: "Mr.", name: "Somchai Jaidee",
  email: "69070101@kmitl.ac.th", cohort: "CE69", program: "CE", status: "active",
}];
const ROSTER = [{
  id: "s-mr", courseId: "c-mr", studentId: "69070101", name: "Somchai Jaidee",
  email: "69070101@kmitl.ac.th", cohort: "CE69", enrollmentStatus: "enrolled",
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
      localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak C", email: "kiatnarong.to@kmitl.ac.th", role: "teacher" }));
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

async function switchTo(page: Page, role: "Admin" | "Teacher") {
  await switcher(page).click();
  await page.getByRole("menuitemradio", { name: new RegExp(role) }).click();
}

test.describe("Multi-role account — kiatnarong.to holds admin and teacher", () => {
  test.beforeEach(async ({ page }) => { await seedData(page); });

  test("signing in lands on the default role (teacher) and the menu lists exactly the two held roles", async ({ page }) => {
    await signIn(page, "kiatnarong.to@kmitl.ac.th");
    await expect(page).toHaveURL(/\/teacher\/courses/, { timeout: 20_000 });
    await expect(page.getByText("เกียรติณรงค์ ทองประเสริฐ").first()).toBeVisible();

    await switcher(page).click();
    const items = page.getByRole("menuitemradio");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText("Admin");
    await expect(items.nth(1)).toContainText("Teacher");
    await expect(items.nth(1)).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("menuitemradio", { name: /Student/ })).toHaveCount(0);
    // both roles act as the account's own email
    await expect(items.nth(0)).toContainText("kiatnarong.to@kmitl.ac.th");
    await expect(items.nth(1)).toContainText("kiatnarong.to@kmitl.ac.th");
  });

  test("Admin opens user management, Teacher brings back the teacher's own courses", async ({ page }) => {
    await signIn(page, "kiatnarong.to@kmitl.ac.th");
    await expect(page).toHaveURL(/\/teacher\/courses/, { timeout: 20_000 });

    await switchTo(page, "Admin");
    await expect(page).toHaveURL(/\/admin\/users/, { timeout: 20_000 });
    expect(await storedUser(page)).toMatchObject({
      role: "admin", email: "kiatnarong.to@kmitl.ac.th", name: "เกียรติณรงค์ ทองประเสริฐ",
      accountEmail: "kiatnarong.to@kmitl.ac.th", roles: ["admin", "teacher"],
    });
    expect((await storedUser(page)).studentId).toBeUndefined();

    await switchTo(page, "Teacher");
    await expect(page).toHaveURL(/\/teacher\/courses/, { timeout: 20_000 });
    await expect(page.getByText("Programming").first()).toBeVisible();
    expect(await storedUser(page)).toMatchObject({ role: "teacher", email: "kiatnarong.to@kmitl.ac.th" });
  });

  test("the active role survives a reload", async ({ page }) => {
    await signIn(page, "kiatnarong.to@kmitl.ac.th");
    await expect(page).toHaveURL(/\/teacher\/courses/, { timeout: 20_000 });
    await switchTo(page, "Admin");
    await expect(page).toHaveURL(/\/admin\/users/, { timeout: 20_000 });

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/admin\/users/);
    await expect(switcher(page)).toBeVisible();
    await switcher(page).click();
    await expect(page.getByRole("menuitemradio", { name: /Admin/ })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("menuitemradio")).toHaveCount(2);
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
  test("an existing kiatnarong.to teacher session gains the other roles on load", async ({ page }) => {
    await seedData(page, { legacyUser: true });
    await page.goto(`${BASE}/teacher/courses`);
    await page.waitForLoadState("networkidle");
    await switcher(page).click();
    await expect(page.getByRole("menuitemradio")).toHaveCount(2);
    await page.getByRole("menuitemradio", { name: /Admin/ }).click(); // menu is already open
    await expect(page).toHaveURL(/\/admin\/users/, { timeout: 20_000 });
    expect(await storedUser(page)).toMatchObject({ role: "admin", email: "kiatnarong.to@kmitl.ac.th" });
  });
});

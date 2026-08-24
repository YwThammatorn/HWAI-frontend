import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// Mock CohortStudent matching hwai_cohort_students_v1 schema
const MOCK_COHORT_STUDENT = {
  id: "test-student-uuid",
  studentId: "64070501",
  firstName: "สมชาย",
  lastName: "ใจดี",
  email: "student@school.edu",
  cohort: "CE69",
  program: "CE",
};

/** Force English lang (no auth) */
async function withLang(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("hwai_lang", "en");
  });
}

/** Force English lang + seed one CohortStudent into localStorage */
async function withLangAndStudent(page: Page) {
  await page.addInitScript((student) => {
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem(
      "hwai_cohort_students_v1",
      JSON.stringify([student])
    );
  }, MOCK_COHORT_STUDENT);
}

async function waitReady(page: Page, path: string) {
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");
}

// ── 1. Role Tabs UI ──────────────────────────────────────────────────────────

test.describe("Login Page — Role Tab UI", () => {
  test.beforeEach(async ({ page }) => { await withLang(page); });

  test("teacher tab is selected by default", async ({ page }) => {
    await waitReady(page, "/login");
    const teacherTab = page.getByRole("tab", { name: /teacher/i });
    await expect(teacherTab).toHaveAttribute("aria-selected", "true");
  });

  test("student tab shows studentId field, not email field", async ({ page }) => {
    await waitReady(page, "/login");
    await page.getByRole("tab", { name: /^student$/i }).click();
    // Student ID input should be visible
    await expect(page.getByPlaceholder("64070501")).toBeVisible();
    // Email input should NOT be visible (it's conditionally rendered)
    await expect(page.locator('input[type="email"]')).not.toBeVisible();
  });

  test("admin tab shows email field with admin@school.edu placeholder", async ({ page }) => {
    await waitReady(page, "/login");
    await page.getByRole("tab", { name: /admin/i }).click();
    await expect(page.getByPlaceholder("admin@school.edu")).toBeVisible();
  });
});

// ── 2. Login Flows ───────────────────────────────────────────────────────────

test.describe("Login Flows", () => {
  test("teacher login with valid credentials redirects to /dashboard", async ({ page }) => {
    await withLang(page);
    await waitReady(page, "/login");
    // Teacher tab is default — fill email + password
    await page.fill('input[type="email"]', "teacher@school.edu");
    await page.fill('input[type="password"]', "password123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 8000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("admin login with valid credentials redirects to /admin", async ({ page }) => {
    await withLang(page);
    await waitReady(page, "/login");
    await page.getByRole("tab", { name: /admin/i }).click();
    await page.fill('input[type="email"]', "admin@school.edu");
    await page.fill('input[type="password"]', "password123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/admin/, { timeout: 8000 });
    await expect(page).toHaveURL(/\/admin/);
  });

  test("student login with unknown studentId shows error", async ({ page }) => {
    await withLang(page);
    await waitReady(page, "/login");
    await page.getByRole("tab", { name: /^student$/i }).click();
    await page.getByPlaceholder("64070501").fill("99999999");
    await page.fill('input[type="password"]', "pass1");
    await page.getByRole("button", { name: /sign in/i }).click();
    // Error <p role="alert"> — scoped to the <p> element to avoid strict-mode conflict
    // with Next.js's __next-route-announcer__ div which also carries role="alert"
    await expect(page.locator('p[role="alert"]')).toContainText(/not found/i, { timeout: 5000 });
  });

  test("student login with seeded CohortStudent redirects to /student", async ({ page }) => {
    await withLangAndStudent(page);
    await waitReady(page, "/login");
    await page.getByRole("tab", { name: /^student$/i }).click();
    await page.getByPlaceholder("64070501").fill("64070501");
    await page.fill('input[type="password"]', "pass1");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/student/, { timeout: 8000 });
    await expect(page).toHaveURL(/\/student/);
  });
});

// ── 3. Auth Guards for /admin and /student ───────────────────────────────────

test.describe("Auth Guards — Admin & Student routes", () => {
  test("unauthenticated visit to /admin redirects to /login", async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated visit to /student redirects to /login", async ({ page }) => {
    await page.goto(`${BASE}/student`);
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });
});

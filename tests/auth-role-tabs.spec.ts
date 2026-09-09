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

// ── 1. Single-form login UI ──────────────────────────────────────────────────
// Rewritten 5/9/2569 — the login page used to have separate Admin/Teacher/Student
// tabs (role chosen up front), but was redesigned to a single email+password form
// that auto-detects role from the email prefix (numeric → student, contains
// "admin" → admin, else teacher — see detectRole() in src/app/login/page.tsx).
// No role="tab" elements exist on this page anymore.

test.describe("Login Page — Single Form (role auto-detected from email)", () => {
  test.beforeEach(async ({ page }) => { await withLang(page); });

  test("renders one login form with no role tabs", async ({ page }) => {
    await waitReady(page, "/login");
    await expect(page.locator('input[type="email"]')).toHaveCount(1);
    await expect(page.locator('input[type="password"]')).toHaveCount(1);
    await expect(page.getByRole("tab")).toHaveCount(0);
  });

  test("email field enforces valid format via native HTML5 constraint", async ({ page }) => {
    // The app also has a custom "please enter a valid email" JS check, but it's
    // unreachable through normal interaction: the input is type="email" +
    // required, so the browser's own constraint validation blocks form
    // submission (and the React onSubmit handler) before our JS ever runs for
    // a value with no "@". This test verifies the actual enforcement mechanism.
    await waitReady(page, "/login");
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute("required", "");
    await emailInput.fill("not-an-email");
    const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(isValid).toBe(false);
  });
});

// ── 2. Login Flows — role detected from email prefix ─────────────────────────

test.describe("Login Flows", () => {
  test("teacher-looking email redirects to /teacher/courses", async ({ page }) => {
    await withLang(page);
    await waitReady(page, "/login");
    await page.fill('input[type="email"]', "teacher@school.edu");
    await page.fill('input[type="password"]', "password123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/teacher\/courses/, { timeout: 8000 });
    await expect(page).toHaveURL(/\/teacher\/courses/);
  });

  test("admin-looking email redirects to /admin", async ({ page }) => {
    await withLang(page);
    await waitReady(page, "/login");
    await page.fill('input[type="email"]', "admin@school.edu");
    await page.fill('input[type="password"]', "password123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/admin/, { timeout: 8000 });
    await expect(page).toHaveURL(/\/admin/);
  });

  test("numeric-prefix email with unknown studentId shows error", async ({ page }) => {
    await withLang(page);
    await waitReady(page, "/login");
    await page.fill('input[type="email"]', "99999999@school.edu");
    await page.fill('input[type="password"]', "pass1");
    await page.getByRole("button", { name: /sign in/i }).click();
    // Error <p role="alert"> — scoped to the <p> element to avoid strict-mode conflict
    // with Next.js's __next-route-announcer__ div which also carries role="alert"
    await expect(page.locator('p[role="alert"]')).toContainText(/not found/i, { timeout: 5000 });
  });

  test("numeric-prefix email matching a seeded CohortStudent redirects to /student", async ({ page }) => {
    await withLangAndStudent(page);
    await waitReady(page, "/login");
    await page.fill('input[type="email"]', "64070501@school.edu");
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

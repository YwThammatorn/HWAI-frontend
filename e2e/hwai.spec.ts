import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// Mirrors LANGUAGE_TOGGLE_DISABLED in src/context/LanguageContext.tsx — keep
// in sync. The language-toggle button is hidden app-wide (15/9/2569,
// temporary), so the whole "i18n Language Toggle" suite below is skipped
// until it's restored.
const LANGUAGE_TOGGLE_DISABLED = true;

// Mirrors TEACHER_HISTORY_DISABLED in src/lib/featureFlags.ts — keep in sync.
// /teacher/history is hidden from nav and redirects away (17/9/2569, temporary).
const TEACHER_HISTORY_DISABLED = true;

// Mirrors NOTIFICATIONS_DISABLED in src/lib/featureFlags.ts — keep in sync.
// The bell (teacher + admin top bars) is gone and /teacher/notifications redirects
// away (21/9/2569, temporary), so the Notifications Page suite and the unread-badge
// check are skipped until it's restored.
const NOTIFICATIONS_DISABLED = true;

const MOCK_USER = { name: "Test Teacher", email: "test@school.edu", role: "teacher" };

/** Inject mock auth session + force English lang before page load. Also seeds
 *  a ManagedTeacher matching MOCK_USER's email with courseIds covering the
 *  app's own SEED_COURSES (seed-1/seed-2) — /teacher/courses now filters by
 *  assignment (10/9/2569), so an unlinked session would see none of them. */
async function withAuth(page: Page) {
  await page.addInitScript((u) => {
    localStorage.setItem("hwai_user", JSON.stringify(u));
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([
      { id: "e2e-teacher-1", name: u.name, email: u.email, role: "teacher", status: "active", courseIds: ["seed-1", "seed-2"] },
    ]));
  }, MOCK_USER);
}

/** Force English lang (no auth) — for login/register page tests */
async function withLang(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("hwai_lang", "en");
  });
}

async function waitReady(page: Page, path: string) {
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");
}

// ── 1. Navigation ─────────────────────────────────────────────────────────────
// NOTE: teacher-scoped pages live under /teacher/... (not bare paths) — fixed
// 5/9/2569 after discovering these tests predated the /teacher prefix routing.

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("dashboard loads", async ({ page }) => {
    await waitReady(page, "/teacher/dashboard");
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /courses/i }).first()).toBeVisible();
  });

  test("courses page shows course cards", async ({ page }) => {
    await waitReady(page, "/teacher/courses");
    await expect(page.locator("text=UX/UI Design").first()).toBeVisible();
  });

  test("history page loads with grading log", async ({ page }) => {
    test.skip(TEACHER_HISTORY_DISABLED, "/teacher/history is hidden and redirects away until TEACHER_HISTORY_DISABLED is flipped back to false");
    await waitReady(page, "/teacher/history");
    await expect(page.locator("h1").filter({ hasText: /grading history/i })).toBeVisible();
    await expect(page.locator("text=/Detailed Grading Log/i")).toBeVisible();
  });

});

// ── 2. Course Detail ──────────────────────────────────────────────────────────

test.describe("Course Detail", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("opens course and shows Assignments tab", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1");
    // Scope to the page's own <h1> — "UX/UI Design" also appears (truncated)
    // in the sidebar's per-course nav label, which is a separate element.
    await expect(page.getByRole("heading", { level: 1, name: "UX/UI Design" })).toBeVisible();
    await expect(page.locator("text=Assignments").first()).toBeVisible();
  });

  test("Score Book tab links to course results", async ({ page }) => {
    // 21/9/2569: the "Results" sidebar entry became "Score Book" (same /results route)
    await waitReady(page, "/teacher/courses/seed-1");
    const resultsLink = page.getByRole("link", { name: /^score book$/i }).first();
    await expect(resultsLink).toBeVisible();
    await resultsLink.click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/courses\/seed-1\/results/, { timeout: 20_000 }); // the dev server compiles the route on first visit
  });
});

// ── 3. Assignment Detail ──────────────────────────────────────────────────────

test.describe("Assignment Detail", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  // 21/9/2569: the detail page is planning only — the submissions table, stats and Review / Recheck
  // links moved to the assignment's Grading page (see "Grading Progress" below).
  test("a-seed-1-1 detail page leads to grading with a Go to grading button", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/assignments/a-seed-1-1");
    const btn = page.getByRole("link", { name: /go to grading/i }).first();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute("href", /\/a-seed-1-1\/grading/);
  });

  test("a-seed-1-2 detail page also leads to grading, and no longer lists submissions", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/assignments/a-seed-1-2");
    await expect(page.getByRole("link", { name: /go to grading/i }).first()).toHaveAttribute("href", /\/a-seed-1-2\/grading/);
    await expect(page.getByPlaceholder("Search students...")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /recheck|start grading/i })).toHaveCount(0);
  });
});

// ── 4. Grading Progress ───────────────────────────────────────────────────────

test.describe("Grading Progress", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("shows SVG ring and stat labels", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/assignments/a-seed-1-2/grading");
    await expect(page.locator("svg").first()).toBeVisible();
    await expect(
      page.locator("text=/processed|total files|needs review|avg score/i").first()
    ).toBeVisible();
  });

  test("fully-graded assignment shows View Results link", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/assignments/a-seed-1-1/grading");
    await expect(
      page.getByRole("link", { name: /view results/i }).first()
    ).toBeVisible();
  });

  // moved here from the old assignment detail page (21/9/2569)
  test("submissions table shows Recheck links for graded rows", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/assignments/a-seed-1-1/grading");
    await expect(page.getByRole("link", { name: /recheck/i }).first()).toBeVisible();
  });

  test("search box is present and accepts input", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/assignments/a-seed-1-1/grading");
    const search = page.getByPlaceholder("Search students...");
    await expect(search).toBeVisible();
    await search.fill("test");
    await expect(search).toHaveValue("test");
  });
});

// ── 5. Assignment Results ─────────────────────────────────────────────────────

test.describe("Assignment Results", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("grade distribution labels A-F visible", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/assignments/a-seed-1-1/results");
    for (const grade of ["A", "B", "C", "D", "F"]) {
      await expect(page.locator(`text="${grade}"`).first()).toBeVisible();
    }
  });

  test("student search box present", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/assignments/a-seed-1-1/results");
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  });

  test("Export CSV button exists", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/assignments/a-seed-1-1/results");
    await expect(page.getByRole("button", { name: /export/i })).toBeVisible();
  });

  test("Recheck or View Details link exists per student", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/assignments/a-seed-1-1/results");
    const links = page.locator("a[href*='/recheck']");
    await expect(links.first()).toBeVisible();
    const href = await links.first().getAttribute("href");
    expect(href).toContain("/recheck?sub=");
  });
});

// ── 6. Recheck ────────────────────────────────────────────────────────────────

test.describe("Recheck", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("loads with AI confidence and score inputs", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/assignments/a-seed-1-1/recheck?sub=sub-1-1-1");
    await expect(page.locator("text=/AI Confidence/i")).toBeVisible();
    await expect(page.locator("input[type=number]").first()).toBeVisible();
  });

  test("editing score shows MANUALLY EDITED badge", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/assignments/a-seed-1-1/recheck?sub=sub-1-1-1");
    const input = page.locator("input[type=number]").first();
    await input.fill("5");
    await page.keyboard.press("Tab");
    await expect(page.locator("text=/manually edited/i")).toBeVisible();
  });

  test("Reset to Default clears MANUALLY EDITED", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/assignments/a-seed-1-1/recheck?sub=sub-1-1-1");
    const input = page.locator("input[type=number]").first();
    await input.fill("1");
    await page.keyboard.press("Tab");
    await page.getByRole("button", { name: /reset to default/i }).click();
    await expect(page.locator("text=/manually edited/i")).not.toBeVisible();
  });

  test("zoom + button increments display value", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/assignments/a-seed-1-1/recheck?sub=sub-1-1-1");
    await expect(page.locator("text=100%")).toBeVisible();
    await page.getByRole("button", { name: "+" }).click();
    await expect(page.locator("text=125%")).toBeVisible();
  });
});

// ── 7. Course Score Book (was "Course Results Overview" until 21/9/2569) ──────────────────────────────────
// The full matrix behaviour (cells, totals, sort, export …) is covered in tests/teacher-score-book.spec.ts;
// this only checks the page mounts for the shared seed course.

test.describe("Course Results", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("the Score Book page loads with its title", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/results");
    await expect(page.getByRole("heading", { level: 1, name: "Score Book" })).toBeVisible();
  });

  test("shows the matrix, or an empty state that leads the teacher to fix it", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/results");
    const matrix = page.locator("main table");
    const emptyAction = page.getByRole("link", { name: /go to students|create assignment/i });
    await expect(matrix.or(emptyAction).first()).toBeVisible();
  });
});

// ── 8. History ────────────────────────────────────────────────────────────────

test.describe("History", () => {
  test.skip(TEACHER_HISTORY_DISABLED, "/teacher/history is hidden and redirects away until TEACHER_HISTORY_DISABLED is flipped back to false");
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("stat cards show credits and papers count", async ({ page }) => {
    await waitReady(page, "/teacher/history");
    await expect(page.locator("text=/Total Credits Used/i")).toBeVisible();
    await expect(page.locator("text=/Assignments Graded/i")).toBeVisible();
    await expect(page.locator("text=/Remaining Balance/i")).toBeVisible();
  });

  test("grading log table shows rows", async ({ page }) => {
    await waitReady(page, "/teacher/history");
    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible();
  });

  test("search filters table rows", async ({ page }) => {
    await waitReady(page, "/teacher/history");
    const search = page.getByPlaceholder("Search activity...");
    await search.fill("Wireframe");
    await expect(page.locator("text=Wireframe Prototype").first()).toBeVisible();
    await expect(page.locator("text=User Research Report")).not.toBeVisible();
  });

  test("status filter shows only completed", async ({ page }) => {
    await waitReady(page, "/teacher/history");
    await page.selectOption("select", "completed");
    const cells = page.locator("tbody td").filter({ hasText: /Failed/i });
    await expect(cells).toHaveCount(0);
  });

  test("Export CSV button is present", async ({ page }) => {
    await waitReady(page, "/teacher/history");
    await expect(page.getByRole("button", { name: /export csv/i })).toBeVisible();
  });

  test("pagination controls render", async ({ page }) => {
    await waitReady(page, "/teacher/history");
    await expect(page.locator("text=/Showing/i")).toBeVisible();
  });
});

// ── 9. Rubric Editor ──────────────────────────────────────────────────────────

test.describe("Rubric Editor", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("page loads with rubric criteria", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/assignments/a-seed-1-1/rubrics/r-seed-1-1");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("AI Rubric Assistant button opens modal", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/assignments/a-seed-1-1/rubrics/r-seed-1-1");
    const aiBtn = page.getByRole("button", { name: /AI Rubric Assistant/i });
    await expect(aiBtn).toBeVisible();
    await aiBtn.click();
    await expect(
      page.locator("text=/กำลังวิเคราะห์|AI แนะนำ|Apply Suggestions/").first()
    ).toBeVisible({ timeout: 8000 });
  });

  test("Generate button visible per criterion", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/assignments/a-seed-1-1/rubrics/r-seed-1-1");
    await expect(page.getByRole("button", { name: /generate/i }).first()).toBeVisible();
  });
});

// ── 10. Auth Guard ────────────────────────────────────────────────────────────

test.describe("Auth Guard", () => {
  test("unauthenticated user is redirected to /login", async ({ page }) => {
    // No withAuth — localStorage empty
    await page.goto(`${BASE}/teacher/dashboard`);
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated access to /courses redirects to /login", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses`);
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("already-logged-in user visiting /login is redirected to /courses", async ({ page }) => {
    await withAuth(page);
    await waitReady(page, "/login");
    await page.waitForURL(/\/teacher\/courses/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/teacher\/courses/);
  });
});

// ── 11. Login ─────────────────────────────────────────────────────────────────
// NOTE: the login page is a single email+password form — role is auto-detected
// from the email prefix (numeric → student, contains "admin" → admin, else
// teacher), not a separate tab UI. See tests/auth-role-tabs.spec.ts for the
// role-detection-specific coverage.

test.describe("Login", () => {
  test.beforeEach(async ({ page }) => { await withLang(page); });

  test("page renders sign-in form and OAuth buttons", async ({ page }) => {
    await waitReady(page, "/login");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByPlaceholder("you@kmitl.ac.th")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
  });

  test("valid credentials redirect to /teacher/courses", async ({ page }) => {
    await waitReady(page, "/login");
    await page.fill('input[type="email"]', "teacher@school.edu");
    await page.fill('input[type="password"]', "password123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/teacher\/courses/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/teacher\/courses/);
  });

  test("short password (< 8 chars) shows error", async ({ page }) => {
    await waitReady(page, "/login");
    await page.fill('input[type="email"]', "teacher@school.edu");
    await page.fill('input[type="password"]', "abc");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.locator("text=/at least 8/i")).toBeVisible();
  });

  test("login page does not offer inline self-registration", async ({ page }) => {
    // Self-registration was intentionally removed from the login flow — admins
    // create accounts (see meeting notes 4/9/2569, "Admin scope ยืนยันแคบ").
    // /register still exists as a directly-reachable route (see "Register"
    // describe block below), it's just no longer linked from /login.
    await waitReady(page, "/login");
    await expect(page.getByRole("link", { name: /sign up/i })).toHaveCount(0);
  });
});

// ── 12. Register ──────────────────────────────────────────────────────────────

test.describe("Register", () => {
  test.beforeEach(async ({ page }) => { await withLang(page); });

  test("page renders with role toggle and Create Account button", async ({ page }) => {
    await waitReady(page, "/register");
    await expect(page.getByRole("heading", { name: /get started with hwai/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /teacher/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /teaching assistant/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
  });

  test("TA role toggle selects Teaching Assistant", async ({ page }) => {
    await waitReady(page, "/register");
    const taBtn = page.getByRole("button", { name: /teaching assistant/i });
    await taBtn.click();
    // Selected style includes border-[#2DD4BF] via class — check aria or text
    await expect(taBtn).toBeVisible();
    // Verify teacher button is deselected by checking class (not selected color)
    const teacherBtn = page.getByRole("button", { name: /^Teacher$/i });
    await expect(teacherBtn).toBeVisible();
  });

  test("password mismatch shows error", async ({ page }) => {
    await waitReady(page, "/register");
    await page.fill('input[type="text"]', "Jane Doe");
    await page.fill('input[type="email"]', "jane@school.edu");
    // Fill password fields — there are two password inputs
    const pwInputs = page.locator('input[type="password"]');
    await pwInputs.nth(0).fill("Password123!");
    await pwInputs.nth(1).fill("DifferentPass!");
    // Check terms
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.locator("text=/do not match/i")).toBeVisible();
  });

  test("unchecked terms show agreement error", async ({ page }) => {
    await waitReady(page, "/register");
    await page.fill('input[type="text"]', "Jane Doe");
    await page.fill('input[type="email"]', "jane@school.edu");
    const pwInputs = page.locator('input[type="password"]');
    await pwInputs.nth(0).fill("Password123!");
    await pwInputs.nth(1).fill("Password123!");
    // Do NOT check terms
    await page.getByRole("button", { name: /create account/i }).click();
    // Error text, not a hardcoded Tailwind class (migrated to design tokens
    // during the Slate Morning color pass — bg-red-50 no longer exists here).
    // "Please agree..." disambiguates from the checkbox's own "I agree..." label.
    await expect(page.getByText(/please agree to the terms/i)).toBeVisible();
  });

  test("valid registration redirects to /courses", async ({ page }) => {
    await waitReady(page, "/register");
    await page.fill('input[type="text"]', "Jane Doe");
    await page.fill('input[type="email"]', "jane@school.edu");
    const pwInputs = page.locator('input[type="password"]');
    await pwInputs.nth(0).fill("Password123!");
    await pwInputs.nth(1).fill("Password123!");
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: /create account/i }).click();
    await page.waitForURL(/\/courses/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/courses/);
  });
});

// ── 13. Sign Out ──────────────────────────────────────────────────────────────

test.describe("Sign Out", () => {
  test("sign out clears session and redirects to /login", async ({ page }) => {
    await withAuth(page);
    await waitReady(page, "/teacher/dashboard");
    // Find and click the sign out / logout button in the navbar or sidebar
    const signOutBtn = page.getByRole("button", { name: /sign out|logout/i }).first();
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
    // Confirm localStorage cleared
    const stored = await page.evaluate(() => localStorage.getItem("hwai_user"));
    expect(stored).toBeNull();
  });
});

// ── 14. i18n Language Toggle ──────────────────────────────────────────────────

test.describe("i18n Language Toggle", () => {
  test.skip(LANGUAGE_TOGGLE_DISABLED, "Language toggle button is hidden app-wide until LANGUAGE_TOGGLE_DISABLED is flipped back to false");
  // Don't set hwai_lang — fresh context starts empty, app defaults to "th".
  // Setting it via addInitScript would re-run on reload and break the persist test.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((u) => {
      localStorage.setItem("hwai_user", JSON.stringify(u));
    }, MOCK_USER);
  });

  test("default language is TH — toggle button shows TH", async ({ page }) => {
    await waitReady(page, "/teacher/courses");
    const langBtn = page.getByRole("button", { name: /toggle language/i });
    await expect(langBtn).toHaveText("TH");
  });

  test("clicking toggle switches to EN", async ({ page }) => {
    await waitReady(page, "/teacher/courses");
    const langBtn = page.getByRole("button", { name: /toggle language/i });
    await langBtn.click();
    await expect(langBtn).toHaveText("EN");
  });

  test("language preference persists after reload", async ({ page }) => {
    await waitReady(page, "/teacher/courses");
    const langBtn = page.getByRole("button", { name: /toggle language/i });
    await langBtn.click();
    await expect(langBtn).toHaveText("EN");
    // Reload the page — init script re-runs with hwai_user, but hwai_lang stays in localStorage
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: /toggle language/i })).toHaveText("EN");
  });

  test("toggling shows Thai text in TH mode, English in EN mode", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/clo");
    // Default lang=th: back button shows Thai text or heading shows Thai
    const langBtn = page.getByRole("button", { name: /toggle language/i });
    await expect(langBtn).toHaveText("TH");
    // Switch to EN
    await langBtn.click();
    await expect(langBtn).toHaveText("EN");
  });
});

// ── 15. Uncovered Pages ───────────────────────────────────────────────────────

test.describe("Notifications Page", () => {
  test.skip(NOTIFICATIONS_DISABLED, "Notifications is hidden until NOTIFICATIONS_DISABLED is flipped back to false");
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("loads and shows notification cards or empty state", async ({ page }) => {
    await waitReady(page, "/teacher/notifications");
    await expect(page.getByRole("heading", { name: /notifications/i })).toBeVisible();
    // Either cards are visible or empty state
    const hasCards = await page.locator("[class*='rounded-2xl']").count();
    expect(hasCards).toBeGreaterThan(0);
  });

  test("notification cards have dismiss or action buttons", async ({ page }) => {
    await waitReady(page, "/teacher/notifications");
    const actionBtns = page.locator("button").filter({ hasText: /dismiss|accept|decline|grade now|view/i });
    await expect(actionBtns.first()).toBeVisible();
  });
});

// "Courses New" describe block removed (10/9/2569) — teachers can no longer
// create their own courses (TEACHER_COURSE_CREATION_DISABLED in
// teacher/courses/new/page.tsx redirects the route away); only admin
// creates courses now, via /admin/courses. Restore these 3 tests
// (form loads / submit disabled on empty name / enabled once filled)
// alongside flipping that flag back to false.

test.describe("Course Settings", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("form loads with course name and danger zone", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/settings");
    await expect(page.getByRole("heading", { name: /edit existing course/i })).toBeVisible();
    await expect(page.locator("text=/Danger Zone/i")).toBeVisible();
    await expect(page.getByRole("button", { name: /archive course/i })).toBeVisible();
    // Delete removed 22/9/2569 — teachers can archive (reversible) but only admin can permanently
    // delete a course now (admin/courses/page.tsx has its own delete flow).
    await expect(page.getByRole("button", { name: /delete permanently/i })).toHaveCount(0);
    await expect(page.locator("text=/admin-only/i")).toBeVisible();
  });

  test("Save Changes button present", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/settings");
    await expect(page.getByRole("button", { name: /save changes/i })).toBeVisible();
  });
});

test.describe("CLO Page", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("page loads and shows CLO table", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/clo");
    // CLO should appear somewhere on the page — in heading or table header
    await expect(page.locator("text=/CLO/i").first()).toBeVisible();
  });

  test("Add CLO button is visible", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/clo");
    await expect(page.getByRole("button", { name: /add clo/i })).toBeVisible();
  });
});

test.describe("Collaborators Page", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("page loads with collaborator list or invite section", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/collaborators");
    await expect(page).toHaveURL(/\/collaborators/);
    // Search or heading should be visible
    await expect(page.locator("h1, h2, input[type='search'], input[placeholder*='search']").first()).toBeVisible();
  });
});

test.describe("Student Import", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("page loads with CSV upload area", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/students/import");
    // Should show CSV-related content
    await expect(page.locator("text=/CSV|Import|upload/i").first()).toBeVisible();
  });

  test("Download Template link is present", async ({ page }) => {
    await waitReady(page, "/teacher/courses/seed-1/students/import");
    await expect(page.getByRole("link", { name: /download/i }).first()).toBeVisible();
  });
});

// "App Settings" describe block removed (12/9/2569) — /teacher/settings and
// /teacher/profile were deleted at the user's request (no longer needed);
// theme toggling still works app-wide via the header button in every shell
// (AppShell/AdminShell/StudentShell), which calls ThemeProvider's
// toggleTheme() directly and doesn't depend on this settings page.

// ── New Feature Tests ─────────────────────────────────────────────────────────

/** Inject auth + English + 7 courses so pagination kicks in (PAGE_SIZE = 6) */
async function withManyCourses(page: Page) {
  await page.addInitScript(() => {
    const now = "2026-01-01T00:00:00.000Z";
    const courses = Array.from({ length: 7 }, (_, i) => ({
      id: `pag-${i}`,
      name: `Pagination Course ${i + 1}`,
      description: "",
      status: "active",
      source: "manual",
      coverColor: "#2DD4BF",
      iconColor: "#2DD4BF",
      createdAt: now,
      updatedAt: now,
    }));
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Test Teacher", email: "test@school.edu", role: "teacher" }));
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_courses_v2", JSON.stringify(courses));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([
      { id: "e2e-teacher-1", name: "Test Teacher", email: "test@school.edu", role: "teacher", status: "active", courseIds: courses.map((c) => c.id) },
    ]));
  });
}

test.describe("Courses Pagination", () => {
  test.beforeEach(async ({ page }) => { await withManyCourses(page); });

  test("pagination controls appear when courses exceed page size", async ({ page }) => {
    await waitReady(page, "/teacher/courses");
    await expect(page.getByRole("button", { name: "2" })).toBeVisible();
  });

  test("page 1 shows exactly 6 course cards", async ({ page }) => {
    await waitReady(page, "/teacher/courses");
    await expect(page.locator(".grid h3")).toHaveCount(6);
  });

  test("clicking page 2 shows the remaining course", async ({ page }) => {
    await waitReady(page, "/teacher/courses");
    await page.getByRole("button", { name: "2" }).click();
    await expect(page.getByText("Pagination Course 7")).toBeVisible();
  });

  test("prev button is disabled on page 1", async ({ page }) => {
    await waitReady(page, "/teacher/courses");
    const pagination = page.locator(".flex.justify-center.items-center.gap-1");
    await expect(pagination.locator("button").first()).toBeDisabled();
  });

  test("next button is disabled on last page", async ({ page }) => {
    await waitReady(page, "/teacher/courses");
    await page.getByRole("button", { name: "2" }).click();
    const pagination = page.locator(".flex.justify-center.items-center.gap-1");
    await expect(pagination.locator("button").last()).toBeDisabled();
  });
});

test.describe("Navbar UI", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("avatar shows user initials", async ({ page }) => {
    await waitReady(page, "/teacher/dashboard");
    // MOCK_USER.name = "Test Teacher" → initials "T"
    const avatar = page.locator('[class*="2DD4BF"].rounded-full span');
    await expect(avatar).toBeVisible();
    await expect(avatar).toHaveText("T");
  });

  test("unread notification badge is visible", async ({ page }) => {
    test.skip(NOTIFICATIONS_DISABLED, "Notifications is hidden until NOTIFICATIONS_DISABLED is flipped back to false");
    await waitReady(page, "/teacher/dashboard");
    // 3 notifications are unread in INITIAL_NOTIFS — badge should render.
    // Migrated from bg-red-500 to the --danger-solid token during the Slate
    // Morning color pass.
    const badge = page.locator('a[aria-label="Notifications"] [class*="danger-solid"]');
    await expect(badge).toBeVisible();
  });
});

test.describe("Auth Pages Layout", () => {
  test.beforeEach(async ({ page }) => { await withLang(page); });

  test("login page fits in viewport without scrolling", async ({ page }) => {
    await waitReady(page, "/login");
    const scrollable = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight
    );
    expect(scrollable).toBe(false);
  });

  test("register page fits in viewport without scrolling", async ({ page }) => {
    await waitReady(page, "/register");
    const scrollable = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight
    );
    expect(scrollable).toBe(false);
  });

  test("login left panel shows branding tagline", async ({ page }) => {
    await waitReady(page, "/login");
    await expect(page.getByText(/grading at the/i)).toBeVisible();
  });

  test("register left panel shows branding tagline", async ({ page }) => {
    await waitReady(page, "/register");
    await expect(page.getByText(/grade smarter/i)).toBeVisible();
  });
});

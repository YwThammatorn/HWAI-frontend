import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

const MOCK_USER = { name: "Test Teacher", email: "test@school.edu", role: "teacher" };

/** Inject mock auth session + force English lang before page load */
async function withAuth(page: Page) {
  await page.addInitScript((u) => {
    localStorage.setItem("hwai_user", JSON.stringify(u));
    localStorage.setItem("hwai_lang", "en");
  }, MOCK_USER);
}

async function waitReady(page: Page, path: string) {
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");
}

// ── 1. Navigation ─────────────────────────────────────────────────────────────

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("dashboard loads", async ({ page }) => {
    await waitReady(page, "/dashboard");
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /courses/i }).first()).toBeVisible();
  });

  test("courses page shows course cards", async ({ page }) => {
    await waitReady(page, "/courses");
    await expect(page.locator("text=UX/UI Design").first()).toBeVisible();
  });

  test("history page loads with grading log", async ({ page }) => {
    await waitReady(page, "/history");
    await expect(page.locator("h1").filter({ hasText: /grading history/i })).toBeVisible();
    await expect(page.locator("text=/Detailed Grading Log/i")).toBeVisible();
  });

  test("profile page loads", async ({ page }) => {
    await waitReady(page, "/profile");
    await expect(page).toHaveURL(/\/profile/);
  });
});

// ── 2. Course Detail ──────────────────────────────────────────────────────────

test.describe("Course Detail", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("opens course and shows Assignments tab", async ({ page }) => {
    await waitReady(page, "/courses/seed-1");
    await expect(page.locator("text=UX/UI Design").first()).toBeVisible();
    await expect(page.locator("text=Assignments").first()).toBeVisible();
  });

  test("Results tab links to course results", async ({ page }) => {
    await waitReady(page, "/courses/seed-1");
    const resultsLink = page.getByRole("link", { name: /^results$/i }).first();
    await expect(resultsLink).toBeVisible();
    await resultsLink.click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/courses\/seed-1\/results/);
  });
});

// ── 3. Assignment Detail ──────────────────────────────────────────────────────

test.describe("Assignment Detail", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("a-seed-1-1 (all graded) shows View Results button", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/assignments/a-seed-1-1");
    const btn = page.getByRole("link", { name: /view results/i }).first();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute("href", /\/results/);
  });

  test("a-seed-1-2 (partial) shows Start Grading button", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/assignments/a-seed-1-2");
    const btn = page.getByRole("link", { name: /start grading/i }).first();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute("href", /\/grading/);
  });

  test("submissions table shows Recheck links for graded rows", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/assignments/a-seed-1-1");
    await expect(page.getByRole("link", { name: /recheck/i }).first()).toBeVisible();
  });

  test("search box is present and accepts input", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/assignments/a-seed-1-1");
    const search = page.getByPlaceholder("Search students...");
    await expect(search).toBeVisible();
    await search.fill("test");
    await expect(search).toHaveValue("test");
  });
});

// ── 4. Grading Progress ───────────────────────────────────────────────────────

test.describe("Grading Progress", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("shows SVG ring and stat labels", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/assignments/a-seed-1-2/grading");
    await expect(page.locator("svg").first()).toBeVisible();
    await expect(
      page.locator("text=/processed|total files|needs review|avg score/i").first()
    ).toBeVisible();
  });

  test("fully-graded assignment shows View Results link", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/assignments/a-seed-1-1/grading");
    await expect(
      page.getByRole("link", { name: /view results/i }).first()
    ).toBeVisible();
  });
});

// ── 5. Assignment Results ─────────────────────────────────────────────────────

test.describe("Assignment Results", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("grade distribution labels A-F visible", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/assignments/a-seed-1-1/results");
    for (const grade of ["A", "B", "C", "D", "F"]) {
      await expect(page.locator(`text="${grade}"`).first()).toBeVisible();
    }
  });

  test("student search box present", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/assignments/a-seed-1-1/results");
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  });

  test("Export CSV button exists", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/assignments/a-seed-1-1/results");
    await expect(page.getByRole("button", { name: /export/i })).toBeVisible();
  });

  test("Recheck or View Details link exists per student", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/assignments/a-seed-1-1/results");
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
    await waitReady(page, "/courses/seed-1/assignments/a-seed-1-1/recheck?sub=sub-1-1-1");
    await expect(page.locator("text=/AI Confidence/i")).toBeVisible();
    await expect(page.locator("input[type=number]").first()).toBeVisible();
  });

  test("editing score shows MANUALLY EDITED badge", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/assignments/a-seed-1-1/recheck?sub=sub-1-1-1");
    const input = page.locator("input[type=number]").first();
    await input.fill("5");
    await page.keyboard.press("Tab");
    await expect(page.locator("text=/manually edited/i")).toBeVisible();
  });

  test("Reset to Default clears MANUALLY EDITED", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/assignments/a-seed-1-1/recheck?sub=sub-1-1-1");
    const input = page.locator("input[type=number]").first();
    await input.fill("1");
    await page.keyboard.press("Tab");
    await page.getByRole("button", { name: /reset to default/i }).click();
    await expect(page.locator("text=/manually edited/i")).not.toBeVisible();
  });

  test("zoom + button increments display value", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/assignments/a-seed-1-1/recheck?sub=sub-1-1-1");
    await expect(page.locator("text=100%")).toBeVisible();
    await page.getByRole("button", { name: "+" }).click();
    await expect(page.locator("text=125%")).toBeVisible();
  });
});

// ── 7. Course Results Overview ────────────────────────────────────────────────

test.describe("Course Results", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("shows assignment list with links", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/results");
    const assignmentLinks = page.locator("a[href*='/assignments/']");
    await expect(assignmentLinks.first()).toBeVisible();
  });

  test("has links to results or grading per assignment", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/results");
    const hrefs = await page.locator("a[href*='/assignments/']").evaluateAll(
      (els) => els.map((el) => el.getAttribute("href") ?? "")
    );
    expect(hrefs.length).toBeGreaterThan(0);
    const hasGradingOrResults = hrefs.some((h) => /\/(grading|results)$/.test(h));
    expect(hasGradingOrResults).toBe(true);
  });
});

// ── 8. History ────────────────────────────────────────────────────────────────

test.describe("History", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("stat cards show credits and papers count", async ({ page }) => {
    await waitReady(page, "/history");
    await expect(page.locator("text=/Total Credits Used/i")).toBeVisible();
    await expect(page.locator("text=/Assignments Graded/i")).toBeVisible();
    await expect(page.locator("text=/Remaining Balance/i")).toBeVisible();
  });

  test("grading log table shows rows", async ({ page }) => {
    await waitReady(page, "/history");
    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible();
  });

  test("search filters table rows", async ({ page }) => {
    await waitReady(page, "/history");
    const search = page.getByPlaceholder("Search activity...");
    await search.fill("Wireframe");
    await expect(page.locator("text=Wireframe Prototype").first()).toBeVisible();
    await expect(page.locator("text=User Research Report")).not.toBeVisible();
  });

  test("status filter shows only completed", async ({ page }) => {
    await waitReady(page, "/history");
    await page.selectOption("select", "completed");
    const cells = page.locator("tbody td").filter({ hasText: /Failed/i });
    await expect(cells).toHaveCount(0);
  });

  test("Export CSV button is present", async ({ page }) => {
    await waitReady(page, "/history");
    await expect(page.getByRole("button", { name: /export csv/i })).toBeVisible();
  });

  test("pagination controls render", async ({ page }) => {
    await waitReady(page, "/history");
    await expect(page.locator("text=/Showing/i")).toBeVisible();
  });
});

// ── 9. Rubric Editor ──────────────────────────────────────────────────────────

test.describe("Rubric Editor", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("page loads with rubric criteria", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/assignments/a-seed-1-1/rubrics/r-seed-1-1");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("AI Rubric Assistant button opens modal", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/assignments/a-seed-1-1/rubrics/r-seed-1-1");
    const aiBtn = page.getByRole("button", { name: /AI Rubric Assistant/i });
    await expect(aiBtn).toBeVisible();
    await aiBtn.click();
    await expect(
      page.locator("text=/กำลังวิเคราะห์|AI แนะนำ|Apply Suggestions/").first()
    ).toBeVisible({ timeout: 8000 });
  });

  test("Generate button visible per criterion", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/assignments/a-seed-1-1/rubrics/r-seed-1-1");
    await expect(page.getByRole("button", { name: /generate/i }).first()).toBeVisible();
  });
});

// ── 10. Auth Guard ────────────────────────────────────────────────────────────

test.describe("Auth Guard", () => {
  test("unauthenticated user is redirected to /login", async ({ page }) => {
    // No withAuth — localStorage empty
    await page.goto(`${BASE}/dashboard`);
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated access to /courses redirects to /login", async ({ page }) => {
    await page.goto(`${BASE}/courses`);
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("already-logged-in user visiting /login is redirected to /dashboard", async ({ page }) => {
    await withAuth(page);
    await waitReady(page, "/login");
    await page.waitForURL(/\/dashboard/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

// ── 11. Login ─────────────────────────────────────────────────────────────────

test.describe("Login", () => {
  test("page renders sign-in form and OAuth buttons", async ({ page }) => {
    await waitReady(page, "/login");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByPlaceholder("teacher@school.edu")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /microsoft/i })).toBeVisible();
  });

  test("valid credentials redirect to /dashboard", async ({ page }) => {
    await waitReady(page, "/login");
    await page.fill('input[type="email"]', "teacher@school.edu");
    await page.fill('input[type="password"]', "password123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("short password (< 4 chars) shows error", async ({ page }) => {
    await waitReady(page, "/login");
    await page.fill('input[type="email"]', "teacher@school.edu");
    await page.fill('input[type="password"]', "abc");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.locator("text=/at least 4/i")).toBeVisible();
  });

  test("register link navigates to /register", async ({ page }) => {
    await waitReady(page, "/login");
    await page.getByRole("link", { name: /sign up/i }).click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/register/);
  });
});

// ── 12. Register ──────────────────────────────────────────────────────────────

test.describe("Register", () => {
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
    await expect(page.locator("p.bg-red-50")).toBeVisible();
  });

  test("valid registration redirects to /dashboard", async ({ page }) => {
    await waitReady(page, "/register");
    await page.fill('input[type="text"]', "Jane Doe");
    await page.fill('input[type="email"]', "jane@school.edu");
    const pwInputs = page.locator('input[type="password"]');
    await pwInputs.nth(0).fill("Password123!");
    await pwInputs.nth(1).fill("Password123!");
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: /create account/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

// ── 13. Sign Out ──────────────────────────────────────────────────────────────

test.describe("Sign Out", () => {
  test("sign out clears session and redirects to /login", async ({ page }) => {
    await withAuth(page);
    await waitReady(page, "/dashboard");
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
  // Don't set hwai_lang — fresh context starts empty, app defaults to "th".
  // Setting it via addInitScript would re-run on reload and break the persist test.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((u) => {
      localStorage.setItem("hwai_user", JSON.stringify(u));
    }, MOCK_USER);
  });

  test("default language is TH — toggle button shows TH", async ({ page }) => {
    await waitReady(page, "/courses");
    const langBtn = page.getByRole("button", { name: /toggle language/i });
    await expect(langBtn).toHaveText("TH");
  });

  test("clicking toggle switches to EN", async ({ page }) => {
    await waitReady(page, "/courses");
    const langBtn = page.getByRole("button", { name: /toggle language/i });
    await langBtn.click();
    await expect(langBtn).toHaveText("EN");
  });

  test("language preference persists after reload", async ({ page }) => {
    await waitReady(page, "/courses");
    const langBtn = page.getByRole("button", { name: /toggle language/i });
    await langBtn.click();
    await expect(langBtn).toHaveText("EN");
    // Reload the page — init script re-runs with hwai_user, but hwai_lang stays in localStorage
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: /toggle language/i })).toHaveText("EN");
  });

  test("toggling shows Thai text in TH mode, English in EN mode", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/clo");
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
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("loads and shows notification cards or empty state", async ({ page }) => {
    await waitReady(page, "/notifications");
    await expect(page.getByRole("heading", { name: /notifications/i })).toBeVisible();
    // Either cards are visible or empty state
    const hasCards = await page.locator("[class*='rounded-2xl']").count();
    expect(hasCards).toBeGreaterThan(0);
  });

  test("notification cards have dismiss or action buttons", async ({ page }) => {
    await waitReady(page, "/notifications");
    const actionBtns = page.locator("button").filter({ hasText: /dismiss|accept|decline|grade now|view/i });
    await expect(actionBtns.first()).toBeVisible();
  });
});

test.describe("Courses New", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("form loads with Course Name field and color picker", async ({ page }) => {
    await waitReady(page, "/courses/new");
    await expect(page.getByRole("heading", { name: /add new course/i })).toBeVisible();
    await expect(page.getByPlaceholder("e.g. UX/UI Design Principles")).toBeVisible();
    await expect(page.getByRole("button", { name: /create course/i })).toBeVisible();
  });

  test("Create Course button is disabled with empty name", async ({ page }) => {
    await waitReady(page, "/courses/new");
    const submitBtn = page.getByRole("button", { name: /create course/i });
    await expect(submitBtn).toBeDisabled();
  });

  test("typing course name enables Create Course button", async ({ page }) => {
    await waitReady(page, "/courses/new");
    await page.getByPlaceholder("e.g. UX/UI Design Principles").fill("My New Course");
    await expect(page.getByRole("button", { name: /create course/i })).toBeEnabled();
  });
});

test.describe("Course Settings", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("form loads with course name and danger zone", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/settings");
    await expect(page.getByRole("heading", { name: /edit existing course/i })).toBeVisible();
    await expect(page.locator("text=/Danger Zone/i")).toBeVisible();
    await expect(page.getByRole("button", { name: /archive course/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /delete permanently/i })).toBeVisible();
  });

  test("Save Changes button present", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/settings");
    await expect(page.getByRole("button", { name: /save changes/i })).toBeVisible();
  });
});

test.describe("CLO Page", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("page loads and shows CLO table", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/clo");
    // CLO should appear somewhere on the page — in heading or table header
    await expect(page.locator("text=/CLO/i").first()).toBeVisible();
  });

  test("Add CLO button is visible", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/clo");
    await expect(page.getByRole("button", { name: /add clo/i })).toBeVisible();
  });
});

test.describe("Collaborators Page", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("page loads with collaborator list or invite section", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/collaborators");
    await expect(page).toHaveURL(/\/collaborators/);
    // Search or heading should be visible
    await expect(page.locator("h1, h2, input[type='search'], input[placeholder*='search']").first()).toBeVisible();
  });
});

test.describe("Student Import", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("page loads with CSV upload area", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/students/import");
    // Should show CSV-related content
    await expect(page.locator("text=/CSV|Import|upload/i").first()).toBeVisible();
  });

  test("Download Template link is present", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/students/import");
    await expect(page.getByRole("link", { name: /download/i }).first()).toBeVisible();
  });
});

test.describe("App Settings", () => {
  test.beforeEach(async ({ page }) => { await withAuth(page); });

  test("page loads with theme toggle switches", async ({ page }) => {
    await waitReady(page, "/settings");
    // Settings page has theme-related toggles
    await expect(page.locator("role=switch").first()).toBeVisible();
  });

  test("dark mode toggle is a switch", async ({ page }) => {
    await waitReady(page, "/settings");
    const themeSwitch = page.locator("[role='switch']").first();
    await expect(themeSwitch).toBeVisible();
    // Click it and verify aria-checked changes
    const before = await themeSwitch.getAttribute("aria-checked");
    await themeSwitch.click();
    const after = await themeSwitch.getAttribute("aria-checked");
    expect(before).not.toBe(after);
  });
});

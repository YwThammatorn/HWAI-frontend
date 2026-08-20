import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

async function waitReady(page: Page, path: string) {
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");
}

// ── 1. Navigation ─────────────────────────────────────────────────────────────

test.describe("Navigation", () => {
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
  test("opens course and shows Assignments tab", async ({ page }) => {
    await waitReady(page, "/courses/seed-1");
    await expect(page.locator("text=UX/UI Design").first()).toBeVisible();
    // Assignments tab text (button or element containing the word)
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
    // verify input value changed
    await expect(search).toHaveValue("test");
  });
});

// ── 4. Grading Progress ───────────────────────────────────────────────────────

test.describe("Grading Progress", () => {
  test("shows SVG ring and stat labels", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/assignments/a-seed-1-2/grading");
    await expect(page.locator("svg").first()).toBeVisible();
    // at least one stat card label
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
    // accept either "Recheck" or "View Details" link
    const links = page.locator("a[href*='/recheck']");
    await expect(links.first()).toBeVisible();
    const href = await links.first().getAttribute("href");
    expect(href).toContain("/recheck?sub=");
  });
});

// ── 6. Recheck ────────────────────────────────────────────────────────────────

test.describe("Recheck", () => {
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
  test("shows assignment list with links", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/results");
    // should contain at least one assignment link
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
  test("page loads with rubric criteria", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/assignments/a-seed-1-1/rubrics/r-seed-1-1");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("AI Rubric Assistant button opens modal", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/assignments/a-seed-1-1/rubrics/r-seed-1-1");
    const aiBtn = page.getByRole("button", { name: /AI Rubric Assistant/i });
    await expect(aiBtn).toBeVisible();
    await aiBtn.click();
    // modal appears — shows Thai loading text or suggestions
    await expect(
      page.locator("text=/กำลังวิเคราะห์|AI แนะนำ|Apply Suggestions/").first()
    ).toBeVisible({ timeout: 8000 });
  });

  test("Generate button visible per criterion", async ({ page }) => {
    await waitReady(page, "/courses/seed-1/assignments/a-seed-1-1/rubrics/r-seed-1-1");
    await expect(page.getByRole("button", { name: /generate/i }).first()).toBeVisible();
  });
});

import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// 26/9/2569 — admin Users → Students: inactive students are hidden by default and a single "Show inactive (n)"
// switch in the filter row brings them in below the active ones (a second tab bar under Teachers/Students was
// redundant). A long program name (Computer Engineering and Cybersecurity) wraps instead of being clipped.

const mk = (n: number, program: string, status?: string) => ({
  id: `s-${n}`, studentId: `6907${String(n).padStart(4, "0")}`, firstName: `Name${n}`, lastName: "Test",
  email: `6907${String(n).padStart(4, "0")}@kmitl.ac.th`, program, ...(status ? { status } : {}),
});
// CECS: 1 (no status), 2 inactive, 3 active   |   CE: 4 active, 5 inactive
const STUDENTS = [mk(1, "CECS"), mk(2, "CECS", "inactive"), mk(3, "CECS", "active"), mk(4, "CE"), mk(5, "CE", "inactive")];

async function open(page: Page, lang: "en" | "th" = "en", students: unknown[] = STUDENTS) {
  await page.addInitScript(([l, st]) => {
    if (sessionStorage.getItem("sf")) return;
    sessionStorage.setItem("sf", "1");
    localStorage.setItem("hwai_lang", l as string);
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Admin", email: "admin@kmitl.ac.th", role: "admin" }));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(st));
  }, [lang, students] as const);
  await page.goto(`${BASE}/admin/users`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: /^Students|^นักศึกษา/ }).click();
}

const rows = (page: Page) => page.getByRole("row").filter({ hasText: "Test" });
const toggle = (page: Page) => page.getByRole("switch", { name: /Show inactive|แสดงที่พ้นสภาพ/ });

test("inactive students are hidden until 'Show inactive' is switched on, then they follow the active ones", async ({ page }) => {
  await open(page);
  await page.getByLabel("Filter by program").selectOption("CECS");

  // default: only the active students (one has no status at all → counts as active), no second tab bar
  await expect(page.getByRole("tablist", { name: "Student status" })).toHaveCount(0);
  await expect(toggle(page)).toHaveAttribute("aria-checked", "false");
  await expect(toggle(page)).toContainText("(1)");
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).getByText("Inactive", { exact: true })).toHaveCount(0);

  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute("aria-checked", "true");
  await expect(rows(page)).toHaveCount(3);
  // active first, inactive last — even though Name2 sorts before Name3 by ID
  await expect(rows(page).nth(0)).toContainText("Name1");
  await expect(rows(page).nth(1)).toContainText("Name3");
  await expect(rows(page).nth(2)).toContainText("Name2");
  await expect(rows(page).nth(2).getByText("Inactive", { exact: true })).toBeVisible();

  await toggle(page).click();
  await expect(rows(page)).toHaveCount(2);
});

test("the count follows the program filter and the search; the switch is disabled when nobody is inactive", async ({ page }) => {
  await open(page);
  await page.getByLabel("Filter by program").selectOption("CE");
  await expect(toggle(page)).toContainText("(1)");
  await page.getByPlaceholder("Search students...").fill("Name4");
  await expect(toggle(page)).toContainText("(0)");
  await expect(toggle(page)).toBeDisabled();
});

test("deactivating a student drops the row from the default view and the count goes up; activating brings it back", async ({ page }) => {
  await open(page);
  await page.getByLabel("Filter by program").selectOption("CE");

  await page.getByRole("button", { name: "Deactivate Name4 Test" }).click();
  await page.getByRole("button", { name: "Deactivate", exact: true }).click();
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByText("Everyone in this program is inactive")).toBeVisible();
  await expect(toggle(page)).toContainText("(2)");

  await toggle(page).click();
  await expect(rows(page)).toHaveCount(2);
  await page.getByRole("button", { name: "Activate Name4 Test" }).click();
  await expect(rows(page).nth(0)).toContainText("Name4");                   // back among the active ones, above Name5
  await expect(rows(page).nth(1)).toContainText("Name5");
  await expect(toggle(page)).toContainText("(1)");
});

test("a long program name wraps and shows in full instead of being clipped", async ({ page }) => {
  await open(page);
  await page.getByLabel("Filter by program").selectOption("CECS");
  const cell = rows(page).first().getByText("Computer Engineering and Cybersecurity");
  await expect(cell).toBeVisible();
  const fits = await cell.evaluate((e) => ({
    sideways: e.scrollWidth > e.clientWidth + 1,                              // clipped on the right?
    lines: Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)),
  }));
  expect(fits.sideways).toBe(false);
  expect(fits.lines).toBeLessThanOrEqual(2);
  await expect(cell).toHaveAttribute("title", "Computer Engineering and Cybersecurity");
});

test("Thai UI: the switch is Thai", async ({ page }) => {
  await open(page, "th");
  await expect(page.getByRole("switch", { name: /แสดงที่พ้นสภาพ/ })).toBeVisible();
});

import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// 26/9/2569 — admin Users → Students: a Status filter (All / Active / Inactive), and a long program name
// (Computer Engineering and Cybersecurity) wraps onto two lines instead of being clipped mid-word.

const mk = (n: number, program: string, status?: string) => ({
  id: `s-${n}`, studentId: `6907${String(n).padStart(4, "0")}`, firstName: `Name${n}`, lastName: "Test",
  email: `6907${String(n).padStart(4, "0")}@kmitl.ac.th`, program, ...(status ? { status } : {}),
});
const STUDENTS = [mk(1, "CECS"), mk(2, "CECS", "inactive"), mk(3, "CECS", "active"), mk(4, "CE"), mk(5, "CE", "inactive")];

async function open(page: Page, lang: "en" | "th" = "en") {
  await page.addInitScript(([l, st]) => {
    if (sessionStorage.getItem("sf")) return;
    sessionStorage.setItem("sf", "1");
    localStorage.setItem("hwai_lang", l as string);
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Admin", email: "admin@kmitl.ac.th", role: "admin" }));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(st));
  }, [lang, STUDENTS] as const);
  await page.goto(`${BASE}/admin/users`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: /^Students|^นักศึกษา/ }).click();
}

const rows = (page: Page) => page.getByRole("row").filter({ hasText: "Test" });

test("Status filter narrows the students to Active or Inactive, alongside the program filter", async ({ page }) => {
  await open(page);
  await page.getByLabel("Filter by program").selectOption("CECS");
  await expect(rows(page)).toHaveCount(3);

  const status = page.getByLabel("Filter by status");
  await expect(status).toHaveValue("all");
  await status.selectOption("inactive");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("Name2");
  await expect(rows(page).first().getByText("Inactive")).toBeVisible();

  await status.selectOption("active");                // a student with no status counts as Active
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).getByText("Inactive", { exact: true })).toHaveCount(0);

  await page.getByLabel("Filter by program").selectOption("CE");   // the status stays while the program changes
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("Name4");
});

test("Status filter combines with search and shows the empty message when nothing matches", async ({ page }) => {
  await open(page);
  await page.getByLabel("Filter by program").selectOption("CECS");
  await page.getByLabel("Filter by status").selectOption("inactive");
  await page.getByPlaceholder("Search students...").fill("Name1");
  await expect(page.getByText("No results found")).toBeVisible();
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

test("Thai UI: the filter and its options are Thai", async ({ page }) => {
  await open(page, "th");
  const status = page.getByLabel("กรองตามสถานะ");
  await expect(status).toBeVisible();
  await expect(status.locator("option")).toHaveText(["ทุกสถานะ", "ปกติ", "พ้นสภาพ"]);
});

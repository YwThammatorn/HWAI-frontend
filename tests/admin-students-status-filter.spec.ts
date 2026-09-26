import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// 26/9/2569 — admin Users → Students: Active / Inactive tabs (Active first, like Active / Archived courses), and a long program name
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

test("Active is the default tab; Inactive students sit one click away, with counts", async ({ page }) => {
  await open(page);
  await page.getByLabel("Filter by program").selectOption("CECS");
  const tabs = page.getByRole("tablist", { name: "Student status" });
  await expect(tabs.getByRole("tab", { name: /Active/ })).toHaveAttribute("aria-selected", "true");
  await expect(tabs.getByRole("tab", { name: /^Active/ })).toContainText("2");     // a student with no status counts as Active
  await expect(tabs.getByRole("tab", { name: /^Inactive/ })).toContainText("1");

  // the default view: only the two active students, no Inactive badge anywhere
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).getByText("Inactive", { exact: true })).toHaveCount(0);

  await tabs.getByRole("tab", { name: /^Inactive/ }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("Name2");
  await expect(rows(page).first().getByText("Inactive")).toBeVisible();

  await tabs.getByRole("tab", { name: /^Active/ }).click();
  await expect(rows(page)).toHaveCount(2);
});

test("the tab counts follow the program filter and the search", async ({ page }) => {
  await open(page);
  const tabs = page.getByRole("tablist", { name: "Student status" });
  await page.getByLabel("Filter by program").selectOption("CE");            // Name4 active, Name5 inactive
  await expect(tabs.getByRole("tab", { name: /^Active/ })).toContainText("1");
  await expect(tabs.getByRole("tab", { name: /^Inactive/ })).toContainText("1");

  await page.getByPlaceholder("Search students...").fill("Name4");
  await expect(tabs.getByRole("tab", { name: /^Inactive/ })).toContainText("0");
  await page.getByRole("heading", { level: 1 }).click();                       // click away: closes the search suggestions
  await tabs.getByRole("tab", { name: /^Inactive/ }).click();
  await expect(page.getByText("No results found")).toBeVisible();          // searching → the usual message
});

test("deactivating moves a student to the Inactive tab, activating brings them back", async ({ page }) => {
  await open(page);
  await page.getByLabel("Filter by program").selectOption("CE");
  const tabs = page.getByRole("tablist", { name: "Student status" });

  await page.getByRole("button", { name: "Deactivate Name4 Test" }).click();
  await page.getByRole("button", { name: "Deactivate", exact: true }).click();
  await expect(rows(page)).toHaveCount(0);                                    // Active tab is now empty
  await expect(page.getByText("No results found")).toBeVisible();
  await expect(tabs.getByRole("tab", { name: /^Inactive/ })).toContainText("2");

  await tabs.getByRole("tab", { name: /^Inactive/ }).click();
  await expect(rows(page)).toHaveCount(2);
  await page.getByRole("button", { name: "Activate Name4 Test" }).click();
  await expect(rows(page)).toHaveCount(1);                                    // only Name5 is left here
  await expect(tabs.getByRole("tab", { name: /^Active/ })).toContainText("1");
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

test("Thai UI: the tabs are Thai", async ({ page }) => {
  await open(page, "th");
  const tabs = page.getByRole("tablist", { name: "สถานะนักศึกษา" });
  await expect(tabs.getByRole("tab", { name: /^ปกติ/ })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: /^พ้นสภาพ/ })).toBeVisible();
});

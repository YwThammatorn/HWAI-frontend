import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// Mirrors NOTIFICATIONS_DISABLED in src/lib/featureFlags.ts — keep in sync.
// Notifications are folded away for now (21/9/2569): no bell in the teacher or admin top bar,
// and /teacher/notifications bounces to My Courses. Flip the flag to false to bring it back
// (this file then has nothing to assert, so it skips itself).
const NOTIFICATIONS_DISABLED = true;
test.skip(!NOTIFICATIONS_DISABLED, "Notifications are enabled — nothing is hidden");

const USERS = {
  teacher: { name: "Somsak", email: "somsak.c@kmitl.ac.th", role: "teacher" },
  admin: { name: "Admin", email: "admin@kmitl.ac.th", role: "admin" },
  student: { name: "Somchai", email: "69070101@kmitl.ac.th", role: "student", studentId: "69070101" },
};

async function open(page: Page, role: keyof typeof USERS, url: string) {
  await page.addInitScript((u) => {
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify(u));
  }, USERS[role]);
  await page.goto(`${BASE}${url}`);
  await page.waitForLoadState("networkidle");
}

test.describe("Notifications are folded away", () => {
  test("teacher top bar has no bell, but the rest of the bar is intact", async ({ page }) => {
    await open(page, "teacher", "/teacher/courses");
    await expect(page.getByRole("link", { name: "Notifications" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Notifications" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /theme|dark|light/i }).first()).toBeVisible();
    await expect(page.getByText("Somsak", { exact: false }).first()).toBeVisible();
  });

  test("admin top bar has no bell, but the rest of the bar is intact", async ({ page }) => {
    await open(page, "admin", "/admin/users");
    await expect(page.getByRole("button", { name: "Notifications" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Notifications" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /theme|dark|light/i }).first()).toBeVisible();
    await expect(page.getByText("Admin", { exact: false }).first()).toBeVisible();
  });

  test("no red unread dot is left behind in the teacher top bar", async ({ page }) => {
    await open(page, "teacher", "/teacher/courses");
    await expect(page.locator("nav [class*='danger-solid'], header [class*='danger-solid']")).toHaveCount(0);
  });

  test("/teacher/notifications bounces to My Courses", async ({ page }) => {
    await open(page, "teacher", "/teacher/notifications");
    await expect(page).toHaveURL(/\/teacher\/courses$/);
    await expect(page.getByRole("heading", { name: "Notifications" })).toHaveCount(0);
  });

  test("the student top bar never had one", async ({ page }) => {
    await open(page, "student", "/student");
    await expect(page.getByRole("button", { name: "Notifications" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Notifications" })).toHaveCount(0);
  });
});

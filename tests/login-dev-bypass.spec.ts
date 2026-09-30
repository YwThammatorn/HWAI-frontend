import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

// 29/9/2569 — the login page's "Dev Bypass" panel (dev builds only) had a Student shortcut hardcoded to
// studentId "64070501", which exists in no current mock seed at all (only in various self-contained test
// fixtures) — clicking it logged into a real session with an empty roster, which looked exactly like
// missing data after running one of the console commands. Now points at 69070101, which is present in
// every seed combination ([5] alone, [12]'s 57-student cohort, and [14]'s extra current-term courses).

test("the Dev Bypass Student shortcut logs into a real, enrolled account", async ({ page }) => {
  await page.addInitScript(() => {
    const NOW = "2026-01-01T00:00:00.000Z";
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_courses_v2", JSON.stringify([{ id: "c-devb", name: "Web", description: "", status: "active", coverColor: "#0F766E", createdAt: NOW, updatedAt: NOW }]));
    localStorage.setItem("hwai_students_v1", JSON.stringify([{ id: "r-devb", courseId: "c-devb", studentId: "69070101", firstName: "Somchai", lastName: "Jaidee", email: "69070101@kmitl.ac.th", sequenceNumber: 1, enrollmentStatus: "enrolled" }]));
  });
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Student" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/student$/);
  const user = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_user") ?? "{}"));
  expect(user).toMatchObject({ role: "student", studentId: "69070101" });

  await page.goto(`${BASE}/student/courses`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Web", { exact: true })).toBeVisible();   // a real enrolled course shows, not an empty state
  await expect(page.getByText("No courses yet")).toHaveCount(0);
});

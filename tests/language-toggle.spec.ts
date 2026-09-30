import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

// 26/9/2569 — the TH/EN button is back in every role's header (it had been hidden since 15/9).
// The app's default language is English; the button shows the language currently on.

const ROLES = [
  { role: "teacher", user: { name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }, path: "/teacher/courses", en: "Courses", th: "รายวิชา" },
  { role: "student", user: { name: "Ann", email: "69070401@kmitl.ac.th", role: "student", studentId: "69070401" }, path: "/student", en: "Home", th: "หน้าหลัก" },
  { role: "admin", user: { name: "Admin", email: "admin@kmitl.ac.th", role: "admin" }, path: "/admin/courses", en: "Course Management", th: "จัดการรายวิชา" },
] as const;

for (const r of ROLES) {
  test(`${r.role}: the language button switches English ↔ Thai and remembers the choice`, async ({ page }) => {
    await page.addInitScript((u) => {
      if (sessionStorage.getItem("lt_seeded")) return;
      sessionStorage.setItem("lt_seeded", "1");
      localStorage.setItem("hwai_user", JSON.stringify(u));
    }, r.user);
    await page.goto(`${BASE}${r.path}`);
    await page.waitForLoadState("networkidle");

    const button = page.getByRole("button", { name: "Toggle language" });
    await expect(button).toBeVisible();
    await expect(button).toHaveText("EN");
    await expect(page.getByText(r.en, { exact: true }).first()).toBeVisible();

    await button.click();
    await expect(button).toHaveText("TH");
    await expect(page.getByText(r.th, { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("hwai_lang"))).toBe("th");

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Toggle language" })).toHaveText("TH");
  });
}

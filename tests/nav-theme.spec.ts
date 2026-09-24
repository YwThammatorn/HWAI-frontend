import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const NOW = "2026-01-01T00:00:00.000Z";

// 24/9/2569 — the navy/teal top-bar + sidebar theme is available to every role (was teacher only),
// and the two surfaces are swapped: navbar takes the lighter navy / darker teal, sidebar the reverse.
const NAVY = { top: "rgb(36, 60, 90)", side: "rgb(26, 45, 69)" };
const TEAL = { top: "rgb(8, 69, 65)", side: "rgb(15, 118, 110)" };

const ROLES = [
  { role: "teacher", user: { name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }, path: "/teacher/courses/c-nt/students", top: "nav" },
  { role: "admin", user: { name: "Admin", email: "admin@kmitl.ac.th", role: "admin" }, path: "/admin/users", top: "header" },
  { role: "student", user: { name: "Fah Test", email: "64070601@kmitl.ac.th", role: "student", studentId: "64070601" }, path: "/student", top: "header" },
] as const;

async function seed(page: Page, user: object) {
  await page.addInitScript(({ user, course }) => {
    if (sessionStorage.getItem("nt_seeded")) return;
    sessionStorage.setItem("nt_seeded", "1");
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify(user));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([course]));
  }, {
    user,
    course: {
      id: "c-nt", name: "Theme Course", description: "", status: "active", source: "manual",
      coverColor: "#0F766E", iconColor: "#0F766E", createdAt: NOW, updatedAt: NOW,
    },
  });
}

const expectBg = (page: Page, sel: string, colour: string) => expect(page.locator(sel).first()).toHaveCSS("background-color", colour);

for (const r of ROLES) {
  test.describe(`${r.role} — navy/teal chrome theme`, () => {
    test.beforeEach(async ({ page }) => { await seed(page, r.user); });

    test("the toggle is in the top bar, and the navbar is lighter than the sidebar in navy", async ({ page }) => {
      await page.goto(`${BASE}${r.path}`);
      await expect(page.getByRole("button", { name: "Switch to teal theme" })).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-nav-theme", "navy");
      await expectBg(page, r.top, NAVY.top);
      await expectBg(page, "aside", NAVY.side);
    });

    test("switching to teal repaints both, and the choice survives a reload", async ({ page }) => {
      await page.goto(`${BASE}${r.path}`);
      await page.getByRole("button", { name: "Switch to teal theme" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-nav-theme", "teal");
      await expectBg(page, r.top, TEAL.top);
      await expectBg(page, "aside", TEAL.side);

      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-nav-theme", "teal");
      await expect(page.getByRole("button", { name: "Switch to navy theme" })).toBeVisible();
    });
  });
}

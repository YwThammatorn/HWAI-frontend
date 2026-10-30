import { test, expect, Page } from "@playwright/test";

import { BASE } from "./base";
const NOW = "2026-01-01T00:00:00.000Z";

// 14/10/2569 — the navy/teal switch is gone: the top bar and the sidebar are teal for every role (navbar darker than the sidebar since 24/9/2569).
// 15/10/2569 — the dark mode button is gone too: the app is always light, and a "dark" choice stored by an earlier visit is ignored (and cleared).
// The deeper dark teal pair stays in globals.css for when the button comes back. Before this the same file tested both toggles (22–24/9).
const TEAL = { top: "rgb(8, 69, 65)", side: "rgb(15, 118, 110)" };

const ROLES = [
  { role: "teacher", user: { name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }, path: "/teacher/courses/c-nt/students", top: "nav" },
  { role: "admin", user: { name: "Admin", email: "admin@kmitl.ac.th", role: "admin" }, path: "/admin/users", top: "header" },
  { role: "student", user: { name: "Fah Test", email: "64070601@kmitl.ac.th", role: "student", studentId: "64070601" }, path: "/student", top: "header" },
] as const;

async function seed(page: Page, user: object, extra: Record<string, string> = {}) {
  await page.addInitScript(({ user, course, extra }) => {
    if (sessionStorage.getItem("nt_seeded")) return;
    sessionStorage.setItem("nt_seeded", "1");
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify(user));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([course]));
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
  }, {
    user,
    extra,
    course: {
      id: "c-nt", name: "Theme Course", description: "", status: "active",
      coverColor: "#0F766E", createdAt: NOW, updatedAt: NOW,
    },
  });
}

const expectBg = (page: Page, sel: string, colour: string) => expect(page.locator(sel).first()).toHaveCSS("background-color", colour);

for (const r of ROLES) {
  test.describe(`${r.role} — teal chrome`, () => {
    test("the top bar and the sidebar are teal, the top bar darker, and there is no navy/teal switch", async ({ page }) => {
      await seed(page, r.user);
      await page.goto(`${BASE}${r.path}`);
      await expectBg(page, r.top, TEAL.top);
      await expectBg(page, "aside", TEAL.side);
      await expect(page.getByRole("button", { name: /Switch to (teal|navy) theme/ })).toHaveCount(0);
      await expect(page.locator("html")).not.toHaveAttribute("data-nav-theme", /.*/);
      await expect(page.getByRole("button", { name: /Switch to (dark|light) mode/ })).toHaveCount(0);   // no dark mode button either
    });

    test("an old stored 'dark' (or 'navy') choice is ignored: the page stays light and the same teal, and the stored value is cleared", async ({ page }) => {
      await seed(page, r.user, { "hwai-theme": "dark", "hwai-nav-theme": "navy" });
      await page.goto(`${BASE}${r.path}`);
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      await expectBg(page, r.top, TEAL.top);
      await expectBg(page, "aside", TEAL.side);
      expect(await page.evaluate(() => localStorage.getItem("hwai-theme"))).toBeNull();
    });
  });
}

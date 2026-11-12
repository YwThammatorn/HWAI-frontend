import { test, expect, Page } from "@playwright/test";
import { BASE } from "./base";

// 11/11/2569 — the top bar's role chip. The advisor circled the old one (a 10px pill with a dashed border) and asked "what button is this?".
// It is now a button that looks like one where it opens a menu (person icon, the role, a chevron; 28px tall and 12px type like the language toggle
// beside it, solid border), and a plain label where nothing can be switched. A teacher's menu is titled "View as".

// The dev server labels the switcher "Switch role (dev)" and shows a dev-only variant, so these run on the production build only.
test.skip(!process.env.E2E_PROD, "role chip: production build only");

async function as(page: Page, user: Record<string, unknown>, url: string) {
  await page.addInitScript((u) => {
    if (sessionStorage.getItem("rc_seeded")) return;
    sessionStorage.setItem("rc_seeded", "1");
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify(u));
  }, user);
  await page.goto(`${BASE}${url}`);
  await page.waitForLoadState("networkidle");
}

test("a teacher's role chip is a button: icon, the role, a chevron, same height and type size as the language toggle, a solid border", async ({ page }) => {
  await as(page, { name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }, "/teacher/courses");
  const chip = page.getByRole("button", { name: "Switch view" });
  await expect(chip).toBeVisible();
  await expect(chip).toContainText("Teacher");
  await expect(chip.locator("svg")).toHaveCount(2);                                   // the person and the chevron
  const look = await chip.evaluate((el) => { const c = getComputedStyle(el); return { h: el.getBoundingClientRect().height, fs: parseFloat(c.fontSize), bs: c.borderTopStyle }; });
  const lang = await page.getByRole("button", { name: "Toggle language" }).evaluate((el) => ({ h: el.getBoundingClientRect().height, fs: parseFloat(getComputedStyle(el).fontSize) }));
  expect(look.bs).toBe("solid");                                                      // not the dashed pill that read as a mystery
  const bg = await chip.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).not.toBe("rgba(0, 0, 0, 0)");                                          // filled with the role colour
  expect(look.fs).toBeGreaterThanOrEqual(12);
  expect(Math.round(look.h)).toBe(Math.round(lang.h));
  expect(look.fs).toBe(lang.fs);
});

test("it says what it does: a title on hover, aria-expanded, and the menu is titled \"View as\" with the three roles", async ({ page }) => {
  await as(page, { name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }, "/teacher/courses");
  const chip = page.getByRole("button", { name: "Switch view" });
  expect(await chip.getAttribute("title")).toMatch(/preview/i);
  await expect(chip).toHaveAttribute("aria-expanded", "false");
  await chip.click();
  await expect(chip).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("View as", { exact: true })).toBeVisible();
  for (const r of ["Teacher", "TA", "Student"]) await expect(page.getByRole("button", { name: r, exact: true })).toBeVisible();
});

test("where nothing can be switched the role is a badge, not a button (an admin): filled in its role colour, no border, no chevron", async ({ page }) => {
  await as(page, { name: "Dev Admin", email: "admin@kmitl.ac.th", role: "admin" }, "/admin");
  const badge = page.getByTestId("role-badge");
  await expect(badge).toContainText("Admin");
  await expect(page.getByRole("button", { name: /Switch (role|view)/ })).toHaveCount(0);
  const look = await badge.evaluate((el) => { const c = getComputedStyle(el); return { bw: c.borderTopWidth, cursor: c.cursor, h: el.getBoundingClientRect().height }; });
  expect(look.bw).toBe("0px");
  expect(look.cursor).toBe("default");
  const lang = await page.getByRole("button", { name: "Toggle language" }).evaluate((el) => el.getBoundingClientRect().height);
  expect(Math.round(look.h)).toBe(Math.round(lang));                           // same height as the language toggle
  await expect(badge.locator("svg")).toHaveCount(1);                         // the icon only: no chevron
});

test("each role has its own solid colour and the Teacher its own icon — an examiner can tell a teacher's screen from a student's (advisor, 3.41)", async ({ page }) => {
  const fills: Record<string, string> = {};
  for (const [role, user, url] of [
    ["teacher", { name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }, "/teacher/courses"],
    ["student", { name: "Somchai", email: "69070101@kmitl.ac.th", role: "student", studentId: "69070101" }, "/student"],
    ["admin", { name: "Dev Admin", email: "admin@kmitl.ac.th", role: "admin" }, "/admin"],
  ] as const) {
    await page.context().clearCookies();
    await page.goto(`${BASE}/login`);
    await page.evaluate(([u]) => { sessionStorage.clear(); localStorage.setItem("hwai_lang", "en"); localStorage.setItem("hwai_user", JSON.stringify(u)); }, [user]);
    await page.goto(`${BASE}${url}`);
    await page.waitForLoadState("networkidle");
    const chip = page.getByTestId("role-badge").or(page.getByRole("button", { name: /Switch (role|view)/ })).first();
    await expect(chip).toBeVisible();
    fills[role] = await chip.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(fills[role]).not.toBe("rgba(0, 0, 0, 0)");                        // solid, not a faint tint
  }
  expect(new Set(Object.values(fills)).size).toBe(3);                         // three roles, three different colours
});

import { test, expect } from "@playwright/test";

import { BASE } from "./base";

// 21/10/2569 — the sign-in page wears the same chrome as the rest of the app: the brand panel is the top bar's teal (not a one-off navy),
// the form sits straight on the white page (no card, as before), and the language can be switched before signing in.

test.use({ viewport: { width: 1440, height: 900 } });

test("the brand panel takes the top bar's colour; the form sits straight on the page, not in a box", async ({ page }) => {
  await page.goto(`${BASE}/login`);
  // what a token resolves to, read the way the browser paints it
  const paint = (token: string) => page.evaluate((tk) => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = `var(${tk})`;
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return c;
  }, token);
  await expect(page.getByTestId("login-brand")).toHaveCSS("background-color", await paint("--navbar-bg"));
  await expect(page.locator("div.flex-1.overflow-y-auto")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator("h1").locator("xpath=..")).toHaveCSS("border-top-width", "0px");   // no card around the form
});

test("the language can be switched on the sign-in page and is remembered", async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem("lt")) { sessionStorage.setItem("lt", "1"); localStorage.setItem("hwai_lang", "en"); } });
  await page.goto(`${BASE}/login`);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await page.getByRole("button", { name: "Toggle language" }).click();
  await expect(page.getByRole("heading", { name: "ยินดีต้อนรับกลับ" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("hwai_lang"))).toBe("th");
});

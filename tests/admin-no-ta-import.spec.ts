import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

// 26/9/2569 — admin creates teacher accounts only. A teacher CSV row asking for role "ta" is rejected
// with a pointer to where TAs really are added, and the preview has no Role column any more.

test("Import Teachers: a role=ta row is an error, teacher rows import as teachers", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Admin", email: "admin@kmitl.ac.th", role: "admin" }));
    localStorage.setItem("hwai_managed_teachers_v1", "[]");
  });
  await page.goto(`${BASE}/admin/users`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Import CSV" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Import Teachers" });
  await expect(dialog.getByText("Columns: name, email (title optional)")).toBeVisible();

  const csv = ["title,name,email,role", "Dr.,Ann Lee,ann@kmitl.ac.th,teacher", ",Bob Ta,bob@kmitl.ac.th,ta", ",Cy Kim,cy@kmitl.ac.th,"].join("\n");
  await dialog.locator('input[type="file"]').setInputFiles({ name: "t.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

  await expect(dialog.getByRole("columnheader", { name: "Role" })).toHaveCount(0);
  const bob = dialog.getByRole("row", { name: /Bob Ta/ });
  await expect(bob.getByText("TA accounts can't be added here")).toBeVisible();
  await dialog.getByRole("button", { name: "+ Import 2" }).click();
  await expect(dialog.getByText("Added 2 teacher(s) (skipped 1)")).toBeVisible();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_managed_teachers_v1") ?? "[]"));
  expect(saved.map((t: { name: string; role: string }) => [t.name, t.role])).toEqual([["Ann Lee", "teacher"], ["Cy Kim", "teacher"]]);
});

test("the CSV template has no role column", async ({ request }) => {
  const res = await request.get(`${BASE}/teachers-template.csv`);
  expect((await res.text()).split(/\r?\n/)[0]).toBe("title,name,email");
});

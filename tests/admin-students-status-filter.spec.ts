import { test, expect, Page } from "@playwright/test";
import fs from "fs";

const BASE = "http://localhost:3000";

// 26/9/2569 — admin Users → Students: inactive students are hidden by default and a single "Show inactive (n)"
// switch in the filter row brings them in below the active ones (a second tab bar under Teachers/Students was
// redundant). A long program name (Computer Engineering and Cybersecurity) wraps instead of being clipped.

const mk = (n: number, program: string, status?: string) => ({
  id: `s-${n}`, studentId: `6907${String(n).padStart(4, "0")}`, firstName: `Name${n}`, lastName: "Test",
  email: `6907${String(n).padStart(4, "0")}@kmitl.ac.th`, program, ...(status ? { status } : {}),
});
// CECS: 1 (no status), 2 inactive, 3 active   |   CE: 4 active, 5 inactive
const STUDENTS = [mk(1, "CECS"), mk(2, "CECS", "inactive"), mk(3, "CECS", "active"), mk(4, "CE"), mk(5, "CE", "inactive")];

async function open(page: Page, lang: "en" | "th" = "en", students: unknown[] = STUDENTS) {
  await page.addInitScript(([l, st]) => {
    if (sessionStorage.getItem("sf")) return;
    sessionStorage.setItem("sf", "1");
    localStorage.setItem("hwai_lang", l as string);
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Admin", email: "admin@kmitl.ac.th", role: "admin" }));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(st));
  }, [lang, students] as const);
  await page.goto(`${BASE}/admin/users`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: /^Students|^นักศึกษา/ }).click();
}

const rows = (page: Page) => page.getByRole("row").filter({ hasText: "Test" });
const toggle = (page: Page) => page.getByRole("switch", { name: /Show inactive|แสดงที่พ้นสภาพ/ });

test("inactive students are hidden until 'Show inactive' is switched on, then they follow the active ones", async ({ page }) => {
  await open(page);
  await page.getByLabel("Filter by program").selectOption("CECS");

  // default: only the active students (one has no status at all → counts as active), no second tab bar
  await expect(page.getByRole("tablist", { name: "Student status" })).toHaveCount(0);
  await expect(toggle(page)).toHaveAttribute("aria-checked", "false");
  await expect(toggle(page)).toContainText("(1)");
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).getByText("Inactive", { exact: true })).toHaveCount(0);

  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute("aria-checked", "true");
  await expect(rows(page)).toHaveCount(3);
  // active first, inactive last — even though Name2 sorts before Name3 by ID
  await expect(rows(page).nth(0)).toContainText("Name1");
  await expect(rows(page).nth(1)).toContainText("Name3");
  await expect(rows(page).nth(2)).toContainText("Name2");
  await expect(rows(page).nth(2).getByText("Inactive", { exact: true })).toBeVisible();

  await toggle(page).click();
  await expect(rows(page)).toHaveCount(2);
});

test("the count follows the program filter and the search; the switch is disabled when nobody is inactive", async ({ page }) => {
  await open(page);
  await page.getByLabel("Filter by program").selectOption("CE");
  await expect(toggle(page)).toContainText("(1)");
  await page.getByPlaceholder("Search students...").fill("Name4");
  await expect(toggle(page)).toContainText("(0)");
  await expect(toggle(page)).toBeDisabled();
});

test("deactivating a student drops the row from the default view and the count goes up; activating brings it back", async ({ page }) => {
  await open(page);
  await page.getByLabel("Filter by program").selectOption("CE");

  await page.getByRole("button", { name: "Deactivate Name4 Test" }).click();
  await page.getByRole("button", { name: "Deactivate", exact: true }).click();
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByText("Everyone in this program is inactive")).toBeVisible();
  await expect(toggle(page)).toContainText("(2)");

  await toggle(page).click();
  await expect(rows(page)).toHaveCount(2);
  await page.getByRole("button", { name: "Activate Name4 Test" }).click();
  await expect(rows(page).nth(0)).toContainText("Name4");                   // back among the active ones, above Name5
  await expect(rows(page).nth(1)).toContainText("Name5");
  await expect(toggle(page)).toContainText("(1)");
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
  expect(fits.lines).toBeLessThanOrEqual(3);   // 1280px viewport: wraps, never cut off
  await expect(cell).toHaveAttribute("title", "Computer Engineering and Cybersecurity");
});

test("Thai UI: the switch is Thai", async ({ page }) => {
  await open(page, "th");
  await expect(page.getByRole("switch", { name: /แสดงที่พ้นสภาพ/ })).toBeVisible();
});

// 26/9/2569 — "a batch has graduated": deactivate every active student whose ID starts with the batch's two digits.
test.describe("Deactivate a whole batch", () => {
  const S = (id: string, program: string, status?: string) => ({
    id: `s-${id}`, studentId: id, firstName: `N${id.slice(-3)}`, lastName: "Test", email: `${id}@kmitl.ac.th`, program, ...(status ? { status } : {}),
  });
  const BATCHES = [
    S("67010101", "CE"), S("67010102", "CE"), S("67020101", "CECS"), S("67010103", "CE", "inactive"),   // batch 67: 3 active + 1 already inactive
    S("68010101", "CE"), S("68010102", "CEI"),                                                          // batch 68: 2 active
    S("69010101", "CE"),                                                                                // batch 69: 1 active
  ];
  const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("hwai_cohort_students_v1") ?? "[]") as { studentId: string; status?: string }[]);

  test("the popup offers each batch that still has active students, oldest first, with counts", async ({ page }) => {
    await open(page, "en", BATCHES);
    await page.getByRole("button", { name: "Deactivate batch" }).click();
    const dialog = page.getByRole("dialog", { name: "Deactivate a whole batch" });
    const options = dialog.getByLabel(/Batch \(first two digits/).locator("option");
    await expect(options).toHaveText(["Batch 67 — 3 active", "Batch 68 — 2 active", "Batch 69 — 1 active"]);
    // the oldest is preselected; the breakdown shows which programs are in it
    await expect(dialog.getByText("3 students of batch 67")).toBeVisible();
    // programs are named in full, never CE / CECS / CEI
    await expect(dialog.getByLabel("Program").locator("option")).toHaveText(["All programs — 3", "Computer Engineering — 2", "Computer Engineering and Cybersecurity — 1"]);
    await expect(dialog.getByText("CECS")).toHaveCount(0);
    await dialog.getByLabel(/Batch \(first two digits/).selectOption("68");
    await expect(dialog.getByRole("button", { name: "Deactivate 2 students" })).toBeVisible();
  });

  test("confirming deactivates only that batch's active students, across programs, and leaves the rest alone", async ({ page }) => {
    await open(page, "en", BATCHES);
    await page.getByLabel("Filter by program").selectOption("CE");
    await page.getByRole("button", { name: "Deactivate batch" }).click();
    const dialog = page.getByRole("dialog", { name: "Deactivate a whole batch" });
    await dialog.getByRole("button", { name: "Deactivate 3 students" }).click();
    await expect(dialog).toHaveCount(0);

    await expect(page.getByRole("status")).toContainText("Deactivated 3 students of batch 67");
    const after = await stored(page);
    expect(after.filter((s) => s.studentId.startsWith("67")).every((s) => s.status === "inactive")).toBe(true);   // incl. the CECS one, and none lost in the batch write
    expect(after.filter((s) => !s.studentId.startsWith("67")).every((s) => s.status !== "inactive")).toBe(true);

    // the CE list now shows the CE students of batches 68 and 69 only; batch 67's CE students are under "Show inactive"
    await expect(rows(page)).toHaveCount(2);
    await expect(toggle(page)).toContainText("(3)");
    await toggle(page).click();
    await expect(rows(page)).toHaveCount(5);
  });

  test("Undo brings the batch back in one click, but not the student who was already inactive", async ({ page }) => {
    await open(page, "en", BATCHES);
    await page.getByRole("button", { name: "Deactivate batch" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Deactivate 3 students" }).click();
    await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("status")).toHaveCount(0);

    const after = await stored(page);
    expect(after.filter((s) => s.studentId.startsWith("67")).map((s) => [s.studentId, s.status ?? "active"]).sort())
      .toEqual([["67010101", "active"], ["67010102", "active"], ["67010103", "inactive"], ["67020101", "active"]]);
  });

  test("a batch can be closed one program at a time", async ({ page }) => {
    await open(page, "en", BATCHES);
    await page.getByRole("button", { name: "Deactivate batch" }).click();
    const dialog = page.getByRole("dialog", { name: "Deactivate a whole batch" });
    await dialog.getByLabel("Program").selectOption({ label: "Computer Engineering and Cybersecurity — 1" });
    await expect(dialog.getByText("1 student of batch 67")).toBeVisible();
    await dialog.getByRole("button", { name: "Deactivate 1 student", exact: true }).click();

    await expect(page.getByRole("status")).toContainText("Deactivated 1 student of batch 67 · Computer Engineering and Cybersecurity");
    const after = await stored(page);
    expect(after.filter((s) => s.status === "inactive").map((s) => s.studentId).sort()).toEqual(["67010103", "67020101"]);   // the CECS one + the one already inactive

    // batch 67 is still on offer, now with its 2 CE students
    await page.getByRole("button", { name: "Deactivate batch" }).click();
    await expect(dialog.getByLabel(/^Batch/).locator("option").first()).toHaveText("Batch 67 — 2 active");
    await expect(dialog.getByLabel("Program").locator("option")).toHaveText(["All programs — 2", "Computer Engineering — 2"]);
  });

  test("a program picked for one batch falls back to 'all programs' when the next batch does not have it", async ({ page }) => {
    await open(page, "en", BATCHES);
    await page.getByRole("button", { name: "Deactivate batch" }).click();
    const dialog = page.getByRole("dialog", { name: "Deactivate a whole batch" });
    await dialog.getByLabel("Program").selectOption({ label: "Computer Engineering and Cybersecurity — 1" });
    await dialog.getByLabel(/^Batch/).selectOption("68");        // 68 has CE and CEI, no CECS
    await expect(dialog.getByLabel("Program")).toHaveValue("all");
    await expect(dialog.getByRole("button", { name: "Deactivate 2 students" })).toBeVisible();
  });

  test("with nobody active the button is disabled", async ({ page }) => {
    await open(page, "en", [S("67010101", "CE", "inactive")]);
    await expect(page.getByRole("button", { name: "Deactivate batch" })).toBeDisabled();
  });

  test("Thai UI", async ({ page }) => {
    await open(page, "th", BATCHES);
    await page.getByRole("button", { name: "ปิดใช้งานทั้งรุ่น" }).click();
    const dialog = page.getByRole("dialog", { name: "ปิดใช้งานทั้งรุ่น" });
    await expect(dialog.getByText("รุ่น 67 — ปกติ 3 คน")).toBeAttached();
    await dialog.getByRole("button", { name: "ปิดใช้งาน 3 คน" }).click();
    await expect(page.getByRole("status")).toContainText("ปิดใช้งานนักศึกษารุ่น 67 แล้ว 3 คน");
  });
});

// 26/9/2569 — the students mock (console command [12] in test-data/seed-commands.txt): batches 66-69 in all 3 programs.
test.describe("Students mock data (batches 66-69)", () => {
  const rdJson = (f: string) => JSON.parse(fs.readFileSync(`public/mock-data/${f}`, "utf8"));

  test("the file is consistent: unique ids, email = studentId, the 13 students of the flow mock are unchanged", async () => {
    for (const [file, flowFile] of [["students-mockup.json", "student-flow-mockup.json"], ["students-mockup-en.json", "student-flow-mockup-en.json"]]) {
      const all = rdJson(file) as { id: string; studentId: string; email: string; program: string; status: string }[];
      expect(new Set(all.map((s) => s.studentId)).size).toBe(all.length);
      expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
      for (const s of all) expect(s.email).toBe(`${s.studentId}@kmitl.ac.th`);
      expect(new Set(all.map((s) => s.studentId.slice(0, 2)))).toEqual(new Set(["66", "67", "68", "69"]));
      expect(new Set(all.map((s) => s.program))).toEqual(new Set(["CE", "CECS", "CEI"]));
      // what [5] (student-flow) enrols and logs in still exists with the same data
      for (const orig of rdJson(flowFile).cohortStudents) expect(all.find((s) => s.id === orig.id)).toEqual(orig);
    }
  });

  test("loaded into the app, the batch popup offers 66, 67, 68 and 69 with the right active counts", async ({ page }) => {
    await open(page, "en", rdJson("students-mockup-en.json"));
    await page.getByRole("button", { name: "Deactivate batch" }).click();
    const dialog = page.getByRole("dialog", { name: "Deactivate a whole batch" });
    await expect(dialog.getByLabel(/^Batch/).locator("option")).toHaveText(["Batch 66 — 10 active", "Batch 67 — 10 active", "Batch 68 — 12 active", "Batch 69 — 19 active"]);
    await dialog.getByLabel("Program").selectOption({ label: "Computer Engineering International — 2" });
    await expect(dialog.getByRole("button", { name: "Deactivate 2 students" })).toBeVisible();
  });
});

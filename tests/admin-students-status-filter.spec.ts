import { test, expect, Page } from "@playwright/test";
import fs from "fs";

import { BASE } from "./base";

// 26/9/2569 — admin Users → Students: inactive students were hidden by default behind a single
// "Show inactive (n)" switch in the filter row, which brought them in below the active ones.
// 30/9/2569 — replaced with two subtabs (Active / Inactive), same PillTabBar as Teachers/Students
// itself and the teacher roster's Enrolled/Withdrawn: a status is never ambiguous from the row
// alone, and a search that only matches the other tab jumps there automatically (see the last
// describe block below). A long program name (Computer Engineering and Cybersecurity) still wraps
// instead of being clipped.

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
const activeTab = (page: Page) => page.getByRole("tab", { name: /^Active|^ปกติ/ });
const inactiveTab = (page: Page) => page.getByRole("tab", { name: /^Inactive|^พ้นสภาพ/ });

test("active and inactive students live on separate tabs, never mixed", async ({ page }) => {
  await open(page);
  await page.getByLabel("Filter by program").selectOption("CECS");

  // Active is the default tab; the bar itself only exists because CECS has an inactive student
  await expect(activeTab(page)).toHaveAttribute("aria-selected", "true");
  await expect(activeTab(page)).toContainText("2");
  await expect(inactiveTab(page)).toContainText("1");
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).getByText("Inactive", { exact: true })).toHaveCount(0);

  await inactiveTab(page).click();
  await expect(inactiveTab(page)).toHaveAttribute("aria-selected", "true");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText("Name2");
  await expect(rows(page).getByText("Inactive", { exact: true })).toBeVisible();

  await activeTab(page).click();
  await expect(rows(page)).toHaveCount(2);
});

test("no tab bar at all when nobody in the program is inactive", async ({ page }) => {
  await open(page, "en", [mk(1, "CECS"), mk(3, "CECS")]);
  await page.getByLabel("Filter by program").selectOption("CECS");
  await expect(page.getByRole("tablist", { name: "Student status" })).toHaveCount(0);
  await expect(rows(page)).toHaveCount(2);
});

test("tab counts follow the program filter and the search; the bar stays even when the search matches none of the inactive ones", async ({ page }) => {
  await open(page);
  await page.getByLabel("Filter by program").selectOption("CE");
  await expect(activeTab(page)).toContainText("1");
  await expect(inactiveTab(page)).toContainText("1");

  await page.getByPlaceholder("Search students...").fill("Name4");
  await expect(activeTab(page)).toContainText("1");
  await expect(inactiveTab(page)).toContainText("0");
  // no auto-jump: the tab we're already on still has a match
  await expect(activeTab(page)).toHaveAttribute("aria-selected", "true");
});

test("deactivating a student moves them to the Inactive tab; activating brings them back", async ({ page }) => {
  await open(page);
  await page.getByLabel("Filter by program").selectOption("CE");

  await page.getByRole("button", { name: "Deactivate Name4 Test" }).click();
  await page.getByRole("button", { name: "Deactivate", exact: true }).click();
  // confirming lands on the Inactive tab by itself, with the student right there
  await expect(inactiveTab(page)).toHaveAttribute("aria-selected", "true");
  await expect(inactiveTab(page)).toContainText("2");
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).filter({ hasText: "Name4" })).toHaveCount(1);

  await activeTab(page).click();
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByText("Everyone in this program is inactive")).toBeVisible();

  await inactiveTab(page).click();
  await page.getByRole("button", { name: "Activate Name4 Test" }).click();
  await expect(rows(page)).toHaveCount(1);   // Name4 leaves this tab the moment it's active again
  await expect(rows(page)).toContainText("Name5");

  await activeTab(page).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText("Name4");
});

test("deactivating the first-ever inactive student still lands on a brand-new Inactive tab", async ({ page }) => {
  const mk = (id: string, first: string) => ({ id: `s-${id}`, studentId: id, firstName: first, lastName: "Test", email: `${id}@kmitl.ac.th`, program: "CE" });
  await open(page, "en", [mk("67010101", "Alpha"), mk("67010102", "Bravo")]);
  await expect(inactiveTab(page)).toHaveCount(0);   // nobody inactive yet, so no tab bar

  await page.getByRole("button", { name: "Deactivate Alpha Test" }).click();
  await page.getByRole("button", { name: "Deactivate", exact: true }).click();
  await expect(inactiveTab(page)).toHaveAttribute("aria-selected", "true");
  await expect(rows(page)).toHaveCount(1);
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

test("Thai UI: the tabs are Thai", async ({ page }) => {
  await open(page, "th");
  await expect(page.getByRole("tab", { name: /ปกติ/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /พ้นสภาพ/ })).toBeVisible();
});

// 30/9/2569 — a search that only matches the other tab jumps there automatically, so a name that
// happens to be inactive never dead-ends in "no results found" on the Active tab.
test.describe("Search autocomplete surfaces inactive matches and jumps to their tab", () => {
  test("a suggestion for an inactive student is labelled, and picking it switches to the Inactive tab", async ({ page }) => {
    await open(page);
    await page.getByLabel("Filter by program").selectOption("CECS");   // Name2 here is inactive
    await page.getByPlaceholder("Search students...").fill("Name2");
    const option = page.getByRole("option", { name: "Name2 Test (Inactive)" });
    await expect(option).toBeVisible();
    await option.click();
    await expect(inactiveTab(page)).toHaveAttribute("aria-selected", "true");
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page)).toContainText("Name2");
  });

  test("typing a name that only exists in the other tab jumps there too, without picking a suggestion", async ({ page }) => {
    await open(page);
    await page.getByLabel("Filter by program").selectOption("CECS");
    await page.getByPlaceholder("Search students...").fill("Name2");
    await page.keyboard.press("Escape");   // close the dropdown, keep the typed text
    await expect(inactiveTab(page)).toHaveAttribute("aria-selected", "true");
  });

  test("clearing the search does not jump back on its own", async ({ page }) => {
    await open(page);
    await page.getByLabel("Filter by program").selectOption("CECS");
    await page.getByPlaceholder("Search students...").fill("Name2");
    await expect(inactiveTab(page)).toHaveAttribute("aria-selected", "true");
    await page.getByPlaceholder("Search students...").fill("");
    await expect(inactiveTab(page)).toHaveAttribute("aria-selected", "true");   // stays put; just no longer highlighted
  });

  test("an auto-jumped match is highlighted; a manual tab switch clears it", async ({ page }) => {
    await open(page);
    await page.getByLabel("Filter by program").selectOption("CECS");
    await page.getByPlaceholder("Search students...").fill("Name2");
    await expect(inactiveTab(page)).toHaveAttribute("aria-selected", "true");
    expect(await rows(page).first().getAttribute("class")).toContain("accent-bright");

    await activeTab(page).click();
    await inactiveTab(page).click();
    expect(await rows(page).first().getAttribute("class")).not.toContain("accent-bright");
  });
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

  test("an individually-added student outside the chosen batch is included in the count and can be removed again", async ({ page }) => {
    await open(page, "en", BATCHES);
    await page.getByRole("button", { name: "Deactivate batch" }).click();
    const dialog = page.getByRole("dialog", { name: "Deactivate a whole batch" });
    await expect(dialog.getByRole("button", { name: "Deactivate 3 students" })).toBeVisible();   // batch 67, preselected
    await dialog.getByText("Also deactivate people outside this selection (optional)").click();   // collapsed by default

    const box = dialog.getByRole("checkbox", { name: /68010101/ });
    await box.check();
    await expect(dialog.getByRole("button", { name: "Deactivate 4 students" })).toBeVisible();
    await expect(dialog.getByText("3 left · 1 added")).toBeVisible();

    await box.uncheck();
    await expect(dialog.getByRole("button", { name: "Deactivate 3 students" })).toBeVisible();
    await expect(dialog.getByText("3 left · 0 added")).toBeVisible();
  });

  test("the batch picked above is listed below with everyone ticked; unticking a student who has not graduated keeps them active", async ({ page }) => {
    await open(page, "en", BATCHES);
    await page.getByRole("button", { name: "Deactivate batch" }).click();
    const dialog = page.getByRole("dialog", { name: "Deactivate a whole batch" });
    const list = dialog.getByTestId("deactivate-batch-list");
    const names = () => list.getByRole("checkbox").evaluateAll((els) => els.map((e) => (e.closest("label") as HTMLElement).innerText.replace(/\s+/g, " ").trim()));

    // batch 67 (3 active) — only its students, all ticked; nobody from 68 / 69 and not the one already inactive
    await expect(list.getByRole("checkbox")).toHaveCount(3);
    expect(await names()).toEqual([
      "N101 Test 67010101 Computer Engineering",
      "N102 Test 67010102 Computer Engineering",
      "N101 Test 67020101 Computer Engineering and Cybersecurity",
    ]);
    for (const box of await list.getByRole("checkbox").all()) await expect(box).toBeChecked();
    await expect(list.getByText("3 of 3 selected")).toBeVisible();

    // not graduated yet: untick → one fewer in the count and on the button
    await list.getByRole("checkbox", { name: /67010102/ }).uncheck();
    await expect(list.getByText("2 of 3 selected")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Deactivate 2 students" })).toBeVisible();

    // the list follows the pickers, and a new choice starts from everyone ticked again
    await dialog.getByLabel("Program").selectOption("CE");
    await expect(list.getByRole("checkbox")).toHaveCount(2);
    await expect(list.getByText("2 of 2 selected")).toBeVisible();
    await dialog.getByLabel(/Batch \(first two digits/).selectOption("68");
    await expect(list.getByRole("checkbox")).toHaveCount(1);                    // program CE is still picked: only 68010101
    expect(await names()).toEqual(["N101 Test 68010101 Computer Engineering"]);
  });

  test("confirming deactivates the ticked students of the batch and leaves the unticked one active", async ({ page }) => {
    await open(page, "en", BATCHES);
    await page.getByRole("button", { name: "Deactivate batch" }).click();
    const dialog = page.getByRole("dialog", { name: "Deactivate a whole batch" });
    await dialog.getByTestId("deactivate-batch-list").getByRole("checkbox", { name: /67010102/ }).uncheck();
    await dialog.getByRole("button", { name: "Deactivate 2 students" }).click();
    const after = await stored(page);
    expect(after.find((x) => x.studentId === "67010101")?.status).toBe("inactive");
    expect(after.find((x) => x.studentId === "67020101")?.status).toBe("inactive");
    expect(after.find((x) => x.studentId === "67010102")?.status).not.toBe("inactive");   // not graduated yet — still active
    expect(after.find((x) => x.studentId === "68010101")?.status).not.toBe("inactive");
  });

  test("the people the selection leaves out are listed right away, follow the batch/program choice, and can be filtered", async ({ page }) => {
    await open(page, "en", BATCHES);
    await page.getByRole("button", { name: "Deactivate batch" }).click();
    const dialog = page.getByRole("dialog", { name: "Deactivate a whole batch" });
    await dialog.getByText("Also deactivate people outside this selection (optional)").click();   // collapsed by default
    const list = dialog.getByTestId("deactivate-left-out");
    const names = () => list.getByRole("checkbox").evaluateAll((els) => els.map((e) => (e.closest("label") as HTMLElement).innerText.replace(/\s+/g, " ").trim()));

    // batch 67 selected → the three active students of 68 and 69 are what is left, nobody has to be searched for
    await expect(list.getByRole("checkbox")).toHaveCount(3);
    expect(await names()).toEqual([
      "N101 Test 68010101 Computer Engineering",
      "N102 Test 68010102 Computer Engineering International",
      "N101 Test 69010101 Computer Engineering",
    ]);
    await expect(list.getByText("3 left · 0 added")).toBeVisible();

    // narrowing the selection to one program leaves the rest of batch 67 in the list too
    await dialog.getByLabel("Program").selectOption("CE");
    await expect(list.getByRole("checkbox")).toHaveCount(4);
    await expect(list.getByText("4 left")).toBeVisible();
    // switching batch swaps who is left out
    await dialog.getByLabel(/Batch \(first two digits/).selectOption("68");
    await expect(list.getByRole("checkbox")).toHaveCount(5);   // program CE is still picked: batch 68 CEI student + 3 of batch 67 + 1 of batch 69
    expect((await names()).some((n) => n.includes("68010101"))).toBe(false);

    // the filter box narrows the list by name, ID or program; the ticks survive the filtering
    await list.getByRole("checkbox", { name: /69010101/ }).check();
    await list.getByLabel("Filter the remaining students").fill("cybersecurity");
    await expect(list.getByRole("checkbox")).toHaveCount(1);
    await list.getByLabel("Filter the remaining students").fill("zzz");
    await expect(list.getByText("No student matches the filter")).toBeVisible();
    await list.getByLabel("Filter the remaining students").fill("");
    await expect(list.getByRole("checkbox", { name: /69010101/ })).toBeChecked();
    await expect(list.getByText(/· 1 added/)).toBeVisible();
  });

  test("confirming includes the individually-added student even though they're outside the chosen batch", async ({ page }) => {
    await open(page, "en", BATCHES);
    await page.getByRole("button", { name: "Deactivate batch" }).click();
    const dialog = page.getByRole("dialog", { name: "Deactivate a whole batch" });   // batch 67 preselected
    await dialog.getByText("Also deactivate people outside this selection (optional)").click();   // collapsed by default
    await dialog.getByRole("checkbox", { name: /68010101/ }).check();
    await dialog.getByRole("button", { name: "Deactivate 4 students" }).click();
    await expect(dialog).toHaveCount(0);

    const after = await stored(page);
    expect(after.filter((s) => s.studentId.startsWith("67")).every((s) => s.status === "inactive")).toBe(true);
    expect(after.find((s) => s.studentId === "68010101")?.status).toBe("inactive");
    expect(after.find((s) => s.studentId === "68010102")?.status).not.toBe("inactive");   // the rest of batch 68 untouched
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

    // confirming lands on the Inactive tab with batch 67's CE students; Active keeps the CE students of 68 and 69
    await expect(inactiveTab(page)).toHaveAttribute("aria-selected", "true");
    await expect(inactiveTab(page)).toContainText("3");
    await expect(rows(page)).toHaveCount(3);
    await activeTab(page).click();
    await expect(rows(page)).toHaveCount(2);
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
    await expect(dialog.getByLabel(/^Batch/).locator("option")).toHaveText(["Batch 66 — 10 active", "Batch 67 — 10 active", "Batch 68 — 12 active", "Batch 69 — 47 active"]);
    await dialog.getByLabel("Program").selectOption({ label: "Computer Engineering International — 2" });
    await expect(dialog.getByRole("button", { name: "Deactivate 2 students" })).toBeVisible();
  });
});

import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// 25/9/2569 — admin New Course: the course details are entered once and several sections are opened at
// the same time. Each section becomes its own course row with its own section number and teacher; the
// teacher is shared by default ("same teacher for all"), or set per section.

const TEACHERS = [
  { id: "t-john", name: "John Smith", email: "john@kmitl.ac.th", role: "teacher", status: "active", courseIds: [] },
  { id: "t-jane", name: "Jane Doe", email: "jane@kmitl.ac.th", role: "teacher", status: "active", courseIds: [] },
];
const EXISTING = {
  id: "c-old", name: "Web Design", description: "", status: "active", coverColor: "#0F766E",
  academicYear: new Date().getFullYear() + 543, sectionNumber: "1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

async function open(page: Page, courses: unknown[] = []) {
  await page.addInitScript((d) => {
    if (sessionStorage.getItem("ms_seeded")) return;
    sessionStorage.setItem("ms_seeded", "1");
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Admin", email: "admin@kmitl.ac.th", role: "admin" }));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify(d.teachers));
    localStorage.setItem("hwai_courses_v2", JSON.stringify(d.courses));
  }, { teachers: TEACHERS, courses });
  await page.goto(`${BASE}/admin/courses`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "New Course" }).first().click();
  const dialog = page.getByRole("dialog", { name: "New Course" });
  await dialog.getByPlaceholder("e.g. UX/UI Design").fill("Web Design");
  return dialog;
}

const pick = async (dialog: ReturnType<Page["getByRole"]>, label: string | RegExp, typed: string, option: string) => {
  await dialog.getByLabel(label).fill(typed);
  await dialog.getByRole("option", { name: option }).click();
};
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("hwai_courses_v2") ?? "[]"));
const teachersOf = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("hwai_managed_teachers_v1") ?? "[]"));

test.describe("Admin — open several sections at once", () => {
  test("starts with one section row and the same single-course flow as before", async ({ page }) => {
    const dialog = await open(page);
    await expect(dialog.getByLabel("Section number, row 1")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Create Course" })).toBeDisabled();
    await pick(dialog, "Primary Teacher", "John", "John Smith");
    await expect(dialog.getByRole("button", { name: "Create Course" })).toBeEnabled();
    // one row: no "same teacher" checkbox, no remove button
    await expect(dialog.getByLabel("Same teacher for all sections")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: /Remove section row/ })).toHaveCount(0);
  });

  test("adds rows (numbered on from the last one), and one teacher covers them all by default", async ({ page }) => {
    const dialog = await open(page);
    await dialog.getByLabel("Section number, row 1").fill("1");
    await dialog.getByRole("button", { name: "Add section" }).click();
    await dialog.getByRole("button", { name: "Add section" }).click();
    await expect(dialog.getByLabel("Section number, row 2")).toHaveValue("2");
    await expect(dialog.getByLabel("Section number, row 3")).toHaveValue("3");
    await expect(dialog.getByLabel("Same teacher for all sections")).toBeChecked();
    await expect(dialog.getByRole("button", { name: "Create 3 sections" })).toBeDisabled(); // no teacher yet

    await pick(dialog, "Primary Teacher", "John", "John Smith");
    await dialog.getByRole("button", { name: "Create 3 sections" }).click();
    await expect(dialog).toHaveCount(0);

    const courses = await stored(page);
    expect(courses).toHaveLength(3);
    expect(courses.map((c: { sectionNumber: string }) => c.sectionNumber).sort()).toEqual(["1", "2", "3"]);
    expect(courses.every((c: { name: string }) => c.name === "Web Design")).toBe(true);
    const john = (await teachersOf(page)).find((t: { id: string }) => t.id === "t-john");
    expect(john.courseIds).toHaveLength(3);
  });

  test("switching off 'same teacher' lets each section have its own", async ({ page }) => {
    const dialog = await open(page);
    await dialog.getByLabel("Section number, row 1").fill("1");
    await dialog.getByRole("button", { name: "Add section" }).click();
    await pick(dialog, "Primary Teacher", "John", "John Smith");

    await dialog.getByLabel("Same teacher for all sections").uncheck();
    // every row starts on the shared teacher; change just the second
    await expect(dialog.getByLabel("Teacher for section row 1")).toHaveValue("John Smith");
    await expect(dialog.getByLabel("Teacher for section row 2")).toHaveValue("John Smith");
    await pick(dialog, "Teacher for section row 2", "Jane", "Jane Doe");
    await dialog.getByRole("button", { name: "Create 2 sections" }).click();

    const teachers = await teachersOf(page);
    const courses = await stored(page);
    const sec = (n: string) => courses.find((c: { sectionNumber: string }) => c.sectionNumber === n).id;
    expect(teachers.find((t: { id: string }) => t.id === "t-john").courseIds).toEqual([sec("1")]);
    expect(teachers.find((t: { id: string }) => t.id === "t-jane").courseIds).toEqual([sec("2")]);
  });

  test("a section number is required once there is more than one row, and can't repeat", async ({ page }) => {
    const dialog = await open(page);
    await pick(dialog, "Primary Teacher", "John", "John Smith");
    await dialog.getByRole("button", { name: "Add section" }).click();
    await expect(dialog.getByText("Enter a section number").first()).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Create 2 sections" })).toBeDisabled();

    await dialog.getByLabel("Section number, row 1").fill("1");
    await dialog.getByLabel("Section number, row 2").fill("1");
    await expect(dialog.getByText("Repeated in this list").first()).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Create 2 sections" })).toBeDisabled();

    await dialog.getByLabel("Section number, row 2").fill("2");
    await expect(dialog.getByRole("button", { name: "Create 2 sections" })).toBeEnabled();
  });

  test("a row can be removed, and the button goes back to the single-course wording", async ({ page }) => {
    const dialog = await open(page);
    await dialog.getByLabel("Section number, row 1").fill("1");
    await dialog.getByRole("button", { name: "Add section" }).click();
    await dialog.getByRole("button", { name: "Remove section row 2" }).click();
    await expect(dialog.getByLabel("Section number, row 2")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Create Course" })).toBeVisible();
  });

  test("a section that already exists for the same course, year and term is refused", async ({ page }) => {
    const dialog = await open(page, [EXISTING]);
    // no curriculum here, so the clash is matched on the course name + this year (the default) + no term
    await dialog.getByLabel("Section number, row 1").fill("1");
    await pick(dialog, "Primary Teacher", "John", "John Smith");
    await expect(dialog.getByText("This section already exists")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Create Course" })).toBeDisabled();
    await dialog.getByLabel("Section number, row 1").fill("2");
    await expect(dialog.getByRole("button", { name: "Create Course" })).toBeEnabled();
  });
});

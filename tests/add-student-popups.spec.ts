import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// 20/9/2569 — stakeholder wants centred popups instead of right-hand drawers.
// Sample round: the shared <Modal>, the NEW teacher "Add Student" (by ID) and the
// admin "Add Student" converted from a drawer. Other drawers convert after sign-off.

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-as", name: "Programming", description: "", status: "active",
  coverColor: "#2DD4BF", createdAt: NOW, updatedAt: NOW,
};
const TEACHER = { id: "t-as", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-as"] };
const COHORT = [
  { id: "cs-1", studentId: "64070501", title: "Mr.", firstName: "Fah", lastName: "Test", email: "64070501@kmitl.ac.th", cohort: "CE64", program: "CE", status: "active" },
  { id: "cs-2", studentId: "64070502", firstName: "Beam", lastName: "Suk", email: "64070502@kmitl.ac.th", cohort: "CE64", program: "CE", status: "active" },
];
const ENROLLED_BEAM = { id: "s-beam", courseId: "c-as", studentId: "64070502", firstName: "Beam", lastName: "Suk", email: "64070502@kmitl.ac.th", cohort: "CE64", sequenceNumber: 1, enrollmentStatus: "enrolled" };

async function seedTeacher(page: Page, roster: unknown[] = [ENROLLED_BEAM]) {
  await page.addInitScript((data) => {
    if (sessionStorage.getItem("as_seeded")) return;
    sessionStorage.setItem("as_seeded", "1");
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([data.course]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([data.teacher]));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(data.cohort));
    localStorage.setItem("hwai_students_v1", JSON.stringify(data.roster));
  }, { course: COURSE, teacher: TEACHER, cohort: COHORT, roster });
}

async function assertCentred(page: Page, dialog: ReturnType<Page["getByRole"]>) {
  const box = (await dialog.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThan(2);
  expect(Math.abs(box.y + box.height / 2 - vp.height / 2)).toBeLessThan(2);
}

const savedRoster = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("hwai_students_v1") ?? "[]"));

test.describe("Teacher — Add Student (by ID) popup", () => {
  async function openPopup(page: Page, roster?: unknown[]) {
    await seedTeacher(page, roster);
    await page.goto(`${BASE}/teacher/courses/c-as/students`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Add Student" }).first().click();
    return page.getByRole("dialog", { name: "Add Student" });
  }

  test("opens as a centred popup over the page, next to Import CSV", async ({ page }) => {
    const dialog = await openPopup(page);
    await expect(dialog).toBeVisible();
    await assertCentred(page, dialog);
    await expect(page.getByRole("button", { name: "Import CSV" })).toBeVisible();
    await expect(dialog.getByLabel("Student ID")).toBeFocused();
  });

  test("typing an ID shows who it is (from the student database), Add enrols them at the end of the roster", async ({ page }) => {
    const dialog = await openPopup(page);
    await dialog.getByLabel("Student ID").fill("64070501");
    await expect(dialog.getByText("Mr. Fah Test")).toBeVisible();
    await expect(dialog.getByText("64070501@kmitl.ac.th")).toBeVisible();
    await expect(dialog.getByText("CE", { exact: true })).toBeVisible();

    await dialog.getByRole("button", { name: "Add Student" }).click();
    await expect(dialog.getByRole("status")).toContainText("Fah Test was added to the course");
    // the row is on the page behind the popup
    await expect(page.getByRole("cell", { name: "64070501", exact: true })).toBeVisible();

    const roster = await savedRoster(page);
    expect(roster).toHaveLength(2);
    expect(roster[1]).toMatchObject({
      courseId: "c-as", studentId: "64070501", firstName: "Fah", lastName: "Test",
      email: "64070501@kmitl.ac.th", sequenceNumber: 2, enrollmentStatus: "added-midterm",
    });
  });

  test("'Add another' returns to an empty form; 'Done' closes", async ({ page }) => {
    const dialog = await openPopup(page, []);
    await dialog.getByLabel("Student ID").fill("64070501");
    await dialog.getByRole("button", { name: "Add Student" }).click();
    await dialog.getByRole("button", { name: "Add another" }).click();
    await expect(dialog.getByLabel("Student ID")).toHaveValue("");
    await dialog.getByLabel("Student ID").fill("64070502");
    await dialog.getByRole("button", { name: "Add Student" }).click();
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(dialog).toHaveCount(0);
    expect((await savedRoster(page)).map((s: { studentId: string }) => s.studentId)).toEqual(["64070501", "64070502"]);
  });

  test("an ID that isn't in the system is refused with a reason and nothing is saved", async ({ page }) => {
    const dialog = await openPopup(page);
    await dialog.getByLabel("Student ID").fill("99999999");
    await dialog.getByRole("button", { name: "Add Student" }).click();
    await expect(dialog.getByRole("alert")).toContainText("isn't in the system");
    expect(await savedRoster(page)).toHaveLength(1);
  });

  test("a student already in the course is flagged as you type and can't be added twice", async ({ page }) => {
    const dialog = await openPopup(page);
    await dialog.getByLabel("Student ID").fill("64070502");
    await expect(dialog.getByText("Beam Suk is already enrolled in this course")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Add Student" })).toBeDisabled();
    expect(await savedRoster(page)).toHaveLength(1);
  });

  test("an empty ID says it is required", async ({ page }) => {
    const dialog = await openPopup(page);
    await dialog.getByRole("button", { name: "Add Student" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Student ID is required");
  });

  test("Esc, the backdrop, the X and Cancel all close it, and focus goes back to the button", async ({ page }) => {
    const dialog = await openPopup(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add Student" })).toBeFocused();

    await page.getByRole("button", { name: "Add Student" }).click();
    await page.mouse.click(5, 5); // backdrop — over the top bar too, which the popup now covers
    await expect(dialog).toHaveCount(0);

    await page.getByRole("button", { name: "Add Student" }).click();
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toHaveCount(0);

    await page.getByRole("button", { name: "Add Student" }).click();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("Tab stays inside the popup", async ({ page }) => {
    const dialog = await openPopup(page);
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
  });

  test("the empty roster offers Add Student as well", async ({ page }) => {
    await seedTeacher(page, []);
    await page.goto(`${BASE}/teacher/courses/c-as/students`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("No students yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Student" })).toHaveCount(2); // header + empty state
  });
});

test.describe("Admin — Add Student is a centred popup now", () => {
  async function openAdmin(page: Page) {
    await page.addInitScript(() => {
      localStorage.setItem("hwai_lang", "en");
      localStorage.setItem("hwai_user", JSON.stringify({ name: "Admin", email: "admin@kmitl.ac.th", role: "admin" }));
    });
    await page.goto(`${BASE}/admin/users`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: "Students" }).click();
    await page.getByRole("button", { name: "Add Student" }).first().click();
    return page.getByRole("dialog", { name: "Add Student" });
  }

  test("opens in the middle of the screen (not docked to the right)", async ({ page }) => {
    const dialog = await openAdmin(page);
    await expect(dialog).toBeVisible();
    await assertCentred(page, dialog);
  });

  test("validates, then saves a new cohort student and closes", async ({ page }) => {
    const dialog = await openAdmin(page);
    await dialog.getByRole("button", { name: "Add Student" }).click();
    await expect(dialog.getByRole("alert").first()).toBeVisible();

    await dialog.getByLabel("Student ID").fill("69070199");
    await dialog.getByLabel("First Name").fill("Nok");
    await dialog.getByLabel("Last Name").fill("Sai");
    await dialog.getByLabel("Email").fill("69070199@kmitl.ac.th");
    await dialog.getByLabel("Program").selectOption("CE");
    await dialog.getByRole("button", { name: "Add Student" }).click();
    await expect(dialog).toHaveCount(0);
    const cohort = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_cohort_students_v1") ?? "[]"));
    expect(cohort).toHaveLength(1);
    expect(cohort[0]).toMatchObject({ studentId: "69070199", firstName: "Nok", email: "69070199@kmitl.ac.th", program: "CE" });
  });

  test("Esc closes it", async ({ page }) => {
    const dialog = await openAdmin(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
});

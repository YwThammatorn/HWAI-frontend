import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// Teacher › Students roster (21/9/2569): laid out like the admin Students tab —
// Student ID · Title · Name (first + last together) · Email. The honorific is looked up
// from the central student record by student ID. Search box + click-to-sort headers.

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-rt", name: "Programming", description: "", status: "active",
  coverColor: "#0F766E", courseTemplateId: "ct-rt", term: 1, academicYear: 2569,
  sectionNumber: "1", code: "01076112", schedule: "Mon 9:00-12:00", room: "811", createdAt: NOW, updatedAt: NOW,
};
const TEACHER = { id: "t-rt", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-rt"] };
const COHORT = [
  { id: "cs-1", studentId: "69070101", title: "Mr.", firstName: "Somchai", lastName: "Jaidee", email: "69070101@kmitl.ac.th", cohort: "CE69", program: "CE", status: "active" },
  { id: "cs-2", studentId: "69070102", title: "Miss", firstName: "Malee", lastName: "Suksan", email: "69070102@kmitl.ac.th", cohort: "CE69", program: "CE", status: "active" },
  { id: "cs-3", studentId: "69070103", firstName: "Chai", lastName: "Notitle", email: "69070103@kmitl.ac.th", cohort: "CE69", program: "CE", status: "active" },
];
const roster = (id: string, studentId: string, firstName: string, lastName: string, seq: number, email = `${studentId}@kmitl.ac.th`) => ({
  id, courseId: "c-rt", studentId, firstName, lastName, email, cohort: "CE69", sequenceNumber: seq, enrollmentStatus: "enrolled",
});
// Deliberately NOT in ID or name order, so "roster order" differs from both sorts.
const ROSTER = [
  roster("s-2", "69070102", "Malee", "Suksan", 1),
  roster("s-1", "69070101", "Somchai", "Jaidee", 2),
  roster("s-4", "69079999", "Ghost", "Record", 3), // enrolled but not in the central list
  roster("s-3", "69070103", "Chai", "Notitle", 4),
];

async function open(page: Page, lang: "en" | "th" = "en") {
  await page.addInitScript((d) => {
    // addInitScript re-runs on every navigation — seed once so an edit made mid-test survives a reload
    if (sessionStorage.getItem("rt_seeded")) return;
    sessionStorage.setItem("rt_seeded", "1");
    localStorage.setItem("hwai_lang", d.lang);
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([d.course]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([d.teacher]));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(d.cohort));
    localStorage.setItem("hwai_students_v1", JSON.stringify(d.roster));
  }, { lang, course: COURSE, teacher: TEACHER, cohort: COHORT, roster: ROSTER });
  await page.goto(`${BASE}/teacher/courses/c-rt/students`);
  await page.waitForLoadState("networkidle");
}

test.describe("Teacher roster table", () => {
  test("columns are #, Student ID, Title, Name, Email, Program, Status, Actions — no separate first/last name columns", async ({ page }) => {
    await open(page);
    const heads = page.getByRole("columnheader");
    await expect(heads).toHaveText(["#", "Student ID", "Title", "Name", "Email", "Program", "Status", "Actions"]);
    await expect(page.getByRole("columnheader", { name: "First Name" })).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: "Last Name" })).toHaveCount(0);
  });

  test("first and last name share one cell; the title is its own cell", async ({ page }) => {
    await open(page);
    const row = page.getByRole("row", { name: /69070101/ });
    const cells = row.getByRole("cell");
    await expect(cells.nth(1)).toHaveText("69070101");
    await expect(cells.nth(2)).toHaveText("Mr.");
    await expect(cells.nth(3)).toHaveText("Somchai Jaidee");
    await expect(cells.nth(4)).toHaveText("69070101@kmitl.ac.th");
    await expect(page.getByRole("row", { name: /69070102/ }).getByRole("cell").nth(2)).toHaveText("Miss");
  });

  test("a student with no title, or missing from the central list, shows a dash", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("row", { name: /69070103/ }).getByRole("cell").nth(2)).toHaveText("-");
    const ghost = page.getByRole("row", { name: /69079999/ }).getByRole("cell");
    await expect(ghost.nth(2)).toHaveText("-");
    await expect(ghost.nth(3)).toHaveText("Ghost Record"); // roster still shows its own copy of the name
  });

  test("the title follows the central record when an admin edits it", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("row", { name: /69070101/ }).getByRole("cell").nth(2)).toHaveText("Mr.");
    await page.evaluate(() => {
      const list = JSON.parse(localStorage.getItem("hwai_cohort_students_v1") ?? "[]");
      localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(list.map((s: { studentId: string }) => (s.studentId === "69070101" ? { ...s, title: "Ms." } : s))));
    });
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("row", { name: /69070101/ }).getByRole("cell").nth(2)).toHaveText("Ms.");
  });

  test("Thai UI labels the columns คำนำหน้า and ชื่อ-นามสกุล", async ({ page }) => {
    await open(page, "th");
    await expect(page.getByRole("columnheader")).toHaveText(["#", "รหัสนักศึกษา", "คำนำหน้า", "ชื่อ-นามสกุล", "อีเมล", "สาขา", "สถานะ", "จัดการ"]);
  });
});

const ids = (page: Page) => page.locator("tbody tr td:nth-child(2)").allTextContents();
const nums = (page: Page) => page.locator("tbody tr td:nth-child(1)").allTextContents();
const header = (page: Page, name: string) => page.getByRole("columnheader", { name });
const search = (page: Page) => page.getByRole("combobox", { name: "Search students" });

test.describe("Teacher roster — search", () => {
  test("filters by name, student ID, email and title; the count line follows", async ({ page }) => {
    await open(page);
    await expect(page.getByText("4 students", { exact: true })).toBeVisible();

    await search(page).fill("chai"); // Somchai + Chai
    await expect.poll(() => ids(page)).toEqual(["69070101", "69070103"]);
    await expect(page.getByText("2 of 4 students", { exact: true })).toBeVisible();

    await search(page).fill("69079999");
    await expect.poll(() => ids(page)).toEqual(["69079999"]);

    await search(page).fill("69070102@kmitl");
    await expect.poll(() => ids(page)).toEqual(["69070102"]);

    await search(page).fill("miss"); // title of Malee
    await expect.poll(() => ids(page)).toEqual(["69070102"]);

    await search(page).fill("");
    await expect.poll(async () => (await ids(page)).length).toBe(4);
    await expect(page.getByText("4 students", { exact: true })).toBeVisible();
  });

  test("no match shows a message; clearing brings the roster back", async ({ page }) => {
    await open(page);
    await search(page).fill("zzzz");
    await expect(page.getByText("No results found")).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.getByText("0 of 4 students", { exact: true })).toBeVisible();
    await search(page).fill("");
    await expect(page.getByText("No results found")).toHaveCount(0);
    await expect(page.locator("tbody tr")).toHaveCount(4);
  });

  test("typing offers name / ID suggestions and picking one fills the box", async ({ page }) => {
    await open(page);
    await search(page).fill("Som");
    await expect(page.getByRole("listbox").getByRole("option", { name: "Somchai Jaidee" })).toBeVisible();
    await page.getByRole("option", { name: "Somchai Jaidee" }).click();
    await expect(search(page)).toHaveValue("Somchai Jaidee");
    await expect.poll(() => ids(page)).toEqual(["69070101"]);
  });

  test("Thai placeholder and count wording", async ({ page }) => {
    await open(page, "th");
    await page.getByPlaceholder("ค้นหานักศึกษา...").fill("Ghost");
    await expect(page.getByText("พบ 1 จาก 4 นักศึกษา", { exact: true })).toBeVisible();
  });

  test("no toolbar on an empty roster", async ({ page }) => {
    await page.addInitScript((d) => {
      localStorage.setItem("hwai_lang", "en");
      localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
      localStorage.setItem("hwai_courses_v2", JSON.stringify([d.course]));
      localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([d.teacher]));
      localStorage.setItem("hwai_students_v1", "[]");
    }, { course: COURSE, teacher: TEACHER });
    await page.goto(`${BASE}/teacher/courses/c-rt/students`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("No students yet")).toBeVisible();
    await expect(search(page)).toHaveCount(0);
  });
});

test.describe("Teacher roster — sort", () => {
  test("starts in roster order, with no active sort column", async ({ page }) => {
    await open(page);
    expect(await ids(page)).toEqual(["69070102", "69070101", "69079999", "69070103"]);
    expect(await nums(page)).toEqual(["1", "2", "3", "4"]);
    await expect(header(page, "Student ID")).toHaveAttribute("aria-sort", "none");
    await expect(header(page, "Name")).toHaveAttribute("aria-sort", "none");
  });

  test("Student ID cycles ascending → descending → roster order", async ({ page }) => {
    await open(page);
    await header(page, "Student ID").getByRole("button").click();
    expect(await ids(page)).toEqual(["69070101", "69070102", "69070103", "69079999"]);
    await expect(header(page, "Student ID")).toHaveAttribute("aria-sort", "ascending");
    await header(page, "Student ID").getByRole("button").click();
    expect(await ids(page)).toEqual(["69079999", "69070103", "69070102", "69070101"]);
    await expect(header(page, "Student ID")).toHaveAttribute("aria-sort", "descending");
    await header(page, "Student ID").getByRole("button").click();
    expect(await ids(page)).toEqual(["69070102", "69070101", "69079999", "69070103"]);
    await expect(header(page, "Student ID")).toHaveAttribute("aria-sort", "none");
  });

  test("Name cycles A–Z → Z–A → roster order, and only one column is active at a time", async ({ page }) => {
    await open(page);
    await header(page, "Student ID").getByRole("button").click();
    await header(page, "Name").getByRole("button").click();
    await expect(header(page, "Student ID")).toHaveAttribute("aria-sort", "none");
    await expect(header(page, "Name")).toHaveAttribute("aria-sort", "ascending");
    // Chai Notitle, Ghost Record, Malee Suksan, Somchai Jaidee
    expect(await ids(page)).toEqual(["69070103", "69079999", "69070102", "69070101"]);
    await header(page, "Name").getByRole("button").click();
    expect(await ids(page)).toEqual(["69070101", "69070102", "69079999", "69070103"]);
    await header(page, "Name").getByRole("button").click();
    expect(await ids(page)).toEqual(["69070102", "69070101", "69079999", "69070103"]);
  });

  test("the # column belongs to the student, not the row position", async ({ page }) => {
    await open(page);
    await header(page, "Student ID").getByRole("button").click(); // 101, 102, 103, 9999
    expect(await nums(page)).toEqual(["2", "1", "4", "3"]);
    await search(page).fill("chai"); // still sorted, filtered to 101 (#2) and 103 (#4)
    await expect.poll(() => ids(page)).toEqual(["69070101", "69070103"]);
    expect(await nums(page)).toEqual(["2", "4"]);
  });

  test("Thai UI: sort hints are in Thai", async ({ page }) => {
    await open(page, "th");
    await expect(page.getByRole("button", { name: "รหัสนักศึกษา" })).toHaveAttribute("title", /คลิกเพื่อเรียงตามรหัส/);
    await expect(page.getByRole("button", { name: "ชื่อ-นามสกุล" })).toHaveAttribute("title", /คลิกเพื่อเรียงตามชื่อ/);
  });
});

test.describe("Teacher roster — table edge", () => {
  test("the last row has no bottom border (it would double up with the card edge)", async ({ page }) => {
    await open(page);
    await expect(page.locator("tbody tr").last()).toHaveCSS("border-bottom-width", "0px");
    await expect(page.locator("tbody tr").first()).not.toHaveCSS("border-bottom-width", "0px");
  });
});

// Program / Status / delete (23/9/2569, Program relabelled to the full name 23/9/2569 follow-up):
// Program is looked up live from the central cohort record (same pattern as Title) and shown as its
// full name, not the raw abbreviation (same PROGRAM_LABEL map as admin/users.tsx). Status is the
// per-section EnrollmentStatus, not CohortStudent's account-level active/inactive. The Cohort column
// itself was dropped the same follow-up — unused, the sidebar already scopes to one course.
const rowCells = (page: Page, studentId: string) => page.getByRole("row", { name: new RegExp(studentId) }).getByRole("cell");

test.describe("Teacher roster — Program / Status", () => {
  test("Program is looked up from the central record and shown as its full name; a student missing from it shows a dash", async ({ page }) => {
    await open(page);
    const somchai = rowCells(page, "69070101");
    await expect(somchai.nth(5)).toHaveText("Computer Engineering");
    const ghost = rowCells(page, "69079999");
    await expect(ghost.nth(5)).toHaveText("—"); // not in the central list — no program to look up
  });

  test("status badge shows Enrolled by default; missing enrollmentStatus also reads as Enrolled", async ({ page }) => {
    await open(page);
    await expect(rowCells(page, "69070101").nth(6)).toHaveText("Enrolled");
  });

  test("withdrawing a student asks for confirmation, then flips the badge and the toggle icon", async ({ page }) => {
    await open(page);
    const row = page.getByRole("row", { name: /69070101/ });
    await expect(row.getByRole("cell").nth(6)).toHaveText("Enrolled");
    page.once("dialog", (d) => d.accept());
    await row.getByRole("button", { name: /Withdraw Somchai Jaidee/ }).click();
    await expect(row.getByRole("cell").nth(6)).toHaveText("Withdrawn");
    await expect(row.getByRole("button", { name: /Re-enroll Somchai Jaidee/ })).toBeVisible();
  });

  test("withdrawing is cancellable; declining the confirm leaves the student enrolled", async ({ page }) => {
    await open(page);
    const row = page.getByRole("row", { name: /69070101/ });
    page.once("dialog", (d) => d.dismiss());
    await row.getByRole("button", { name: /Withdraw Somchai Jaidee/ }).click();
    await expect(row.getByRole("cell").nth(6)).toHaveText("Enrolled");
  });

  test("re-enrolling a withdrawn student needs no confirmation", async ({ page }) => {
    await open(page);
    const row = page.getByRole("row", { name: /69070102/ }); // Malee — seed her withdrawn first
    await page.evaluate(() => {
      const list = JSON.parse(localStorage.getItem("hwai_students_v1") ?? "[]");
      localStorage.setItem("hwai_students_v1", JSON.stringify(list.map((s: { studentId: string }) => (s.studentId === "69070102" ? { ...s, enrollmentStatus: "withdrawn" } : s))));
    });
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(row.getByRole("cell").nth(6)).toHaveText("Withdrawn");
    await row.getByRole("button", { name: /Re-enroll Malee Suksan/ }).click(); // no dialog listener — must not hang
    await expect(row.getByRole("cell").nth(6)).toHaveText("Enrolled");
  });

  test("Thai UI: status labels and confirm copy", async ({ page }) => {
    await open(page, "th");
    const row = page.getByRole("row", { name: /69070101/ });
    await expect(row.getByRole("cell").nth(6)).toHaveText("ลงทะเบียน");
    page.once("dialog", (d) => { expect(d.message()).toContain("ถอน"); d.dismiss(); });
    await row.getByRole("button", { name: /ถอน Somchai Jaidee/ }).click();
  });
});

test.describe("Teacher roster — remove from course", () => {
  test("deleting a student asks for confirmation, then removes their row and updates the count", async ({ page }) => {
    await open(page);
    await expect(page.getByText("4 students", { exact: true })).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("row", { name: /69070101/ }).getByRole("button", { name: /Remove Somchai Jaidee/ }).click();
    await expect(page.getByRole("row", { name: /69070101/ })).toHaveCount(0);
    await expect(page.getByText("3 students", { exact: true })).toBeVisible();
  });

  test("deleting is cancellable; declining the confirm keeps the row", async ({ page }) => {
    await open(page);
    page.once("dialog", (d) => d.dismiss());
    await page.getByRole("row", { name: /69070101/ }).getByRole("button", { name: /Remove Somchai Jaidee/ }).click();
    await expect(page.getByRole("row", { name: /69070101/ })).toHaveCount(1);
    await expect(page.getByText("4 students", { exact: true })).toBeVisible();
  });
});

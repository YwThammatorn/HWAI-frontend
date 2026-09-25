import { test, expect, Page, Locator } from "@playwright/test";

const BASE = "http://localhost:3000";

// 20/9/2569 — every add / edit / import form is a centred popup now (was a right-hand
// drawer). Each popup is opened from its real button and must: sit in the middle of the
// screen, be named by its title, close on Esc / backdrop, and hand focus back to the button.

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-po", name: "Capstone Studio", description: "", status: "active",
  coverColor: "#0F766E", createdAt: NOW, updatedAt: NOW,
};
const TEACHER = { id: "t-po", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-po"] };
const ROSTER = [
  { id: "s-po-1", courseId: "c-po", studentId: "64070601", firstName: "Fah", lastName: "Test", email: "64070601@kmitl.ac.th", cohort: "CE69" },
  { id: "s-po-2", courseId: "c-po", studentId: "64070602", firstName: "Beam", lastName: "Suk", email: "64070602@kmitl.ac.th", cohort: "CE69" },
];
const GROUP_ASSIGNMENT = {
  id: "a-po", courseId: "c-po", name: "Team Prototype", description: "", dueDate: "2099-12-31",
  maxPoints: 100, submissionType: "group", maxGroupSize: 3, acceptsFiles: true, fileTypes: [], rubricIds: [],
  createdAt: NOW, updatedAt: NOW,
};
const CURRICULUM = { id: "cv-po", program: "CE", label: "CE 2569", effectiveFrom: 2569 };

type Role = "admin" | "teacher" | "student";

/** Expand the curriculum row; retries the click in case it lands before the page has hydrated. */
async function expandCurriculum(page: Page) {
  const row = page.getByRole("button", { name: /CE 2569/ }).first();
  await expect(async () => {
    if ((await row.getAttribute("aria-expanded")) !== "true") await row.click();
    await expect(row).toHaveAttribute("aria-expanded", "true", { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}

async function seed(page: Page, role: Role, extra: Record<string, unknown> = {}) {
  await page.addInitScript(({ role, extra, data }) => {
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify(
      role === "admin" ? { name: "Admin", email: "admin@kmitl.ac.th", role: "admin" }
        : role === "teacher" ? { name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }
        : { name: "Fah Test", email: "64070601@kmitl.ac.th", role: "student", studentId: "64070601" },
    ));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([data.course]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([data.teacher]));
    localStorage.setItem("hwai_students_v1", JSON.stringify(data.roster));
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, JSON.stringify(v));
  }, { role, extra, data: { course: COURSE, teacher: TEACHER, roster: ROSTER } });
}

async function goto(page: Page, path: string) {
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");
}

/** The popup must be in the middle of the viewport, never docked to a side. */
async function expectCentred(page: Page, dialog: Locator) {
  const box = (await dialog.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThan(2);
  expect(Math.abs(box.y + box.height / 2 - vp.height / 2)).toBeLessThan(2);
  expect(box.x).toBeGreaterThan(20); // has a margin on the left …
  expect(box.x + box.width).toBeLessThan(vp.width - 20); // … and on the right (a drawer touches the edge)
}

interface PopupCase {
  name: string;
  role: Role;
  extra?: Record<string, unknown>;
  path: string;
  /** Opens the popup; returns the trigger that must regain focus afterwards. */
  open: (page: Page) => Promise<Locator>;
  title: string;
}

const CASES: PopupCase[] = [
  {
    name: "admin · Add Teacher", role: "admin", path: "/admin/users", title: "Add Teacher",
    open: async (page) => { const b = page.getByRole("button", { name: "Add Teacher" }).first(); await b.click(); return b; },
  },
  {
    name: "admin · Import Teachers (CSV)", role: "admin", path: "/admin/users", title: "Import Teachers",
    open: async (page) => { const b = page.getByRole("button", { name: "Import CSV" }).first(); await b.click(); return b; },
  },
  {
    name: "admin · Add Student", role: "admin", path: "/admin/users", title: "Add Student",
    open: async (page) => { await page.getByRole("tab", { name: "Students" }).click(); const b = page.getByRole("button", { name: "Add Student" }).first(); await b.click(); return b; },
  },
  {
    name: "admin · Import Students (CSV)", role: "admin", path: "/admin/users", title: "Import Students",
    open: async (page) => { await page.getByRole("tab", { name: "Students" }).click(); const b = page.getByRole("button", { name: "Import CSV" }).first(); await b.click(); return b; },
  },
  {
    name: "admin · New Curriculum Version", role: "admin", path: "/admin/curriculum", title: "New Curriculum Version",
    open: async (page) => { const b = page.getByRole("button", { name: "New Curriculum" }).first(); await b.click(); return b; },
  },
  {
    name: "admin · New Course Template", role: "admin", path: "/admin/curriculum", title: "New Course Template",
    extra: { hwai_curriculum_versions_v1: [CURRICULUM], hwai_course_templates_v1: [] },
    open: async (page) => {
      await expandCurriculum(page);
      const b = page.getByRole("button", { name: "+ Add course" }); await b.click(); return b;
    },
  },
  {
    name: "admin · Import Courses (CSV)", role: "admin", path: "/admin/curriculum", title: "Import Courses",
    extra: { hwai_curriculum_versions_v1: [CURRICULUM], hwai_course_templates_v1: [] },
    open: async (page) => {
      await expandCurriculum(page);
      const b = page.getByRole("button", { name: "Import CSV" }); await b.click(); return b;
    },
  },
  {
    name: "admin · New Course", role: "admin", path: "/admin/courses", title: "New Course",
    open: async (page) => { const b = page.getByRole("button", { name: "New Course" }).first(); await b.click(); return b; },
  },
  {
    name: "teacher · Add Student", role: "teacher", path: "/teacher/courses/c-po/students", title: "Add Student",
    extra: { hwai_cohort_students_v1: [] },
    open: async (page) => { const b = page.getByRole("button", { name: "Add Student" }).first(); await b.click(); return b; },
  },
  {
    name: "teacher · Import Students (CSV)", role: "teacher", path: "/teacher/courses/c-po/students", title: "Import Students",
    extra: { hwai_cohort_students_v1: [] },
    open: async (page) => { const b = page.getByRole("button", { name: "Import CSV" }).first(); await b.click(); return b; },
  },
  {
    name: "teacher · Add Collaborator", role: "teacher", path: "/teacher/courses/c-po/collaborators", title: "Add Collaborator",
    open: async (page) => { const b = page.getByRole("button", { name: "Add Collaborator" }).first(); await b.click(); return b; },
  },
  // Not listed: teacher · New Grading Split. The Grading Split page is switched off (GRADING_SPLIT_DISABLED in
  // src/lib/featureFlags.ts — it redirects to the course overview), so its popup cannot be reached from the UI.
  // It was converted with the others (Modal, same footer) and checked by flipping the flag once.
  {
    name: "student · Form a team", role: "student", path: "/student/courses/c-po/classwork/a-po", title: "Form a team",
    extra: { hwai_assignments_v1: [GROUP_ASSIGNMENT], hwai_submissions_v1: [], hwai_student_groups_v1: [] },
    open: async (page) => { const b = page.getByRole("button", { name: "Form a team" }); await b.click(); return b; },
  },
];

test.describe("Centred popups replace every drawer", () => {
  for (const c of CASES) {
    test(`${c.name}: centred, titled, closes on Esc / backdrop, focus returns`, async ({ page }) => {
      await seed(page, c.role, c.extra);
      await goto(page, c.path);
      const trigger = await c.open(page);
      const dialog = page.getByRole("dialog", { name: c.title });
      await expect(dialog).toBeVisible();
      await expectCentred(page, dialog);

      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();

      // and again, closing through the backdrop (which also covers the top bar)
      await c.open(page);
      await expect(dialog).toBeVisible();
      await page.mouse.click(5, 5);
      await expect(dialog).toHaveCount(0);
    });
  }
});

test.describe("Popup behaviour worth its own check", () => {
  test("the phone-width popup keeps a margin instead of touching the edges", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await seed(page, "admin");
    await goto(page, "/admin/users");
    await page.getByRole("button", { name: "Add Teacher" }).first().click();
    const box = (await page.getByRole("dialog", { name: "Add Teacher" }).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(15);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
  });

  test("Import Teachers: upload a CSV, preview it, and the Import button stays pinned under the scrolling preview", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 }); // short window — the body must scroll, not the buttons
    await seed(page, "admin");
    await goto(page, "/admin/users");
    await page.getByRole("button", { name: "Import CSV" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Import Teachers" });
    const rows = ["name,email,role", ...Array.from({ length: 14 }, (_, i) => `Teacher ${i + 1},t${i + 1}@kmitl.ac.th,teacher`)].join("\n");
    await dialog.locator('input[type="file"]').setInputFiles({ name: "teachers.csv", mimeType: "text/csv", buffer: Buffer.from(rows) });
    await expect(dialog.getByText("New: 14")).toBeVisible();

    const importBtn = dialog.getByRole("button", { name: /Import 14/ });
    await expect(importBtn).toBeVisible();
    const d = (await dialog.boundingBox())!;
    const b = (await importBtn.boundingBox())!;
    expect(b.y + b.height).toBeLessThanOrEqual(d.y + d.height + 1); // inside the popup, never scrolled out of it
    expect(d.y + d.height).toBeLessThanOrEqual(600);

    await importBtn.click();
    await expect(dialog.getByText("Import complete")).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_managed_teachers_v1") ?? "[]"));
    expect(saved.filter((t: { email: string }) => /^t\d+@kmitl\.ac\.th$/.test(t.email))).toHaveLength(14);
  });

  test("Import Students: same flow adds cohort students", async ({ page }) => {
    await seed(page, "admin");
    await goto(page, "/admin/users");
    await page.getByRole("tab", { name: "Students" }).click();
    await page.getByRole("button", { name: "Import CSV" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Import Students" });
    const csv = "studentId,title,firstName,lastName,email,cohort,program\n69070301,,Nok,Sai,69070301@kmitl.ac.th,CE69,CE";
    await dialog.locator('input[type="file"]').setInputFiles({ name: "students.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await dialog.getByRole("button", { name: /Import 1 student/ }).click();
    await expect(dialog.getByText("Import complete")).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_cohort_students_v1") ?? "[]"));
    expect(saved.map((s: { studentId: string }) => s.studentId)).toContain("69070301");
  });

  test("New Curriculum Version saves from the popup's pinned footer", async ({ page }) => {
    await seed(page, "admin");
    await goto(page, "/admin/curriculum");
    await page.getByRole("button", { name: "New Curriculum" }).first().click();
    const dialog = page.getByRole("dialog", { name: "New Curriculum Version" });
    // Label now auto-fills from Program + Year (23/9/2569), so Create Version starts enabled.
    await expect(dialog.getByRole("button", { name: "Create Version" })).toBeEnabled();
    await dialog.locator("input").first().fill("CE 2570");
    await dialog.getByRole("button", { name: "Create Version" }).click();
    await expect(dialog).toHaveCount(0);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_curriculum_versions_v1") ?? "[]"));
    expect(saved.map((v: { label: string }) => v.label)).toContain("CE 2570");
  });

  test("Form a team: pick a classmate, create the team, popup closes", async ({ page }) => {
    await seed(page, "student", { hwai_assignments_v1: [GROUP_ASSIGNMENT], hwai_submissions_v1: [], hwai_student_groups_v1: [] });
    await goto(page, "/student/courses/c-po/classwork/a-po");
    await page.getByRole("button", { name: "Form a team" }).click();
    const dialog = page.getByRole("dialog", { name: "Form a team" });
    await dialog.getByPlaceholder(/Team Alpha/).fill("Prototype Pals");
    await dialog.getByText("Beam Suk").click();
    await dialog.getByRole("button", { name: "Create team" }).click();
    await expect(dialog).toHaveCount(0);
    const groups = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_student_groups_v1") ?? "[]"));
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ name: "Prototype Pals", memberStudentIds: ["64070601", "64070602"] });
  });

  test("the confirm dialog for destructive actions stays a compact dialog (not a Modal)", async ({ page }) => {
    await seed(page, "admin", { hwai_curriculum_versions_v1: [CURRICULUM], hwai_course_templates_v1: [] });
    await goto(page, "/admin/curriculum");
    await page.getByTitle("Delete curriculum").click();
    // still the small yes/no card — no popup was mistaken for it
    await expect(page.getByRole("dialog", { name: /New Curriculum Version|Add Teacher/ })).toHaveCount(0);
    await expect(page.getByText(/Delete/).first()).toBeVisible();
  });
});

import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// My Courses cards (21/9/2569): the course code and name sit in the colour band together with
// the icon (teacher and student cards share <CourseBanner>); Section / Term / Schedule / Room
// stay in the body. Text tone follows the cover colour so pastel and dark covers both read.

const NOW = "2026-01-01T00:00:00.000Z";
const mk = (id: string, name: string, code: string, cover: string, extra: Record<string, unknown> = {}) => ({
  id, name, description: "", status: "active", source: "manual", coverColor: cover, iconColor: cover,
  courseTemplateId: `ct-${id}`, term: 1, academicYear: 2569, sectionNumber: "2", code,
  schedule: "Mon 9:00-12:00", room: "811", createdAt: NOW, updatedAt: NOW, ...extra,
});
const PASTEL = mk("c-pastel", "Programming", "01076112", "#2DD4BF");
const DARK = mk("c-dark", "Data Structures", "01076215", "#0F766E");
const LONG = mk("c-long", "Natural Language Processing and Deep Learning for Very Large-Scale Data Analysis", "01076321", "#5B4E96");
const OLD = mk("c-old", "Retired Course", "01076999", "#2B4D8C", { status: "archived" });
const NOCODE = mk("c-nocode", "Untitled Workshop", "", "#B5541F");
const COURSES = [PASTEL, DARK, LONG, OLD, NOCODE];

const TEACHER = {
  id: "t-ccb", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th",
  role: "teacher", status: "active", courseIds: COURSES.map((c) => c.id),
};
const ROSTER = COURSES.map((c, i) => ({
  id: `s-ccb-${i}`, courseId: c.id, studentId: "69070101", firstName: "Somchai", lastName: "Jaidee",
  email: "69070101@kmitl.ac.th", cohort: "CE69", sequenceNumber: 1, enrollmentStatus: "enrolled",
}));

async function seed(page: Page, role: "teacher" | "student") {
  await page.addInitScript((d) => {
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_courses_v2", JSON.stringify(d.courses));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([d.teacher]));
    localStorage.setItem("hwai_students_v1", JSON.stringify(d.roster));
    localStorage.setItem("hwai_user", JSON.stringify(d.role === "student"
      ? { name: "Somchai", email: "69070101@kmitl.ac.th", role: "student", studentId: "69070101" }
      : { name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
  }, { courses: COURSES, teacher: TEACHER, roster: ROSTER, role });
}

/** The colour band of a card = the <h3>'s grandparent (h3 sits in a text block inside the band, not the body). */
const band = (card: ReturnType<Page["locator"]>) => card.locator("h3").locator("xpath=../..");
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

for (const role of ["teacher", "student"] as const) {
  const url = role === "teacher" ? "/teacher/courses" : "/student/courses";
  const cardOf = (page: Page, name: string) => page.getByRole("link", { name: new RegExp(name) });

  test.describe(`${role} My Courses card — code and name in the colour band`, () => {
    test("name and code sit inside the band; Section / Term / Schedule / Room stay in the body", async ({ page }) => {
      await seed(page, role);
      await page.goto(`${BASE}${url}`);
      await page.waitForLoadState("networkidle");
      const card = cardOf(page, "Programming");
      const b = band(card);
      await expect(b.locator("h3")).toHaveText("Programming");
      await expect(b.getByText("01076112", { exact: true })).toBeVisible();
      await expect(b).toHaveCSS("background-color", rgb("#2DD4BF"));
      // code above the name
      const codeBox = await b.getByText("01076112", { exact: true }).boundingBox();
      const nameBox = await b.locator("h3").boundingBox();
      expect(codeBox!.y).toBeLessThan(nameBox!.y);

      const field = (label: string) => card.getByText(label, { exact: true }).locator("xpath=following-sibling::p[1]");
      await expect(field("Section")).toHaveText("2");
      await expect(field("Term")).toHaveText("1/2569");
      await expect(field("Schedule")).toHaveText("Mon 9:00-12:00");
      await expect(field("Room")).toHaveText("811");
      // code is no longer a body field and never fused with the section
      await expect(card.getByText("Code", { exact: true })).toHaveCount(0);
      await expect(card.getByText("01076112 · Sec")).toHaveCount(0);
    });

    test("text colour follows the cover: ink on a pastel cover, white on a dark one", async ({ page }) => {
      await seed(page, role);
      await page.goto(`${BASE}${url}`);
      await page.waitForLoadState("networkidle");
      await expect(band(cardOf(page, "Programming"))).toHaveCSS("color", "rgb(15, 30, 46)");
      await expect(band(cardOf(page, "Data Structures"))).toHaveCSS("color", "rgb(255, 255, 255)");
      await expect(band(cardOf(page, "Natural Language"))).toHaveCSS("color", "rgb(255, 255, 255)");
      await expect(band(cardOf(page, "Untitled Workshop"))).toHaveCSS("color", "rgb(255, 255, 255)");
    });

    test("a long name is clamped to two lines and stays inside the band", async ({ page }) => {
      await seed(page, role);
      await page.goto(`${BASE}${url}`);
      await page.waitForLoadState("networkidle");
      const b = band(cardOf(page, "Natural Language"));
      const h3 = await b.locator("h3").boundingBox();
      const bb = await b.boundingBox();
      expect(h3!.height).toBeLessThan(80); // two lines, not the whole sentence
      expect(h3!.y + h3!.height).toBeLessThanOrEqual(bb!.y + bb!.height);
    });

    test("a course with no code shows only the name (no empty code line)", async ({ page }) => {
      await seed(page, role);
      await page.goto(`${BASE}${url}`);
      await page.waitForLoadState("networkidle");
      const b = band(cardOf(page, "Untitled Workshop"));
      await expect(b.locator("h3")).toHaveText("Untitled Workshop");
      await expect(b.locator("p")).toHaveCount(0);
    });
  });
}

test("teacher: an archived course keeps its veil on the band", async ({ page }) => {
  await seed(page, "teacher");
  await page.goto(`${BASE}/teacher/courses`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Archived/ }).click();
  const card = page.locator("h3", { hasText: "Retired Course" }).locator("xpath=../../..");
  await expect(card.getByText("Archived", { exact: true })).toBeVisible();
  await expect(card.locator("h3")).toHaveText("Retired Course");
  await expect(card.getByText("01076999", { exact: true })).toBeVisible();
});

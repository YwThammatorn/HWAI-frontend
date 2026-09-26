import { test, expect, Page } from "@playwright/test";
import fs from "fs";

const BASE = "http://localhost:3000";

// 26/9/2569 — admin Courses is grouped by curriculum, then by subject (a subject's sections and earlier
// terms stack in one card), with filters. Schedule / room are gone from this page (the teacher sets them).
// Seeded from the same mock files the console commands in test-data/seed-commands.txt load.

const rd = (f: string) => JSON.parse(fs.readFileSync(`public/mock-data/${f}`, "utf8"));
const MOCK = { cur: rd("curriculum-mockup-en.json"), courses: rd("courses-mockup-en.json"), teachers: rd("teachers-mockup-en.json") };

async function open(page: Page, lang: "en" | "th" = "en") {
  await page.addInitScript((d) => {
    if (sessionStorage.getItem("cg_seeded")) return;
    sessionStorage.setItem("cg_seeded", "1");
    localStorage.setItem("hwai_lang", d.lang);
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Admin", email: "admin@kmitl.ac.th", role: "admin" }));
    localStorage.setItem("hwai_curriculum_versions_v1", JSON.stringify(d.cur.curriculumVersions));
    localStorage.setItem("hwai_course_templates_v1", JSON.stringify(d.cur.courseTemplates));
    localStorage.setItem("hwai_courses_v2", JSON.stringify(d.courses));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify(d.teachers));
  }, { ...MOCK, lang });
  await page.goto(`${BASE}/admin/courses`);
  await page.waitForLoadState("networkidle");
}

const curriculumHeadings = (page: Page) => page.getByRole("heading", { level: 2 }).allTextContents();
// CE 2569 and CE 2564 both have a "Database Systems" subject (this term's and an earlier curriculum's), so pin the one in CE 2569
const ce2569Db = (page: Page) => page.getByRole("region", { name: /Computer Engineering \(Revised 2569\)/ }).getByRole("region", { name: "Database Systems", exact: true });
const subjectCard = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

test.describe("Admin Courses — grouped by curriculum, then subject", () => {
  test("curricula come in program order, newest first, with 'No curriculum' last", async ({ page }) => {
    await open(page);
    const heads = (await curriculumHeadings(page)).map((h) => h.replace(/\s+/g, " "));
    const order = heads.map((h) => h.match(/\(Revised (\d+)\)|No curriculum/)?.[0]);
    expect(order).toEqual([
      "(Revised 2569)", "(Revised 2564)", "(Revised 2559)",   // CE, newest first
      "(Revised 2565)", "(Revised 2560)",                      // CECS
      "(Revised 2568)", "(Revised 2563)",                      // CEI
      "No curriculum",
    ]);
    // the program chip's text runs straight into the label
    expect(heads[0]).toMatch(/^CEComputer/);
    expect(heads[3]).toMatch(/^CECSComputer/);
    expect(heads[5]).toMatch(/^CEIComputer/);
  });

  test("the same subject's sections sit together in one card, newest offering first", async ({ page }) => {
    await open(page);
    const prog = subjectCard(page, "Computer Programming").first();
    // CE 2569: three sections of the same term, in section order, one with no teacher
    const rows = prog.getByRole("button", { expanded: false });
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toHaveAccessibleName("Computer Programming · Sec 1 · 2569 · Term 1");
    await expect(rows.nth(1)).toHaveAccessibleName("Computer Programming · Sec 2 · 2569 · Term 1");
    await expect(rows.nth(2)).toHaveAccessibleName("Computer Programming · Sec 3 · 2569 · Term 1");
    await expect(prog.getByText("No teachers assigned")).toHaveCount(1);
    await expect(prog.getByText("3 sections")).toBeVisible();

    // Senior Project: this term above the archived earlier one, in a single card
    const senior = subjectCard(page, "Computer Engineering Senior Project");
    await expect(senior).toHaveCount(1);
    await expect(senior.getByRole("button", { expanded: false })).toHaveCount(2);
    const names = await senior.getByRole("button", { expanded: false }).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    expect(names).toEqual([
      "Computer Engineering Senior Project · Sec 1 · 2569 · Term 1",
      "Computer Engineering Senior Project · Sec 1 · 2568 · Term 1",
    ]);
    await expect(senior.getByText("Archived", { exact: true })).toHaveCount(1);
  });

  test("subjects with the same name in different curricula are not mixed up", async ({ page }) => {
    await open(page);
    // "UX/UI Design" is CECS 2565; "User Experience and User Interface Design" is CE 2569 and CEI 2568
    const cecs = page.getByRole("region", { name: /Cybersecurity \(Revised 2565\)/ });
    await expect(cecs.getByRole("region", { name: "UX/UI Design" })).toHaveCount(1);
    const ce = page.getByRole("region", { name: "Computer Engineering (Revised 2569)" });
    await expect(ce.getByRole("region", { name: "User Experience and User Interface Design" })).toHaveCount(1);
    await expect(ce.getByRole("region", { name: "UX/UI Design" })).toHaveCount(0);
    const cei = page.getByRole("region", { name: /International Program \(Revised 2568\)/ });
    await expect(cei.getByRole("region", { name: "User Experience and User Interface Design" })).toHaveCount(1);
  });

  test("courses with no curriculum are grouped at the end; hand-made ones stack by name", async ({ page }) => {
    await open(page);
    const none = page.getByRole("region", { name: "No curriculum", exact: true });
    await expect(none.getByRole("region", { name: "Special Topics: Generative AI for Software Engineering" }).getByText("2 sections")).toBeVisible();
    // no term info at all → still listed, just says so
    await expect(none.getByRole("region", { name: "Git & GitHub Workshop" }).getByText("No sec")).toBeVisible();
  });

  test("a curriculum can be collapsed and expanded, and 'Collapse all' does every one", async ({ page }) => {
    await open(page);
    const ce = page.getByRole("button", { name: /Computer Engineering \(Revised 2569\)/ });
    await expect(ce2569Db(page)).toHaveCount(1);
    await ce.click();
    await expect(ce).toHaveAttribute("aria-expanded", "false");
    await expect(ce2569Db(page)).toHaveCount(0);
    await ce.click();
    await expect(ce2569Db(page)).toHaveCount(1);

    await page.getByRole("button", { name: "Collapse all" }).click();
    await expect(ce2569Db(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Expand all" })).toBeVisible();
    await page.getByRole("button", { name: "Expand all" }).click();
    await expect(ce2569Db(page)).toHaveCount(1);
  });
});

test.describe("Admin Courses — filters", () => {
  test("program, curriculum, term and status each narrow the list, and the counts follow", async ({ page }) => {
    await open(page);
    const summary = page.getByText(/sections? ·/).first();
    await expect(summary).toHaveText("52 sections · 29 subjects · 8 curricula");

    await page.getByLabel("Filter by program").selectOption("CEI");
    await expect(summary).toHaveText("5 sections · 4 subjects · 2 curricula");
    // the curriculum list only offers CEI's versions now
    await expect(page.getByLabel("Filter by curriculum").locator("option")).toHaveText(["All curricula", "CEI · 2568", "CEI · 2563"]);
    await page.getByLabel("Filter by curriculum").selectOption({ label: "CEI · 2563" });
    await expect(summary).toHaveText("1 section · 1 subject · 1 curriculum");

    await page.getByRole("button", { name: "Clear filters" }).click();
    await page.getByLabel("Filter by status").selectOption("archived");
    await expect(summary).toHaveText("22 sections · 12 subjects · 4 curricula");
    await expect(page.getByText("Archived", { exact: true }).first()).toBeVisible();

    await page.getByLabel("Filter by status").selectOption("all");
    await page.getByLabel("Filter by term").selectOption({ label: "2569 · Term 3" });
    await expect(summary).toHaveText("1 section · 1 subject · 1 curriculum");
    await expect(subjectCard(page, "Database Systems")).toHaveCount(1);
  });

  test("a picked curriculum that the program filter hides falls back to 'all' instead of showing nothing", async ({ page }) => {
    await open(page);
    await page.getByLabel("Filter by curriculum").selectOption({ label: "CE · 2569" });
    await page.getByLabel("Filter by program").selectOption("CEI");
    await expect(page.getByLabel("Filter by curriculum")).toHaveValue("all");
    await expect(page.getByText("5 sections · 4 subjects · 2 curricula")).toBeVisible();
  });

  test("search matches subject name, code or teacher, keeps groups open, and says so when nothing matches", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Collapse all" }).click();
    const search = page.getByLabel("Search courses");

    await search.fill("Wanna");                         // a teacher
    await expect(subjectCard(page, "Database Systems")).toHaveCount(0);
    await expect(subjectCard(page, "Software Engineering")).toHaveCount(1); // groups open again while filtering
    await expect(page.getByRole("button", { name: "Collapse all" })).toHaveCount(0);

    await search.fill("01076321");                      // a code
    await expect(page.getByText("4 sections · 2 subjects · 2 curricula")).toBeVisible();
    await expect(subjectCard(page, "Database Systems")).toHaveCount(2);      // this term's (CE 2569) and the earlier terms in CE 2564

    await search.fill("zzz nothing");
    await expect(page.getByText("No courses match these filters")).toBeVisible();
    await page.getByRole("main").getByRole("button", { name: "Clear filters" }).last().click();
    await expect(page.getByText("52 sections · 29 subjects · 8 curricula")).toBeVisible();
  });
});

test.describe("Admin Courses — no schedule / room, Add Section per subject", () => {
  test("schedule and room appear neither on a row nor in the edit popup", async ({ page }) => {
    await open(page);
    await expect(page.getByText("Mon 9:00-12:00")).toHaveCount(0);
    await expect(page.getByText(/Room \d+/)).toHaveCount(0);
    await subjectCard(page, "Computer Programming").first().getByRole("button", { name: "Edit course" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Schedule|Room/)).toHaveCount(0);
  });

  test("+ Section sits on the subject, copies its newest open offering, and is absent when everything is archived", async ({ page }) => {
    await open(page);
    // Computer Networks (CE 2559) has only an archived section → nothing to copy
    await expect(subjectCard(page, "Computer Networks").getByRole("button", { name: "Add Section" })).toHaveCount(0);
    await expect(subjectCard(page, "Database Systems").getByRole("button", { name: "Add Section" })).toHaveCount(1);

    await subjectCard(page, "Computer Engineering Senior Project").getByRole("button", { name: "Add Section" }).click();
    const dialog = page.getByRole("dialog", { name: "Add Section" });
    await expect(dialog.getByText('Adding sections to "Computer Engineering Senior Project"')).toBeVisible();
    await expect(dialog.getByLabel("Primary Teacher")).toHaveValue("");
  });

  test("Thai UI", async ({ page }) => {
    await open(page, "th");
    await expect(page.getByLabel("กรองตามหลักสูตร")).toBeVisible();
    await expect(page.getByRole("button", { name: "ย่อทั้งหมด" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "ไม่ผูกหลักสูตร" })).toBeVisible();
  });
});

// 26/9/2569 — the system has no TAs yet, and admin never assigns them: only teacher accounts are offered.
test.describe("Admin Courses — teachers only, no TA", () => {
  const TEACHERS = [
    { id: "t-john", name: "John Smith", email: "john@kmitl.ac.th", role: "teacher", status: "active", courseIds: [] },
    { id: "t-ta", name: "Alice Johnson", email: "alice@kmitl.ac.th", role: "ta", status: "active", courseIds: [] },
  ];
  const COURSE = { id: "c-x", name: "Web Design", description: "", status: "active", source: "manual", coverColor: "#0F766E", iconColor: "#0F766E", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };

  async function seed(page: Page, teachers: unknown[]) {
    await page.addInitScript((d) => {
      localStorage.setItem("hwai_lang", "en");
      localStorage.setItem("hwai_user", JSON.stringify({ name: "Admin", email: "admin@kmitl.ac.th", role: "admin" }));
      localStorage.setItem("hwai_courses_v2", JSON.stringify([d.course]));
      localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify(d.teachers));
    }, { course: COURSE, teachers });
    await page.goto(`${BASE}/admin/courses`);
    await page.waitForLoadState("networkidle");
  }

  test("the assign panel lists teachers, not TA accounts", async ({ page }) => {
    await seed(page, TEACHERS);
    await page.getByRole("button", { name: /Web Design/ }).click();
    await expect(page.getByRole("checkbox", { name: /John Smith/ })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Alice Johnson/ })).toHaveCount(0);
  });

  test("a TA already on the course (older data) stays listed so it can be removed", async ({ page }) => {
    await seed(page, [TEACHERS[0], { ...TEACHERS[1], courseIds: ["c-x"] }]);
    await page.getByRole("button", { name: /Web Design/ }).click();
    const box = page.getByRole("checkbox", { name: /Alice Johnson/ });
    await expect(box).toBeChecked();
    await box.click();
    // once removed it is not offered again
    await expect(box).toHaveCount(0);
  });

  test("New Course's Primary Teacher autocomplete does not offer a TA", async ({ page }) => {
    await seed(page, TEACHERS);
    await page.getByRole("button", { name: "New Course" }).first().click();
    const dialog = page.getByRole("dialog", { name: "New Course" });
    await dialog.getByLabel("Primary Teacher").fill("Alice");
    await expect(dialog.getByRole("option", { name: "Alice Johnson" })).toHaveCount(0);
    await dialog.getByLabel("Primary Teacher").fill("John");
    await expect(dialog.getByRole("option", { name: "John Smith" })).toBeVisible();
  });

  test("the mock teachers have no TA", async () => {
    for (const f of ["teachers-mockup.json", "teachers-mockup-en.json"]) {
      expect(rd(f).filter((t: { role: string }) => t.role !== "teacher")).toEqual([]);
    }
  });
});

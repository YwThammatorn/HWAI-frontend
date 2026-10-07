import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import { sectionProgramOf, programFits, outOfProgram } from "../src/lib/sectionProgram";

const BASE = "http://localhost:3000";
const rd = (f: string) => JSON.parse(fs.readFileSync(`public/mock-data/${f}`, "utf8"));

// 4/10/2569 — one section = one program (หลักสูตร CE / CECS / CEI). A section never mixes students from several
// programs: adding by ID and the CSV import both refuse a student from another program, and a roster that already
// holds a mix (older data) says so. The program comes from the curriculum the section's subject belongs to; a section
// with no curriculum takes the program of whoever was enrolled first.

test.describe("the mock data keeps every section to one program", () => {
  for (const sfx of ["", "-en"]) {
    test(`every enrolled student is in the program of their section's curriculum (${sfx ? "English" : "Thai"} files)`, () => {
      const cur = rd(`curriculum-mockup${sfx}.json`);
      const courses = rd(`courses-mockup${sfx}.json`) as { id: string; courseTemplateId?: string }[];
      const flow = rd(`student-flow-mockup${sfx}.json`);
      const hist = rd(`student-history-mockup${sfx}.json`);
      const cohort = new Map<string, string>();
      for (const s of rd(`students-mockup${sfx}.json`) as { studentId: string; program: string }[]) cohort.set(s.studentId, s.program);
      for (const s of flow.cohortStudents as { studentId: string; program: string }[]) expect(cohort.get(s.studentId), s.studentId).toBe(s.program);
      const programOf = (courseId: string) => {
        const tpl = cur.courseTemplates.find((x: { id: string }) => x.id === courses.find((c) => c.id === courseId)?.courseTemplateId);
        return cur.curriculumVersions.find((v: { id: string }) => v.id === tpl?.curriculumVersionId)?.program as string | undefined;
      };
      const uxui = rd(`student-uxui-mockup${sfx}.json`);   // the UX/UI class (c-mock-4) has its own file
      const roster = [...flow.courseStudents, ...hist.courseStudents, ...uxui.courseStudents] as { courseId: string; studentId: string }[];
      expect(roster.length).toBeGreaterThan(60);
      for (const r of roster) {
        const sectionProgram = programOf(r.courseId);
        expect(sectionProgram, `${r.courseId} has a curriculum`).toBeDefined();
        expect(cohort.get(r.studentId), `${r.studentId} in ${r.courseId}`).toBe(sectionProgram);
      }
    });
  }
});

test.describe("sectionProgram lib", () => {
  const versions = [{ id: "v-ce", program: "CE", label: "CE", effectiveFrom: 2569 }, { id: "v-cei", program: "CEI", label: "CEI", effectiveFrom: 2568 }] as never;
  const templates = [{ id: "t-ce", curriculumVersionId: "v-ce", code: "1", name: "A" }, { id: "t-gone", curriculumVersionId: "v-missing", code: "2", name: "B" }] as never;
  const progs: Record<string, string> = { a: "CECS", b: "CE" };
  const prog = (id: string) => progs[id];

  test("the curriculum decides, even when the roster disagrees", () => {
    expect(sectionProgramOf({ courseTemplateId: "t-ce" }, templates, versions, [{ studentId: "a" }], prog)).toEqual({ program: "CE", source: "curriculum" });
  });
  test("no curriculum (or a dangling one) → the first student still enrolled pins it; withdrawn ones don't count", () => {
    const roster = [{ studentId: "a", enrollmentStatus: "withdrawn" as const }, { studentId: "b" }];
    expect(sectionProgramOf(undefined, templates, versions, roster, prog)).toEqual({ program: "CE", source: "roster" });
    expect(sectionProgramOf({ courseTemplateId: "t-gone" }, templates, versions, roster, prog)).toEqual({ program: "CE", source: "roster" });
  });
  test("nothing pins it down yet → null, and anyone fits", () => {
    expect(sectionProgramOf(undefined, templates, versions, [], prog)).toBeNull();
    expect(programFits("CEI", null)).toBe(true);
  });
  test("programFits / outOfProgram", () => {
    const ce = { program: "CE", source: "curriculum" as const };
    expect(programFits("CE", ce)).toBe(true);
    expect(programFits("CECS", ce)).toBe(false);
    expect(programFits(undefined, ce)).toBe(true);     // a record with no program can't be judged
    expect(outOfProgram([{ studentId: "a" }, { studentId: "b" }], ce, prog).map((s) => s.studentId)).toEqual(["a"]);
    expect(outOfProgram([{ studentId: "a" }], null, prog)).toEqual([]);
  });
});

// ---- the screens ----
const NOW = "2026-01-01T00:00:00.000Z";
const PEOPLE = [["69071001", "Ann", "CE"], ["69071002", "Bea", "CE"], ["69071003", "Cam", "CECS"], ["69071004", "Dee", "CEI"]];

async function seed(page: Page, o: { roster?: string[]; lang?: "en" | "th" } = {}) {
  await page.addInitScript(([people, roster, lang]) => {
    const NOW = "2026-01-01T00:00:00.000Z";
    const ppl = people as string[][];
    localStorage.setItem("hwai_lang", lang as string);
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    const course = (id: string, name: string, extra: object) => ({ id, name, description: "", status: "active", source: "manual", coverColor: "#0F766E", iconColor: "#0F766E", academicYear: 2569, term: 1, sectionNumber: "1", code: id, createdAt: NOW, updatedAt: NOW, ...extra });
    localStorage.setItem("hwai_courses_v2", JSON.stringify([course("c-ce", "CE Section", { courseTemplateId: "t-ce" }), course("c-free", "Unlinked Section", {})]));
    localStorage.setItem("hwai_curriculum_versions_v1", JSON.stringify([{ id: "v-ce", program: "CE", label: "CE 2569", effectiveFrom: 2569 }]));
    localStorage.setItem("hwai_course_templates_v1", JSON.stringify([{ id: "t-ce", curriculumVersionId: "v-ce", code: "01", name: "CE Subject" }]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([{ id: "t1", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-ce", "c-free"] }]));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(ppl.map(([id, f, program], i) => ({ id: `cs-${i}`, studentId: id, firstName: f, lastName: "Test", email: `${id}@kmitl.ac.th`, program, status: "active" }))));
    localStorage.setItem("hwai_students_v1", JSON.stringify((roster as string[]).map((id, i) => {
      const [, f] = ppl.find((p) => p[0] === id)!;
      return { id: `r-${i}`, courseId: "c-ce", studentId: id, firstName: f, lastName: "Test", email: `${id}@kmitl.ac.th`, sequenceNumber: i + 1, enrollmentStatus: "enrolled" };
    })));
    localStorage.setItem("hwai_grading_categories_v1", "[]");
    localStorage.setItem("hwai_assignments_v1", "[]");
    localStorage.setItem("hwai_rubrics_v1", "[]");
    localStorage.setItem("hwai_submissions_v1", "[]");
  }, [PEOPLE, o.roster ?? [], o.lang ?? "en"] as const);
}
const roster = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("hwai_students_v1") ?? "[]").map((s: { courseId: string; studentId: string }) => `${s.courseId}:${s.studentId}`));

test.describe("Add Student by ID", () => {
  test("a CECS student can't join a CE section: the reason is shown at once, the button is off, nothing is added", async ({ page }) => {
    await seed(page);
    await page.goto(`${BASE}/teacher/courses/c-ce/students`);
    await page.getByRole("button", { name: "Add Student" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Student ID/).fill("69071003");
    await expect(dialog.getByRole("alert")).toContainText("Cam Test is in CECS, but this section is for CE");
    await expect(dialog.getByRole("alert")).toContainText("only takes students from one program");
    await expect(dialog.getByRole("button", { name: "Add Student" })).toBeDisabled();
    expect(await roster(page)).toEqual([]);
  });

  test("a CE student joins fine", async ({ page }) => {
    await seed(page);
    await page.goto(`${BASE}/teacher/courses/c-ce/students`);
    await page.getByRole("button", { name: "Add Student" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Student ID/).fill("69071001");
    await expect(dialog.getByRole("button", { name: "Add Student" })).toBeEnabled();
    await dialog.getByRole("button", { name: "Add Student" }).click();
    await expect(dialog.getByRole("status")).toContainText("Ann Test was added");
    expect(await roster(page)).toEqual(["c-ce:69071001"]);
  });

  test("Thai UI says it in Thai", async ({ page }) => {
    await seed(page, { lang: "th" });
    await page.goto(`${BASE}/teacher/courses/c-ce/students`);
    await page.getByRole("button", { name: "เพิ่มนักศึกษา" }).first().click();
    await page.getByRole("dialog").getByLabel(/รหัสนักศึกษา/).fill("69071004");
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText("อยู่หลักสูตร CEI แต่ section นี้เป็นของหลักสูตร CE");
  });
});

test.describe("Import CSV", () => {
  test("rows from another program are skipped with the reason; only the matching ones are imported", async ({ page }) => {
    await seed(page);
    await page.goto(`${BASE}/teacher/courses/c-ce/students`);
    await page.getByRole("button", { name: "Import CSV" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("This section is for CE");
    const csv = "student_id,first_name,last_name,email\n69071001,Ann,Test,\n69071003,Cam,Test,\n69071002,Bea,Test,\n69071004,Dee,Test,\n";
    await dialog.locator("input[type=file]").setInputFiles({ name: "s.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await expect(dialog.getByText("Different program from this section (CECS)")).toBeVisible();
    await expect(dialog.getByText("Different program from this section (CEI)")).toBeVisible();
    await expect(dialog).toContainText("2 ready to import");
    await expect(dialog).toContainText("2 with errors");
    await dialog.getByRole("button", { name: "Import 2 Students" }).click();
    await expect(dialog.getByRole("status")).toContainText("Import Complete");
    expect((await roster(page)).sort()).toEqual(["c-ce:69071001", "c-ce:69071002"]);
  });
});

test.describe("a section with no curriculum", () => {
  test("the first student enrolled pins its program; a different one is then refused", async ({ page }) => {
    await seed(page);
    await page.goto(`${BASE}/teacher/courses/c-free/students`);
    for (const [id, ok] of [["69071003", true], ["69071001", false]] as const) {
      await page.getByRole("button", { name: "Add Student" }).first().click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel(/Student ID/).fill(id);
      if (ok) {
        await dialog.getByRole("button", { name: "Add Student" }).click();
        await dialog.getByRole("button", { name: "Done" }).click();
      } else {
        await expect(dialog.getByRole("alert")).toContainText("Ann Test is in CE, but this section is for CECS");
        await expect(dialog.getByRole("button", { name: "Add Student" })).toBeDisabled();
        await dialog.getByRole("button", { name: "Cancel" }).click();
      }
    }
    expect(await roster(page)).toEqual(["c-free:69071003"]);
    await expect(page.getByText("Program CECS")).toBeVisible();
  });

  test("one CSV can't smuggle in a mix either: the first row pins the program", async ({ page }) => {
    await seed(page);
    await page.goto(`${BASE}/teacher/courses/c-free/students`);
    await page.getByRole("button", { name: "Import CSV" }).first().click();
    const dialog = page.getByRole("dialog");
    const csv = "student_id,first_name,last_name,email\n69071004,Dee,Test,\n69071001,Ann,Test,\n69071003,Cam,Test,\n";
    await dialog.locator("input[type=file]").setInputFiles({ name: "s.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await expect(dialog).toContainText("1 ready to import");        // Dee (CEI) pinned it; Ann (CE) and Cam (CECS) are out
    await expect(dialog.getByText("Different program from this section (CE)")).toBeVisible();
    await expect(dialog.getByText("Different program from this section (CECS)")).toBeVisible();
  });
});

test.describe("Roster page", () => {
  test("shows which program the section is for", async ({ page }) => {
    await seed(page, { roster: ["69071001"] });
    await page.goto(`${BASE}/teacher/courses/c-ce/students`);
    await expect(page.getByText("Program CE")).toBeVisible();
    await expect(page.getByTestId("program-mismatch")).toHaveCount(0);
  });

  test("a roster that already holds a mix (older data) is flagged, with the odd ones tagged", async ({ page }) => {
    await seed(page, { roster: ["69071001", "69071003", "69071004"] });
    await page.goto(`${BASE}/teacher/courses/c-ce/students`);
    await expect(page.getByTestId("program-mismatch")).toContainText("2 students on this roster are not in CE");
    await expect(page.getByTestId("program-mismatch")).toContainText("a section only takes students from one program");
    await expect(page.getByRole("row", { name: /69071003/ })).toContainText("Not CE");
    await expect(page.getByRole("row", { name: /69071004/ })).toContainText("Not CE");
    await expect(page.getByRole("row", { name: /69071001/ })).not.toContainText("Not CE");
  });

  test("removing the odd student clears the warning", async ({ page }) => {
    await seed(page, { roster: ["69071001", "69071003"] });
    await page.goto(`${BASE}/teacher/courses/c-ce/students`);
    await expect(page.getByTestId("program-mismatch")).toContainText("1 student on this roster is not in CE");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /Remove Cam Test from the course/ }).click();
    await expect(page.getByTestId("program-mismatch")).toHaveCount(0);
  });
});

// The browser the teacher actually has: c-mock-1 loaded earlier with students from three programs. Running the
// documented [15] command must leave a clean, single-program roster — not just correct files.
test("from a stale browser that still holds the mixed roster, running [15] leaves c-mock-1 with one program and no warning", async ({ page }) => {
  const doc = fs.readFileSync("test-data/seed-commands.txt", "utf8");
  const command = doc.slice(doc.indexOf("\n[15] ห้อง"), doc.indexOf("\n[16] วิชา UX/UI")).split("\n").filter((l) => l.startsWith("fetch("))[0];
  const flow = rd("student-flow-mockup.json");
  const ids = new Set(flow.courseStudents.map((r: { studentId: string }) => r.studentId));
  let n = 0;
  const stale = (rd("students-mockup.json") as { studentId: string; program: string }[]).map((s) => (ids.has(s.studentId) && n++ % 3 ? { ...s, program: n % 2 ? "CECS" : "CEI" } : s));
  expect(new Set(stale.filter((s) => ids.has(s.studentId)).map((s) => s.program)).size).toBe(3);   // really mixed before
  await page.goto(`${BASE}/login`);
  await page.evaluate(([courses, teachers, curriculum, staleCohort, staleRoster]) => {
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_courses_v2", JSON.stringify(courses));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify(teachers));
    localStorage.setItem("hwai_curriculum_versions_v1", JSON.stringify(curriculum.curriculumVersions));
    localStorage.setItem("hwai_course_templates_v1", JSON.stringify(curriculum.courseTemplates));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(staleCohort));
    localStorage.setItem("hwai_students_v1", JSON.stringify(staleRoster));
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak.c@kmitl.ac.th", role: "teacher" }));
  }, [rd("courses-mockup.json"), rd("teachers-mockup.json"), rd("curriculum-mockup.json"), stale, flow.courseStudents] as const);
  await page.goto(`${BASE}/teacher/courses/c-mock-1/students`);
  await expect(page.getByTestId("program-mismatch")).toContainText("not in CE");       // the stale state IS flagged
  const reloaded = page.waitForEvent("load");
  await page.evaluate((c) => { (0, eval)(c); }, command);
  await reloaded;
  await page.goto(`${BASE}/teacher/courses/c-mock-1/students`);
  await expect(page.getByText("42 students")).toBeVisible();
  await expect(page.getByText("Program CE", { exact: true })).toBeVisible();
  await expect(page.getByTestId("program-mismatch")).toHaveCount(0);
  await expect(page.getByText(/^Not CE$/)).toHaveCount(0);
});

// The documented [7] demo: tests/course-import-test.csv imported into c-mock-1 (a CE section) from the [5] cohort.
test("[7] course-import-test.csv into c-mock-1: the 6 CE rows are ready, the 4 CECS/CEI rows are skipped, plus the duplicate and the unknown ID", async ({ page }) => {
  const flow = rd("student-flow-mockup.json");
  await page.addInitScript(([courses, teachers, curriculum, cohort, roster]) => {
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_courses_v2", JSON.stringify(courses));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify(teachers));
    localStorage.setItem("hwai_curriculum_versions_v1", JSON.stringify(curriculum.curriculumVersions));
    localStorage.setItem("hwai_course_templates_v1", JSON.stringify(curriculum.courseTemplates));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(cohort));
    localStorage.setItem("hwai_students_v1", JSON.stringify(roster));
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak.c@kmitl.ac.th", role: "teacher" }));
  }, [rd("courses-mockup.json"), rd("teachers-mockup.json"), rd("curriculum-mockup.json"), flow.cohortStudents.slice(0, 13), flow.courseStudents.slice(0, 3)] as const);
  await page.goto(`${BASE}/teacher/courses/c-mock-1/students`);
  await page.getByRole("button", { name: "Import CSV" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("input[type=file]").setInputFiles("test-data/course-import-test.csv");
  await expect(dialog).toContainText("6 ready to import");
  await expect(dialog).toContainText("6 with errors");
  await expect(dialog.getByText("Different program from this section (CECS)")).toHaveCount(2);
  await expect(dialog.getByText("Different program from this section (CEI)")).toHaveCount(2);
  await expect(dialog.getByText("Already enrolled")).toHaveCount(1);
  await expect(dialog.getByText("Not found in system")).toHaveCount(1);
});

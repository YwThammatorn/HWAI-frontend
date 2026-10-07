import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import { parseExamScoreCsv, parseCsvText, scoreCsvTemplate } from "../src/lib/examScoreCsv";

const BASE = "http://localhost:3000";

// 4/10/2569 — the exam score page can be filled from a CSV: each student ID in the file is matched against the
// course roster, the matching rows fill the score boxes (nothing is saved until "Save scores"), and everything that
// can't be used is listed with the reason.
//
// Seed: an exam out of 50. Roster — Ann (saved 30), Ben, Cat, Dan, Fay, Gus (no scores), Eve (withdrawn).

const NOW = "2026-01-01T00:00:00.000Z";
const PEOPLE = [["69072001", "Ann"], ["69072002", "Ben"], ["69072003", "Cat"], ["69072004", "Dan"], ["69072005", "Eve"], ["69072006", "Fay"], ["69072007", "Gus"]];

async function seed(page: Page, o: { finalized?: boolean; lang?: "en" | "th" } = {}) {
  await page.addInitScript(([people, finalized, lang]) => {
    const NOW = "2026-01-01T00:00:00.000Z";
    const ppl = people as string[][];
    localStorage.setItem("hwai_lang", lang as string);
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([{ id: "c-ci", name: "CSV Import Course", description: "", status: "active", source: "manual", coverColor: "#0F766E", iconColor: "#0F766E", sectionNumber: "1", code: "01076333", academicYear: 2569, term: 1, createdAt: NOW, updatedAt: NOW }]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([{ id: "t1", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-ci"] }]));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(ppl.map(([id, f], i) => ({ id: `cs-${i}`, studentId: id, firstName: f, lastName: "Test", email: `${id}@kmitl.ac.th`, program: "CE", status: "active" }))));
    localStorage.setItem("hwai_students_v1", JSON.stringify(ppl.map(([id, f], i) => ({ id: `r-${i}`, courseId: "c-ci", studentId: id, firstName: f, lastName: "Test", email: `${id}@kmitl.ac.th`, sequenceNumber: i + 1, enrollmentStatus: id === "69072005" ? "withdrawn" : "enrolled" }))));
    localStorage.setItem("hwai_grading_categories_v1", "[]");
    localStorage.setItem("hwai_rubrics_v1", "[]");
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([{ id: "ex1", courseId: "c-ci", name: "Midterm", description: "", maxPoints: 50, acceptsFiles: false, fileTypes: [], submissionType: "individual", maxGroupSize: null, rubricIds: [], isExam: true, gradingFinalized: finalized || undefined, createdAt: NOW, updatedAt: NOW }]));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify([{ id: "s-ann", assignmentId: "ex1", studentId: "69072001", studentName: "Ann Test", email: "69072001@kmitl.ac.th", submittedAt: NOW, fileUrl: null, aiScore: null, instructorScore: 30, instructorComment: "", externalUseConsent: false, status: "graded", updatedAt: NOW }]));
  }, [PEOPLE, !!o.finalized, o.lang ?? "en"] as const);
  await page.goto(`${BASE}/teacher/courses/c-ci/assignments/ex1/grading`);
  await page.waitForLoadState("networkidle");
}

const box = (page: Page, name: string) => page.getByLabel(`Score for ${name} Test`);
async function openImport(page: Page) {
  await page.getByRole("button", { name: "Import CSV" }).click();
  return page.getByRole("dialog", { name: "Import exam scores from CSV" });
}
const upload = (dialog: ReturnType<Page["getByRole"]>, content: string, name = "scores.csv") =>
  dialog.locator("input[type=file]").setInputFiles({ name, mimeType: "text/csv", buffer: Buffer.from(content, "utf8") });
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("hwai_submissions_v1") ?? "[]").map((s: { studentId: string; instructorScore: number | null; status: string }) => [s.studentId, s.instructorScore, s.status]));

const CSV = [
  "student_id,name,score",
  "69072001,Ann,42",          // enrolled, had 30 → replaces
  "69072002,Ben,38.5",        // enrolled, none → new
  "69072003,Cat,",            // blank → skipped
  "69072004,Dan,55",          // above 50
  "69072005,Eve,40",          // withdrawn
  "69079999,Zed,40",          // not enrolled
  "69072002,Ben,10",          // repeated
  "69072006,Fay,abc",         // not a number
].join("\n");

test.describe("Import exam scores from CSV", () => {
  test("the preview matches each row against the roster and says what will happen — and why anything is skipped", async ({ page }) => {
    await seed(page);
    const dialog = await openImport(page);
    await upload(dialog, CSV);
    await expect(dialog.getByRole("status")).toContainText("2 ready to fill");
    await expect(dialog.getByRole("status")).toContainText("1 replace an existing score");
    await expect(dialog.getByRole("status")).toContainText("1 skipped");
    await expect(dialog.getByRole("status")).toContainText("5 with errors");
    const status = async (id: string, nth = 0) => (await dialog.locator("tr[data-status]").filter({ hasText: id }).nth(nth).locator("td").last().innerText()).trim();
    expect(await status("69072001")).toBe("Replaces 30");
    expect(await status("69072002")).toBe("Will fill");
    expect(await status("69072003")).toBe("No score — skipped");
    expect(await status("69072004")).toBe("Score must be a number from 0 to 50");
    expect(await status("69072005")).toBe("Withdrawn from this course");
    expect(await status("69079999")).toBe("Not enrolled in this course");
    expect(await status("69072002", 1)).toBe("ID repeated in the file (first row used)");
    expect(await status("69072006")).toBe("Score must be a number from 0 to 50");
    await expect(dialog.getByText("Ann Test")).toBeVisible();   // the roster's name for the matched row
    await expect(dialog).toContainText("1 other student on this course isn't in the file");   // Gus
    await expect(dialog.getByRole("button", { name: "Fill 2 scores" })).toBeEnabled();
  });

  test("Fill puts the scores in the boxes (highlighted, unsaved); Save keeps them; the rest is untouched", async ({ page }) => {
    await seed(page);
    const dialog = await openImport(page);
    await upload(dialog, CSV);
    await dialog.getByRole("button", { name: "Fill 2 scores" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(box(page, "Ann")).toHaveValue("42");
    await expect(box(page, "Ben")).toHaveValue("38.5");
    await expect(box(page, "Cat")).toHaveValue("");
    await expect(box(page, "Dan")).toHaveValue("");
    await expect(page.getByTestId("import-note")).toContainText("2 scores filled from the CSV");
    expect(await saved(page)).toEqual([["69072001", 30, "graded"]]);        // nothing written yet
    await page.getByRole("button", { name: "Save scores" }).click();
    await expect(page.getByTestId("import-note")).toHaveCount(0);
    await expect.poll(() => saved(page)).toEqual(expect.arrayContaining([["69072001", 42, "graded"], ["69072002", 38.5, "graded"]]));
    expect((await saved(page)).length).toBe(2);
  });

  test("editing an imported box takes its highlight; Cancel fills nothing", async ({ page }) => {
    await seed(page);
    let dialog = await openImport(page);
    await upload(dialog, "student_id,score\n69072002,40\n69072006,35");
    await dialog.getByRole("button", { name: "Fill 2 scores" }).click();
    await expect(page.getByTestId("import-note")).toContainText("2 scores filled");
    await box(page, "Ben").fill("41");
    await expect(page.getByTestId("import-note")).toContainText("1 score filled");
    dialog = await openImport(page);
    await upload(dialog, "student_id,score\n69072007,12");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(box(page, "Gus")).toHaveValue("");
  });

  test("other file shapes: Thai headings with tabs and a BOM, no header, id+name+score without a header, semicolons with a decimal comma", async ({ page }) => {
    await seed(page);
    let dialog = await openImport(page);
    await upload(dialog, "﻿รหัสนักศึกษา\tชื่อ\tคะแนน\r\n69072002\tเบน\t44\r\n69072006\tเฟย์\t31\r\n");
    await expect(dialog.getByRole("status")).toContainText("2 ready to fill");
    await dialog.getByRole("button", { name: "Choose another file" }).click();
    await upload(dialog, "69072002,41\n69072006,29\n");
    await expect(dialog.getByRole("status")).toContainText("2 ready to fill");
    await dialog.getByRole("button", { name: "Choose another file" }).click();
    await upload(dialog, "69072002,Ben Test,36\n69072006,Fay Test,27\n");
    await expect(dialog.getByRole("status")).toContainText("2 ready to fill");
    await dialog.getByRole("button", { name: "Choose another file" }).click();
    await upload(dialog, "student_id;score\n69072002;38,5\n");
    await dialog.getByRole("button", { name: "Fill 1 score" }).click();
    await expect(box(page, "Ben")).toHaveValue("38.5");
    dialog = await openImport(page);
    await expect(dialog).toBeVisible();
  });

  test("the roster download is a CSV of the enrolled students with an empty score column — and uploading it back changes nothing", async ({ page }) => {
    await seed(page);
    const dialog = await openImport(page);
    const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Download" }).click()]);
    const text = fs.readFileSync((await download.path())!, "utf8");
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const lines = text.replace(/^﻿/, "").trim().split(/\r?\n/);
    expect(lines[0]).toBe("student_id,name,score");
    expect(lines).toHaveLength(1 + 6);                     // Eve (withdrawn) is not on it
    expect(lines).toContain("69072002,Ben Test,");
    expect(text).not.toContain("69072005");
    await upload(dialog, text);
    await expect(dialog.getByRole("status")).toContainText("0 ready to fill");
    await expect(dialog.getByRole("status")).toContainText("6 skipped");
    await expect(dialog.getByRole("button", { name: "Fill 0 scores" })).toBeDisabled();
  });

  test("there is no import once grading is finished, or on the withdrawn tab", async ({ page }) => {
    await seed(page, { finalized: true });
    await expect(page.getByRole("button", { name: "Import CSV" })).toHaveCount(0);
    await expect(page.getByText("Grading is finished")).toBeVisible();
  });

  test("Thai UI", async ({ page }) => {
    await seed(page, { lang: "th" });
    await page.getByRole("button", { name: "นำเข้าด้วย CSV" }).click();
    const dialog = page.getByRole("dialog", { name: "นำเข้าคะแนนสอบจาก CSV" });
    await upload(dialog, CSV);
    await expect(dialog.getByRole("status")).toContainText("2 พร้อมกรอก");
    await expect(dialog.getByRole("status")).toContainText("5 มีข้อผิดพลาด");
    await expect(dialog.getByText("ไม่ได้ลงทะเบียนในวิชานี้")).toBeVisible();
    await expect(dialog.getByText("ถอนจากวิชาแล้ว")).toBeVisible();
    await dialog.getByRole("button", { name: "กรอก 2 คะแนน" }).click();
    await expect(page.getByTestId("import-note")).toContainText("กรอกคะแนนจาก CSV แล้ว 2 คน");
  });
});

test.describe("examScoreCsv lib", () => {
  const ctx = (cur: Record<string, string> = {}) => ({ maxPoints: 50, enrolled: new Map([["1", "A"], ["2", "B"], ["3", "C"]]), withdrawn: new Set(["9"]), current: (id: string) => cur[id] ?? "" });
  test("quotes, commas inside cells, CRLF, BOM and the three delimiters", () => {
    expect(parseCsvText('﻿id,name,score\r\n1,"Smith, Ann",42\r\n').rows).toEqual([["id", "name", "score"], ["1", "Smith, Ann", "42"]]);
    expect(parseCsvText("a;b\n1;2").delimiter).toBe(";");
    expect(parseCsvText("a\tb\n1\t2").delimiter).toBe("\t");
    expect(parseCsvText('1,"say ""hi""",3').rows).toEqual([["1", 'say "hi"', "3"]]);
  });
  test("the range is 0…max inclusive; decimals are fine; 'same' and 'overwrite' compare with what the table holds", () => {
    const r = parseExamScoreCsv("id,score\n1,0\n2,50\n3,50.5\n1,5\n", ctx({ "2": "50" })).rows;
    expect(r.map((x) => x.status)).toEqual(["new", "same", "bad_score", "duplicate"]);
    expect(parseExamScoreCsv("1,-1\n2,12.25\n", ctx({ "2": "10" })).rows.map((x) => x.status)).toEqual(["bad_score", "overwrite"]);
    expect(parseExamScoreCsv("1, 4 2 ,\n", ctx()).rows[0].studentId).toBe("1");
  });
  test("a header is recognised by its words, not its position; an ID that looks like data is never taken for a header", () => {
    expect(parseExamScoreCsv("score,student_id\n40,1\n", ctx()).rows[0]).toMatchObject({ studentId: "1", score: 40, status: "new" });
    expect(parseExamScoreCsv("69070101,40\n", { ...ctx(), enrolled: new Map([["69070101", "A"]]) }).hasHeader).toBe(false);
    expect(parseExamScoreCsv("", ctx()).rows).toEqual([]);
  });
  test("the roster template is UTF-8 with a BOM and quotes names that need it", () => {
    const csv = scoreCsvTemplate([{ studentId: "1", firstName: "Ann", lastName: "Lee" }, { studentId: "2", firstName: 'A"B', lastName: "C,D" }], { id: "student_id", name: "name", score: "score" });
    expect(csv).toBe('﻿student_id,name,score\r\n1,Ann Lee,\r\n2,"A""B C,D",\r\n');
  });
});

// The two sample files in test-data/ — for trying the import on c-mock-1's final exam (a-mock-9, out of 100, 42 students).
test.describe("sample files for c-mock-1's final exam", () => {
  const rd = (f: string) => JSON.parse(fs.readFileSync(`public/mock-data/${f}`, "utf8"));
  const flow = rd("student-flow-mockup.json");
  const enrolled = new Map<string, string>(flow.courseStudents.map((r: { studentId: string; firstName: string; lastName: string }) => [r.studentId, `${r.firstName} ${r.lastName}`]));
  const parse = (file: string) => parseExamScoreCsv(fs.readFileSync(`test-data/${file}`, "utf8"), { maxPoints: 100, enrolled, withdrawn: new Set(), current: () => "" });
  const count = (rows: { status: string }[]) => rows.reduce<Record<string, number>>((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {});

  test("the clean file has all 42 students, every score valid, and the spread of a real class", () => {
    const { rows, hasHeader } = parse("exam-scores-final-c-mock-1.csv");
    expect(hasHeader).toBe(true);
    expect(count(rows)).toEqual({ new: 42 });
    expect(new Set(rows.map((r) => r.studentId))).toEqual(new Set(enrolled.keys()));
    const sc = rows.map((r) => r.score!);
    const mean = sc.reduce((a, b) => a + b, 0) / sc.length;
    expect(mean).toBeGreaterThan(58); expect(mean).toBeLessThan(72);
    expect(Math.max(...sc)).toBeLessThan(100); expect(Math.min(...sc)).toBeGreaterThan(25);
  });

  test("the file with problems has each kind once: 36 ready, 1 blank skipped, 4 errors, 3 students left out", () => {
    const { rows } = parse("exam-scores-final-c-mock-1-with-errors.csv");
    expect(count(rows)).toEqual({ new: 36, empty: 1, bad_score: 2, not_enrolled: 1, duplicate: 1 });
    expect(rows.find((r) => r.rawId === "69070205")!.status).toBe("bad_score");     // 105
    expect(rows.find((r) => r.rawScore === "ขาดสอบ")!.status).toBe("bad_score");
    expect(rows.find((r) => r.rawId === "69079999")!.status).toBe("not_enrolled");
    expect(rows.filter((r) => r.studentId === "69070201").map((r) => r.status)).toEqual(["new", "duplicate"]);
    expect(rows.find((r) => r.studentId === "69070220")!.score).not.toBeNull();     // stray spaces are fine
    expect([...enrolled.keys()].filter((id) => !rows.some((r) => r.studentId === id))).toHaveLength(3);
  });

  test("in the app: the clean file fills all 42 boxes of the final exam, and Save keeps them", async ({ page }) => {
    await page.addInitScript(([courses, teachers, cohort, f]) => {
      localStorage.setItem("hwai_lang", "th");
      localStorage.setItem("hwai_courses_v2", JSON.stringify(courses));
      localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify(teachers));
      localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(cohort));
      localStorage.setItem("hwai_students_v1", JSON.stringify(f.courseStudents));
      localStorage.setItem("hwai_grading_categories_v1", JSON.stringify(f.gradingCategories));
      localStorage.setItem("hwai_assignments_v1", JSON.stringify(f.assignments));
      localStorage.setItem("hwai_rubrics_v1", JSON.stringify(f.rubrics));
      localStorage.setItem("hwai_submissions_v1", JSON.stringify(f.submissions));
      localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak.c@kmitl.ac.th", role: "teacher" }));
    }, [rd("courses-mockup.json"), rd("teachers-mockup.json"), rd("students-mockup.json"), flow] as const);
    await page.goto(`${BASE}/teacher/courses/c-mock-1/assignments/a-mock-9/grading`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "นำเข้าด้วย CSV" }).click();
    const dialog = page.getByRole("dialog", { name: "นำเข้าคะแนนสอบจาก CSV" });
    await dialog.locator("input[type=file]").setInputFiles("test-data/exam-scores-final-c-mock-1.csv");
    await expect(dialog.getByRole("status")).toContainText("42 พร้อมกรอก");
    await dialog.getByRole("button", { name: "กรอก 42 คะแนน" }).click();
    await expect(page.getByTestId("import-note")).toContainText("42 คน");
    await page.getByRole("button", { name: "บันทึกคะแนน" }).click();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("hwai_submissions_v1") ?? "[]").filter((s: { assignmentId: string; status: string }) => s.assignmentId === "a-mock-9" && s.status === "graded").length)).toBe(42);
    const first = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_submissions_v1") ?? "[]").find((s: { assignmentId: string; studentId: string }) => s.assignmentId === "a-mock-9" && s.studentId === "69070101").instructorScore);
    expect(first).toBe(81.5);
  });
});

import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import { readXls, XlsError } from "../src/lib/xls";
import { readXlsx, XlsxError } from "../src/lib/xlsx";
import { parseRosterGrid, csvToGrid, xlsToGrid, excelToGrid, splitThaiName, fileKind } from "../src/lib/rosterSheet";

import { BASE } from "./base";

// 15/10/2569 — the teacher's Import Students popup takes the registrar's exam sheet (stdfinsec_<term>-<subject>.xls) as it comes, not only our CSV.
// The fixture test-data/registrar-sheet-sample.xls was made with Excel in the real sheet's layout but with MADE-UP people (ids 99010001–99010010 in
// group 1 across two pages, 99020001–99020002 in group 2, the page headers and footer repeated like the real file). The real sheet holds real
// students, so it is never committed: one test reads it from the git-ignored local-data/ when the file is there.

const SAMPLE = "test-data/registrar-sheet-sample.xls";
const SAMPLE_X = "test-data/registrar-sheet-sample.xlsx";   // the same made-up sheet saved by Excel in the newer format
const sampleBytes = () => new Uint8Array(fs.readFileSync(SAMPLE));
const G1 = ["99010001", "99010002", "99010003", "99010004", "99010005", "99010006", "99010007", "99010008", "99010009", "99010010"];

test.describe("the .xls reader", () => {
  test("reads the first sheet into text: titles, the table header and every student row, ids as text", () => {
    const grid = readXls(sampleBytes());
    expect(grid.length).toBeGreaterThan(45);
    expect(grid[0][7]).toBe("หน้า: 1/3");
    expect(grid[5][0]).toBe("รหัสวิชา01076311");
    expect(grid[8]).toEqual(["ลำดับที่", "รหัส น.ศ.", "ชื่อ-นามสกุล", "ลายเซ็น", "กลางภาค", "ปลายภาค", "รวม", "เกรด"]);
    expect(grid[9]).toEqual(["1", "99010001", " นายสมชาย  ตัวอย่างหนึ่ง", "", "", "", "", ""]);   // the sequence is a number cell, the id a text cell
    expect(grid.filter((r) => /^\d{8}$/.test(r[1])).map((r) => r[1])).toEqual([...G1, "99020001", "99020002"]);
  });

  test("things that are not a readable .xls say so instead of returning rubbish", () => {
    const code = (b: Uint8Array) => { try { readXls(b); return "read"; } catch (e) { return e instanceof XlsError ? e.message : "other"; } };
    expect(code(new TextEncoder().encode("student_id,first_name\n1,a\n"))).toBe("not_xls");
    expect(code(new Uint8Array(0))).toBe("not_xls");
    expect(code(sampleBytes().subarray(0, 1500))).toBe("corrupt");                          // cut off mid-file
    const xlsx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new Array(600).fill(0)]);      // a .xlsx is a zip
    expect(code(xlsx)).toBe("not_xls");
  });

  test("the .xlsx twin reads to the same students as the .xls (a zip of XML, inflated by the built-in DecompressionStream)", async () => {
    const grid = await readXlsx(new Uint8Array(fs.readFileSync(SAMPLE_X)));
    expect(grid[8].slice(0, 3)).toEqual(["ลำดับที่", "รหัส น.ศ.", "ชื่อ-นามสกุล"]);
    expect(grid[9].slice(0, 3)).toEqual(["1", "99010001", " นายสมชาย  ตัวอย่างหนึ่ง"]);
    const a = parseRosterGrid(grid), b = parseRosterGrid(xlsToGrid(sampleBytes()));
    expect(a).toEqual(b);
    expect(a.rows).toHaveLength(12);
  });

  test("excelToGrid picks the reader from the file's first bytes, not its name", async () => {
    expect((await excelToGrid(fs.readFileSync(SAMPLE_X))).length).toBeGreaterThan(40);
    expect((await excelToGrid(fs.readFileSync(SAMPLE))).length).toBeGreaterThan(40);
    await expect(excelToGrid(new TextEncoder().encode("student_id,1"))).rejects.toBeInstanceOf(XlsError);
  });

  test("a damaged or non-xlsx zip says so", async () => {
    const code = async (b: Uint8Array) => { try { await readXlsx(b); return "read"; } catch (e) { return e instanceof XlsxError ? e.message : "other"; } };
    expect(await code(new TextEncoder().encode("hello, not a zip at all, nothing here"))).toBe("not_xlsx");
    expect(await code(new Uint8Array([0x50, 0x4b, ...new Array(40).fill(1)]))).toBe("not_xlsx");     // looks like a zip, no directory
    expect(await code(new Uint8Array(fs.readFileSync(SAMPLE_X)).subarray(0, 300))).toBe("not_xlsx");  // cut off: the directory at the end is gone
  });

  test("the real sheet, when it is here (local-data/ is git-ignored): 107 students, group 1 + group 2, same as Excel's own CSV export", () => {
    const real = "local-data/stdfinsec_2569-1-01076311.xls", csv = "local-data/real-roster.csv";
    test.skip(!fs.existsSync(real) || !fs.existsSync(csv), "real files are only on the author's machine");
    const parsed = parseRosterGrid(xlsToGrid(new Uint8Array(fs.readFileSync(real))));
    expect(parsed).toMatchObject({ kind: "registrar", courseCode: "01076311", groups: [1, 2] });
    expect(parsed.rows).toHaveLength(107);
    expect(parsed.rows.filter((r) => r.group === 2)).toHaveLength(1);
    const fromCsv = parseRosterGrid(csvToGrid(fs.readFileSync(csv, "utf8")));
    expect(parsed.rows.map((r) => [r.studentId, r.firstName, r.lastName, r.group])).toEqual(fromCsv.rows.map((r) => [r.studentId, r.firstName, r.lastName, r.group]));
  });
});

test.describe("reading the registrar's layout", () => {
  const parsed = () => parseRosterGrid(xlsToGrid(sampleBytes()));

  test("it is recognised, with the subject and the groups it holds; page headers and the footer are not students", () => {
    const p = parsed();
    expect(p).toMatchObject({ kind: "registrar", courseCode: "01076311", courseName: "PROJECT 1", groups: [1, 2] });
    expect(p.rows).toHaveLength(12);
    expect(p.rows.every((r) => !r.error)).toBe(true);
  });

  test("each row carries its group (from the 'กลุ่ม N' line above it) and its line in the file", () => {
    const p = parsed();
    expect(p.rows.slice(0, 10).every((r) => r.group === 1)).toBe(true);
    expect(p.rows.slice(10).map((r) => [r.studentId, r.group])).toEqual([["99020001", 2], ["99020002", 2]]);
    expect(p.rows[0].line).toBe(10);                  // sheet row 10 (1-based)
    expect(p.rows[5].line).toBeGreaterThan(p.rows[4].line + 8);   // the second page's rows come after its header block
  });

  test("the title is cut off the name and the double space splits first and last name", () => {
    const p = parsed();
    expect(p.rows[0]).toMatchObject({ studentId: "99010001", firstName: "สมชาย", lastName: "ตัวอย่างหนึ่ง" });
    expect(p.rows[1]).toMatchObject({ firstName: "สมหญิง", lastName: "ตัวอย่างสอง" });      // นางสาว
    expect(splitThaiName(" นายกรวิชญ์  สวัสดี")).toEqual({ firstName: "กรวิชญ์", lastName: "สวัสดี" });
    expect(splitThaiName("นางสาวนางรำ  ใจดี")).toEqual({ firstName: "นางรำ", lastName: "ใจดี" });   // "นางสาว" wins over "นาง"
    expect(splitThaiName("สมชาย ใจดี")).toEqual({ firstName: "สมชาย", lastName: "ใจดี" });         // no title
    expect(splitThaiName("นายสมชาย")).toEqual({ firstName: "สมชาย", lastName: "" });
  });

  test("the same sheet saved as CSV reads the same", () => {
    const grid = xlsToGrid(sampleBytes());
    const csv = "﻿" + grid.map((r) => r.map((c) => (/[",]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\r\n");
    expect(parseRosterGrid(csvToGrid(csv)).rows).toEqual(parsed().rows);
  });

  test("our own template (with or without its header row) still reads as before", () => {
    const withHeader = parseRosterGrid(csvToGrid("student_id,first_name,last_name,email\n66070500401,สมชาย,ใจดี,a@kmitl.ac.th\n66070500402,สมหญิง,,\n,x,y,\n"));
    expect(withHeader.kind).toBe("template");
    expect(withHeader.rows.map((r) => [r.line, r.studentId, r.firstName, r.lastName, r.email, r.error])).toEqual([
      [2, "66070500401", "สมชาย", "ใจดี", "a@kmitl.ac.th", undefined],
      [3, "66070500402", "สมหญิง", "", "", "missing_last"],
      [4, "", "x", "y", "", "missing_id"],
    ]);
    expect(parseRosterGrid(csvToGrid("66070500401,สมชาย,ใจดี\n")).rows[0]).toMatchObject({ line: 1, studentId: "66070500401" });
  });

  test("file kinds", () => {
    expect(fileKind("stdfinsec_2569-1-01076311.xls")).toBe("xls");
    expect(fileKind("Students.CSV")).toBe("csv");
    expect(fileKind("sheet.xlsx")).toBe("xlsx");
    expect(fileKind("notes.pdf")).toBe("unsupported");
  });
});

// ── the popup ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function seed(page: Page, o: { code?: string; section?: string; lang?: "en" | "th"; cohort?: string[]; enrolled?: string[] } = {}) {
  await page.addInitScript(([code, section, lang, cohort, enrolled]) => {
    const NOW = "2026-01-01T00:00:00.000Z";
    localStorage.setItem("hwai_lang", lang as string);
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([{ id: "c-rs", name: "Project 1", code, description: "", status: "active", source: "manual", coverColor: "#0F766E", iconColor: "#0F766E", academicYear: 2569, term: 1, sectionNumber: section, createdAt: NOW, updatedAt: NOW }]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([{ id: "t1", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-rs"] }]));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify((cohort as string[]).map((id, i) => ({ id: `cs-${i}`, studentId: id, firstName: `First${id.slice(-3)}`, lastName: `Last${id.slice(-3)}`, email: `${id}@kmitl.ac.th`, program: "CE", status: "active" }))));
    localStorage.setItem("hwai_students_v1", JSON.stringify((enrolled as string[]).map((id, i) => ({ id: `r-${i}`, courseId: "c-rs", studentId: id, firstName: "x", lastName: "y", email: `${id}@kmitl.ac.th`, sequenceNumber: i + 1, enrollmentStatus: "enrolled" }))));
    for (const k of ["hwai_grading_categories_v1", "hwai_assignments_v1", "hwai_rubrics_v1", "hwai_submissions_v1"]) localStorage.setItem(k, "[]");
  }, [o.code ?? "01076311", o.section ?? "1", o.lang ?? "en", o.cohort ?? [...G1, "99020001", "99020002"], o.enrolled ?? []] as const);
}
const open = async (page: Page) => {
  await page.goto(`${BASE}/teacher/courses/c-rs/students`);
  await page.getByRole("button", { name: "Import Excel" }).click();
  return page.getByRole("dialog");
};
const enrolledIds = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("hwai_students_v1") ?? "[]").map((s: { studentId: string }) => s.studentId));

test.describe("Import Students popup takes the registrar's Excel sheet", () => {
  test("group 1 of the sheet is imported into section 1; group 2 is listed but skipped with the reason", async ({ page }) => {
    await seed(page);
    const dialog = await open(page);
    await dialog.locator("input[type=file]").setInputFiles(SAMPLE);
    await expect(dialog.getByTestId("sheet-info")).toContainText("Registrar exam sheet · 01076311 PROJECT 1 · group 1, 2");
    await expect(dialog.getByTestId("sheet-info")).toContainText("importing group 1 only");
    await expect(dialog).toContainText("10 ready to import");
    await expect(dialog).toContainText("2 with errors");
    await expect(dialog.getByText("In group 2, not this section's group")).toHaveCount(2);
    await expect(dialog.getByTestId("sheet-code-warning")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Import 10 Students" }).click();
    await expect(dialog.getByRole("status")).toContainText("Import Complete");
    expect((await enrolledIds(page)).sort()).toEqual(G1);
  });

  test("the rows with a problem are listed first in the preview (10/11/2569)", async ({ page }) => {
    await seed(page);
    const dialog = await open(page);
    await dialog.locator("input[type=file]").setInputFiles(SAMPLE);
    await expect(dialog).toContainText("2 with errors");
    const firstTwo = await dialog.locator("tbody tr").evaluateAll((trs) => trs.slice(0, 2).map((tr) => tr.textContent ?? ""));
    expect(firstTwo.join(" ")).toContain("In group 2, not this section's group");
  });

  test("the system's own record wins: names come from the student database, an unknown id is skipped, an enrolled one too", async ({ page }) => {
    await seed(page, { cohort: G1.filter((id) => id !== "99010005"), enrolled: ["99010001"] });
    const dialog = await open(page);
    await dialog.locator("input[type=file]").setInputFiles(SAMPLE);
    await expect(dialog.getByText("Not found in system")).toHaveCount(1);
    await expect(dialog.getByText("Already enrolled")).toHaveCount(1);
    await expect(dialog).toContainText("8 ready to import");
    await expect(dialog.getByText("First002")).toBeVisible();                              // not the name typed in the sheet
  });

  test("section 2 takes the other group", async ({ page }) => {
    await seed(page, { section: "2" });
    const dialog = await open(page);
    await dialog.locator("input[type=file]").setInputFiles(SAMPLE);
    await expect(dialog.getByTestId("sheet-info")).toContainText("importing group 2 only");
    await expect(dialog).toContainText("2 ready to import");
    await expect(dialog.getByText("In group 1, not this section's group")).toHaveCount(10);
  });

  test("a sheet for another subject warns before anything is imported", async ({ page }) => {
    await seed(page, { code: "01076999" });
    const dialog = await open(page);
    await dialog.locator("input[type=file]").setInputFiles(SAMPLE);
    await expect(dialog.getByTestId("sheet-code-warning")).toContainText("This sheet is for subject 01076311, but you are importing into 01076999");
  });

  test("Thai UI", async ({ page }) => {
    await seed(page, { lang: "th" });
    await page.goto(`${BASE}/teacher/courses/c-rs/students`);
    await page.getByRole("button", { name: /นำเข้า/ }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("ใบคะแนนสอบจากทะเบียน (Excel)");
    await dialog.locator("input[type=file]").setInputFiles(SAMPLE);
    await expect(dialog.getByTestId("sheet-info")).toContainText("นำเข้าเฉพาะกลุ่ม 1");
    await expect(dialog.getByText("อยู่กลุ่ม 2 ไม่ใช่กลุ่มของ section นี้")).toHaveCount(2);
  });

  test("the .xlsx version imports the same way", async ({ page }) => {
    await seed(page);
    const dialog = await open(page);
    await dialog.locator("input[type=file]").setInputFiles(SAMPLE_X);
    await expect(dialog.getByTestId("sheet-info")).toContainText("group 1, 2");
    await expect(dialog).toContainText("10 ready to import");
    await dialog.getByRole("button", { name: "Import 10 Students" }).click();
    await expect(dialog.getByRole("status")).toContainText("Import Complete");
    expect((await enrolledIds(page)).sort()).toEqual(G1);
  });

  test("another file type, or a damaged Excel file, gets a clear message and nothing happens", async ({ page }) => {
    await seed(page);
    const dialog = await open(page);
    await dialog.locator("input[type=file]").setInputFiles({ name: "sheet.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
    await expect(dialog.getByRole("alert")).toContainText("isn't supported");
    await dialog.locator("input[type=file]").setInputFiles({ name: "broken.xls", mimeType: "application/vnd.ms-excel", buffer: fs.readFileSync(SAMPLE).subarray(0, 1500) });
    await expect(dialog.getByRole("alert")).toContainText("Couldn't read this file");
    await dialog.locator("input[type=file]").setInputFiles({ name: "broken.xlsx", mimeType: "application/octet-stream", buffer: fs.readFileSync(SAMPLE_X).subarray(0, 300) });
    await expect(dialog.getByRole("alert")).toContainText("Couldn't read this file");
    expect(await enrolledIds(page)).toEqual([]);
  });

  test("the button says Excel, and the popup lists what it takes", async ({ page }) => {
    await seed(page);
    const dialog = await open(page);
    await expect(dialog).toContainText("Supports Excel (.xls / .xlsx");
    await expect(page.getByRole("button", { name: "Import CSV" })).toHaveCount(0);
  });

  test("a CSV of our own template still imports exactly as before", async ({ page }) => {
    await seed(page);
    const dialog = await open(page);
    const csv = "student_id,first_name,last_name,email\n99010001,Ann,Test,\n99010002,Bea,Test,\n";
    await dialog.locator("input[type=file]").setInputFiles({ name: "s.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await expect(dialog.getByTestId("sheet-info")).toHaveCount(0);
    await expect(dialog).toContainText("2 ready to import");
  });
});

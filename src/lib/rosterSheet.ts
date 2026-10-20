import { splitCsvLine } from "./csv";
import { readXls } from "./xls";
import { readXlsx } from "./xlsx";

// Turns an uploaded file (.xls, .xlsx or .csv) into student rows for the teacher's "Import Students" popup. Two layouts are understood:
//
//   template   student_id, first_name, last_name, email        (our own students-template.csv; a header row is optional)
//   registrar  the university's exam sheet, "ใบคะแนนสอบ…" (stdfinsec_<term>-<subject>.xls, or that sheet saved as CSV): title lines on every page,
//              then rows `ลำดับที่ | รหัส น.ศ. | ชื่อ-นามสกุล | …` where the name is "<title><first>  <last>" in ONE cell, and a "กลุ่ม N" line says
//              which section the rows below belong to. One file can hold several sections.
//
// Pure functions: the file is read in the component, everything after that is text, so each rule is checked in tests/roster-sheet.spec.ts.

export interface SheetRow {
  /** 1-based line (row) in the file, shown in the preview */
  line: number;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  /** registrar sheets only: the section ("กลุ่ม") the row sits under */
  group?: number;
  error?: "missing_id" | "missing_first" | "missing_last";
}

export interface ParsedSheet {
  kind: "template" | "registrar";
  rows: SheetRow[];
  /** registrar sheets only */
  courseCode?: string;
  courseName?: string;
  /** every section number found in the sheet, ascending */
  groups: number[];
}

export type FileKind = "xls" | "xlsx" | "csv" | "unsupported";
export function fileKind(name: string): FileKind {
  const n = name.toLowerCase();
  if (n.endsWith(".xls")) return "xls";
  if (n.endsWith(".xlsx")) return "xlsx";
  if (n.endsWith(".csv")) return "csv";
  return "unsupported";
}

/** Rows of text from a CSV (UTF-8, optional BOM). */
export function csvToGrid(text: string): string[][] {
  return text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim()).map(splitCsvLine);
}

/** Rows of text from the bytes of an .xls file (the first worksheet). */
export function xlsToGrid(bytes: ArrayBuffer | Uint8Array): string[][] {
  return readXls(bytes);
}

/** Rows of text from an Excel file of either age: the old .xls (an OLE2 file) or the newer .xlsx (a zip) — told apart by their first bytes, not the name. */
export async function excelToGrid(bytes: ArrayBuffer | Uint8Array): Promise<string[][]> {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return b[0] === 0x50 && b[1] === 0x4b ? readXlsx(b) : readXls(b);
}

const TITLES = ["นางสาว", "นาย", "นาง", "เด็กชาย", "เด็กหญิง"];   // "นางสาว" before "นาง" — the longer one must win

/** " นายกรวิชญ์  สวัสดี" → { first: "กรวิชญ์", last: "สวัสดี" } (a title is dropped, the double space between the names is the separator). */
export function splitThaiName(full: string): { firstName: string; lastName: string } {
  const text = full.replace(/\s+/g, " ").trim();
  const title = TITLES.find((t) => text.startsWith(t)) ?? "";
  const [firstName = "", ...rest] = text.slice(title.length).trim().split(" ");
  return { firstName, lastName: rest.join(" ") };
}

const cell = (r: string[], i: number) => (r[i] ?? "").trim();
const isStudentRow = (r: string[]) => /^\d+(\.0)?$/.test(cell(r, 0)) && /^\d{8,11}$/.test(cell(r, 1)) && cell(r, 2) !== "";

/** Is this the registrar's sheet? It has the "รหัส น.ศ." column heading, or at least a "รหัสวิชา" line and numbered student rows. */
function looksLikeRegistrar(grid: string[][]): boolean {
  const flat = grid.map((r) => r.join(" "));
  if (flat.some((l) => l.includes("รหัส น.ศ."))) return true;
  return flat.some((l) => /รหัสวิชา\s*\d{8}/.test(l)) && grid.some(isStudentRow);
}

function parseRegistrar(grid: string[][]): ParsedSheet {
  let group = 1;
  let courseCode: string | undefined;
  let courseName: string | undefined;
  const found = new Set<number>();
  const rows: SheetRow[] = [];
  grid.forEach((r, i) => {
    const line = r.join("  ");
    const g = line.match(/กลุ่ม\s*(\d+)/);                 // "กลุ่มเรียน" in the page title has no number after it, so it never matches
    if (g) group = Number(g[1]);
    courseCode ??= line.match(/รหัสวิชา\s*(\d{8})/)?.[1];
    const nm = line.match(/ชื่อวิชา\s+(.+?)\s*$/);
    if (nm && !courseName) courseName = nm[1].trim();
    if (!isStudentRow(r)) return;
    const { firstName, lastName } = splitThaiName(cell(r, 2));
    found.add(group);
    rows.push({
      line: i + 1, studentId: cell(r, 1), firstName, lastName, email: "", group,
      error: !firstName ? "missing_first" : !lastName ? "missing_last" : undefined,
    });
  });
  return { kind: "registrar", rows, courseCode, courseName, groups: [...found].sort((a, b) => a - b) };
}

function parseTemplate(grid: string[][]): ParsedSheet {
  const first = (grid[0] ?? []).join(",").toLowerCase();
  const hasHeader = first.includes("student_id") || first.includes("รหัส") || first.includes("first") || first.includes("ชื่อ");
  const body = hasHeader ? grid.slice(1) : grid;
  const rows = body.map((cols, i): SheetRow => {
    const studentId = cell(cols, 0), firstName = cell(cols, 1), lastName = cell(cols, 2), email = cell(cols, 3);
    const error = !studentId ? "missing_id" : !firstName ? "missing_first" : !lastName ? "missing_last" : undefined;
    return { line: i + (hasHeader ? 2 : 1), studentId, firstName, lastName, email, error };
  });
  return { kind: "template", rows, groups: [] };
}

/** Which layout is this grid, and what is in it. */
export function parseRosterGrid(grid: string[][]): ParsedSheet {
  return looksLikeRegistrar(grid) ? parseRegistrar(grid) : parseTemplate(grid);
}

// CSV import of exam scores (4/10/2569): "student_id,score" rows are matched against the students enrolled in the
// course and turned into values for the score table. Pure functions so every case can be checked without a browser.

export type ScoreRowStatus =
  | "new"           // enrolled, had no score → will be filled
  | "overwrite"     // enrolled, had a different score → will be replaced
  | "same"          // enrolled, already has exactly this score → nothing to do
  | "empty"         // no score on the row (a roster template left blank) → skipped, not an error
  | "bad_score"     // not a number, or outside 0…max
  | "not_enrolled"  // the ID isn't on this course's roster
  | "withdrawn"     // enrolled but withdrawn — their scores can't be edited
  | "duplicate"     // the same ID again further down the file (the first row counts)
  | "missing_id";

export interface ScoreCsvRow {
  line: number;
  rawId: string;
  rawScore: string;
  studentId: string;
  /** the roster's name for this ID, when it is enrolled */
  name?: string;
  score: number | null;
  /** what the table holds for this student right now ("" = no score) */
  current: string;
  status: ScoreRowStatus;
}

export interface ScoreCsvContext {
  maxPoints: number;
  /** enrolled (active) students by ID → display name */
  enrolled: Map<string, string>;
  withdrawn: Set<string>;
  current: (studentId: string) => string;
}

/** Rows of cells. Handles a UTF-8 BOM, quoted cells (with commas and "" escapes) and comma / semicolon / tab delimiters. */
export function parseCsvText(text: string): { rows: string[][]; delimiter: string } {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const delimiter = count("\t") > 0 && count("\t") >= count(",") ? "\t" : count(";") > count(",") ? ";" : ",";
  const rows: string[][] = [];
  let cell = "", row: string[] = [], quoted = false;
  const endCell = () => { row.push(cell.trim()); cell = ""; };
  const endRow = () => { endCell(); if (row.some((c) => c !== "")) rows.push(row); row = []; };
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"') { if (clean[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) endCell();
    else if (ch === "\n") endRow();
    else if (ch !== "\r") cell += ch;
  }
  if (cell !== "" || row.length > 0) endRow();
  return { rows, delimiter };
}

const ID_HEADER = /student.?id|^id$|รหัส/i;
const SCORE_HEADER = /score|mark|point|คะแนน/i;

export function parseExamScoreCsv(text: string, ctx: ScoreCsvContext): { rows: ScoreCsvRow[]; hasHeader: boolean } {
  const { rows: cells, delimiter } = parseCsvText(text);
  if (cells.length === 0) return { rows: [], hasHeader: false };
  const head = cells[0];
  const hasHeader = head.some((h) => ID_HEADER.test(h) || SCORE_HEADER.test(h)) && !head.some((h) => /^\d{6,}$/.test(h));
  let idIdx = 0, scoreIdx = 1;
  if (hasHeader) {
    const i = head.findIndex((h) => ID_HEADER.test(h));
    const s = head.findIndex((h) => SCORE_HEADER.test(h));
    idIdx = i >= 0 ? i : 0;
    scoreIdx = s >= 0 ? s : (idIdx === 0 ? 1 : 0);
  } else if (head.length > 2) {
    scoreIdx = head.length - 1;   // "id, name, score" without a header: the score is the last column
  }
  const seen = new Set<string>();
  const out: ScoreCsvRow[] = [];
  (hasHeader ? cells.slice(1) : cells).forEach((c, i) => {
    const line = i + (hasHeader ? 2 : 1);
    const rawId = (c[idIdx] ?? "").replace(/\s+/g, "");
    const rawScore = (c[scoreIdx] ?? "").trim();
    const base = { line, rawId, rawScore, studentId: rawId, score: null as number | null, current: "" };
    if (!rawId) { out.push({ ...base, status: "missing_id" }); return; }
    if (seen.has(rawId)) { out.push({ ...base, status: "duplicate", name: ctx.enrolled.get(rawId) }); return; }
    seen.add(rawId);
    const name = ctx.enrolled.get(rawId);
    if (ctx.withdrawn.has(rawId)) { out.push({ ...base, name, status: "withdrawn" }); return; }
    if (name === undefined) { out.push({ ...base, status: "not_enrolled" }); return; }
    const current = ctx.current(rawId);
    if (rawScore === "") { out.push({ ...base, name, current, status: "empty" }); return; }
    const n = Number(delimiter === "," ? rawScore : rawScore.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > ctx.maxPoints) { out.push({ ...base, name, current, status: "bad_score" }); return; }
    out.push({ ...base, name, current, score: n, status: current === "" ? "new" : current === String(n) ? "same" : "overwrite" });
  });
  return { rows: out, hasHeader };
}

/** A CSV of the course's roster with an empty score column, ready to fill in a spreadsheet (UTF-8 with BOM so Thai opens right in Excel). */
export function scoreCsvTemplate(students: { studentId: string; firstName: string; lastName: string }[], labels: { id: string; name: string; score: string }): string {
  const q = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "﻿" + [[labels.id, labels.name, labels.score], ...students.map((s) => [s.studentId, `${s.firstName} ${s.lastName}`, ""])].map((r) => r.map(q).join(",")).join("\r\n") + "\r\n";
}

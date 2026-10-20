// A small reader for .xlsx (Office Open XML: a zip of XML files) — the first worksheet as a grid of strings, like lib/xls.ts does for the old .xls.
// No library: the zip is read by hand (stored or deflate entries, inflated with the browser's / Node's built-in DecompressionStream), and the
// few XML parts needed (workbook, its relationships, shared strings, the sheet) are picked apart with regular expressions — Excel writes them
// in one regular shape, so there is no need for a DOM (which also keeps this runnable in tests).
//
//   await readXlsx(await file.arrayBuffer())  →  string[][]
//
// Understood: shared strings (plain and rich text), inline strings, numbers, booleans, formula results (cached), empty cells. Dates stay numbers.

export class XlsxError extends Error {}

const td = new TextDecoder("utf-8");

interface ZipEntry { name: string; method: number; compressedSize: number; localOffset: number }

function readZipDirectory(bytes: Uint8Array): Map<string, ZipEntry> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new XlsxError("not_xlsx");
  const count = v.getUint16(eocd + 10, true);
  let o = v.getUint32(eocd + 16, true);
  const entries = new Map<string, ZipEntry>();
  for (let k = 0; k < count; k++) {
    if (o + 46 > bytes.length || v.getUint32(o, true) !== 0x02014b50) throw new XlsxError("corrupt");
    const nameLen = v.getUint16(o + 28, true), extraLen = v.getUint16(o + 30, true), commentLen = v.getUint16(o + 32, true);
    const name = td.decode(bytes.subarray(o + 46, o + 46 + nameLen));
    entries.set(name, { name, method: v.getUint16(o + 10, true), compressedSize: v.getUint32(o + 20, true), localOffset: v.getUint32(o + 42, true) });
    o += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readEntry(bytes: Uint8Array, e: ZipEntry): Promise<string> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (e.localOffset + 30 > bytes.length || v.getUint32(e.localOffset, true) !== 0x04034b50) throw new XlsxError("corrupt");
  const start = e.localOffset + 30 + v.getUint16(e.localOffset + 26, true) + v.getUint16(e.localOffset + 28, true);
  const raw = bytes.subarray(start, start + e.compressedSize);
  if (e.method === 0) return td.decode(raw);
  if (e.method === 8) return td.decode(await inflateRaw(raw));
  throw new XlsxError("corrupt");
}

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unescapeXml = (s: string) =>
  s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (m, g: string) =>
    g[0] === "#" ? String.fromCodePoint(g[1] === "x" ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10)) : entities[g] ?? m);

/** All the text of an element: every <t>…</t> in it, joined (rich-text strings are split into several runs; phonetic <rPh> text is left out). */
function textOf(xml: string): string {
  const withoutPhonetic = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  let out = "";
  for (const m of withoutPhonetic.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += m[1];
  return unescapeXml(out);
}

function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** The first worksheet of an .xlsx file as rows of text. Throws XlsxError("not_xlsx" | "corrupt" | "no_sheet"). */
export async function readXlsx(input: ArrayBuffer | Uint8Array): Promise<string[][]> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new XlsxError("not_xlsx");
  const zip = readZipDirectory(bytes);
  const read = async (name: string) => { const e = zip.get(name); return e ? readEntry(bytes, e) : null; };

  // which file is the first sheet: workbook.xml names it by relationship id, the .rels file maps the id to a path
  let sheetPath = "xl/worksheets/sheet1.xml";
  const workbook = await read("xl/workbook.xml");
  const rels = await read("xl/_rels/workbook.xml.rels");
  const rid = workbook?.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  if (rid && rels) {
    for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
      if (m[0].match(/\bId="([^"]+)"/)?.[1] === rid) {
        const target = m[0].match(/\bTarget="([^"]+)"/)?.[1];
        if (target) sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
      }
    }
  }
  const sheet = await read(sheetPath);
  if (!sheet) throw new XlsxError("no_sheet");

  const sstXml = await read("xl/sharedStrings.xml");
  const sst: string[] = sstXml ? [...sstXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1])) : [];

  const cells = new Map<string, string>();
  let maxRow = -1, maxCol = -1;
  for (const m of sheet.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = m[1], body = m[2];
    if (body === undefined) continue;                                      // <c r="A1" s="3"/> — empty
    const ref = attrs.match(/\br="([A-Z]+)(\d+)"/);
    if (!ref) continue;
    const type = attrs.match(/\bt="([^"]+)"/)?.[1] ?? "n";
    const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
    let text = "";
    if (type === "s") text = sst[Number(v)] ?? "";
    else if (type === "inlineStr") text = textOf(body);
    else if (type === "b") text = v === "1" ? "TRUE" : "FALSE";
    else if (v !== undefined) text = unescapeXml(v);
    if (text === "") continue;
    const row = Number(ref[2]) - 1, col = colIndex(ref[1] + ref[2]);
    cells.set(`${row},${col}`, text);
    if (row > maxRow) maxRow = row;
    if (col > maxCol) maxCol = col;
  }
  const grid: string[][] = [];
  for (let r = 0; r <= maxRow; r++) {
    const row: string[] = [];
    for (let c = 0; c <= maxCol; c++) row.push(cells.get(`${r},${c}`) ?? "");
    grid.push(row);
  }
  return grid;
}

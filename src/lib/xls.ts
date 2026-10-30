// A small reader for the old Excel format (.xls, BIFF8 inside an OLE2 "compound file") — what the registrar's exam sheets are saved as.
// It reads the FIRST worksheet into a grid of strings and nothing else (no styles, formulas are read through their cached result, dates stay
// numbers). Written by hand so the app needs no spreadsheet library; no I/O and no React, so it is checked directly in tests/xls-reader.spec.ts.
//
//   readXls(await file.arrayBuffer())  →  string[][]   (rows × columns, "" for an empty cell, numbers as plain text: 66010016, 3.5)
//
// What it understands: OLE2 sectors + mini stream, the Workbook stream, BOUNDSHEET, SST (+ CONTINUE, strings split across records,
// compressed and UTF-16 characters, rich-text and phonetic extras), LABELSST, LABEL, NUMBER, RK, MULRK, FORMULA (+ STRING). Anything else is skipped.

export class XlsError extends Error {}

const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ENDOFCHAIN = 0xfffffffe;
const FREESECT = 0xffffffff;

// ── OLE2 compound file: find a stream by name ──────────────────────────────────────────────────────────────────────────────────
function readOleStream(buf: Uint8Array, wanted: string[]): Uint8Array {
  if (buf.length < 512 || OLE_MAGIC.some((b, i) => buf[i] !== b)) throw new XlsError("not_xls");
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const sectorSize = 1 << v.getUint16(30, true);
  const miniSize = 1 << v.getUint16(32, true);
  const numFatSectors = v.getUint32(44, true);
  const dirStart = v.getUint32(48, true);
  const miniCutoff = v.getUint32(56, true);
  const miniFatStart = v.getUint32(60, true);
  const numMiniFat = v.getUint32(64, true);
  const difatStart = v.getUint32(68, true);
  const numDifat = v.getUint32(72, true);
  const sectorOffset = (n: number) => 512 + n * sectorSize;
  const sector = (n: number) => {
    const o = sectorOffset(n);
    if (o + sectorSize > buf.length) throw new XlsError("corrupt");
    return buf.subarray(o, o + sectorSize);
  };

  // FAT: the first 109 sector numbers are in the header, the rest in DIFAT sectors
  const fatSectorIds: number[] = [];
  for (let i = 0; i < 109 && fatSectorIds.length < numFatSectors; i++) fatSectorIds.push(v.getUint32(76 + i * 4, true));
  let d = difatStart;
  for (let i = 0; i < numDifat && d !== ENDOFCHAIN && d !== FREESECT; i++) {
    const dv = new DataView(buf.buffer, buf.byteOffset + sectorOffset(d), sectorSize);
    for (let k = 0; k < sectorSize / 4 - 1 && fatSectorIds.length < numFatSectors; k++) fatSectorIds.push(dv.getUint32(k * 4, true));
    d = dv.getUint32(sectorSize - 4, true);
  }
  const fat: number[] = [];
  for (const id of fatSectorIds) {
    const dv = new DataView(buf.buffer, buf.byteOffset + sectorOffset(id), sectorSize);
    for (let k = 0; k < sectorSize / 4; k++) fat.push(dv.getUint32(k * 4, true));
  }

  const readChain = (start: number, size: number | null): Uint8Array => {
    const parts: Uint8Array[] = [];
    let n = start, guard = 0;
    while (n !== ENDOFCHAIN && n !== FREESECT && guard++ <= fat.length) { parts.push(sector(n)); n = fat[n] ?? ENDOFCHAIN; }
    const out = new Uint8Array(parts.length * sectorSize);
    parts.forEach((p, i) => out.set(p, i * sectorSize));
    return size === null ? out : out.subarray(0, size);
  };

  // directory entries: 128 bytes each
  const dir = readChain(dirStart, null);
  const dd = new DataView(dir.buffer, dir.byteOffset, dir.byteLength);
  interface Entry { name: string; type: number; start: number; size: number }
  const entries: Entry[] = [];
  for (let o = 0; o + 128 <= dir.length; o += 128) {
    const nameLen = dd.getUint16(o + 64, true);
    let name = "";
    for (let k = 0; k < Math.max(0, nameLen / 2 - 1); k++) name += String.fromCharCode(dd.getUint16(o + k * 2, true));
    entries.push({ name, type: dir[o + 66], start: dd.getUint32(o + 116, true), size: dd.getUint32(o + 120, true) });
  }
  const entry = entries.find((e) => e.type === 2 && wanted.includes(e.name));
  if (!entry) throw new XlsError("no_workbook");
  if (entry.size >= miniCutoff) return readChain(entry.start, entry.size);

  // small streams live in the mini stream (the root entry's data), chained through the mini FAT
  const root = entries.find((e) => e.type === 5);
  if (!root) throw new XlsError("corrupt");
  const miniStream = readChain(root.start, root.size);
  const miniFatBytes = readChain(miniFatStart, numMiniFat * sectorSize);
  const mv = new DataView(miniFatBytes.buffer, miniFatBytes.byteOffset, miniFatBytes.byteLength);
  const parts: Uint8Array[] = [];
  let n = entry.start, guard = 0;
  while (n !== ENDOFCHAIN && n !== FREESECT && guard++ < 1_000_000) {
    parts.push(miniStream.subarray(n * miniSize, (n + 1) * miniSize));
    n = n * 4 + 4 <= miniFatBytes.length ? mv.getUint32(n * 4, true) : ENDOFCHAIN;
  }
  const out = new Uint8Array(parts.length * miniSize);
  parts.forEach((p, i) => out.set(p, i * miniSize));
  return out.subarray(0, entry.size);
}

// ── BIFF8 ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
interface Rec { id: number; data: Uint8Array; /** the CONTINUE records that followed, kept apart so strings can cross them */ cont: Uint8Array[] }

function records(wb: Uint8Array, from = 0): Rec[] {
  const v = new DataView(wb.buffer, wb.byteOffset, wb.byteLength);
  const out: Rec[] = [];
  let o = from;
  while (o + 4 <= wb.length) {
    const id = v.getUint16(o, true), len = v.getUint16(o + 2, true);
    if (o + 4 + len > wb.length) break;
    const data = wb.subarray(o + 4, o + 4 + len);
    o += 4 + len;
    if (id === 0x003c && out.length > 0) out[out.length - 1].cont.push(data);   // CONTINUE
    else out.push({ id, data, cont: [] });
  }
  return out;
}

/** Reads text out of a record and its CONTINUEs: a string that crosses a boundary restarts with a one-byte "16-bit characters?" flag. */
class ChunkReader {
  private ci = 0;
  private pos = 0;
  private chunks: Uint8Array[];
  constructor(chunks: Uint8Array[]) { this.chunks = chunks; }
  private get cur() { return this.chunks[this.ci]; }
  get done() { return this.ci >= this.chunks.length || (this.ci === this.chunks.length - 1 && this.pos >= this.cur.length); }
  private ensure(): boolean {
    while (this.ci < this.chunks.length && this.pos >= this.cur.length) { this.ci++; this.pos = 0; if (this.ci < this.chunks.length) return true; }
    return this.ci < this.chunks.length;
  }
  u8(): number { this.ensure(); return this.cur[this.pos++] ?? 0; }
  u16(): number { const a = this.u8(); return a | (this.u8() << 8); }
  u32(): number { const a = this.u16(); return (a | (this.u16() << 16)) >>> 0; }
  skip(n: number) { while (n > 0 && this.ensure()) { const k = Math.min(n, this.cur.length - this.pos); this.pos += k; n -= k; } }
  /** `count` characters; `wide` = 16-bit. Crossing into a CONTINUE chunk re-reads the width flag. */
  chars(count: number, wide: boolean): string {
    let s = "";
    while (count > 0) {
      if (this.pos >= this.cur.length) { if (!this.ensure()) break; wide = (this.u8() & 1) === 1; continue; }
      const room = this.cur.length - this.pos;
      const take = Math.min(count, wide ? Math.floor(room / 2) : room);
      if (take === 0) { this.pos = this.cur.length; continue; }
      for (let k = 0; k < take; k++) {
        if (wide) { s += String.fromCharCode(this.cur[this.pos] | (this.cur[this.pos + 1] << 8)); this.pos += 2; }
        else s += String.fromCharCode(this.cur[this.pos++]);
      }
      count -= take;
    }
    return s;
  }
}

/** One BIFF8 "unicode string": cch, flags, [runs], [ext size], characters, [run data], [ext data]. */
function readUnicodeString(r: ChunkReader, cchSize: 1 | 2 = 2): string {
  const cch = cchSize === 2 ? r.u16() : r.u8();
  const flags = r.u8();
  const runs = flags & 0x08 ? r.u16() : 0;
  const ext = flags & 0x04 ? r.u32() : 0;
  const s = r.chars(cch, (flags & 0x01) === 1);
  r.skip(runs * 4 + ext);
  return s;
}

function rkValue(rk: number): number {
  let n: number;
  if (rk & 2) n = rk >> 2;                                           // 30-bit signed integer
  else { const b = new DataView(new ArrayBuffer(8)); b.setUint32(4, (rk & 0xfffffffc) >>> 0, true); n = b.getFloat64(0, true); }
  return rk & 1 ? n / 100 : n;
}
const numText = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toPrecision(15))));

/** The first worksheet of an .xls file as rows of text. Throws XlsError("not_xls" | "no_workbook" | "corrupt" | "encrypted") when it cannot. */
export function readXls(input: ArrayBuffer | Uint8Array): string[][] {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const wb = readOleStream(bytes, ["Workbook", "Book"]);
  const recs = records(wb);
  if (recs.some((r) => r.id === 0x002f)) throw new XlsError("encrypted");   // FILEPASS

  // shared strings
  const sst: string[] = [];
  const sstRec = recs.find((r) => r.id === 0x00fc);
  if (sstRec) {
    const rd = new ChunkReader([sstRec.data, ...sstRec.cont]);
    rd.u32();                                            // total references
    const unique = rd.u32();
    for (let i = 0; i < unique && !rd.done; i++) sst.push(readUnicodeString(rd));
  }

  // the first real worksheet: BOUNDSHEET gives the offset of its substream
  let sheetOffset = -1;
  for (const r of recs) {
    if (r.id === 0x0085) {
      const dv = new DataView(r.data.buffer, r.data.byteOffset, r.data.byteLength);
      if (r.data[5] === 0) { sheetOffset = dv.getUint32(0, true); break; }   // 0 = worksheet
    }
  }
  if (sheetOffset < 0) throw new XlsError("no_workbook");
  const sheet = records(wb, sheetOffset);

  const cells = new Map<string, string>();
  let maxRow = -1, maxCol = -1;
  const put = (row: number, col: number, text: string) => { cells.set(`${row},${col}`, text); if (row > maxRow) maxRow = row; if (col > maxCol) maxCol = col; };
  let pendingFormula: [number, number] | null = null;

  for (let i = 0; i < sheet.length; i++) {
    const { id, data, cont } = sheet[i];
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    if (id === 0x000a && i > 0) break;                   // EOF of the sheet
    if (id === 0x00fd && data.length >= 10) put(dv.getUint16(0, true), dv.getUint16(2, true), sst[dv.getUint32(6, true)] ?? "");                 // LABELSST
    else if (id === 0x0203 && data.length >= 14) put(dv.getUint16(0, true), dv.getUint16(2, true), numText(dv.getFloat64(6, true)));             // NUMBER
    else if (id === 0x027e && data.length >= 10) put(dv.getUint16(0, true), dv.getUint16(2, true), numText(rkValue(dv.getUint32(6, true))));    // RK
    else if (id === 0x00bd && data.length >= 6) {                                                                                                // MULRK
      const row = dv.getUint16(0, true), first = dv.getUint16(2, true), n = (data.length - 6) / 6;
      for (let k = 0; k < n; k++) put(row, first + k, numText(rkValue(dv.getUint32(4 + k * 6 + 2, true))));
    } else if (id === 0x0204 && data.length >= 8) {                                                                                              // LABEL
      const rd = new ChunkReader([data.subarray(6), ...cont]);
      put(dv.getUint16(0, true), dv.getUint16(2, true), readUnicodeString(rd));
    } else if (id === 0x0006 && data.length >= 14) {                                                                                             // FORMULA
      const row = dv.getUint16(0, true), col = dv.getUint16(2, true);
      if (data[12] === 0xff && data[13] === 0xff) { if (data[6] === 0) pendingFormula = [row, col]; }   // string result: the STRING record follows
      else put(row, col, numText(dv.getFloat64(6, true)));
    } else if (id === 0x0207 && pendingFormula) {                                                                                                // STRING (formula result)
      put(pendingFormula[0], pendingFormula[1], readUnicodeString(new ChunkReader([data, ...cont])));
      pendingFormula = null;
    }
  }

  const grid: string[][] = [];
  for (let r = 0; r <= maxRow; r++) {
    const row: string[] = [];
    for (let c = 0; c <= maxCol; c++) row.push(cells.get(`${r},${c}`) ?? "");
    grid.push(row);
  }
  return grid;
}

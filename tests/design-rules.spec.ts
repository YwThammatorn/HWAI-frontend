import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

// The design rules of DESIGN.md that a machine can check (22/10/2569). They exist because the same few mistakes kept coming back
// (a hand-pasted icon with its own stroke width, a gray utility class that ignores dark mode, a hex colour that is not in the palette).
// A failure here is not a style nitpick: it means a screen will not follow the theme. Fix the code; only add to an allow-list when the
// file really is artwork, and say why. Rules and reasons: DESIGN.md → "Icons", "Colour usage", "Before you ship UI".

const SRC = path.join(__dirname, "..", "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(full);
  }
  return out;
}
const FILES = walk(SRC).map((f) => ({ rel: path.relative(SRC, f).replace(/\\/g, "/"), text: fs.readFileSync(f, "utf8") }));

/** Drop comments so a rule written in a comment ("never an inline <svg>") is not read as a violation. */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** Artwork that is not a UI icon: drawn once, in its own file. Anything else that needs a glyph uses components/Icon.tsx. */
const SVG_ALLOWED: Record<string, string> = {
  "components/Icon.tsx": "the one icon component",
  "components/BrandLogo.tsx": "HWAI's mark and the Google / Microsoft sign-in logos",
  "app/not-found.tsx": "the 404 robot illustration",
  "app/teacher/courses/page.tsx": "the empty-state illustration",
  "app/teacher/courses/[id]/assignments/[assignmentId]/grading/page.tsx": "the progress ring (a chart)",
  "app/teacher/dashboard/page.tsx": "two charts",
  "app/teacher/history/page.tsx": "the donut (a chart)",
};

/** Files where a hex colour is data or artwork, not UI styling. */
const HEX_ALLOWED: Record<string, string> = {
  "components/BrandLogo.tsx": "third-party brand colours",
  "app/not-found.tsx": "the 404 illustration",
  "lib/courses.ts": "the course cover colours a teacher picks from — stored data",
};

test.describe("Design rules (DESIGN.md)", () => {
  test("every icon comes from components/Icon.tsx — no inline <svg> outside the artwork files", () => {
    const bad = FILES.filter((f) => !SVG_ALLOWED[f.rel] && /<svg[\s>]/.test(code(f.text))).map((f) => f.rel);
    expect(bad, "Use <Icon name=\"…\" size=\"…\" /> (add the glyph to components/Icon.tsx if it is missing), or a named artwork component").toEqual([]);
  });

  test("the artwork allow-list has no stale entries", () => {
    const stale = Object.keys(SVG_ALLOWED).filter((rel) => !FILES.find((f) => f.rel === rel && /<svg[\s>]/.test(code(f.text))));
    expect(stale).toEqual([]);
  });

  test("Icon has one stroke and a fixed set of sizes — nothing overrides them", () => {
    const icon = FILES.find((f) => f.rel === "components/Icon.tsx")!.text;
    expect(icon).toContain("ICON_STROKE = 2");
    expect(icon).toMatch(/ICON_SIZES = \{ xs: 12, sm: 14, md: 16, lg: 20, xl: 24 \}/);
    const overrides = FILES.filter((f) => f.rel !== "components/Icon.tsx" && /<Icon\b[^>]*\b(strokeWidth|width|height)=/.test(code(f.text))).map((f) => f.rel);
    expect(overrides, "Icon takes size=\"xs|sm|md|lg|xl\" only").toEqual([]);
  });

  test("no parent forces an icon's size from CSS ([&>svg]:w-4 …) — the size prop is the only way", () => {
    // That override silently beat the size prop: the sidebars asked for 16px and drew 18px (w-4 is 18px on this app's spacing scale).
    const hits = FILES.filter((f) => /\[&[>_ ]*svg\]:(?:w|h|size)-/.test(code(f.text))).map((f) => f.rel);
    expect(hits).toEqual([]);
  });

  // ── the small pieces built on Icon (23/10/2569): one component each, so every screen draws them the same way ──
  const PIECES = new Set(["components/Icon.tsx", "components/IconTile.tsx", "components/IconButton.tsx", "components/Avatar.tsx", "components/MetricCard.tsx", "components/BrandLogo.tsx"]);
  const noArrows = (t: string) => t.replace(/=>/g, "=_");   // so `onClick={() => …}` does not end a tag early in the patterns below

  test("an icon in a box is an <IconTile> — no hand-sized w-N h-N box around an <Icon>", () => {
    const bad: string[] = [];
    for (const f of FILES) {
      if (PIECES.has(f.rel)) continue;
      for (const m of noArrows(code(f.text)).matchAll(/<(?:div|span)\b[^>]*className=(?:"([^"]*)"|\{`([^`]*)`\})[^>]*>\s*<(?:Icon|CourseIcon)\b/g)) {
        const cls = m[1] ?? m[2] ?? "";
        const w = cls.match(/\bw-(\d+)\b/), h = cls.match(/\bh-(\d+)\b/);   // a fixed square: w-8 h-8
        if (w && h && w[1] === h[1] && /justify-center/.test(cls)) bad.push(`${f.rel}: ${cls.slice(0, 70)}`);
      }
    }
    expect(bad, "Use <IconTile icon=\"…\" size=\"sm|md|lg\" tone=\"…\" /> (DESIGN.md §9c)").toEqual([]);
  });

  test("a button that is only an icon is an <IconButton> (with a label) — never a bare <button><Icon/></button>", () => {
    const bad: string[] = [];
    for (const f of FILES) {
      if (PIECES.has(f.rel)) continue;
      for (const m of noArrows(code(f.text)).matchAll(/<(button|Link|a)\b[^>]*>\s*<Icon\b[^>]*\/>\s*<\/\1>/g)) bad.push(`${f.rel}: ${m[0].slice(0, 80).replace(/\s+/g, " ")}`);
    }
    expect(bad, "Use <IconButton icon=\"…\" label=\"…\" /> (DESIGN.md §9c)").toEqual([]);
  });

  test("a person's initials circle is an <Avatar>", () => {
    const ALLOWED: Record<string, string> = { "app/teacher/courses/[id]/calibration/page.tsx": "numbered step badges, not people" };
    const bad: string[] = [];
    for (const f of FILES) {
      if (PIECES.has(f.rel) || ALLOWED[f.rel]) continue;
      for (const m of noArrows(code(f.text)).matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
        const cls = m[1] ?? m[2] ?? "";
        if (/\brounded-full\b/.test(cls) && /\bfont-bold\b/.test(cls) && /justify-center/.test(cls) && /\b(?:w|h)-(?:7|8|9|10|11|12)\b/.test(cls)) bad.push(`${f.rel}: ${cls.slice(0, 70)}`);
      }
    }
    expect(bad, "Use <Avatar initials=\"…\" size=\"sm|md\" /> (DESIGN.md §9c)").toEqual([]);
  });

  test("an <Icon> takes no spread props — they would override its stroke and size", () => {
    const bad = FILES.filter((f) => f.rel !== "components/Icon.tsx" && /<Icon\b[^>]*\{\.\.\./.test(noArrows(code(f.text)))).map((f) => f.rel);
    expect(bad).toEqual([]);
  });

  test("an icon beside text in a button or link is sized by that text: text-xs → sm, text-sm → md, text-base → lg", () => {
    // The app's type scale is shifted up one step (globals.css): text-xs is 14px, text-sm 16px, text-base 18px — so the icon matches the letters.
    const WANT: Record<string, string> = { xs: "sm", sm: "md", base: "lg" };
    const tagEnd = (s: string, i: number) => {
      let depth = 0, q = "";
      for (let j = i + 1; j < s.length; j++) {
        const c = s[j];
        if (q) { if (c === q && s[j - 1] !== "\\") q = ""; } else if (c === '"' || c === "'" || c === "`") q = c;
        else if (c === "{") depth++; else if (c === "}") depth--; else if (c === ">" && depth === 0) return j + 1;
      }
      return -1;
    };
    const bad: string[] = [];
    for (const f of FILES) {
      if (PIECES.has(f.rel)) continue;
      const src = code(f.text);
      for (const m of src.matchAll(/<(button|Link|a)\b/g)) {
        const end = tagEnd(src, m.index!);
        if (end < 0 || src[end - 2] === "/") continue;
        const cls = /className=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(src.slice(m.index!, end));
        const ts = /(?<![\w-])text-(xs|sm|base)(?![\w-])/.exec(cls?.[1] ?? cls?.[2] ?? "");
        const close = src.indexOf(`</${m[1]}>`, end);
        if (!ts || close < 0) continue;
        const inner = src.slice(end, close);
        if (/<(button|Link|a)\b/.test(inner)) continue;
        for (const im of inner.matchAll(/<Icon\b[^>]*?\/>/g)) {
          const have = /size="(\w+)"/.exec(im[0])?.[1] ?? "md";
          if (have !== WANT[ts[1]]) bad.push(`${f.rel}: text-${ts[1]} button has an icon of size ${have} (want ${WANT[ts[1]]})`);
        }
      }
    }
    expect(bad.slice(0, 30)).toEqual([]);
  });

  test("--bg-subtle is a hover colour, never a static fill (DESIGN.md §9b)", () => {
    const bad: string[] = [];
    for (const f of FILES) for (const m of code(f.text).matchAll(/(?<![\w:-])bg-\[var\(--bg-subtle\)\]/g)) bad.push(`${f.rel}: ${m[0]}`);
    expect(bad, "Use bg-[var(--bg-app)] for a quiet fill; keep --bg-subtle for hover:").toEqual([]);
  });

  test("no Tailwind palette colour or plain white/gray utility: colours come from the theme tokens", () => {
    // gray-500, bg-white, text-red-600, border-amber-200 … do not follow light/dark and drift from the palette.
    // Allowed: text-white / bg-black scrims / white at an opacity (on the dark teal chrome), and every var(--token).
    const palette = /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border|ring|divide|from|to|via|fill|stroke|outline|placeholder|accent|caret|decoration|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d+)?(?![\w-])/g;
    const plainWhite = /(?<![\w:-])(?:[a-z-]+:)*(?:bg-white|border-white|divide-white|ring-white)(?![\w/-])/g;
    const hits: string[] = [];
    for (const f of FILES) {
      const t = code(f.text);
      for (const re of [palette, plainWhite]) for (const m of t.matchAll(re)) hits.push(`${f.rel}: ${m[0]}`);
    }
    expect(hits.slice(0, 40), `${hits.length} raw palette class(es) — use text-[var(--text-secondary)], bg-[var(--bg-surface)], border-[var(--border)] … (DESIGN.md §2)`).toEqual([]);
  });

  test("no hex colour literal in UI code: use a token (var(--…)) — only artwork and stored data may carry hex", () => {
    const hits: string[] = [];
    for (const f of FILES) {
      if (HEX_ALLOWED[f.rel]) continue;
      for (const m of code(f.text).matchAll(/#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b(?![\w-])/g)) hits.push(`${f.rel}: ${m[0]}`);
    }
    expect(hits.slice(0, 40), `${hits.length} hex literal(s) — add a token to globals.css and DESIGN.md if the palette truly lacks the colour`).toEqual([]);
  });

  // 8/11/2569 — a rubric's levels look the same on every screen (DESIGN.md §9e). Four forms: RubricCriterionCard / RubricLevelGrid (read),
  // RubricLevelPicker (pick), RubricCriteriaEditor (edit), RubricTable (compact). A screen that lists a criterion's levels by itself is how
  // seven different looks happened.
  const LEVEL_UI_ALLOWED: Record<string, string> = {
    "components/RubricLevels.tsx": "the level cell: read grid and picker",
    "components/RubricTable.tsx": "the compact table's level-names column",
    "components/RubricCriteriaEditor.tsx": "the editor — its level cells are inputs",
    "components/GradingRubricPanel.tsx": "the legend under the distribution bar (colour dot + count), not a level cell",
  };

  test("a criterion's levels are drawn by the shared rubric components, not by a page (DESIGN.md §9e)", () => {
    const bad: string[] = [];
    for (const f of FILES) {
      if (!f.rel.endsWith(".tsx") || LEVEL_UI_ALLOWED[f.rel]) continue;
      for (const m of code(f.text).matchAll(/\.levels\??\.map\(([\s\S]{0,200})/g)) if (/<[A-Za-z]/.test(m[1])) bad.push(f.rel);
    }
    expect(bad, "Use <RubricCriterionCard> / <RubricLevelGrid> (read), <RubricLevelPicker> (pick) or <RubricTable> (popup) — not your own level cells").toEqual([]);
  });

  test("the allow-list of level screens has no stale entries", () => {
    const stale = Object.keys(LEVEL_UI_ALLOWED).filter((rel) => !FILES.find((f) => f.rel === rel && /\.levels\??\.map\(/.test(code(f.text))));
    expect(stale).toEqual([]);
  });

  test("a level's colour comes from levelTone() only — no --level-N class outside lib/rubricLevels.ts", () => {
    const bad = FILES.filter((f) => f.rel !== "lib/rubricLevels.ts" && /-\[var\(--level-\d\)\]/.test(code(f.text))).map((f) => f.rel);
    expect(bad, "Use levelTone(i, total).dot / .label from lib/rubricLevels.ts").toEqual([]);
  });

  test("a level's name is readable in both themes: each --level-N passes 4.5:1 on the page, a card and the highlighted cell", () => {
    const css = fs.readFileSync(path.join(SRC, "app", "globals.css"), "utf8");
    const light = css.slice(css.indexOf(":root"), css.indexOf('[data-theme="dark"] {'));
    const dark = css.slice(css.indexOf('[data-theme="dark"] {'));
    const tok = (blk: string, name: string) => blk.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))?.[1] ?? "";
    const lum = (h: string) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    const low: string[] = [];
    for (const [theme, blk] of [["light", light], ["dark", dark]] as const) {
      for (const bg of ["bg-app", "bg-surface", "accent-subtle"]) {
        for (let n = 1; n <= 5; n++) {
          const fg = tok(blk, `level-${n}`), back = tok(blk, bg);
          expect(fg && back, `${theme}: --level-${n} / --${bg} not found in globals.css`).toBeTruthy();
          const r = ratio(fg, back);
          if (r < 4.5) low.push(`${theme} --level-${n} ${fg} on --${bg} ${back} = ${r.toFixed(2)}`);
        }
      }
    }
    expect(low, "The level name is text in this colour: darken (light) or lighten (dark) the token until it passes").toEqual([]);
  });

  test("no screen keeps its own green/blue/grey/red ramp for levels — a bar uses levelTone() too", () => {
    // two screens had one (the grading rubric panel and the Rubrics compare bar); a third copy is how the looks drift apart again
    const bad = FILES.filter((f) => /["']bg-\[var\(--s-ok-text\)\]["'],\s*["']bg-\[var\(--s-info-text\)\]["']/.test(code(f.text))).map((f) => f.rel);
    expect(bad, "Use levelTone(i, total).dot from lib/rubricLevels.ts for a level's colour").toEqual([]);
  });

  // 9/11/2569 — one meaning, one icon (DESIGN.md §9c "Which icon means what"). The glyph set was already uniform; what drifted was its use:
  // delete drawn as a bin on some screens and a cross on others, a red Cancel, a pale teal glyph that fails contrast, ✓ and 👋 typed as text.
  test("a teal icon is --accent: --accent-bright is a fill, never a glyph on a light surface (2.79:1, DESIGN.md §3)", () => {
    const bad = FILES.filter((f) => !PIECES.has(f.rel)).flatMap((f) => [...noArrows(code(f.text)).matchAll(/<Icon\b[^>]*accent-bright[^>]*>/g)].map((m) => `${f.rel}: ${m[0].slice(0, 90)}`));
    expect(bad, "Use text-[var(--accent)] on the icon").toEqual([]);
  });

  test("no symbol or emoji character stands in for an icon (✓ ✕ ↑ ↗ ▲ ▼ ★ 👋 …) — use <Icon name=…>; arrows inside a sentence (A → B) are punctuation and stay", () => {
    const symbol = /[↑↓↖-↙▲▼★☆☐-☒✓-✘⭐\u{1F300}-\u{1FAFF}]/u;
    const bad: string[] = [];
    for (const f of FILES) {
      code(f.text).split("\n").forEach((line, i) => { const m = line.match(symbol); if (m) bad.push(`${f.rel}:${i + 1} ${m[0]}`); });
    }
    expect(bad, "A done mark is <Icon name=\"check\">, a trend is <Icon name=\"trending-up\">, a sort arrow is the SortableTh icon").toEqual([]);
  });

  test("delete is a bin and is red; close / cancel is a cross and is never red — the two meanings do not swap", () => {
    const bad: string[] = [];
    for (const f of FILES) {
      for (const m of noArrows(code(f.text)).matchAll(/<IconButton\b[^>]*>/g)) {
        const tag = m[0];
        const icon = tag.match(/\bicon="([\w-]+)"/)?.[1];
        const danger = /\btone="danger"/.test(tag);
        if (icon === "x" && danger) bad.push(`${f.rel}: a red cross — a cross closes or cancels (neutral); deleting is icon="trash"`);
        if (icon === "trash" && !danger) bad.push(`${f.rel}: a bin that is not tone="danger"`);
      }
    }
    expect(bad).toEqual([]);
  });

  test("an empty or drop area draws its icon in an <IconTile>, not a bare xl <Icon> with mx-auto", () => {
    const bad = FILES.filter((f) => !PIECES.has(f.rel)).filter((f) => /<Icon\b[^>]*size="xl"[^>]*mx-auto/.test(noArrows(code(f.text)))).map((f) => f.rel);
    expect(bad, "Use <IconTile icon=… size=\"lg\" tone=\"accent\" /> (or <EmptyState>)").toEqual([]);
  });

  test("an export or template download is the download icon, an import is upload — the file-plus / file-download glyphs are gone", () => {
    const icon = FILES.find((f) => f.rel === "components/Icon.tsx")!.text;
    expect(icon).not.toMatch(/"file-plus"|"file-download"/);
  });

  test("import and export arrows point the way the data goes: Import = download (into the tray), Export = upload (out of the tray)", () => {
    // 9/11/2569 — the tray glyphs follow the Windows / Microsoft Import / Export pair: data coming IN is the arrow into the tray, data going OUT is the arrow out of it.
    // A screen that means "pick a file" or "attach files" uses image / paperclip, never one of these two. Checked by the words around the icon.
    const out = /Export|ส่งออก/, into = /Import|นำเข้า|Fill from|ดึงจาก|Drag|ลากไฟล์/;
    const bad: string[] = [];
    for (const f of FILES) {
      const t = noArrows(code(f.text));
      for (const m of t.matchAll(/<(?:Icon name|IconTile icon|IconButton icon)="(upload|download)"/g)) {
        const around = t.slice(Math.max(0, m.index! - 250), m.index! + 250);
        if (m[1] === "upload" && !out.test(around)) bad.push(`${f.rel}: upload arrow with no "Export" beside it`);
        if (m[1] === "download" && !into.test(around)) bad.push(`${f.rel}: download arrow with no "Import" / drop-area words beside it`);
      }
    }
    expect(bad, "Import = download, Export = upload; a template or a file is file-text, a cover is image, attached files are paperclip").toEqual([]);
  });

  test("an icon is always an outline: there is no `filled` prop and no --rating-fill token (a solid star beside outline icons read as another set)", () => {
    const icon = FILES.find((f) => f.rel === "components/Icon.tsx")!.text;
    expect(icon).not.toMatch(/\bfilled\??:/);
    const bad = FILES.filter((f) => /<(?:Icon|IconTile|IconButton|MetricCard)\b[^>]*\sfilled\b/.test(noArrows(code(f.text)))).map((f) => f.rel);
    expect(bad, "Draw the glyph as an outline like every other icon").toEqual([]);
    const css = fs.readFileSync(path.join(SRC, "app", "globals.css"), "utf8");
    expect(css).not.toContain("--rating-fill");
  });

  test("the old bright teal is a token now (--brand-bright), defined once in :root (it is the same in both themes)", () => {
    const css = fs.readFileSync(path.join(SRC, "app", "globals.css"), "utf8");
    expect((css.match(/--brand-bright:/g) ?? []).length).toBe(1);
  });
});

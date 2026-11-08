# UI design rules (apply to EVERY UI change — new page, new component, or a small tweak)

The source of truth is `DESIGN.md` (§9c Icons, §9d Colour usage, §13 checklist). It overrides generic skills such as interface-kit. Read the relevant section before writing UI, not after.

## Non-negotiable
- **Icons**: only `<Icon name="…" size="xs|sm|md|lg|xl" />` from `components/Icon.tsx`. Never paste an `<svg>` for a UI glyph. Stroke is fixed (2); sizes are tokens; colour is a token class on the icon. A missing glyph is added to `Icon.tsx` (24-grid outline), then used by name. Course icons → `CourseIcon`; logos → `BrandLogo`.
- **Pieces made of icons** (DESIGN.md §9c): an icon in a tinted box → `<IconTile>`; an icon-only button → `<IconButton label="…">` (label required, 36px, always visible); initials circle → `<Avatar>`; number-with-icon card → `<StatCard>` / `<MetricCard>`; empty panel → `<EmptyState icon="…">`; pages → `<Pagination>`. Never hand-size a `w-N h-N` box around an icon. An icon beside text is sized by the text (`text-xs` → sm, `text-sm` → md, `text-base` → lg); no CSS may set an icon's size.
- **Icon meaning** (DESIGN.md §9c "Which icon means what"): delete = `trash` (red); close / cancel = `x` (never red); Import = `download` (arrow into the tray), Export = `upload` (arrow out of it), a template file = `file-text`; an assignment = `file-text`; done = `check`; a trend = `trending-up`. No ✓ ↑ ↗ ▲ ▼ ★ or emoji as an icon; a teal glyph is `--accent`, never `--accent-bright`; an empty / drop area uses `IconTile` or `EmptyState`.
- **Rubric** (DESIGN.md §9e): show a rubric with `<RubricCriterionCard>` (read), `<RubricLevelPicker>` (pick), `<RubricTable>` (popup) or the editor — never map a criterion's `levels` into your own cells. A level reads "Level 3 · 4 pts"; its colour is `levelTone()` from `lib/rubricLevels.ts` (dot + name only, the cell stays neutral).
- **Colours**: only `var(--token)` (Tailwind arbitrary value, e.g. `text-[var(--text-secondary)]`). No `text-gray-*`, `bg-white`, `border-gray-*`, `amber/green/red/blue-*`, no hex literal. A missing colour becomes a token in `globals.css` (both themes, with a comment) and a row in DESIGN.md §9d first.
- **Both themes**: check light and dark, and the teal chrome. Text on a tint uses that tint's `-text` token; teal text is `--accent`, never `--accent-bright`.
- **Existing patterns**: buttons §4, badges §6, modal §9a, tables §9b, `EmptyState`, `PageHeader`; no hover-only actions; popups instead of drawers.
- **Strings**: `t("ไทย", "English")` via `useLanguage`; never Thai at module level.

## When you ADD something new (a page, a card, a button, an icon, a state) — do this before and after
The drift in this app (355 hand-pasted icons, a solid star beside outline icons, a bin on one screen and a cross on another for "delete") always came from the same move: building a piece by hand next to a documented one. So:
1. **Look first, build second.** Find the piece that already does the job (DESIGN.md §9c table "Building blocks", §9e rubric, §4 buttons, §6 badges, §9a modal, §9b tables). Use it; extend it if it is almost right. Never copy its markup into a page.
2. **Icons**: pick the glyph from "Which icon means what" (DESIGN.md §9c). A meaning that is not in the table gets a row first (one meaning, one icon), then the code. Always an outline, always `<Icon>`, never a character or emoji (✓ ↑ ↗ • 👋), never `--accent-bright` on a glyph.
3. **New kind of thing** (a card shape, a tile size, a tone, a button style, a colour): it does not exist until it is in DESIGN.md. Write the row (and the token in `globals.css`, both themes) in the same change, then use it. If you cannot justify a new one, use the nearest existing one.
4. **Same job = same look**: when one screen already shows the same fact (a stat, an empty state, an import drop area, a delete / cancel / export action), the new one must be indistinguishable in icon, size, colour and wording.
5. **After**: run `npx playwright test -c playwright.rules.config.ts` (1 s); look at it at a real width (1480px) in the browser and compare with the sibling screen; if you touched icons in more than one place run `node report-ui/icon-audit.mjs` then `node report-ui/icon-audit-sheet.mjs` (every icon on every screen, side by side) and look for the odd one out. Show the user before / after pictures (`report-ui/fixes-before-after.mjs` is the template) when a visible thing changed.
6. **A guard for every new rule**: if a mistake is checkable by a regex, add it to `tests/design-rules.spec.ts` (and mutation-check it by writing the bad code in a scratch file); if it needs the browser, to `tests/icon-consistency.spec.ts`. A rule that only lives in prose gets broken.

## Enforcement
`tests/design-rules.spec.ts` fails on an inline icon `<svg>`, a raw palette class, a hex literal, an `<Icon>` that overrides stroke/size or takes spread props, a hand-sized icon box, a bare icon-only `<button>`, a hand-made initials circle, a button icon that does not match its text size, a filled icon, a symbol / emoji used as an icon, a red cross or a non-red bin, a bare xl icon in a drop area, a teal glyph in --accent-bright, or a static `bg-[var(--bg-subtle)]`. Run it alone in ~1 s: `npx playwright test -c playwright.rules.config.ts`. The Stop hook runs it with the full suite when `src/` changes.
Adding to its allow-lists (`SVG_ALLOWED`, `HEX_ALLOWED`) is a design decision: say why in the entry.

## When a rule does not fit
Change DESIGN.md first (with the reason), then the code. Do not work around it in one page.

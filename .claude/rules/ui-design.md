# UI design rules (apply to EVERY UI change — new page, new component, or a small tweak)

The source of truth is `DESIGN.md` (§9c Icons, §9d Colour usage, §13 checklist). It overrides generic skills such as interface-kit. Read the relevant section before writing UI, not after.

## Non-negotiable
- **Icons**: only `<Icon name="…" size="xs|sm|md|lg|xl" />` from `components/Icon.tsx`. Never paste an `<svg>` for a UI glyph. Stroke is fixed (2); sizes are tokens; colour is a token class on the icon. A missing glyph is added to `Icon.tsx` (24-grid outline), then used by name. Course icons → `CourseIcon`; logos → `BrandLogo`.
- **Pieces made of icons** (DESIGN.md §9c): an icon in a tinted box → `<IconTile>`; an icon-only button → `<IconButton label="…">` (label required, 36px, always visible); initials circle → `<Avatar>`; number-with-icon card → `<StatCard>` / `<MetricCard>`; empty panel → `<EmptyState icon="…">`; pages → `<Pagination>`. Never hand-size a `w-N h-N` box around an icon. An icon beside text is sized by the text (`text-xs` → sm, `text-sm` → md, `text-base` → lg); no CSS may set an icon's size.
- **Rubric** (DESIGN.md §9e): show a rubric with `<RubricCriterionCard>` (read), `<RubricLevelPicker>` (pick), `<RubricTable>` (popup) or the editor — never map a criterion's `levels` into your own cells. A level reads "Level 3 · 4 pts"; its colour is `levelTone()` from `lib/rubricLevels.ts` (dot + name only, the cell stays neutral).
- **Colours**: only `var(--token)` (Tailwind arbitrary value, e.g. `text-[var(--text-secondary)]`). No `text-gray-*`, `bg-white`, `border-gray-*`, `amber/green/red/blue-*`, no hex literal. A missing colour becomes a token in `globals.css` (both themes, with a comment) and a row in DESIGN.md §9d first.
- **Both themes**: check light and dark, and the teal chrome. Text on a tint uses that tint's `-text` token; teal text is `--accent`, never `--accent-bright`.
- **Existing patterns**: buttons §4, badges §6, modal §9a, tables §9b, `EmptyState`, `PageHeader`; no hover-only actions; popups instead of drawers.
- **Strings**: `t("ไทย", "English")` via `useLanguage`; never Thai at module level.

## Enforcement
`tests/design-rules.spec.ts` fails on an inline icon `<svg>`, a raw palette class, a hex literal, an `<Icon>` that overrides stroke/size or takes spread props, a hand-sized icon box, a bare icon-only `<button>`, a hand-made initials circle, a button icon that does not match its text size, or a static `bg-[var(--bg-subtle)]`. Run it alone in ~1 s: `npx playwright test -c playwright.rules.config.ts`. The Stop hook runs it with the full suite when `src/` changes.
Adding to its allow-lists (`SVG_ALLOWED`, `HEX_ALLOWED`) is a design decision: say why in the entry.

## When a rule does not fit
Change DESIGN.md first (with the reason), then the code. Do not work around it in one page.

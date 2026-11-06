# HWAI Design System — "Slate Morning"

This file is the source of truth for color, component, and interaction rules across HWAI. It overrides the generic defaults in `/interface-kit` — when the two disagree, this file wins.

Built by reconciling two things that had drifted apart: the **design tokens** finalized after a multi-round WCAG review (see `DESIGN_REVIEW_LOG` at the bottom), and the **component patterns** already documented in the HWAI Knowledge Base (StatCard, PillTabBar, AccentColorStrip, OutlineDestructive, WCAGColorMap, SuspendReactivate, TeacherAssignPanel, BatchImportContext). Several KB patterns hardcode the *old* accent (`#2DD4BF`) and raw Tailwind colors — the mapping table in §6 shows exactly what changes.

## 1. Philosophy

HWAI is an academic tool (AI-assisted grading, course/CLO management) — not a startup marketing page. The palette should feel **ละมุน** (soft, composed) and never **กระโดด** (jarring against itself). Concretely: every accent color shares blue-undertone with the base navy (`#1A2D45`) — hue distance from navy stays under ~40° for anything meant to sit calmly in the UI. Anything hotter than that is reserved for the one moment it needs to grab attention (a solid CTA, a destructive confirm).

**The two-tier rule** (the one unifying idea this system is built on): almost every color category has a *soft* form for ambient UI and a *solid* form for the single decisive action in that category. Don't reach for solid by default — it's the exception, not the base state.

| Category | Soft (ambient, default) | Solid (the one decisive moment) |
|---|---|---|
| Accent/Primary | `--accent-bright` #4EA8A0 — strips, badge fills, focus ring · `--accent` #0F766E — the teal that is safe as text, a link or a border | `--accent-solid` #0F766E + white — the Primary button only |
| Destructive | `--s-err-*` — outline/tinted row actions, inline warnings | `--danger-solid` #C43A4A + white — the confirm-dialog's final "delete" button only |

## 2. Color Tokens

### Light mode

```css
:root {
  /* Surface */
  --bg-app:         #EEF2F7;
  --bg-card:        #FFFFFF;
  --bg-subtle:      #E4ECF3;
  --bg-nav:         #1A2D45;   /* same in both themes — sidebar doesn't flip */
  --border:         #C8D6E0;
  --border-subtle:  #E0E8F0;

  /* Text */
  --text-primary:   #1A2D45;
  --text-secondary: #4A6478;
  --text-muted:     #607080;

  /* Accent — soft (ambient) */
  --accent-bright:       #4EA8A0;  /* strips, badge fills, focus ring. NEVER text on a light surface (2.79:1) */
  --accent:              #0F766E;  /* text, links, borders — 5.48:1 on white */
  --accent-subtle:       #DFF0EE;

  /* Accent — solid (Primary button only) */
  --accent-solid:       #0F766E;
  --accent-solid-hover: #0D6259;
  --accent-solid-text:  #FFFFFF;

  /* Nav */
  --nav-text:       #D4EEF0;
  --nav-text-muted: #A8BCCE;
  --nav-active-bg:  rgba(78,168,160,.18);

  /* Disabled */
  --disabled-bg:     #EEF1F5;
  --disabled-text:   #A0AEBC;
  --disabled-border: #D4DCE4;

  /* Status */
  --s-ok-bg:   #E8F4ED; --s-ok-text:   #1A6645; --s-ok-bd:   #B8DCC8;
  --s-warn-bg: #FDF3E3; --s-warn-text: #7A5010; --s-warn-bd: #EDD8A0;
  --s-err-bg:  #FCEEF0; --s-err-text:  #8C2535; --s-err-bd:  #DDB0B8;
  --s-info-bg: #E8EEF8; --s-info-text: #2B4D8C; --s-info-bd: #B0C4E0;

  /* Destructive — solid (confirm-dialog final action only) */
  --danger-solid:       #C43A4A;
  --danger-solid-hover: #AE3240;
  --danger-solid-text:  #FFFFFF;

  /* Role badges (Teacher reuses --accent; Student reuses --s-info; TA is new) */
  --role-ta-bg:     #EEEAF7;
  --role-ta-text:   #5B4E96;
  --role-ta-border: #CFC5E8;
}
```

### Dark mode

```css
[data-theme="dark"] {
  --bg-app:         #0D1820;
  --bg-card:        #162232;
  --bg-subtle:      #1E2E40;
  --bg-nav:         #0A1218;
  --border:         #2A3F54;
  --border-subtle:  #1C2938;

  --text-primary:   #D4E4F0;
  --text-secondary: #7A9AB2;
  --text-muted:     #7090A8;

  --accent-bright:       #4EA8A0;
  --accent:              #4EA8A0;  /* the same teal reads as text on the dark surfaces (5.68:1) */
  --accent-subtle:       #123A38;

  /* NOT the same value as light mode — #0F766E only hits 2.93:1 against
     dark --bg-card, below the 3:1 floor for UI-component separation. */
  --accent-solid:       #12817A;
  --accent-solid-hover: #17968D;
  --accent-solid-text:  #FFFFFF;

  --nav-text:       #D4EEF0;
  --nav-text-muted: #A8BCCE;
  --nav-active-bg:  rgba(78,168,160,.18);

  --disabled-bg:     #1A2634;
  --disabled-text:   #4A6070;
  --disabled-border: #263444;

  --s-ok-bg:   #0D2E1E; --s-ok-text:   #5CC490; --s-ok-bd:   #1A4A32;
  --s-warn-bg: #2A1E08; --s-warn-text: #D4A04A; --s-warn-bd: #4A3010;
  --s-err-bg:  #2A0E14; --s-err-text:  #E07080; --s-err-bd:  #4A1A22;
  --s-info-bg: #0D1E3A; --s-info-text: #7AB0E8; --s-info-bd: #1A3060;

  --danger-solid:       #C43A4A;
  --danger-solid-hover: #D14A5A;
  --danger-solid-text:  #FFFFFF;

  --role-ta-bg:     #211C3A;
  --role-ta-text:   #B8A8E8;
  --role-ta-border: #3A2F5C;
}
```

> ⚠ `--role-ta-*` is a **new proposal**, not yet run through the same manual-contrast-then-tool-verify process the rest of the palette went through. Derived using the identical bg/text luminance formula as the four `--s-*` pairs (dark saturated text on a >90%-light tint), which reliably lands 5–7:1 — but confirm with a real contrast checker before shipping, same caveat as everything else in this file.

## 3. The one rule that broke twice during review

`--accent-bright` (#4EA8A0) is a **background/border token**, never a text color on a light surface — on white it is 2.79:1, fails AA. Every time this system slipped, it was this exact mistake (a badge, a link) reintroducing the failure after it had already been fixed once. If teal needs to be text, it's `--accent` (#0F766E). No exceptions. (This file once named them the other way round; the names above are the ones in `globals.css`.)

## 4. Buttons

| Variant | Style | When |
|---|---|---|
| **Primary** | `--accent-solid` bg + white, `border-radius:10px`, `font-weight:700`, uppercase | Form submit, main CTA — one per section |
| **Outline** | transparent + `--accent` border + `--text-primary` text | Secondary action still tied to accent workflow |
| **Ghost** | transparent + `--border` + `--text-secondary` | Cancel, Back — never the loudest button on screen |
| **Destructive (row-level)** | `--s-err-bg` bg + `--s-err-text` text + `--s-err-bd` border (outline/tinted, not solid) | Inline destructive actions in a table/list — matches the existing `OutlineDestructive` KB pattern |
| **Destructive (solid)** | `--danger-solid` bg + white | The single "Yes, delete" button inside a confirm dialog — never used standalone in a row |

Focus ring: `--accent` at **28%** opacity, 3px (not 15% — visually too faint to register).
Input radius: `9px` everywhere. Button radius: `10px` everywhere except `sm` size (`8px`).

**Sizes**: `sm` — `padding:5px 12px; font-size:11px; radius:8px`. Default — `padding:7-8px 16-18px; font-size:13px`. `lg` — `padding:10px 22px; font-size:14px; radius:11px`.

**States**: `:active` → `transform:scale(.97)` (press feedback, all variants). `:disabled` → `opacity:.4; cursor:not-allowed` (no separate disabled color — opacity is enough, don't invent a `--btn-disabled-*` token). Loading → `opacity:.7; cursor:wait` + spinner icon (`stroke:currentColor`, `1s linear infinite` rotation) replacing or preceding the label, button keeps its dimensions.

```css
.btn:active { transform: scale(.97); }
.btn:disabled { opacity: .4; cursor: not-allowed; }
.btn-loading { opacity: .7; cursor: wait; }
```

## 5. Inputs

```css
.inp {
  background: var(--bg-card);
  border: 1.5px solid var(--border);
  border-radius: 9px;
  padding: 9px 12px;
  font-size: 13px;
  color: var(--text-primary);
}
.inp::placeholder { color: var(--text-muted); }
.inp:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 28%, transparent);
}
.inp.inp-error {
  border-color: var(--danger-solid);
}
.inp.inp-error:focus {
  box-shadow: 0 0 0 3px rgba(196,58,74,.28);
}
.inp:disabled {
  background: var(--bg-subtle);
  color: var(--text-muted);
  cursor: not-allowed;
}
```

- **Label**: always visible, `--text-secondary`, `11px`, above the field — never placeholder-only.
- **Error message**: below the field, `--danger-solid` color, `11px`, leads with a `⚠` glyph and states what's wrong + how to fix it — not just "invalid".
- **Focus and error rings share the same 28% opacity and 3px spread** — the only difference is hue (teal vs red). Don't let one drift to a different opacity than the other; that was a real regression during review (error ring got left at 15% after the focus ring was fixed to 28%).

## 6. Status Badges

```css
.badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 500;
  padding: 3px 10px; border-radius: 99px;
  border: 1px solid;
}
.badge-ok   { background: var(--s-ok-bg);   color: var(--s-ok-text);   border-color: var(--s-ok-bd); }
.badge-warn { background: var(--s-warn-bg); color: var(--s-warn-text); border-color: var(--s-warn-bd); }
.badge-err  { background: var(--s-err-bg);  color: var(--s-err-text);  border-color: var(--s-err-bd); }
.badge-info { background: var(--s-info-bg); color: var(--s-info-text); border-color: var(--s-info-bd); }
.badge-dot  { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
```

Pill shape (`radius:99px`), always with a `background:currentColor` dot before the label — color alone never carries the meaning (WCAG: don't rely on color-only indicators). A generic teal count/tag badge (not a status) uses `--accent-subtle` background + `--accent-text-onlight` text — **never** `--accent` directly as the text color (see §3).

## 7. Cards & Lists

**Stat card** — no accent strip (the strip is a *page-header* pattern, not a card pattern; don't stamp it on every card or it stops meaning anything):

```css
.stat-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; }
.stat-label { font-size: 11px; color: var(--text-muted); }
.stat-value { font-size: 26px; font-weight: 600; color: var(--text-primary); font-variant-numeric: tabular-nums; }
.stat-delta { font-size: 11px; color: var(--s-ok-text); } /* or --text-muted for "no change" */
```

**List row** — hover background `--bg-subtle`, bottom border `--border` (last row: none). Avatar is either a light tint (`--accent-subtle` bg / `--accent` text — default, unassigned/neutral state) or solid (`--accent` bg / `--accent-text` text — assigned/active state, e.g. `TeacherAssignPanel`'s assigned rows):

```css
.list-row { padding: 10px 14px; border-bottom: 1px solid var(--border); }
.list-row:hover { background: var(--bg-subtle); }
.avatar { width: 30px; height: 30px; border-radius: 50%; font-size: 11px; font-weight: 600; }
.avatar-teal  { background: var(--accent-subtle); color: var(--accent); }
.avatar-solid { background: var(--accent); color: var(--accent-text); }
```

## 8. Navigation Sidebar

Two separate tokens drive this, not `--bg-nav` (which is a general-purpose navy reused in ~15 unrelated places — tab active-states, filter chips, cards — a sidebar/navbar re-theme must never touch it): `--navbar-bg` (the Navbar top bar) and `--sidebar-bg` (the 3 portal sidebars — `ProfileSidebar.tsx`/`AdminSidebar.tsx`/`StudentSidebar.tsx`). Both default to the same navy as `--bg-nav` and, like it, don't flip with light/dark — the chrome is always-dark by default. Sidebar text sits on it via dedicated `--nav-text` / `--nav-text-muted` tokens (and `--nav-active-text` for the active item), not the app's regular `--text-*` tokens, for the same reason.

```css
.nav-item { padding: 8px 16px; color: var(--nav-text-muted); }
.nav-item:hover { background: rgba(255,255,255,.08); color: var(--nav-text); }
.nav-item.active {
  background: var(--nav-active-bg);   /* rgba(78,168,160,.2) navy · rgba(0,0,0,.18-.2) teal, see below */
  color: var(--nav-active-text);
}
```

**Teal chrome (14/10/2569)** — the navbar and the 3 portal sidebars are teal for every role, in light and dark mode: navbar `--navbar-bg` `#084541`, sidebar `--sidebar-bg` `#0F766E` (the navbar takes the darker colour). This began on 22/9/2569 as an opt-in navy/teal toggle (advisor feedback: the same teal as the Sign-in button); the toggle, `NavThemeToggle.tsx`, `ThemeProvider`'s `navTheme` and the `data-nav-theme` attribute were removed on 14/10 and teal became the only chrome. It repaints only `--navbar-bg` / `--sidebar-bg` / `--sidebar-text-muted` / `--nav-active-bg` / `--nav-active-text` — never `--bg-nav`, which ~15 unrelated tab/chip/card backgrounds read. Contrast: the flat teal is lighter than navy at the same visual depth, so the sidebar's inactive text is white at 0.9 alpha (≈ 4.8:1; the old `white/55` gave ~2.8:1) and the active row *darkens* (black at 18–20%) instead of lightening, with plain white text (4.76:1 light / 4.73:1 dark) — lightening teal leaves no text colour able to reach 4.5:1. Dark mode uses a deeper pair — navbar `#052E2B`, sidebar `#0A4640` (the light-mode `#0F766E` sidebar glared against the dark page; white/90 on it is ≈ 10:1, and the active row lightens again with white at 12%). This departs from §1's "calm stays within ~40° of navy" rule on purpose.

## 9. Accent strip pattern

Unchanged in mechanism from the existing `AccentColorStrip` KB pattern — only the color token changes.

```tsx
<div className="pl-4" style={{ borderLeft: "3px solid var(--accent)" }}>
  <h1>...</h1>
</div>
```

Role-colored table rows keep the same left-border mechanism, remapped to tokens:
- Teacher → `var(--accent)`
- TA → `var(--role-ta-text)`
- Student → `var(--s-info-text)`

## 9a. Modal / popup (centred dialog)

Every "add / edit / import" form is a **centred popup**, not a side drawer (stakeholder decision 20/9/2569 — the right-hand drawers were retired). One component: `src/components/Modal.tsx`. Don't hand-roll an overlay in a page.

| Part | Spec |
|---|---|
| Overlay | `bg-black/40` (same as the confirm dialogs), covers the whole viewport **including the sticky top bar** |
| Layers | overlay `z-[60]`, dialog `z-[70]` — above the top bar (`z-50`). Nothing behind an open popup is clickable |
| Surface | `--bg-surface`, `1px --border-subtle`, `rounded-2xl`, **`shadow-2xl`** (the largest elevation — a modal sits furthest above the page), `max-h:90vh`, body scrolls, header stays |
| Width | `sm` 384px (confirmations) · `md` 512px (forms, default) · `lg` 672px (CSV import with a preview table). `calc(100% - 2rem)` on phones |
| Header | title `text-base font-bold --text-primary`; optional description `text-xs --text-secondary` (not `--text-muted` — 4.42:1 fails AA on white); close ✕ is an icon-only action → rest color **`--text-secondary`**, hover `--text-primary` on `--bg-subtle` |
| Footer row | right-aligned: **Ghost "Cancel"** (`--border` outline, `--text-secondary`) then **one Primary** (`--accent-solid`). `h-10 px-5 rounded-xl`, no shadow, `active:scale-[.97]`, `disabled:opacity-50` |
| Fields | same as §5; two short fields may share a row (`grid-cols-2 gap-3`); IDs/codes use `tabular-nums` |
| Status text | error `--s-err-text`, "already exists / heads-up" `--s-warn-text`, success check `--accent` on `--accent-subtle` (not `--accent-bright` — 2.79:1 as a glyph) |
| Motion | 150ms fade + scale .96→1 (`cubic-bezier(.23,1,.32,1)`), overlay fades; `prefers-reduced-motion` turns it off. Classes `.hwai-modal` / `.hwai-modal-overlay` in `globals.css`. No exit animation (an occasional, dismissible surface) |

**Behaviour (accessibility, non-negotiable):** `role="dialog" aria-modal="true"` labelled by the title (and described by the description); **Esc**, backdrop click, ✕ and Cancel all close it; **Tab is trapped** inside; focus moves to the first field on open (or an `autoFocus` field) and **returns to the button that opened it** on close (the opener is captured during render — an `autoFocus` field steals focus before effects run).

**Popup vs confirm dialog:** a small yes/no (delete, deactivate) stays the compact `max-w-sm` confirm dialog with the *solid destructive* button (§4); everything that collects input uses `Modal`.

## 9b. Data tables (teacher roster · admin Students · Score Book)

Settled 21/9/2569 while building the Score Book; the roster and admin Students tables already follow it.

- **Container**: `rounded-2xl` card, `border-[var(--border-subtle)]`, `--bg-surface`, `overflow-hidden`. If the table can grow, scroll *inside* the card (`overflow-auto` + `max-h`), never the page.
- **Toolbar** sits *above* the card, not inside it (the search suggestion list would be clipped by `overflow-hidden`): search + filters on the left, actions on the right, a count line ("x of y") below or beside.
- **Header**: `th` is `text-xs` (14px) semibold, uppercase, `tracking-wider`, `--text-muted`, on the same `--bg-surface` as the body — never a tinted fill (`--bg-subtle` is reserved for row hover, see the next bullet); sticky when the table scrolls. Differentiate the header with a `border-b --border-subtle` + the muted uppercase text alone. Sortable columns use `SortableTh` (asc → desc → back to the original order; active column `--accent`; `aria-sort`). A header never wraps — `whitespace-nowrap`; `tests/font-scale.spec.ts` fails any header taller than one line.
- **Rows**: cells 16px, `border-b --border-subtle`, hover `--bg-subtle`, **no bottom border on the last row** (it doubles up with the card edge). IDs and numbers are `tabular-nums`. Nothing found → one full-width "No results found" row.
- **Wide matrices** (Score Book): pin the identifying columns left (ID, Name) and the result columns right (Total, Grade) with `sticky` and an *opaque* background (`--bg-surface` for header, `--bg-subtle` only on hover) so scrolled cells never show through; category groups get their own first header row showing the weight; the class-average footer row is pinned to the bottom. A **single-row** table (e.g. the student's own Evaluation page, which reuses this same pattern — 22/9/2569) needs none of this: rows and columns swap (rows = assignments, grouped by category header rows instead of column groups) and there's no sticky/matrix machinery at that scale.
- **Score cells**: graded ≥ 80% `--s-ok-*`, 60–79% `--s-info-*`, < 60% `--s-err-*`; *awaiting grading* is `--s-warn-*` with a dot and the word "Pending"; *missing* (past due, nothing handed in) is `--s-err-*` with a dot and the word "Missing"; *not submitted yet* is a muted "—". Colour is never the only signal (text or shape too) and a legend sits above the table, using the exact same tokens as the cells it explains. `--s-warn-*` is reserved for "awaiting grading" so a warning colour always means "needs you".
- **Every tinted cell/pill gets its `--s-*-bd` border** (§6's `.badge` pattern applies here too, not just to status pills) — the pale `-bg` tints are calibrated against `--bg-card`; on a plain white/dark `--bg-surface` table they wash out (read as "kind of the same colour as the page") without the border. Real regression, caught by the user on the Score Book (21/9/2569): a `bg`-only chip and a `border-dashed` outline-only chip both blended into the surface; fixed by adding a solid border in the matching `-bd` token (e.g. `border-[var(--s-ok-bd)]`) to every one, including the legend swatches and any inline notice box built from the same tokens.
- **Totals** say what they are out of ("15.0 / 30"): the weighted total counts only categories that already have graded work, and it is the same figure the student sees on the Evaluation page.

## 9c. Icons

One component draws every icon: `components/Icon.tsx`. A page never contains an `<svg>` of its own for a UI glyph.

```tsx
<Icon name="check" size="sm" className="text-[var(--s-ok-text)]" />
```

| Rule | Value | Why |
|---|---|---|
| Grid, style | 24 × 24, outline, round caps and joins | one visual language; the set is Feather-style |
| Stroke | **2**, always — never passed in, never overridden | 355 inline icons used five widths (1.5 / 1.8 / 2 / 2.5 / 3) so no two screens drew the same glyph the same way |
| Size | `xs` 12 · `sm` 14 · `md` 16 (default) · `lg` 20 · `xl` 24 — a token, never a number | eight different pixel sizes were in use |
| Colour | `currentColor`: set the text colour with a token class (`text-[var(--accent)]`) | no hex in an icon; the icon follows the theme |
| Fill | `filled` fills the glyph with the same colour (rating star, play) | the only exception to "outline" |
| Accessibility | decorative (`aria-hidden`) by default; pass `label="…"` only when the icon stands alone | the text next to an icon names it |

**Which size where:** `xs` inside a small chip or badge (10–12px text) · `sm` next to 14px text, in table cells and row actions, sidebar sub-items · `md` in buttons, form fields, top-level sidebar items · `lg` in stat cards and section headers · `xl` in empty states.

**Icon beside text follows the text** (buttons, links, chips): `text-xs` (14px) → `sm`, `text-sm` (16px) → `md`, `text-base` (18px) → `lg`. The type scale is shifted up one step in `globals.css`, so these are the pixel sizes that match. A sidebar nav item is `md`; nothing sets an icon's size from CSS (`[&>svg]:w-4` on a parent beat the prop and drew every sidebar icon at 18px, because `w-4` is 18px on this app's spacing scale).

**Building blocks made of icons** — use them, never hand-build the same thing:

| Piece | What it is | Sizes / tones |
|---|---|---|
| `<IconTile>` | the tinted box an icon sits in: row marks, file tiles, empty states, "done" marks, a course's own icon | `sm` 36px (icon sm) · `md` 45px (icon lg) · `lg` 54px (icon xl); `shape="round"` for a status mark; tones `accent · ok · warn · err · info · ta · neutral · onDark · brand · cover` |
| `<IconButton>` | a button that is only an icon (edit, delete, close, show/hide, ⋮, page arrows): 36px, icon `sm`, always visible, **label required** (it is the accessible name and the tooltip) | tones `default · danger · warn · onDark`; `round` only for pagination; `dense` (27px) only inside a dense table cell such as the Score Book; `href` makes it a link |
| `<Avatar>` | a person's initials circle | `sm` 36px · `md` 45px; tones `accent` (people in a list) · `solid` + `bg` (a person's own colour / role) · `muted` · `brand` (the signed-in user in the top bar) |
| `<StatCard>` / `<MetricCard>` | a number with its icon. StatCard: icon left (admin, queue, results). MetricCard: icon top-right with a unit line (assignment Grading and Results). Both draw the icon in the same tile and take the same tones, so a "graded" card is the same green everywhere; every card in a row has the same icon tile, the same header height and the number on the same line | tones `ok · warn · info · accent · neutral · rating` |
| `<EmptyState icon="…">` | the empty panel; its icon is an `IconTile lg accent`. Empty states inside a card use the same tile | |
| `<Pagination>` | page arrows + numbers (… for long lists); the only pagination | |
| `<BrandLogo>` / `<CourseIcon>` | the HWAI mark; a course's icon (a glyph of the set) | |

**A glyph that is missing:** add one entry to `ICONS` in `Icon.tsx` (24-grid outline shapes only — no stroke or fill attributes on the shapes), then use it by name. Do not paste an SVG into a page. The names are typed, so a typo fails `tsc`.

**What is not an icon, and where it lives:** HWAI's mark and the Google / Microsoft sign-in logos → `components/BrandLogo.tsx`. Illustrations and charts (404 robot, empty-state art, progress ring, dashboard charts, donut) keep their own `<svg>`; they are listed, with a reason, in `tests/design-rules.spec.ts` (`SVG_ALLOWED`) — adding to that list is a design decision, not a shortcut. Course icons → `CourseIcon` (a name → glyph map on top of `Icon`).

## 9d. Colour usage — tokens only

Every colour in a component is a token from `globals.css` (`var(--…)`). That is what makes dark mode, the teal/navy chrome and contrast fixes work from one place.

- **No Tailwind palette classes**: `text-gray-500`, `bg-white`, `border-gray-200`, `text-amber-600`, `bg-green-100` … are all replaced. Use the table below. `text-white`, `bg-black/40` scrims and white-at-an-opacity (on the dark teal chrome) are fine.
- **No hex literals** in `.tsx`/`.ts` (except stored data such as the course cover presets, and brand/illustration artwork — both listed in the test). A colour the palette lacks becomes a token first (in both themes), with a comment saying what it is for.
- A colour is never built by string concatenation (`color + "80"`) — use `color-mix(in srgb, <colour> 50%, transparent)`, which works for hex and `var()` alike.

| You wrote | Write instead |
|---|---|
| `text-gray-900 / 800 / 700` | `text-[var(--text-primary)]` |
| `text-gray-600 / 500` | `text-[var(--text-secondary)]` |
| `text-gray-400 / 300`, `placeholder-gray-400` | `text-[var(--text-muted)]`, `placeholder:text-[var(--text-muted)]` |
| `bg-white` | `bg-[var(--bg-surface)]` |
| `bg-gray-50 / 100` (a static fill) | `bg-[var(--bg-app)]` — never `--bg-subtle` as a static fill (§9b) |
| `hover:bg-gray-50`, `hover:bg-white` | `hover:bg-[var(--bg-subtle)]` |
| `border-gray-100 / 50` | `border-[var(--border-subtle)]` |
| `border-gray-200 / 300` | `border-[var(--border)]` |
| amber / yellow (text, tint, border) | `--s-warn-text` / `--s-warn-bg` / `--s-warn-bd` · a solid button: `--warn-solid`, `--warn-solid-hover` |
| green / emerald | `--s-ok-*` · a dot or bar: `bg-[var(--s-ok-text)]` |
| red | `--s-err-*` (a solid confirm: `--danger-solid`) |
| blue / sky | `--s-info-*` |
| orange | `--st-todo-*` (to-do status) |
| purple / violet | `--role-ta-*` |
| teal tint | `--accent-subtle` |
| the bright logo teal `#2DD4BF` | `--brand-bright` (logo tile, avatar fill, accent words on the dark brand panel); text on it: `--brand-ink` |
| a 5-step good→bad scale (rubric levels, password strength) | `--level-1` … `--level-5` |
| a filled rating star | `--rating-fill` |
| a person's avatar hue | `--cat-1` … `--cat-8` |

## 10. Migration — old KB patterns → new tokens

| KB Pattern | What it hardcodes today | Maps to |
|---|---|---|
| `AccentColorStrip` | `#2DD4BF` literal | `var(--accent-bright)` |
| `OutlineDestructive` | `border-red-300 bg-red-50 text-red-700` (Tailwind) | `--s-err-bd` / `--s-err-bg` / `--s-err-text` |
| `WCAGColorMap` | Raw Tailwind pairs (`amber-800`/`amber-100`, `green-700`, `red-700`/`red-50`) | Superseded by `--s-warn-*`, `--s-ok-*`, `--s-err-*` — same intent (dark saturated text on light tint), now theme-aware (has dark-mode pairs, the old map didn't) |
| `StatCard` role tints | `#0F766E` (teacher), `#4F46E5` (student), `#7C3AED` (TA) — indigo/purple are a different hue family from navy, same "กระโดด" problem the old accent had | Teacher → `--accent`; Student → `--s-info-text`; TA → `--role-ta-text` (new, muted) |
| `TeacherAssignPanel` | `bg-[#2DD4BF]/5`, `bg-[#0F766E]` inline | `--accent-subtle` background tint, `--accent-solid` for the assigned-avatar fill |
| `SuspendReactivate` badge | `bg-amber-100 text-amber-700` | `--s-warn-bg` / `--s-warn-text` |

## 11. Typography

Unchanged from the existing stack — no new font introduced.

- **Lexend** — UI, headings, body (`--font-sans` in `globals.css`)
- **Prompt** — Thai-script fallback, same `--font-sans` stack
- **DM Mono** — data, hex values, code (used in KB + design docs; not yet used in the live app — optional if a monospace need appears, e.g. student IDs, timestamps)

## 12. Open items before implementation

1. `--role-ta-*` needs a real contrast-checker pass (see §2 warning).
2. `globals.css` currently names surface tokens `--bg-surface` (alias of `--bg-card`) — this file uses `--bg-card` as primary. Reconcile naming before merge: rename in `globals.css` or add the alias here, don't maintain two names for the same thing.
3. `--danger-solid` (#C43A4A) is a new token — nothing in the current codebase uses it yet (existing destructive actions use `bg-red-500`/`bg-red-600` per the earlier button audit). Implementing this file means replacing those, not adding a third destructive color.
4. Not yet covered here: toast/notification styling and pagination controls (modal / popup is §9a, data tables §9b). Extend this file when those get designed, don't invent them ad hoc in component code.

## 13. Before you ship UI — the checklist (every UI change, new page or small tweak)

1. **Icons** from `<Icon>` only, a size token, colour from a token class. Missing glyph → add it to `Icon.tsx`.
2. **Colours** from tokens only (§9d). No gray / palette class, no hex. Missing colour → add a token in both themes first.
3. **Look at both themes** (light and dark) and at the teal chrome — a screen that only works in one is not done.
4. **Contrast**: text on a tint uses that tint's `-text` pair; teal as text is `--accent`, never `--accent-bright` (§3).
5. **Buttons / badges / modals / tables / empty states** follow §4, §6, §9a, §9b and `EmptyState`; no hover-only actions.
6. **Words**: every visible string goes through `t("ไทย", "English")` (CLAUDE.md i18n rule); wording follows the terminology notes in `docs/design-stability-audit.md`.
7. **Run** `npx playwright test -c playwright.rules.config.ts` (the rules above, 1 second) — and the normal suite before calling it done. `tests/design-rules.spec.ts` fails the build on an inline icon, a palette class or a hex colour.

A rule that does not fit is changed *here* first (with the reason), then in the code — not worked around in one page.

---

*Reference: full interactive token + component preview at [Slate Morning v3](https://claude.ai/code/artifact/b31d88b0-8095-469d-b1eb-63b30b7bc90a).*

# HWAI Design System — "Slate Morning"

This file is the source of truth for color, component, and interaction rules across HWAI. It overrides the generic defaults in `/interface-kit` — when the two disagree, this file wins.

Built by reconciling two things that had drifted apart: the **design tokens** finalized after a multi-round WCAG review (see `DESIGN_REVIEW_LOG` at the bottom), and the **component patterns** already documented in the HWAI Knowledge Base (StatCard, PillTabBar, AccentColorStrip, OutlineDestructive, WCAGColorMap, SuspendReactivate, TeacherAssignPanel, BatchImportContext). Several KB patterns hardcode the *old* accent (`#2DD4BF`) and raw Tailwind colors — the mapping table in §6 shows exactly what changes.

## 1. Philosophy

HWAI is an academic tool (AI-assisted grading, course/CLO management) — not a startup marketing page. The palette should feel **ละมุน** (soft, composed) and never **กระโดด** (jarring against itself). Concretely: every accent color shares blue-undertone with the base navy (`#1A2D45`) — hue distance from navy stays under ~40° for anything meant to sit calmly in the UI. Anything hotter than that is reserved for the one moment it needs to grab attention (a solid CTA, a destructive confirm).

**The two-tier rule** (the one unifying idea this system is built on): almost every color category has a *soft* form for ambient UI and a *solid* form for the single decisive action in that category. Don't reach for solid by default — it's the exception, not the base state.

| Category | Soft (ambient, default) | Solid (the one decisive moment) |
|---|---|---|
| Accent/Primary | `--accent` #4EA8A0 — strips, badges, focus ring, active nav | `--accent-solid` #0F766E + white — the Primary button only |
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
  --accent:              #4EA8A0;
  --accent-subtle:       #DFF0EE;
  --accent-text:         #0D1820;  /* pairs with --accent as bg — avatar-solid only */
  --accent-text-onlight: #2D8A82;  /* the ONLY safe way to put accent color in text/links */

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

  --accent:              #4EA8A0;
  --accent-subtle:       #123A38;
  --accent-text:         #D4EEF0;
  --accent-text-onlight: #6BC4BB;

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

`--accent` is a **background/border token**, never a text color on a light surface — `color: var(--accent)` on white is 2.79:1, fails AA. Every time this system slipped, it was this exact mistake (a badge, a link) reintroducing the failure after it had already been fixed once. If teal needs to be text, it's `--accent-text-onlight`. No exceptions.

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

`--bg-nav` (`#1A2D45`, unchanged both themes — this is the one surface that deliberately doesn't flip). Text sits on it via dedicated `--nav-text` / `--nav-text-muted` tokens, not the app's regular `--text-*` tokens — the sidebar is always-dark regardless of theme, so it needs its own always-legible pair.

```css
.nav-item { padding: 8px 16px; color: var(--nav-text-muted); }
.nav-item:hover { background: rgba(255,255,255,.05); color: var(--nav-text); }
.nav-item.active {
  background: var(--nav-active-bg);         /* rgba(78,168,160,.18) */
  color: var(--nav-text);
  border-right: 2px solid var(--accent);
}
```

Active state is marked two ways at once (background tint **and** right border), not color alone — same WCAG reasoning as the badge dot in §6.

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

## 10. Migration — old KB patterns → new tokens

| KB Pattern | What it hardcodes today | Maps to |
|---|---|---|
| `AccentColorStrip` | `#2DD4BF` literal | `var(--accent)` |
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
4. Not yet covered here: toast/notification styling, modal overlay treatment, table/pagination controls. Extend this file when those get designed, don't invent them ad hoc in component code.

---

*Reference: full interactive token + component preview at [Slate Morning v3](https://claude.ai/code/artifact/b31d88b0-8095-469d-b1eb-63b30b7bc90a).*

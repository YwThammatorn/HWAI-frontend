@AGENTS.md

# Project Memory (CLAUDE.md)

> ไฟล์นี้คือ root memory — อ่านทุก session ก่อนเริ่มงาน รายละเอียดเชิงลึกแยกไว้ใน `.claude/rules/` เพื่อไม่ให้ไฟล์นี้ยาวเกินไป

## Standing rules (แยกไฟล์)
- Context / session hygiene → `.claude/rules/context-hygiene.md`
- Refactor & cleanup workflow → `.claude/rules/refactor-protocol.md`

## หลักการหลัก (ย่อ)
- ก่อนเริ่ม task ที่กระทบวงกว้าง (refactor, migration, เปลี่ยน architecture) → เปิด Plan Mode เสมอ
- Subtask ต้องเล็กพอให้จบได้ภายใน ~50% ของ context ต่อ session
- Commit ทันทีที่จบแต่ละ subtask — อย่าปล่อยค้าง
- Manual /compact ที่ ~50% ของ context — อย่ารอ auto-compact
- ไม่รู้ = ห้ามเดา → ประกาศ knowledge gap ก่อนเสมอ (รายละเอียดใน context-hygiene.md)
- เช็ค .claude/skills/ ที่มีอยู่ก่อนเขียนอะไรใหม่เอง — Claude โหลด skill เองอัตโนมัติ ไม่ต้องทำ manifest มือ
- ห้ามสรุปว่า "เสร็จแล้ว" โดยไม่รัน test จริง (มี hook บังคับอยู่แล้ว ดู .claude/hooks/)

## Current active task
_(อัปเดตช่องนี้ทุกครั้งที่เริ่ม task ใหม่ — ดูรายละเอียดที่ HANDOFF.md)_
- Task: follow-up feedback round (23/9) — CLO page mockup+layout, Grade Adjustment reverted to read-only (corrects a 22/9 misreading), Students table Program/Cohort cleanup, mock data variety (`c-mock-1`)
- Status: **done and pushed** (966e512, 1c37712, 34be2b4 + eff6819 mock data) — see HANDOFF.md. Previous task (2nd batch of 7 items, 4 sub-tasks) also fully done and pushed.

# i18n Rule (TH/EN Language Toggle)

Every page with visible Thai or English strings **must** use the `useLanguage` hook.

## Pattern

```tsx
import { useLanguage } from "@/context/LanguageContext";

export default function SomePage() {
  const { t, lang } = useLanguage();
  // ...
  return <p>{t("ข้อความไทย", "English text")}</p>;
}
```

## Rules

1. **Never** put Thai strings at module level (constants, arrays with labels). Compute them inside the component using `t()`.
2. For module-level option arrays with Thai labels (e.g. `FILE_TYPE_OPTIONS`), declare them inside the component body so `t()` is accessible.
3. For `window.confirm()` messages, use `t("Thai...", "English...")` at the call site.
4. Default language is `"th"`, persisted to `localStorage("hwai_lang")`.
5. The toggle button is in `AppShell` and available on every page.
6. When a component receives a `label` prop, translate at the callsite before passing, not inside the component.
7. Avoid naming a callback variable `t` in any component that imports `useLanguage` — it shadows the translation function. Use `tabKey`, `tp`, or similar instead.

@AGENTS.md

# Project Memory (CLAUDE.md)

> ไฟล์นี้คือ root memory — อ่านทุก session ก่อนเริ่มงาน รายละเอียดเชิงลึกแยกไว้ใน `.claude/rules/` เพื่อไม่ให้ไฟล์นี้ยาวเกินไป

## Standing rules (แยกไฟล์)
- Context / session hygiene → `.claude/rules/context-hygiene.md`
- Refactor & cleanup workflow → `.claude/rules/refactor-protocol.md`
- Testing (เขียน test เมื่อไหร่ + hook ที่รัน test เอง) → `.claude/rules/testing.md`

## หลักการหลัก (ย่อ)
- ก่อนเริ่ม task ที่กระทบวงกว้าง (refactor, migration, เปลี่ยน architecture) → เปิด Plan Mode เสมอ
- Subtask ต้องเล็กพอให้จบได้ภายใน ~50% ของ context ต่อ session
- Commit/push เมื่อผู้ใช้สั่งเท่านั้น — จบ subtask แล้วรัน test + รายงาน แล้วรอ; ตอนสั่ง commit ให้แยก commit ตามเรื่อง; push แยกต่างหาก (ผู้ใช้สั่ง "push work-log")
- Manual /compact ที่ ~50% ของ context — อย่ารอ auto-compact
- ไม่รู้ = ห้ามเดา → ประกาศ knowledge gap ก่อนเสมอ (รายละเอียดใน context-hygiene.md)
- เช็ค .claude/skills/ ที่มีอยู่ก่อนเขียนอะไรใหม่เอง — Claude โหลด skill เองอัตโนมัติ ไม่ต้องทำ manifest มือ
- ห้ามสรุปว่า "เสร็จแล้ว" โดยไม่รัน test จริง — hook Stop (`.claude/hooks/stop-verify.sh`) รัน tsc + test เมื่อไฟล์เสี่ยง regression เปลี่ยน; โค้ดที่เปลี่ยนพฤติกรรมต้องมี test ในงานเดียวกัน (ดู rules/testing.md)

## Current active task
_(อัปเดตช่องนี้ทุกครั้งที่เริ่ม task ใหม่ — ดูรายละเอียดที่ HANDOFF.md)_
- Task (11/10): one subject = one teacher across all its sections (mock), score bar chart for students, rubric criteria ↔ CLOs, then round 2: per-assignment grading method (AI-assisted / Manual), shorter announce wording, 3-card course Grading dashboard, no AI-confidence on announced results, admin "Deactivate batch" checklist, rubric wording/names/editor closer to the real UX/UI rubric file. Then (12/10): rubric reuse picker + library, Rubrics page (library, compare years), Calibration tab (AI strictness + rubric suggestions). Before that (7–10/10): faster tests / Stop hook / testing rules / UI-design report (`report-ui/`); (6–7/10): 4-level rubrics, exam CSV import, rubric lock.
- Status: all of 7–11/10 is uncommitted/unpushed except what the user has already committed (see `git log`); suite 745 passed / 31 skipped on a production build. Details in HANDOFF.md (last two sections).

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

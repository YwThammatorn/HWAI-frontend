@AGENTS.md

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

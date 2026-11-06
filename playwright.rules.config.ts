import { defineConfig } from "@playwright/test";

// Runs only the static design-rule checks (tests/design-rules.spec.ts): they read source files, so no server and no browser are needed.
// npx playwright test -c playwright.rules.config.ts
export default defineConfig({
  testDir: "./tests",
  testMatch: "design-rules.spec.ts",
  reporter: "list",
});

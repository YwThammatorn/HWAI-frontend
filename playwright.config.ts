import { defineConfig, devices } from "@playwright/test";

// Two ways to run the suite against http://localhost:3000:
//   npm run test:e2e        → `next dev` (what you have open while editing; slower: every page compiles on first hit)
//   npm run test:e2e:fast   → `next build` + `next start` (≈40% less total test time; the 7/10 measurement was
//                              4m38 dev vs 2m40 prod for 644 tests). E2E_PROD is set by playwright.prod.config.ts.
// Either way an already-running server on :3000 is reused, so stop a stray `next dev` before using :fast.
const PROD = !!process.env.E2E_PROD;

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  fullyParallel: true, // every test seeds its own localStorage in its own context, so file order and sharing a worker don't matter (7/10: 2m40 → 2m03 on prod)
  retries: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]],
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    screenshot: "only-on-failure",
    // `video: "retain-on-failure"` records EVERY test and throws the file away when it passes — a real CPU cost on
    // every run. A trace on the retry (a test only gets one when it failed once) keeps the debugging info for free.
    video: "off",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: PROD ? "npm run build && npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true, // ถ้า server รันอยู่แล้วก็ใช้ต่อ ไม่ start ซ้ำ
    timeout: 600000, // รอ 10 นาที เผื่อ first compile
  },
});

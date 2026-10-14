import { defineConfig, devices } from "@playwright/test";

// Two ways to run the suite:
//   npm run test:e2e        → `next dev` on :3000 (what you have open while editing; slower: every page compiles on first hit)
//   npm run test:e2e:fast   → `next build` + `next start` on :3100 (≈40% less total test time; the 7/10 measurement was
//                              4m38 dev vs 2m40 prod for 644 tests). playwright.prod.config.ts passes `prod` and the port in.
// A server already answering on the chosen port is reused. :fast has its own port, so a `next dev` you left running on :3000
// is left alone and the suite really runs on the production build (before 13/10 both shared :3000 and :fast silently tested dev mode).
// Every spec takes the address from tests/base.ts, which reads E2E_PORT in the worker — playwright.prod.config.ts sets it for them.
export function buildConfig(prod: boolean, port: string) {
  return defineConfig({
    testDir: ".",
    testMatch: "**/*.spec.ts",
    fullyParallel: true, // every test seeds its own localStorage in its own context, so file order and sharing a worker don't matter (7/10: 2m40 → 2m03 on prod)
    retries: 1,
    reporter: [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]],
    use: {
      baseURL: `http://localhost:${port}`,
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
      command: prod ? `npm run build && npm run start -- -p ${port}` : `npm run dev -- -p ${port}`,
      url: `http://localhost:${port}`,
      reuseExistingServer: true, // ถ้า server รันอยู่แล้วก็ใช้ต่อ ไม่ start ซ้ำ
      timeout: 600000, // รอ 10 นาที เผื่อ first compile
    },
  });
}

export default buildConfig(!!process.env.E2E_PROD, process.env.E2E_PORT ?? "3000");

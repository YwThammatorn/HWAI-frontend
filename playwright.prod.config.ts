// Same suite, run against a production build (`npm run test:e2e:fast`). Setting E2E_PROD here — the config is loaded
// before the workers are forked — lets playwright.config.ts pick `next build && next start` and lets the few tests that
// need dev-only UI (the login page's Dev Bypass panel, the role switcher) skip themselves.
process.env.E2E_PROD = "1";

export { default } from "./playwright.config";

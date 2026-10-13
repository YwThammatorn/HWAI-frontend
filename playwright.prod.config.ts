// Same suite, run against a production build (`npm run test:e2e:fast`) on its own port.
// The env vars are set here for the workers (forked after this file is loaded): E2E_PROD lets the few tests that need dev-only UI
// (the login page's Dev Bypass panel, the role switcher) skip themselves, E2E_PORT is what tests/base.ts reads. The values are also
// passed to buildConfig directly — a re-exported config module is evaluated BEFORE the statements below (the loader hoists it), so
// reading process.env inside it would still see the old values: the web server was checked on :3000 while the specs used :3100.
import { buildConfig } from "./playwright.config";

process.env.E2E_PROD = "1";
// its own port: a dev server on :3000 must never be reused (and silently tested instead of the production build)
process.env.E2E_PORT ??= "3100";

export default buildConfig(true, process.env.E2E_PORT);

// The address every spec talks to, in one place. playwright.config.ts decides the port: E2E_PORT, default 3000 (what `npm run dev`
// uses); playwright.prod.config.ts (`npm run test:e2e:fast`) sets 3100 so a dev server left running on 3000 is never reused by mistake.
export const BASE = `http://localhost:${process.env.E2E_PORT ?? "3000"}`;

// Renders report-ui/ai-agent-diagram.html to report-ui/shots-book/ai-agent-flow.png (2x) — the diagram for section 3.10 of the book (11/11/2569).
//   node report-ui/ai-agent-diagram.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const OUT = path.resolve("report-ui/shots-book"); fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 2000, height: 720 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto("file:///" + path.resolve("report-ui/ai-agent-diagram.html").split("\\").join("/"));
await page.locator("#diagram").screenshot({ path: path.join(OUT, "ai-agent-flow.png") });
await browser.close();
console.log("wrote", path.join(OUT, "ai-agent-flow.png"));

// Lays out report-ui/icon-audit.mjs's result: one block per icon, every distinct look of it with its surroundings (9/11/2569).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(path.resolve("node_modules/@playwright/test"));
const OUT = path.resolve("report-ui/icon-audit-9-nov");
const { usage, looks } = JSON.parse(fs.readFileSync(OUT + "/usage.json", "utf8"));
const file = Object.fromEntries(looks);

const groups = new Map();
for (const u of usage) {
  if (!groups.has(u.name)) groups.set(u.name, new Map());
  const g = groups.get(u.name);
  if (!g.has(u.sig)) g.set(u.sig, { ...u, n: 0, pages: new Set() });
  const e = g.get(u.sig); e.n++; e.pages.add(u.page.replace(/^\/(teacher|student|admin)\/courses\/c-mock-4/, "/$1/…").replace(/a-uxui-13/, "[id]"));
}
const order = [...groups.entries()].sort((a, b) => [...b[1].values()].reduce((s, x) => s + x.n, 0) - [...a[1].values()].reduce((s, x) => s + x.n, 0));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const block = ([name, g]) => {
  const looksArr = [...g.values()].sort((a, b) => b.n - a.n);
  const total = looksArr.reduce((s, x) => s + x.n, 0);
  const sizes = [...new Set(looksArr.map((x) => x.px))].sort((a, b) => a - b).join(" / ");
  return `<section style="background:#fff;border:1px solid #D5DEE8;border-radius:12px;padding:12px 14px;break-inside:avoid;margin:0 0 12px">
    <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:8px"><b style="font-size:16px">${name}</b><span style="color:#4A6478;font-size:12px">${total} uses · ${looksArr.length} look${looksArr.length > 1 ? "s" : ""} · sizes ${sizes}px${looksArr.some((x) => x.filled) ? " · <b style=color:#8C2535>has FILLED</b>" : ""}</span></div>
    <div style="display:flex;flex-wrap:wrap;gap:10px">${looksArr.map((x) => `<figure style="margin:0;max-width:330px">
      ${file[x.sig] ? `<img src="file:///${OUT.replace(/\\/g, "/")}/${file[x.sig]}" style="display:block;max-width:330px;max-height:120px;border:1px solid #E0E8F0;border-radius:6px;background:#fff"/>` : `<div style="width:120px;height:40px;background:#EEF2F7;border-radius:6px"></div>`}
      <figcaption style="font-size:11px;line-height:1.35;color:#1A2D45;margin-top:3px"><b>${x.px}px</b> · ${esc(x.kind)}${x.kind === "tile" ? ` ${x.tilePx}px ${esc(x.tileTok.split(" ")[0])}` : ""} · ${esc(x.tok.split(" ")[0])}${x.filled ? " · <b style=color:#8C2535>filled</b>" : ""} · ×${x.n}<br><span style="color:#4A6478">${esc([...x.pages][0])}</span></figcaption></figure>`).join("")}</div></section>`;
};

const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 1640, height: 900 } });
// split into sheets of ~equal height: fill columns greedily by block count
const per = Math.ceil(order.length / 5);
const files = [];
for (let s = 0; s < 5; s++) {
  const part = order.slice(s * per, (s + 1) * per);
  if (!part.length) break;
  const html = `<body style="margin:0;padding:18px 22px;background:#EEF2F7;font-family:'Prompt','Leelawadee UI',Tahoma,sans-serif;color:#1A2D45">
    <div style="font-size:20px;font-weight:700;margin-bottom:4px">Every icon, every look — sheet ${s + 1}/5 (${part.map((p) => p[0]).slice(0, 1)} … most-used first)</div>
    <div style="font-size:12px;color:#4A6478;margin-bottom:12px">caption = size · what it sits in (button / link / tile NNpx colour / bare) · glyph colour token · filled · uses</div>
    <div style="column-count:2;column-gap:12px">${part.map(block).join("")}</div></body>`;
  const f = `${OUT}/_sheet-${s + 1}.html`;
  fs.writeFileSync(f, html);
  await pg.goto("file:///" + f.replace(/\\/g, "/"));
  await pg.waitForTimeout(800);
  const png = `${OUT}/sheet-${s + 1}.png`;
  await pg.screenshot({ path: png, fullPage: true });
  files.push(png);
}
await browser.close();
console.log(files);

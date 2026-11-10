// Draws the sample design frames the demo class "submits" (10/11/2569) — wireframe SVGs in public/mock-data/frames/.
//
//   node scripts/build-frames.ts        (Node 22.18+ / 24 runs TypeScript directly)
//
// Grading Review shows the student's work as frozen frames (lib/assignments.ts WorkSnapshot). A real deployment stores screenshots taken at the
// deadline; the demo has no real designs, so these stand in. To use real screenshots instead: drop the images next to these, and change `image`
// in FRAMES — nothing else reads the files. Deterministic (no randomness), so a re-run changes nothing.

import fs from "node:fs";

export const FRAME_DIR = "public/mock-data/frames";
export interface FrameDef { id: string; name: string; file: string }
/** The pool the mock-data script picks from (3–6 frames per submission). `image` is the URL the app loads. */
export const FRAMES: FrameDef[] = [
  { id: "login", name: "Login", file: "login.svg" },
  { id: "home", name: "Home", file: "home.svg" },
  { id: "product-list", name: "Product list", file: "product-list.svg" },
  { id: "product-detail", name: "Product detail", file: "product-detail.svg" },
  { id: "checkout", name: "Checkout", file: "checkout.svg" },
  { id: "order-done", name: "Order confirmed", file: "order-done.svg" },
];
export const frameImage = (f: FrameDef) => `/mock-data/frames/${f.file}`;

const W = 800, H = 520;
// wireframe greys; this is an image, not app chrome, so it does not take the app's tokens
const INK = "#334155", LINE = "#cbd5e1", FILL = "#e2e8f0", PAPER = "#ffffff", MUTED = "#94a3b8", ACCENT = "#0f766e";

const rect = (x: number, y: number, w: number, h: number, o: { fill?: string; stroke?: string; r?: number } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r ?? 6}" fill="${o.fill ?? PAPER}" stroke="${o.stroke ?? LINE}" stroke-width="1.5"/>`;
const text = (x: number, y: number, s: string, size = 14, o: { fill?: string; weight?: number; anchor?: string } = {}) =>
  `<text x="${x}" y="${y}" font-family="Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="${o.weight ?? 400}" fill="${o.fill ?? INK}" text-anchor="${o.anchor ?? "start"}">${s}</text>`;
const bar = (x: number, y: number, w: number, h = 8) => rect(x, y, w, h, { fill: FILL, stroke: "none", r: 4 });
const btn = (x: number, y: number, w: number, label: string, primary = true) =>
  rect(x, y, w, 40, { fill: primary ? ACCENT : PAPER, stroke: primary ? ACCENT : LINE, r: 8 }) + text(x + w / 2, y + 25, label, 14, { fill: primary ? "#ffffff" : INK, weight: 600, anchor: "middle" });
const field = (x: number, y: number, w: number, label: string) => text(x, y - 8, label, 12, { fill: MUTED }) + rect(x, y, w, 40, { r: 8 });
const nav = (title: string) => rect(0, 0, W, 56, { fill: PAPER, stroke: LINE, r: 0 }) + text(28, 35, "Shopli", 18, { weight: 700, fill: ACCENT }) + text(W - 28, 35, title, 13, { fill: MUTED, anchor: "end" })
  + [0, 1, 2].map((i) => bar(220 + i * 90, 24, 56)).join("");
const card = (x: number, y: number, w: number, h: number) => rect(x, y, w, h) + rect(x + 12, y + 12, w - 24, h - 90, { fill: FILL, stroke: "none", r: 6 }) + bar(x + 12, y + h - 62, w * 0.6, 10) + bar(x + 12, y + h - 40, w * 0.35) + text(x + w - 14, y + h - 18, "฿590", 13, { weight: 700, anchor: "end" });

const BODIES: Record<string, string> = {
  login: nav("Sign in") + rect(260, 96, 280, 372, { r: 14 }) + text(400, 140, "Welcome back", 20, { weight: 700, anchor: "middle" }) + bar(320, 158, 160)
    + field(284, 206, 232, "Email") + field(284, 280, 232, "Password") + btn(284, 344, 232, "Sign in") + text(400, 412, "Forgot password?", 12, { fill: ACCENT, anchor: "middle" }) + text(400, 444, "Create an account", 12, { fill: MUTED, anchor: "middle" }),
  home: nav("Home") + rect(28, 80, 744, 150, { fill: FILL, stroke: "none", r: 12 }) + text(60, 138, "Spring sale — up to 40% off", 24, { weight: 700 }) + bar(60, 160, 260) + btn(60, 180, 140, "Shop now")
    + text(28, 266, "Popular now", 16, { weight: 700 }) + [0, 1, 2, 3].map((i) => card(28 + i * 188, 282, 172, 216)).join(""),
  "product-list": nav("Shoes") + rect(28, 76, 200, 424, { r: 10 }) + text(46, 106, "Filters", 15, { weight: 700 })
    + [0, 1, 2, 3].map((i) => rect(46, 128 + i * 52, 16, 16, { r: 4 }) + bar(74, 132 + i * 52, 110)).join("") + btn(46, 440, 164, "Apply", false)
    + [0, 1, 2, 3, 4, 5].map((i) => card(252 + (i % 3) * 180, 76 + Math.floor(i / 3) * 214, 164, 202)).join(""),
  "product-detail": nav("Shoes / Runner") + rect(28, 80, 340, 400, { fill: FILL, stroke: "none", r: 12 }) + [0, 1, 2].map((i) => rect(28 + i * 116, 488, 100, 22, { r: 6 })).join("")
    + text(404, 112, "Runner Lite", 24, { weight: 700 }) + text(404, 146, "฿2,490", 20, { weight: 700, fill: ACCENT }) + bar(404, 168, 330) + bar(404, 188, 290) + bar(404, 208, 310)
    + text(404, 252, "Size", 13, { fill: MUTED }) + [0, 1, 2, 3, 4].map((i) => rect(404 + i * 62, 264, 52, 40, { r: 8, stroke: i === 2 ? ACCENT : LINE })).join("")
    + btn(404, 340, 330, "Add to cart") + btn(404, 392, 330, "Save for later", false),
  checkout: nav("Checkout · Step 2 of 3") + [0, 1, 2].map((i) => rect(28 + i * 240, 76, 224, 8, { fill: i < 2 ? ACCENT : FILL, stroke: "none", r: 4 })).join("")
    + text(28, 124, "Shipping address", 17, { weight: 700 }) + field(28, 160, 350, "Full name") + field(402, 160, 350, "Phone") + field(28, 236, 724, "Address") + field(28, 312, 350, "District") + field(402, 312, 350, "Postcode")
    + rect(28, 384, 724, 76, { fill: FILL, stroke: "none", r: 10 }) + text(48, 416, "Order total", 14) + text(752 - 20, 416, "฿2,490", 16, { weight: 700, anchor: "end" }) + btn(572, 470, 180, "Continue"),
  "order-done": nav("Order confirmed") + `<circle cx="400" cy="150" r="46" fill="${ACCENT}"/>` + `<path d="M378 150 l16 16 l30 -34" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`
    + text(400, 244, "Thank you — your order is on its way", 22, { weight: 700, anchor: "middle" }) + bar(300, 266, 200)
    + rect(220, 300, 360, 120, { r: 12 }) + text(244, 334, "Order #A-20417", 14, { weight: 700 }) + bar(244, 352, 240) + bar(244, 372, 180) + btn(300, 440, 200, "Track my order"),
};

export function svgFor(id: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#f8fafc"/>${BODIES[id]}</svg>\n`;
}

const isMain = (process.argv[1] ?? "").split("\\").join("/").endsWith("scripts/build-frames.ts");
if (isMain) {
  fs.mkdirSync(FRAME_DIR, { recursive: true });
  for (const f of FRAMES) fs.writeFileSync(`${FRAME_DIR}/${f.file}`, svgFor(f.id));
  console.log(`${FRAMES.length} frames → ${FRAME_DIR}`);
}

"use client";

import { useId, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";

const W = 800, H = 260;
const PAD = { l: 20, r: 20, t: 46, b: 58 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const one = (n: number) => n.toFixed(1);

function niceTicks(lo: number, hi: number): number[] {
  const step = [0.5, 1, 2, 5, 10, 20, 25, 50].find((s) => (hi - lo) / s <= 8) ?? 100;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

/** Standard normal CDF (Abramowitz–Stegun erf approximation, error < 1.5e-7). */
function normalCdf(z: number): number {
  const t = 1 / (1 + (0.3275911 * Math.abs(z)) / Math.SQRT2);
  const erf = 1 - ((((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp((-z * z) / 2);
  return 0.5 * (1 + Math.sign(z) * erf);
}

/**
 * A normal curve fitted to the class's average and SD (not a histogram of the real scores — a handful of
 * students can't fill one). It draws itself in, shades the part of the class you scored higher than, drops a
 * marker where you sit, and follows the pointer with a read-out. `percentile` is the real share of classmates
 * below you; the hover read-out is the curve's estimate and says so.
 */
export default function BellCurve({ mean, sd, myScore, maxPoints, percentile }: {
  mean: number;
  sd: number;
  myScore: number | null;
  maxPoints: number;
  percentile: number | null;
}) {
  const { t } = useLanguage();
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const [run, setRun] = useState(0);

  const d0 = Math.max(0, mean - 4 * sd);
  const d1 = Math.min(maxPoints, mean + 4 * sd);
  const x = (v: number) => PAD.l + ((v - d0) / (d1 - d0)) * PLOT_W;
  const shape = (v: number) => Math.exp(-0.5 * ((v - mean) / sd) ** 2);   // peak = 1
  const y = (v: number) => PAD.t + PLOT_H - shape(v) * PLOT_H;
  const base = PAD.t + PLOT_H;

  const pts: [number, number][] = [];
  for (let i = 0; i <= 160; i++) {
    const v = d0 + ((d1 - d0) * i) / 160;
    pts.push([x(v), y(v)]);
  }
  const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
  const area = `${line} L${x(d1).toFixed(1)} ${base} L${x(d0).toFixed(1)} ${base} Z`;

  const me = myScore !== null ? Math.min(d1, Math.max(d0, myScore)) : null;
  const meX = me !== null ? x(me) : 0;
  let belowYou = "";
  if (me !== null && meX > PAD.l) {
    const left = pts.filter(([px]) => px <= meX);
    belowYou = `M${PAD.l} ${base} ${left.map(([px, py]) => `L${px.toFixed(1)} ${py.toFixed(1)}`).join(" ")} L${meX.toFixed(1)} ${y(me!).toFixed(1)} L${meX.toFixed(1)} ${base} Z`;
  }

  const z = myScore !== null ? (myScore - mean) / sd : null;
  const pillText = myScore !== null
    ? `${t("คุณ", "You")} ${num(myScore)}${percentile !== null ? ` · ${t(`ดีกว่า ${percentile}%`, `better than ${percentile}%`)}` : ""}`
    : "";
  const pillW = Math.round(pillText.length * 7.4 + 26);
  const pillX = Math.min(Math.max(meX - pillW / 2, 2), W - pillW - 2);

  const sdMarks = [-3, -2, -1, 0, 1, 2, 3].map((k) => ({ k, v: mean + k * sd })).filter(({ v }) => v >= d0 && v <= d1);

  const hv = hover;
  const hz = hv !== null ? (hv - mean) / sd : null;
  const hPct = hz !== null ? Math.round(normalCdf(hz) * 100) : null;
  const hxPct = hv !== null ? (x(hv) / W) * 100 : 0;
  const hyPct = hv !== null ? (y(hv) / H) * 100 : 0;

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const vx = ((e.clientX - box.left) / box.width) * W;
    setHover(Math.min(d1, Math.max(d0, d0 + ((vx - PAD.l) / PLOT_W) * (d1 - d0))));
  }

  const summary = t(
    `โค้งระฆังคว่ำโดยประมาณจากค่าเฉลี่ย ${one(mean)} และ SD ${one(sd)}` +
      (z !== null ? ` คะแนนของคุณอยู่${z >= 0 ? "เหนือ" : "ต่ำกว่า"}ค่าเฉลี่ย ${Math.abs(z).toFixed(1)} SD` : "") +
      (percentile !== null ? ` ดีกว่าเพื่อนร่วมห้อง ${percentile}%` : ""),
    `Bell curve fitted to the class average ${one(mean)} and SD ${one(sd)}` +
      (z !== null ? `; your score is ${Math.abs(z).toFixed(1)} SD ${z >= 0 ? "above" : "below"} the average` : "") +
      (percentile !== null ? `; better than ${percentile}% of your classmates` : "")
  );

  return (
    <figure className="m-0">
      <div className="relative" key={run}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="block h-auto w-full touch-none select-none">
          <defs>
            <clipPath id={`${uid}-all`}><rect x={PAD.l} y={0} width={PLOT_W} height={H} className="hwai-bell-wipe" /></clipPath>
            <clipPath id={`${uid}-me`}><rect x={PAD.l} y={0} width={Math.max(meX - PAD.l, 1)} height={H} className="hwai-bell-wipe" style={{ animationDelay: "250ms" }} /></clipPath>
          </defs>

          <path d={area} clipPath={`url(#${uid}-all)`} className="fill-[var(--accent-bright)]/10" />
          {belowYou && <path d={belowYou} clipPath={`url(#${uid}-me)`} className="fill-[var(--accent-bright)]/35" />}
          <path d={line} pathLength={1} fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="hwai-bell-draw stroke-[var(--accent-solid)]" />

          <line x1={PAD.l} x2={W - PAD.r} y1={base} y2={base} strokeWidth="1" className="stroke-[var(--border-subtle)]" />
          {niceTicks(d0, d1).map((v) => (
            <g key={v}>
              <line x1={x(v)} x2={x(v)} y1={base} y2={base + 5} strokeWidth="1" className="stroke-[var(--border-subtle)]" />
              <text x={x(v)} y={base + 20} textAnchor="middle" fontSize="12" className="fill-[var(--text-muted)] tabular-nums">{num(v)}</text>
            </g>
          ))}
          {sdMarks.map(({ k, v }) => (
            <text key={k} x={x(v)} y={base + 42} textAnchor="middle" fontSize="11" fontWeight={k === 0 ? 600 : 400} className="hwai-bell-fade fill-[var(--text-muted)]" style={{ animationDelay: "600ms" }}>
              {k === 0 ? t("เฉลี่ย", "avg") : `${k > 0 ? "+" : "−"}${Math.abs(k)} SD`}
            </text>
          ))}

          <g className="hwai-bell-fade" style={{ animationDelay: "600ms" }}>
            <line x1={x(mean)} x2={x(mean)} y1={y(mean)} y2={base} strokeWidth="2" strokeDasharray="4 4" className="stroke-[var(--text-secondary)]" />
            <text x={x(mean)} y={y(mean) - 8} textAnchor="middle" fontSize="12" fontWeight="600" className="fill-[var(--text-secondary)] tabular-nums">
              {t("เฉลี่ย", "Average")} {one(mean)}
            </text>
          </g>

          {me !== null && (
            <g className="hwai-bell-drop" style={{ animationDelay: "850ms" }}>
              <line x1={meX} x2={meX} y1={PAD.t - 10} y2={base} strokeWidth="1.5" className="stroke-[var(--accent-solid)]" />
              <circle cx={meX} cy={y(me)} r="7" strokeWidth="3" className="fill-[var(--accent-solid)] stroke-[var(--bg-surface)]" />
              <rect x={pillX} y={2} width={pillW} height={24} rx={12} className="fill-[var(--accent-solid)]" />
              <text x={pillX + pillW / 2} y={18} textAnchor="middle" fontSize="12.5" fontWeight="600" className="fill-[var(--accent-solid-text)] tabular-nums">{pillText}</text>
            </g>
          )}

          {hv !== null && (
            <g pointerEvents="none">
              <line x1={x(hv)} x2={x(hv)} y1={PAD.t - 10} y2={base} strokeWidth="1" strokeDasharray="3 3" className="stroke-[var(--text-muted)]" />
              <circle cx={x(hv)} cy={y(hv)} r="5" strokeWidth="2" className="fill-[var(--bg-surface)] stroke-[var(--accent-solid)]" />
            </g>
          )}
          <rect x={PAD.l} y={PAD.t - 10} width={PLOT_W} height={PLOT_H + 10} fill="transparent" className="cursor-crosshair" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
        </svg>

        {hv !== null && hz !== null && hPct !== null && (
          <div aria-hidden="true" className="pointer-events-none absolute z-10 w-max max-w-[220px] -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs shadow-lg"
            style={{ left: `${Math.min(86, Math.max(14, hxPct))}%`, top: `${hyPct}%` }}>
            <p className="font-semibold tabular-nums text-[var(--text-primary)]">{t("คะแนน", "Score")} {Math.round(hv)} <span className="font-normal text-[var(--text-muted)]">/ {maxPoints}</span></p>
            <p className="mt-0.5 text-[var(--text-secondary)]">{t(`ประมาณ ${hPct}% ของห้องได้ต่ำกว่านี้`, `≈ ${hPct}% of the class scored lower`)}</p>
            <p className="tabular-nums text-[var(--text-muted)]">{hz >= 0 ? "+" : "−"}{Math.abs(hz).toFixed(1)} SD</p>
          </div>
        )}
      </div>

      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)] @2xl:text-sm">
        {myScore !== null && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-[var(--accent-bright)]/35" aria-hidden="true" />{t("ส่วนของห้องที่คะแนนต่ำกว่าคุณ", "Classmates you scored higher than")}</span>}
        <span className="inline-flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-[var(--text-secondary)]" aria-hidden="true" />{t("ค่าเฉลี่ย", "Average")}</span>
        {z !== null && <span className="tabular-nums">{t(`คุณอยู่${z >= 0 ? "เหนือ" : "ต่ำกว่า"}ค่าเฉลี่ย ${Math.abs(z).toFixed(1)} SD`, `You are ${Math.abs(z).toFixed(1)} SD ${z >= 0 ? "above" : "below"} the average`)}</span>}
        <span className="text-[var(--text-muted)]">{t("โค้งประมาณจากค่าเฉลี่ยและ SD · เลื่อนเมาส์บนกราฟเพื่อดูรายละเอียด", "Curve estimated from the average and SD · hover the chart for details")}</span>
        <button type="button" onClick={() => setRun((r) => r + 1)}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-[var(--accent)] hover:bg-[var(--accent-bright)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
          {t("เล่นอีกครั้ง", "Replay")}
        </button>
      </figcaption>
    </figure>
  );
}

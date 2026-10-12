// Score distribution for the bar chart a student (or teacher) sees next to an announced result (11/10/2569):
// 10 equal bins over 0…max points, so "how many classmates are in my range" can be read straight off the bars.
// Only counts leave this function — nobody's individual score is exposed by the chart.

export const HISTOGRAM_BINS = 10;

export interface HistogramBin {
  /** inclusive lower edge, in points (or % when the scale is a percentage) */
  lo: number;
  /** upper edge; the last bin includes it, the others stop just below it */
  hi: number;
  count: number;
}

/** Which bin a score falls in: [0, w) → 0 … [(n−1)·w, max] → n−1 (the maximum itself belongs to the top bin). */
export function binIndexOf(score: number, maxPoints: number, bins = HISTOGRAM_BINS): number {
  if (maxPoints <= 0) return 0;
  const idx = Math.floor((score / maxPoints) * bins + 1e-9);   // the epsilon keeps 36/40·10 from landing on 8.999…
  return Math.min(bins - 1, Math.max(0, idx));
}

export function histogramBins(scores: number[], maxPoints: number, bins = HISTOGRAM_BINS): HistogramBin[] {
  const width = maxPoints / bins;
  const out: HistogramBin[] = Array.from({ length: bins }, (_, i) => ({ lo: i * width, hi: (i + 1) * width, count: 0 }));
  scores.forEach((s) => { out[binIndexOf(s, maxPoints, bins)].count++; });
  return out;
}

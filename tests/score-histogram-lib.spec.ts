import { test, expect } from "@playwright/test";
import { binIndexOf, histogramBins, HISTOGRAM_BINS } from "../src/lib/scoreHistogram";

// 11/10/2569 — the bins behind the student's "where do I stand" bar chart.

test.describe("binIndexOf", () => {
  test("ten equal ranges over 0…max; the maximum belongs to the top range", () => {
    expect(HISTOGRAM_BINS).toBe(10);
    expect(binIndexOf(0, 40)).toBe(0);
    expect(binIndexOf(3.9, 40)).toBe(0);
    expect(binIndexOf(4, 40)).toBe(1);
    expect(binIndexOf(40, 40)).toBe(9);
  });

  test("a score exactly on an edge goes up, even where floating point would round it down", () => {
    expect(binIndexOf(36, 40)).toBe(9);     // 36/40·10 = 9
    expect(binIndexOf(35.99, 40)).toBe(8);
    expect(binIndexOf(21, 30)).toBe(7);     // 0.7·10 is 7.000000000000001 or 6.999… depending on the rounding
    expect(binIndexOf(30, 100)).toBe(3);
    expect(binIndexOf(70, 100)).toBe(7);
  });

  test("out-of-range scores and a zero maximum never fall outside the chart", () => {
    expect(binIndexOf(-5, 40)).toBe(0);
    expect(binIndexOf(55, 40)).toBe(9);
    expect(binIndexOf(10, 0)).toBe(0);
  });
});

test.describe("histogramBins", () => {
  test("every score lands in exactly one bin and the counts add up", () => {
    const scores = [37.5, 27, 40, 38, 36];
    const bins = histogramBins(scores, 40);
    expect(bins).toHaveLength(10);
    expect(bins.reduce((n, b) => n + b.count, 0)).toBe(scores.length);
    expect(bins[6].count).toBe(1);   // 27 → 24–28
    expect(bins[9].count).toBe(4);   // 37.5, 40, 38, 36 → 36–40
  });

  test("bin edges tile 0…max with no gap", () => {
    const bins = histogramBins([], 50);
    expect(bins[0].lo).toBe(0);
    expect(bins[9].hi).toBe(50);
    bins.slice(1).forEach((b, i) => expect(b.lo).toBe(bins[i].hi));
    expect(bins.every((b) => b.count === 0)).toBe(true);
  });

  test("a percentage scale works the same (the teacher's running grade)", () => {
    const bins = histogramBins([44, 66, 72, 90, 100], 100);
    expect(bins.map((b) => b.count)).toEqual([0, 0, 0, 0, 1, 0, 1, 1, 0, 2]);
  });
});

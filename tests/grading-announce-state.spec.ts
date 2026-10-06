import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// 4/10/2569 — teacher grading page (per assignment):
//  · "Finish & announce" is always visible: enabled once everything is graded, otherwise disabled with the reason,
//    and a note says up front that finishing announces the results to the students
//  · an assignment that is already announced says so even while some work is still ungraded
//  · the status filter is a row of separate boxes (not a faint grey track), the selected one carries a tick
//  · the score is a coloured chip, and every text/background pair on it passes WCAG AA (4.5:1)

type Seed = { finalized?: boolean; lang?: "en" | "th"; theme?: "light" | "dark"; all?: boolean };

async function open(page: Page, o: Seed = {}) {
  await page.addInitScript((d) => {
    const NOW = "2026-01-01T00:00:00.000Z";
    localStorage.setItem("hwai_lang", d.lang);
    localStorage.setItem("hwai-theme", d.theme);
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([{ id: "c-gs", name: "Grading State", description: "", status: "active", coverColor: "#0F766E", sectionNumber: "1", code: "01076999", academicYear: 2569, term: 1, createdAt: NOW, updatedAt: NOW }]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([{ id: "t-gs", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-gs"] }]));
    const people = [["69070501", "Ann"], ["69070502", "Ben"], ["69070503", "Cat"]];
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(people.map(([id, f], i) => ({ id: `cs-${i}`, studentId: id, firstName: f, lastName: "Test", email: `${id}@kmitl.ac.th`, program: "CE", status: "active" }))));
    localStorage.setItem("hwai_students_v1", JSON.stringify(people.map(([id, f], i) => ({ id: `r-${i}`, courseId: "c-gs", studentId: id, firstName: f, lastName: "Test", email: `${id}@kmitl.ac.th`, sequenceNumber: i + 1, enrollmentStatus: "enrolled" }))));
    localStorage.setItem("hwai_grading_categories_v1", JSON.stringify([]));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify([]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([{ id: "hw", courseId: "c-gs", name: "Homework", description: "", dueDate: "2026-01-10", maxPoints: 10, acceptsFiles: true, fileTypes: ["pdf"], submissionType: "individual", maxGroupSize: null, rubricIds: [], gradingFinalized: d.finalized, createdAt: NOW, updatedAt: NOW }]));
    const mk = (i: number, status: string, ai: number | null, instr: number | null) => ({ id: `s-${i}`, assignmentId: "hw", studentId: people[i][0], studentName: `${people[i][1]} Test`, email: `${people[i][0]}@kmitl.ac.th`, submittedAt: "2026-01-05T10:00:00.000Z", fileUrl: null, aiScore: ai, instructorScore: instr, instructorComment: "", externalUseConsent: true, status, updatedAt: NOW });
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(d.all
      ? [mk(0, "graded", 8, 9), mk(1, "graded", 6, 6), mk(2, "graded", 4, 4)]
      : [mk(0, "graded", 8, 9), mk(1, "need_review", 6, null), mk(2, "not_graded", null, null)]));
  }, { finalized: o.finalized ?? false, lang: o.lang ?? "en", theme: o.theme ?? "light", all: o.all ?? false });
  await page.goto(`${BASE}/teacher/courses/c-gs/assignments/hw/grading`);
  await page.waitForLoadState("networkidle");
}

const finish = (page: Page) => page.getByRole("button", { name: "Finish & announce" }).first();

test.describe("Finish & announce", () => {
  test("not everything graded: the button is visible but disabled, and the note says what is left and what finishing does", async ({ page }) => {
    await open(page);
    await expect(finish(page)).toBeDisabled();
    await expect(finish(page)).toHaveAttribute("title", /Finish grading first — 2 submissions left/);
    const note = page.getByRole("note");
    await expect(note).toContainText("Grade the remaining 2 submissions");
    await expect(note).toContainText("announced to your students");
    await expect(page.getByText("Results announced")).toHaveCount(0);
  });

  test("everything graded: the button is enabled and the note says it will send the results", async ({ page }) => {
    await open(page, { all: true });
    await expect(finish(page)).toBeEnabled();
    await expect(page.getByRole("note")).toContainText("Everything is graded");
    await expect(page.getByRole("note")).toContainText("send the results to your students");
    await finish(page).click();
    await expect(page.getByRole("dialog", { name: "Announce results to students?" })).toBeVisible();
  });

  test("already announced but work is still ungraded: it says announced, how many are left, and offers Reopen", async ({ page }) => {
    await open(page, { finalized: true });
    await expect(page.getByText("Results announced")).toBeVisible();
    await expect(page.getByText("2 submissions to grade")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reopen grading" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Finish & announce" })).toHaveCount(0);
    await expect(page.getByRole("note")).toContainText("Results are announced");
    await expect(page.getByRole("note")).toContainText("2 submissions still to grade");
  });

  test("Thai UI", async ({ page }) => {
    await open(page, { lang: "th" });
    await expect(page.getByRole("button", { name: "เสร็จสิ้นและประกาศผล" })).toBeDisabled();
    await expect(page.getByRole("note")).toContainText("ตรวจให้ครบก่อน (เหลืออีก 2 งาน)");
    await expect(page.getByRole("note")).toContainText("ประกาศผลการตรวจไปให้นักศึกษา");
  });
});

test.describe("Status filter as separate boxes", () => {
  test("four separate bordered boxes with gaps, the selected one has a tick, and clicking filters", async ({ page }) => {
    await open(page);
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(4);
    const boxes = await tabs.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return { left: r.left, right: r.right, border: s.borderTopWidth, radius: s.borderTopLeftRadius }; }));
    for (const b of boxes) { expect(b.border).toBe("2px"); expect(parseFloat(b.radius)).toBeGreaterThanOrEqual(10); }
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].left - boxes[i - 1].right).toBeGreaterThanOrEqual(6);   // a gap, not one fused bar
    await expect(page.getByRole("tab", { selected: true })).toContainText("All");
    await expect(page.locator('[role=tab][aria-selected=true] svg')).toHaveCount(1);       // the tick
    await expect(page.locator('[role=tab][aria-selected=false] svg')).toHaveCount(0);
    await page.getByRole("tab", { name: /Needs review/ }).click();
    await expect(page.getByRole("tab", { selected: true })).toContainText("Needs review");
    await expect(page.getByRole("row", { name: /Ben Test/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Ann Test/ })).toHaveCount(0);
  });

  test("each count chip carries its status colour (Needs review = warn, Graded = ok)", async ({ page }) => {
    await open(page);
    const chipClass = (name: RegExp) => page.getByRole("tab", { name }).locator("span").last().getAttribute("class");
    expect(await chipClass(/Needs review/)).toContain("--s-warn-bg");
    expect(await chipClass(/Graded/)).toContain("--s-ok-bg");
    expect(await chipClass(/All/)).toContain("--s-info-bg");
  });
});

// ── WCAG: measure the real, rendered colours (no assuming the token values) ──────────────────────
const contrastInPage = (page: Page, selector: string, bgSelector = selector) => page.evaluate(([sel, bgSel]) => {
  const rgb = (c: string) => { const m = c.match(/[\d.]+/g)!.map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 }; };
  const lum = ({ r, g, b }: { r: number; g: number; b: number }) => { const f = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
  const fg = rgb(getComputedStyle(document.querySelector(sel)!).color);
  // first ancestor (or self) with an opaque-enough background
  let el: Element | null = document.querySelector(bgSel);
  let bg = { r: 255, g: 255, b: 255, a: 1 };
  while (el) { const c = rgb(getComputedStyle(el).backgroundColor); if (c.a > 0.95) { bg = c; break; } el = el.parentElement; }
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}, [selector, bgSelector]);

for (const theme of ["light", "dark"] as const) {
  test.describe(`Score cell contrast (${theme})`, () => {
    test("the score, its /max, the AI figure and the Edited chip all pass 4.5:1", async ({ page }) => {
      await open(page, { theme, all: true });
      // Ann's row: instructor 9 vs AI 8 → "Edited" + "AI: 8"; score chip is tone-coloured with a visible /10
      const row = page.getByRole("row", { name: /Ann Test/ });
      await expect(row.getByText("/10")).toBeVisible();
      await expect(row.getByText("Edited")).toBeVisible();
      await expect(row.getByText("AI: 8")).toBeVisible();
      await row.evaluate((r) => { r.setAttribute("data-t", "row"); });
      const marks = await page.evaluate(() => {
        const row = document.querySelector("[data-t=row]")!;
        const mark = (txt: string, name: string) => { const el = [...row.querySelectorAll("span")].find((s) => s.children.length === 0 && s.textContent?.trim() === txt); el?.setAttribute("data-t", name); return !!el; };
        return [mark("/10", "max"), mark("9", "num"), mark("Edited", "edited"), mark("AI: 8", "ai")];
      });
      expect(marks).toEqual([true, true, true, true]);
      for (const name of ["max", "num", "edited"]) expect(await contrastInPage(page, `[data-t=${name}]`), `${theme} ${name}`).toBeGreaterThanOrEqual(4.5);
    });

    test("the old problem is gone: /max is not the near-invisible light grey (it was 1.47:1)", async ({ page }) => {
      await open(page, { theme, all: true });
      const color = await page.getByRole("row", { name: /Ben Test/ }).getByText("/10").evaluate((el) => getComputedStyle(el).color);
      expect(color).not.toBe("rgb(209, 213, 219)");   // Tailwind gray-300
    });
  });
}

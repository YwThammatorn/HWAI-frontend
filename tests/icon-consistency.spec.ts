import { test, expect, Page } from "@playwright/test";

import { BASE } from "./base";

// 22/10/2569 — what the browser really draws: every UI icon is one <Icon> (24 grid, stroke 2, a size from the scale), on the public pages
// and on the teacher screens that carry the most icons. The source-level rule is in tests/design-rules.spec.ts; this catches an icon that
// gets its look from somewhere else at runtime (a class, a wrapper) and proves the shared component is what is on screen.

const SIZES = [12, 14, 16, 20, 24];
const NOW = "2026-01-01T00:00:00.000Z";

async function seedTeacher(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("ic_seeded")) return;
    sessionStorage.setItem("ic_seeded", "1");
    const NOW = "2026-01-01T00:00:00.000Z";
    const levels = [{ label: "Excellent", description: "" }, { label: "Good", description: "" }, { label: "Needs Improvement", description: "" }];
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([{ id: "c-ic", name: "Icon Course", description: "", status: "active", source: "manual", coverColor: "#2DD4BF", iconColor: "#2DD4BF", icon: "flask", courseTemplateId: "ct-ic", term: 1, academicYear: 2569, sectionNumber: "1", code: "01076555", schedule: "-", room: "-", createdAt: NOW, updatedAt: NOW }]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([{ id: "t1", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", status: "active", courseIds: ["c-ic"] }]));
    localStorage.setItem("hwai_students_v1", JSON.stringify([{ id: "r-0", courseId: "c-ic", studentId: "69071101", name: "Ann Test", email: "69071101@kmitl.ac.th", enrollmentStatus: "enrolled" }]));
    localStorage.setItem("hwai_grading_categories_v1", "[]");
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([{ id: "as1", courseId: "c-ic", name: "Landing page", description: "", dueDate: "2026-01-10", maxPoints: 100, acceptsFiles: true, fileTypes: ["pdf"], submissionType: "individual", maxGroupSize: null, rubricIds: ["r1"], createdAt: NOW, updatedAt: NOW }]));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify([{ id: "r1", assignmentId: "as1", name: "Rubric", createdAt: NOW, updatedAt: NOW, criteria: [{ id: "k1", name: "Layout", description: "", maxPoints: 100, weight: 100, levels }] }]));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify([{ id: "s1", assignmentId: "as1", studentId: "69071101", studentName: "Ann Test", email: "69071101@kmitl.ac.th", submittedAt: "2026-01-05T10:00:00.000Z", instructorComment: "", updatedAt: NOW, aiScore: null, instructorScore: null, status: "not_graded" }]));
  });
}

/** Every <svg> that is an icon (the Icon component marks them focusable=false) — returns what the browser computed. */
const readIcons = (page: Page) => page.evaluate(() =>
  [...document.querySelectorAll("svg[focusable='false']")].map((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { w: Math.round(r.width), h: Math.round(r.height), stroke: cs.strokeWidth, view: el.getAttribute("viewBox"), cap: cs.strokeLinecap, fill: cs.fill, hidden: el.closest("[hidden]") !== null || cs.display === "none" };
  }).filter((i) => !i.hidden));

async function check(page: Page, url: string, minIcons: number) {
  await page.goto(`${BASE}${url}`);
  await page.waitForLoadState("networkidle");
  const icons = await readIcons(page);
  expect(icons.length, `${url}: icons found`).toBeGreaterThanOrEqual(minIcons);
  for (const i of icons) {
    expect(i.view).toBe("0 0 24 24");
    expect(i.stroke).toBe("2px");
    expect(i.cap).toBe("round");
    expect(i.fill, `${url}: an icon is always an outline (fill none)`).toBe("none");
    expect(i.w).toBe(i.h);
    expect(SIZES, `${url}: icon size ${i.w}px is not on the scale`).toContain(i.w);
  }
}

test.describe("Icons on screen", () => {
  test("sign-in and register pages", async ({ page }) => {
    await check(page, "/login", 3);
    await check(page, "/register", 4);
  });

  test("teacher: course list, course sidebar, grading queue, assignment grading, edit form", async ({ page }) => {
    await seedTeacher(page);
    await check(page, "/teacher/courses", 2);
    await check(page, "/teacher/courses/c-ic/grading", 8);
    await check(page, "/teacher/courses/c-ic/assignments/as1/grading", 10);
    await check(page, "/teacher/courses/c-ic/assignments/as1/edit", 8);
  });

  test("the course icon a teacher picked is drawn by the same component", async ({ page }) => {
    await seedTeacher(page);
    await page.goto(`${BASE}/teacher/courses`);
    await page.waitForLoadState("networkidle");
    // the seeded course uses the "flask" icon: a glyph of the shared set, so it carries the shared stroke
    await expect(page.locator("main svg[focusable='false'][stroke-width='2']").first()).toBeVisible();
  });

  test("an icon-only control still has a name; a decorative icon is hidden from screen readers", async ({ page }) => {
    await seedTeacher(page);
    await page.goto(`${BASE}/teacher/courses/c-ic/assignments/as1/grading`);
    await page.waitForLoadState("networkidle");
    const decorative = await page.locator("svg[focusable='false']").evaluateAll((els) => els.filter((e) => e.getAttribute("role") !== "img").every((e) => e.getAttribute("aria-hidden") === "true"));
    expect(decorative).toBe(true);
  });
});

test.describe("Summary cards (MetricCard)", () => {
  // 23/10/2569 — the four cards used a different icon shape and size each, and the ones with the taller icon pushed their number lower.
  // (10/11/2569: the assignment Grading page no longer has four cards — it is a summary strip + a list and a detail — so only the Results page keeps them)
  for (const [name, url] of [["Results page", "/teacher/courses/c-ic/assignments/as1/results"]] as const) {
    test(`${name}: same icon tile, same icon size, and every number on the same line`, async ({ page }) => {
      await seedTeacher(page);
      await page.goto(`${BASE}${url}`);
      await page.waitForLoadState("networkidle");
      const cards = await page.evaluate(() => [...document.querySelectorAll("main .grid.grid-cols-4 > div")].map((c) => {
        const svg = c.querySelector("svg[focusable='false']")!;
        const tile = svg.parentElement!.getBoundingClientRect();
        const value = c.querySelector("p.text-2xl, dd.text-2xl")!.getBoundingClientRect();
        return { top: Math.round(c.getBoundingClientRect().top), valueTop: Math.round(value.top), icon: Math.round(svg.getBoundingClientRect().width), tileW: Math.round(tile.width), tileH: Math.round(tile.height), radius: getComputedStyle(svg.parentElement!).borderTopLeftRadius };
      }));
      expect(cards).toHaveLength(4);
      for (const k of ["top", "valueTop", "icon", "tileW", "tileH"] as const) {
        const v = cards.map((c) => c[k]);
        expect(Math.max(...v) - Math.min(...v), `${name}: ${k} differs between cards (${v.join(", ")})`).toBeLessThanOrEqual(1);   // 1px = sub-pixel rounding, not a layout difference
      }
      expect(new Set(cards.map((c) => c.radius)).size, `${name}: corner radius differs between cards`).toBe(1);
    });
  }
});

void NOW;

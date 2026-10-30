import { test, expect, Page } from "@playwright/test";

import { BASE } from "./base";

// 15/10/2569 — the teacher's Student Roster keeps every row on ONE line even when the program has a long name (CECS "วิศวกรรมคอมพิวเตอร์และความมั่นคง
// ปลอดภัยไซเบอร์"): the Program cell is cut with "…" and shows the whole name on hover, the "Not CECS" tag never wraps, and Status / Name don't get squeezed.

async function seed(page: Page, lang: "th" | "en") {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript((lang) => {
    const NOW = "2026-01-01T00:00:00.000Z";
    localStorage.setItem("hwai_lang", lang);
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([{ id: "c-rp", name: "Cyber Basics", code: "01077421", description: "", status: "active", coverColor: "#0F766E", academicYear: 2569, term: 1, sectionNumber: "1", createdAt: NOW, updatedAt: NOW }]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([{ id: "t1", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-rp"] }]));
    const ppl = [["69070301", "นาย", "สมชาย", "ใจดี", "CECS"], ["69070302", "นางสาว", "สุดา", "วงษ์สา", "CECS"], ["69070303", "นาย", "Anna", "Smith", "CEI"]];
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(ppl.map(([id, title, f, l, program], i) => ({ id: `cs-${i}`, studentId: id, title, firstName: f, lastName: l, email: `${id}@kmitl.ac.th`, program, status: "active" }))));
    localStorage.setItem("hwai_students_v1", JSON.stringify(ppl.map(([id, , f, l], i) => ({ id: `r-${i}`, courseId: "c-rp", studentId: id, firstName: f, lastName: l, email: `${id}@kmitl.ac.th`, sequenceNumber: i + 1, enrollmentStatus: "enrolled" }))));
    for (const k of ["hwai_grading_categories_v1", "hwai_assignments_v1", "hwai_rubrics_v1", "hwai_submissions_v1"]) localStorage.setItem(k, "[]");
  }, lang);
  await page.goto(`${BASE}/teacher/courses/c-rp/students`);
  await page.waitForLoadState("networkidle");
}

const FULL = {
  th: { CECS: "วิศวกรรมคอมพิวเตอร์และความมั่นคงปลอดภัยไซเบอร์", CEI: "วิศวกรรมคอมพิวเตอร์นานาชาติ" },
  en: { CECS: "Computer Engineering and Cybersecurity", CEI: "Computer Engineering International" },
} as const;

for (const lang of ["en", "th"] as const) {
  test(`a long program name stays on one line, cut with … and complete on hover (${lang})`, async ({ page }) => {
    await seed(page, lang);
    const rows = page.locator("main tbody tr");
    await expect(rows).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      const h = await rows.nth(i).evaluate((el) => el.getBoundingClientRect().height);
      expect(h, `row ${i + 1}`).toBeLessThan(60);                         // was ~160px with the name wrapped over 5 lines
    }
    const cell = rows.nth(0).locator("td").nth(5).locator("span.truncate");
    await expect(cell).toHaveAttribute("title", FULL[lang].CECS);          // the whole name is one hover away
    await expect(cell).toHaveText(FULL[lang].CECS);                        // …and still in the DOM for screen readers and search
    expect(await cell.evaluate((el) => getComputedStyle(el).textOverflow)).toBe("ellipsis");
    expect(await cell.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);   // it really is cut on screen
  });
}

test("the 'Not CECS' tag of an out-of-program student stays whole next to the cut name, and Status does not wrap", async ({ page }) => {
  await seed(page, "en");
  const cei = page.locator("main tbody tr", { hasText: "69070303" });
  await expect(cei.getByText("Not CECS")).toBeVisible();
  expect(await cei.getByText("Not CECS").evaluate((el) => el.getBoundingClientRect().height)).toBeLessThan(30);   // one line is 24px; wrapped would be 40+
  await expect(cei.locator("td").nth(5).locator("span.truncate")).toHaveAttribute("title", FULL.en.CEI);
  expect(await cei.getByText("Enrolled").evaluate((el) => el.getBoundingClientRect().height)).toBeLessThan(30);   // one line is 24px; wrapped would be 40+
});

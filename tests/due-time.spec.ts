import { test, expect, Page } from "@playwright/test";

import { BASE } from "./base";
import { deadlineIso, dueAt, dueTimeOf, dueTimeLabel, daysLate, submissionClosesAt, DEFAULT_DUE_TIME } from "../src/lib/assignments";

// 11/11/2569 — advisor: "due_date is a date, but the screen shows 11:59 PM". The deadline is a moment now (`dueAt`, timestamptz in
// HWAI-backend): the teacher picks the time, every screen shows that time, and older assignments without one still end at 23:59:59.

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-dt", name: "Web Design", description: "", status: "active", coverColor: "#2DD4BF", courseTemplateId: "ct-dt", term: 1, academicYear: 2569,
  sectionNumber: "1", code: "01076098", schedule: "-", room: "-", createdAt: NOW, updatedAt: NOW,
};
const lv = (label: string) => ({ label, description: `${label} wording` });
const RUBRIC = {
  id: "r-dt", assignmentId: "a-dt", name: "Rubric", createdAt: NOW, updatedAt: NOW,
  criteria: [{ id: "c1", name: "Design", description: "", maxPoints: 10, weight: 100, levels: [lv("A"), lv("B"), lv("C")] }],
};
const assignment = (extra: Record<string, unknown> = {}) => ({
  id: "a-dt", courseId: "c-dt", name: "Poster", description: "", dueDate: "2099-12-28", maxPoints: 10, submissionType: "individual", maxGroupSize: null,
  acceptsFiles: true, fileTypes: ["pdf"], rubricIds: ["r-dt"], createdAt: NOW, updatedAt: NOW, ...extra,
});

async function seed(page: Page, a: unknown) {
  await page.addInitScript((d) => {
    if (sessionStorage.getItem("dt_seeded")) return;
    sessionStorage.setItem("dt_seeded", "1");
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([d.course]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([d.a]));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify([d.rubric]));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify([]));
  }, { course: COURSE, a, rubric: RUBRIC });
}
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("hwai_assignments_v1") ?? "[]")[0] as { dueDate?: string; dueAt?: string });

test.describe("the deadline is a moment, not just a day", () => {
  test("a day + a time make the deadline; older assignments without a time end at 23:59:59 of their day", () => {
    const at = new Date(deadlineIso("2099-12-28", "17:00"));
    expect([at.getFullYear(), at.getMonth() + 1, at.getDate(), at.getHours(), at.getMinutes(), at.getSeconds()]).toEqual([2099, 12, 28, 17, 0, 59]);
    const timed = { dueDate: "2099-12-28", dueAt: at.toISOString() };
    expect(dueAt(timed)!.getTime()).toBe(at.getTime());
    expect(dueTimeOf(timed)).toBe("17:00");
    expect(dueTimeLabel(timed, "th")).toBe("17:00 น.");
    expect(dueTimeLabel(timed, "en")).toBe("5:00 PM");

    const old = { dueDate: "2099-12-28" };
    expect(dueAt(old)!.getTime()).toBe(new Date("2099-12-28T23:59:59").getTime());
    expect(dueTimeOf(old)).toBe(DEFAULT_DUE_TIME);
    expect(dueTimeLabel(old, "en")).toBe("11:59 PM");
  });

  test("late is measured from the real time: an hour after a 17:00 deadline is late, an hour before is not", () => {
    const a = { dueDate: "2099-12-28", dueAt: deadlineIso("2099-12-28", "17:00") };
    expect(daysLate(a, new Date("2099-12-28T16:00:00").getTime())).toBe(0);
    expect(daysLate(a, new Date("2099-12-28T18:00:00").getTime())).toBe(1);
    // without a late policy the submissions close at the deadline itself
    expect(submissionClosesAt(a)!.getTime()).toBe(dueAt(a)!.getTime());
  });

  test("the assignment page shows the time the teacher set, not a fixed 11:59 PM", async ({ page }) => {
    await seed(page, assignment({ dueAt: deadlineIso("2099-12-28", "17:00") }));
    await page.goto(`${BASE}/teacher/courses/c-dt/assignments/a-dt`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("at 5:00 PM")).toBeVisible();
    await expect(page.getByText("at 11:59 PM")).toHaveCount(0);
  });

  test("the edit form shows the time and saves a new one with the day", async ({ page }) => {
    await seed(page, assignment({ dueAt: deadlineIso("2099-12-28", "17:00") }));
    await page.goto(`${BASE}/teacher/courses/c-dt/assignments/a-dt/edit`);
    await page.waitForLoadState("networkidle");
    const time = page.getByLabel("Due time");
    await expect(time).toHaveValue("17:00");
    await time.fill("09:30");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect.poll(async () => (await stored(page)).dueAt).toBe(deadlineIso("2099-12-28", "09:30"));
    expect((await stored(page)).dueDate).toBe("2099-12-28");
  });

  test("an assignment saved before the time existed opens at 23:59", async ({ page }) => {
    await seed(page, assignment());
    await page.goto(`${BASE}/teacher/courses/c-dt/assignments/a-dt/edit`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByLabel("Due time")).toHaveValue("23:59");
  });
});

import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// 4/10/2569 — the teacher's grading page shows the assignment's rubric: each criterion with its points, how the graded
// work so far spreads over its levels (a bar + counts), the class average, and — opened — the wording of every level.
//
// Seed, worked out by hand. Rubric (4 levels each): Content /15, Style /10, Flow /15  → 40 points.
//   S1  Content 15 · Style 10 · Flow 15   (all Excellent)
//   S2  Content 10 · Style 7  · Flow 10   (all Fair)
//   S3  Content 10 · Style 3  · Flow 5    (Fair / Needs Improvement / Needs Improvement)
//   S4  Content 5  · Style 0  · Flow 0    (Needs Improvement / Fail / Fail)
//   S5  handed in, not graded yet (no scores)
//   Content: Excellent 1, Fair 2, Needs Improvement 1, Fail 0 — average (15+10+10+5)/4 = 10 → 67%
//   Style:   1 / 1 / 1 / 1                              — average (10+7+3+0)/4 = 5   → 50%
//   Flow:    Excellent 1, Fair 1, Needs Improvement 1, Fail 1 — average (15+10+5+0)/4 = 7.5 → 50%

const NOW = "2026-01-01T00:00:00.000Z";
const PEOPLE = [["69071101", "Ann"], ["69071102", "Ben"], ["69071103", "Cat"], ["69071104", "Dan"], ["69071105", "Eve"]];
const SCORES: Record<string, [number, number, number]> = { "69071101": [15, 10, 15], "69071102": [10, 7, 10], "69071103": [10, 3, 5], "69071104": [5, 0, 0] };

const levels = (a: string, b: string, c: string, d: string) => [
  { label: "ดีมาก", description: a }, { label: "พอใช้", description: b }, { label: "ต้องปรับปรุง", description: c }, { label: "ไม่ผ่าน", description: d },
];
const RUBRIC = {
  id: "r1", assignmentId: "as1", name: "Rubric", createdAt: NOW, updatedAt: NOW,
  criteria: [
    { id: "k1", name: "C1 · Content", description: "Is the content complete", maxPoints: 15, weight: 38, levels: levels("Content complete", "Content mostly complete", "Content thin", "Content missing") },
    { id: "k2", name: "C2 · Style", description: "Is the style consistent", maxPoints: 10, weight: 25, levels: levels("Style consistent", "Style mostly consistent", "Style uneven", "No style") },
    { id: "k3", name: "C3 · Flow", description: "Does the flow work", maxPoints: 15, weight: 37, levels: levels("Flow works", "Flow mostly works", "Flow has gaps", "Flow broken") },
  ],
};

async function seed(page: Page, o: { rubric?: boolean; group?: boolean; exam?: boolean; ungraded?: boolean; lang?: "en" | "th" } = {}) {
  await page.addInitScript(([people, scores, rubric, withRubric, group, exam, lang]) => {
    const NOW = "2026-01-01T00:00:00.000Z";
    const ppl = people as string[][];
    localStorage.setItem("hwai_lang", lang as string);
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([{ id: "c-gr", name: "Grading Rubric Course", description: "", status: "active", source: "manual", coverColor: "#0F766E", iconColor: "#0F766E", sectionNumber: "1", code: "01076444", academicYear: 2569, term: 1, createdAt: NOW, updatedAt: NOW }]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([{ id: "t1", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-gr"] }]));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(ppl.map(([id, f], i) => ({ id: `cs-${i}`, studentId: id, firstName: f, lastName: "Test", email: `${id}@kmitl.ac.th`, program: "CE", status: "active" }))));
    localStorage.setItem("hwai_students_v1", JSON.stringify(ppl.map(([id, f], i) => ({ id: `r-${i}`, courseId: "c-gr", studentId: id, firstName: f, lastName: "Test", email: `${id}@kmitl.ac.th`, sequenceNumber: i + 1, enrollmentStatus: "enrolled" }))));
    localStorage.setItem("hwai_grading_categories_v1", "[]");
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([{
      id: "as1", courseId: "c-gr", name: "Rubric Assignment", description: "", dueDate: exam ? undefined : "2026-01-10", maxPoints: 40, acceptsFiles: !exam, fileTypes: [],
      submissionType: group ? "group" : "individual", maxGroupSize: group ? 2 : null, rubricIds: withRubric ? ["r1"] : [], isExam: exam || undefined, createdAt: NOW, updatedAt: NOW,
    }]));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify(withRubric ? [rubric] : []));
    const sc = scores as Record<string, number[]>;
    const grp = (id: string) => (group ? (["69071101", "69071102"].includes(id) ? "g1" : "g2") : undefined);
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(ppl.map(([id, f]) => {
      const s = sc[id];
      const base = { id: `sub-${id}`, assignmentId: "as1", studentId: id, studentName: `${f} Test`, email: `${id}@kmitl.ac.th`, submittedAt: "2026-01-05T10:00:00.000Z", fileUrl: null, externalUseConsent: false, instructorComment: "", updatedAt: NOW, groupId: grp(id) };
      return s
        ? { ...base, aiScore: s[0] + s[1] + s[2], instructorScore: s[0] + s[1] + s[2], status: "graded", criterionScores: { k1: s[0], k2: s[1], k3: s[2] } }
        : { ...base, aiScore: null, instructorScore: null, status: "not_graded" };
    })));
    localStorage.setItem("hwai_student_groups_v1", JSON.stringify(group ? [
      { id: "g1", assignmentId: "as1", courseId: "c-gr", name: "Team One", memberStudentIds: ["69071101", "69071102"], createdAt: NOW, updatedAt: NOW },
      { id: "g2", assignmentId: "as1", courseId: "c-gr", name: "Team Two", memberStudentIds: ["69071103", "69071104"], createdAt: NOW, updatedAt: NOW },
    ] : []));
  }, [PEOPLE, o.ungraded ? {} : SCORES, RUBRIC, o.rubric ?? true, !!o.group, !!o.exam, o.lang ?? "en"] as const);
  await page.goto(`${BASE}/teacher/courses/c-gr/assignments/as1/grading`);
  await page.waitForLoadState("networkidle");
}

const row = (page: Page, id: string) => page.getByTestId(`rubric-row-${id}`);

test.describe("Grading page — rubric panel", () => {
  test("lists every criterion with its points, level counts and class average", async ({ page }) => {
    await seed(page);
    const panel = page.getByTestId("grading-rubric");
    await expect(panel.getByRole("heading", { name: "Grading rubric" })).toBeVisible();
    await expect(panel).toContainText("3 criteria · 40 points");
    await expect(panel).toContainText("from 4 graded items");

    const c1 = row(page, "k1");
    await expect(c1).toContainText("C1 · Content");
    await expect(c1).toContainText("Is the content complete");
    await expect(c1).toContainText("15 pts");
    await expect(c1.getByRole("img")).toHaveAttribute("aria-label", "ดีมาก: 1, พอใช้: 2, ต้องปรับปรุง: 1, ไม่ผ่าน: 0");
    await expect(c1).toContainText("Avg 10 · 67%");

    await expect(row(page, "k2").getByRole("img")).toHaveAttribute("aria-label", "ดีมาก: 1, พอใช้: 1, ต้องปรับปรุง: 1, ไม่ผ่าน: 1");
    await expect(row(page, "k2")).toContainText("Avg 5 · 50%");
    await expect(row(page, "k2")).toContainText("10 pts");
    await expect(row(page, "k3")).toContainText("Avg 7.5 · 50%");
  });

  test("a row opens to the wording of each level and how many students reached it; the header button opens and closes all", async ({ page }) => {
    await seed(page);
    const c1 = row(page, "k1");
    await expect(c1.getByText("Content mostly complete")).toHaveCount(0);
    await c1.getByRole("button", { name: /Level descriptions for C1 · Content/ }).click();
    await expect(c1.getByRole("button", { name: /Level descriptions for C1/ })).toHaveAttribute("aria-expanded", "true");
    for (const text of ["Content complete", "Content mostly complete", "Content thin", "Content missing"]) await expect(c1.getByText(text, { exact: true })).toBeVisible();
    await expect(c1).toContainText("2 students");   // Fair
    await expect(c1).toContainText("0 students");   // Fail
    await expect(row(page, "k2").getByText("Style uneven")).toHaveCount(0);

    await page.getByRole("button", { name: "Show all level descriptions" }).click();
    await expect(row(page, "k2").getByText("Style uneven")).toBeVisible();
    await expect(row(page, "k3").getByText("Flow broken")).toBeVisible();
    await page.getByRole("button", { name: "Hide all level descriptions" }).click();
    await expect(c1.getByText("Content thin")).toHaveCount(0);
  });

  test("Edit rubric goes to the edit page", async ({ page }) => {
    await seed(page);
    await page.getByTestId("grading-rubric").getByRole("link", { name: "Edit rubric" }).click();
    await expect(page).toHaveURL(/\/assignments\/as1\/edit$/);
  });

  test("Thai UI", async ({ page }) => {
    await seed(page, { lang: "th" });
    const panel = page.getByTestId("grading-rubric");
    await expect(panel.getByRole("heading", { name: "เกณฑ์การให้คะแนน" })).toBeVisible();
    await expect(panel).toContainText("3 เกณฑ์ · รวม 40 คะแนน");
    await expect(row(page, "k1")).toContainText("เฉลี่ย 10 · 67%");
    await expect(panel.getByRole("button", { name: "แสดงคำอธิบายระดับทั้งหมด" })).toBeVisible();
    await expect(panel.getByRole("link", { name: "แก้ไขเกณฑ์" })).toBeVisible();
  });

  test("a group assignment counts teams, not members", async ({ page }) => {
    await seed(page, { group: true });
    // 2 teams graded → each criterion's counts add up to 2, not 4
    await expect(page.getByTestId("grading-rubric")).toContainText("from 2 graded items");
    await expect(row(page, "k1").getByRole("img")).toHaveAttribute("aria-label", "ดีมาก: 1, พอใช้: 1, ต้องปรับปรุง: 0, ไม่ผ่าน: 0");
    await row(page, "k1").getByRole("button", { name: /Level descriptions/ }).click();
    await expect(row(page, "k1")).toContainText("1 team");
  });

  test("no rubric on the assignment → no panel", async ({ page }) => {
    await seed(page, { rubric: false });
    await expect(page.getByTestId("grading-rubric")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Grade Adjustment" })).toBeVisible();
  });

  test("nothing graded yet → the criteria are listed, with a note instead of bars", async ({ page }) => {
    await seed(page, { ungraded: true });
    const panel = page.getByTestId("grading-rubric");
    await expect(panel).toContainText("nothing graded yet");
    await expect(panel.getByRole("img")).toHaveCount(0);
    await expect(row(page, "k1")).toContainText("No per-criterion scores to summarise yet");
    await expect(row(page, "k1")).toContainText("15 pts");
  });
});

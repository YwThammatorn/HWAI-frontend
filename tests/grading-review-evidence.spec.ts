import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import { aiEvidenceFor } from "../src/lib/aiEvidence";
import { aiGradingUpdate } from "../src/lib/aiGrading";
import { studentVisibleSubmission, CLEARED_RESULT, type Assignment, type Submission, type WorkSnapshot } from "../src/lib/assignments";
import { BASE } from "./base";

// 10/11/2569 — Grading Review shows the student's WORK (the frozen frames of a design link) and the AI's REASON per criterion with the places it
// looked at (advisor: R22 "score with reasons and evidence"; R35 "the work a grade rests on must not change after the deadline"). The stand-in AI
// (lib/aiEvidence.ts) is pure, so the words are checked against the same function the page uses; the screen is checked for what the grader can do.
// All ids and names are made up.

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-ev", name: "UX Studio", description: "", status: "active", source: "manual", coverColor: "#0F766E", iconColor: "#0F766E",
  courseTemplateId: "ct-ev", term: 1, academicYear: 2569, sectionNumber: "1", code: "01076999", schedule: "Mon", room: "811", createdAt: NOW, updatedAt: NOW,
};
const TEACHER = { id: "t-ev", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-ev"] };
const LV = (n: string) => [
  { label: "Excellent", description: `${n} top` }, { label: "Fair", description: `${n} ok` }, { label: "Needs Improvement", description: `${n} weak` }, { label: "Fail", description: `${n} none` },
];
const CRITERIA = [
  { id: "k1", name: "Visual hierarchy", description: "", maxPoints: 6, weight: 60, levels: LV("Visual hierarchy") },
  { id: "k2", name: "Consistency", description: "", maxPoints: 4, weight: 40, levels: LV("Consistency") },
];
const LIVE = "https://www.figma.com/design/AbCdEf123456/Checkout-flow";
const SNAPSHOT: WorkSnapshot = {
  takenAt: "2026-01-05T10:00:00.000Z", sourceUrl: LIVE,
  frames: [
    { id: "login", name: "Login", image: "/mock-data/frames/login.svg" },
    { id: "checkout", name: "Checkout", image: "/mock-data/frames/checkout.svg" },
    { id: "order-done", name: "Order confirmed", image: "/mock-data/frames/order-done.svg" },
  ],
};
const asg = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, courseId: "c-ev", name, description: "", dueDate: "2026-01-05", maxPoints: 10, acceptsFiles: true, fileTypes: ["figma"], submissionType: "individual",
  maxGroupSize: null, rubricIds: [], createdAt: NOW, updatedAt: NOW, ...extra,
});
const ASSIGNMENTS = [asg("a-ev", "Checkout flow"), asg("a-hand", "Hand graded", { gradingMode: "manual" })];
const rubric = (aid: string) => ({ id: `r-${aid}`, assignmentId: aid, name: aid, criteria: CRITERIA, createdAt: NOW, updatedAt: NOW });
const base = (aid: string, n: number, extra: Record<string, unknown> = {}) => ({
  id: `${aid}-s${n}`, assignmentId: aid, studentId: `6407${String(n).padStart(4, "0")}`, studentName: `Student ${n}`, email: `s${n}@kmitl.ac.th`, submittedAt: "2026-01-05T10:00:00.000Z",
  fileUrl: LIVE, attachments: [{ id: `att-${n}`, kind: "link", name: "Figma", source: "url", ref: LIVE }], aiScore: null, instructorScore: null, instructorComment: "",
  externalUseConsent: false, status: "not_graded", updatedAt: NOW, ...extra,
});
/** What "Grade with AI" stores for a design link: marks, and — because there is a snapshot — the reasons and places. */
const aiSub = (aid: string, n: number, extra: Record<string, unknown> = {}) =>
  base(aid, n, { snapshot: SNAPSHOT, ...aiGradingUpdate(`${aid}-s${n}`, 10, { criteria: CRITERIA }, SNAPSHOT), ...extra });
const SUBS = [
  aiSub("a-ev", 1), aiSub("a-ev", 2), aiSub("a-ev", 3), aiSub("a-ev", 4),
  base("a-ev", 5, { ...aiGradingUpdate("a-ev-s5", 10, { criteria: CRITERIA }) }),         // the AI graded it, but there was no snapshot (a plain link or an old submission)
  aiSub("a-hand", 1),
];

async function seed(page: Page, opts: { lang?: "en" | "th"; ta?: boolean } = {}) {
  await page.addInitScript((d) => {
    if (sessionStorage.getItem("ev_seeded")) return;
    sessionStorage.setItem("ev_seeded", "1");
    localStorage.setItem("hwai_lang", d.lang);
    localStorage.setItem("hwai_user", JSON.stringify(d.ta
      ? { name: "Tia", email: "66000099@kmitl.ac.th", role: "ta", studentId: "66000099" }
      : { name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([d.course]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([d.teacher]));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify([{ id: "cs-66000099", studentId: "66000099", firstName: "Tia", lastName: "Test", email: "66000099@kmitl.ac.th", program: "CE", status: "active" }]));
    localStorage.setItem("hwai_students_v1", JSON.stringify([]));
    localStorage.setItem("hwai_grading_categories_v1", JSON.stringify([]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify(d.assignments));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify(d.rubrics));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(d.subs));
    localStorage.setItem("hwai_section_roles_v1", JSON.stringify([{ id: "sr-1", accountId: "cs-66000099", courseId: "c-ev", role: "ta" }]));
  }, { lang: opts.lang ?? "en", ta: !!opts.ta, course: COURSE, teacher: TEACHER, assignments: ASSIGNMENTS, subs: SUBS, rubrics: ASSIGNMENTS.map((a) => rubric(a.id)) });
}
const grade = async (page: Page, aid: string, sid: string) => { await page.goto(`${BASE}/teacher/courses/c-ev/assignments/${aid}/recheck?sub=${sid}`); await page.waitForLoadState("networkidle"); };

test.describe("the stand-in AI's reasons (lib/aiEvidence.ts)", () => {
  const levels = { k1: 0, k2: 3 };
  test("deterministic: the same work and levels give the same words and places", () => {
    expect(aiEvidenceFor("seed", CRITERIA, levels, SNAPSHOT)).toEqual(aiEvidenceFor("seed", CRITERIA, levels, SNAPSHOT));
  });
  test("every criterion has a reason that names the level, and references that point at frames of the snapshot with boxes inside the frame", () => {
    const ev = aiEvidenceFor("seed", CRITERIA, levels, SNAPSHOT);
    expect(Object.keys(ev).sort()).toEqual(["k1", "k2"]);
    for (const c of CRITERIA) {
      expect(ev[c.id].reason.length, c.id).toBeGreaterThan(20);
      expect(ev[c.id].reason, c.id).toContain(c.levels[levels[c.id as "k1" | "k2"]].label);
      expect(ev[c.id].refs.length, c.id).toBeGreaterThan(0);
      for (const r of ev[c.id].refs) {
        expect(SNAPSHOT.frames.map((f) => f.id), c.id).toContain(r.frameId);
        const b = r.box!;
        expect(b.x).toBeGreaterThanOrEqual(0); expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(1); expect(b.y + b.h).toBeLessThanOrEqual(1);
      }
    }
  });
  test("the best level points at one place, a lower level at two (what to look at)", () => {
    const ev = aiEvidenceFor("seed", CRITERIA, levels, SNAPSHOT);
    expect(ev.k1.refs).toHaveLength(1);
    expect(ev.k2.refs).toHaveLength(2);
    expect(ev.k2.refs[0].frameId).not.toBe(ev.k2.refs[1].frameId);
  });
  test("a Thai rubric gets Thai reasons", () => {
    const th = CRITERIA.map((c) => ({ ...c, name: `${c.name} / เกณฑ์`, levels: c.levels.map((l) => ({ ...l, label: "ดีมาก" })) }));
    for (const e of Object.values(aiEvidenceFor("seed", th, levels, SNAPSHOT))) expect(e.reason).toMatch(/[฀-๿]/);
  });
  test("no frames, no evidence", () => {
    expect(aiEvidenceFor("seed", CRITERIA, levels, { takenAt: NOW, frames: [] })).toEqual({});
  });
  test("grading writes evidence only for a submission that has a snapshot and a rubric; a regrade replaces it", () => {
    expect(aiGradingUpdate("s", 10, { criteria: CRITERIA }, SNAPSHOT).aiEvidence).toBeDefined();
    expect(aiGradingUpdate("s", 10, { criteria: CRITERIA }).aiEvidence).toBeUndefined();
    expect(aiGradingUpdate("s", 10, undefined, SNAPSHOT).aiEvidence).toBeUndefined();
    expect(CLEARED_RESULT).toHaveProperty("aiEvidence", undefined);                     // resubmitting / regrading starts from nothing
    expect(CLEARED_RESULT).not.toHaveProperty("snapshot");                              // …but the frozen copy belongs to the submission
  });
});

test.describe("what a student can see", () => {
  const sub = (SUBS[0] as unknown) as Submission;
  const a = (finalized: boolean) => ({ id: "a-ev", gradingFinalized: finalized } as unknown as Assignment);
  test("never the AI's reasons — not before and not after the result is announced", () => {
    expect(sub.aiEvidence).toBeDefined();
    for (const status of ["not_graded", "need_review", "graded"] as const) {
      for (const fin of [false, true]) expect(studentVisibleSubmission(a(fin), { ...sub, status }).aiEvidence, `${status} ${fin}`).toBeUndefined();
    }
  });
  test("student pages do not import the evidence code", () => {
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
    for (const f of walk("src/app/student").filter((p) => /\.tsx?$/.test(p))) expect(fs.readFileSync(f, "utf8"), f).not.toMatch(/aiEvidence|FrameViewer/);
  });
});

test.describe("Grading Review", () => {
  test("a design link shows its frozen frames instead of 'File preview not available', with when it was taken and a button to the live file", async ({ page }) => {
    await seed(page);
    await grade(page, "a-ev", "a-ev-s1");
    await expect(page.getByTestId("frame-viewer")).toBeVisible();
    await expect(page.getByText("File preview not available")).toHaveCount(0);
    for (const f of SNAPSHOT.frames) await expect(page.getByTestId(`frame-thumb-${f.id}`)).toBeVisible();
    await expect(page.getByTestId("snapshot-note")).toContainText("Snapshot at submission");
    const live = page.getByTestId("open-live-file");
    await expect(live).toHaveAttribute("href", LIVE);
    await expect(live).toHaveAttribute("target", "_blank");
    expect(await live.getAttribute("title")).toMatch(/may have changed/);
    await expect(page.getByTestId("frame-image")).toBeVisible();
    expect(await page.getByTestId("frame-image").evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);   // the picture really loads
  });

  test("each criterion shows the AI's reason; its reference chips pick the frame and draw the numbered box on it", async ({ page }) => {
    await seed(page);
    await grade(page, "a-ev", "a-ev-s1");
    const sub = SUBS[0] as unknown as Submission;
    for (const c of CRITERIA) await expect(page.getByTestId(`ai-reason-${c.id}`)).toHaveText(sub.aiEvidence![c.id].reason);
    await expect(page.locator("[data-testid^=frame-box-]")).toHaveCount(0);            // nothing is boxed until a chip is pressed
    const ref = sub.aiEvidence!.k1.refs[0];
    await page.getByTestId("ref-k1-0").click();
    await expect(page.getByTestId("ref-k1-0")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId(`frame-thumb-${ref.frameId}`)).toHaveAttribute("aria-current", "true");
    const box = page.getByTestId("frame-box-1");
    await expect(box).toBeVisible();
    const style = await box.getAttribute("style");
    expect(style).toContain(`left: ${ref.box!.x * 100}%`);
    // a criterion that points at two places: the second chip moves to its frame and numbers its box 2
    const two = sub.aiEvidence!.k2.refs;
    if (two.length === 2) {
      await page.getByTestId("ref-k2-1").click();
      await expect(page.getByTestId(`frame-thumb-${two[1].frameId}`)).toHaveAttribute("aria-current", "true");
      await expect(page.getByTestId("frame-box-2")).toBeVisible();
    }
  });

  test("the teacher still sees 'Feedback to AI' after changing a level; the reason stays as the AI wrote it", async ({ page }) => {
    await seed(page);
    await grade(page, "a-ev", "a-ev-s2");
    const sub = SUBS[1] as unknown as Submission;
    // pick a level different from the AI's on the first criterion
    const aiLevel = sub.aiCriterionScores!.k1;
    const other = aiLevel === 6 ? "Fail" : "Excellent";
    await page.getByRole("radiogroup", { name: /Level for Visual hierarchy/ }).getByRole("radio", { name: new RegExp("\\b" + other + "\\b") }).click();
    await expect(page.getByText("Feedback to AI").first()).toBeVisible();
    await expect(page.getByTestId("ai-reason-k1")).toHaveText(sub.aiEvidence!.k1.reason);
  });

  test("a TA sees the AI's reasons and places too, but not the 'Feedback to AI' box (they do not train the AI)", async ({ page }) => {
    await seed(page, { ta: true });
    await grade(page, "a-ev", "a-ev-s3");
    await expect(page.getByTestId("frame-viewer")).toBeVisible();
    await expect(page.getByTestId("ai-reason-k1")).toBeVisible();
    await page.getByTestId("ref-k1-0").click();
    await expect(page.getByTestId("frame-box-1")).toBeVisible();
    const aiLevel = (SUBS[2] as unknown as Submission).aiCriterionScores!.k1;
    await page.getByRole("radiogroup", { name: /Level for Visual hierarchy/ }).getByRole("radio", { name: new RegExp("\\b" + (aiLevel === 6 ? "Fail" : "Excellent") + "\\b") }).click();
    await expect(page.getByText("Feedback to AI")).toHaveCount(0);
  });

  test("a piece graded by hand shows no AI reason at all (there was no AI), but still the work", async ({ page }) => {
    await seed(page);
    await grade(page, "a-hand", "a-hand-s1");
    await expect(page.getByTestId("frame-viewer")).toBeVisible();
    await expect(page.locator("[data-testid^=ai-reason-]")).toHaveCount(0);
    await expect(page.locator("[data-testid^=ref-]")).toHaveCount(0);
  });

  test("a submission without a snapshot keeps the old screen: the file/link viewer and the AI's one-line feedback, no chips", async ({ page }) => {
    await seed(page);
    await grade(page, "a-ev", "a-ev-s5");
    await expect(page.getByTestId("frame-viewer")).toHaveCount(0);
    await expect(page.locator("[data-testid^=ref-]")).toHaveCount(0);
    await expect(page.getByTestId("ai-reason-k1")).not.toBeEmpty();
  });

  test("on a Thai screen the labels are Thai; the reason keeps the language of the rubric", async ({ page }) => {
    await seed(page, { lang: "th" });
    await grade(page, "a-ev", "a-ev-s1");
    await expect(page.getByTestId("snapshot-note")).toContainText("สำเนาตอนส่งงาน");
    await expect(page.getByTestId("open-live-file")).toContainText("เปิดไฟล์สด");
    // the reason is written in the language of the rubric (an English rubric gets an English reason on a Thai screen), as the AI's text is data, not interface
    await expect(page.getByTestId("ai-reason-k1")).toHaveText((SUBS[0] as unknown as Submission).aiEvidence!.k1.reason);
  });

  test("the frames fit the work area at a real laptop width — nothing sticks out sideways", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seed(page);
    await grade(page, "a-ev", "a-ev-s1");
    await expect(page.getByTestId("frame-viewer")).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
  });
});

test.describe("Calibration shows the same frozen work, blind", () => {
  test("a design sample shows frames named 'Frame 1…', no live-file button, no AI reasons; with Blind off the real names and the button appear", async ({ page }) => {
    await seed(page);
    await page.goto(`${BASE}/teacher/courses/c-ev/calibration`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("frame-viewer")).toBeVisible();
    await expect(page.getByText("No file attached in the demo data")).toHaveCount(0);
    const body = page.getByTestId("frame-viewer");   // the assignment is called "Checkout flow" too, so look inside the viewer
    for (const f of SNAPSHOT.frames) await expect(body).not.toContainText(f.name);       // a frame's name can carry a student's name, so it is hidden while blind
    await expect(page.getByTestId("frame-thumb-login")).toContainText("Frame");
    await expect(page.getByTestId("open-live-file")).toHaveCount(0);
    await expect(page.locator("[data-testid^=ai-reason-]")).toHaveCount(0);
    await page.getByRole("switch", { name: "Blind test" }).click();
    await expect(page.getByTestId("open-live-file")).toBeVisible();
    await expect(page.getByTestId("frame-thumb-login")).toContainText("Login");
    await expect(page.locator("[data-testid^=ai-reason-]")).toHaveCount(0);              // even when not blind the AI's reasoning is not shown here
  });
});

test.describe("the UX/UI class mock carries snapshots and evidence", () => {
  const th = JSON.parse(fs.readFileSync("public/mock-data/student-uxui-mockup.json", "utf8"));
  type S = Submission & { id: string; assignmentId: string };
  const subs = th.submissions as S[];
  const rubrics = th.rubrics as { assignmentId: string; criteria: { id: string }[] }[];
  const linked = subs.filter((s) => s.attachments?.some((a) => a.kind === "link"));
  test("every Figma-link submission has a snapshot of 3–6 frames, taken when it was handed in, pointing at the link", () => {
    expect(linked.length).toBeGreaterThan(100);
    for (const s of linked) {
      expect(s.snapshot, s.id).toBeDefined();
      expect(s.snapshot!.frames.length, s.id).toBeGreaterThanOrEqual(3);
      expect(s.snapshot!.frames.length, s.id).toBeLessThanOrEqual(6);
      expect(s.snapshot!.takenAt, s.id).toBe(s.submittedAt);
      expect(s.snapshot!.sourceUrl, s.id).toBe(s.attachments!.find((a) => a.kind === "link")!.ref);
      for (const f of s.snapshot!.frames) expect(fs.existsSync(`public${f.image}`), `${s.id} ${f.image}`).toBe(true);
    }
  });
  test("every one the AI graded has a reason and places for every criterion; references point at its own frames, boxes inside 0..1", () => {
    const aiGraded = linked.filter((s) => s.status !== "not_graded");
    expect(aiGraded.length).toBeGreaterThan(100);
    for (const s of aiGraded) {
      const crit = rubrics.find((r) => r.assignmentId === s.assignmentId)!.criteria.map((c) => c.id);
      expect(Object.keys(s.aiEvidence ?? {}).sort(), s.id).toEqual([...crit].sort());
      for (const c of crit) {
        const e = s.aiEvidence![c];
        expect(e.reason.length, `${s.id} ${c}`).toBeGreaterThan(20);
        expect(e.refs.length, `${s.id} ${c}`).toBeGreaterThan(0);
        for (const r of e.refs) {
          expect(s.snapshot!.frames.map((f) => f.id), `${s.id} ${c}`).toContain(r.frameId);
          expect(r.box!.x + r.box!.w).toBeLessThanOrEqual(1); expect(r.box!.y + r.box!.h).toBeLessThanOrEqual(1);
        }
      }
    }
    for (const s of linked.filter((x) => x.status === "not_graded")) expect(s.aiEvidence, s.id).toBeUndefined();   // nothing graded, nothing to explain
  });
  test("team members hold the same frozen work and the same reasons (one piece of work, one explanation)", () => {
    const byGroup = new Map<string, S[]>();
    for (const s of linked.filter((x) => x.groupId)) byGroup.set(`${s.assignmentId}/${s.groupId}`, [...(byGroup.get(`${s.assignmentId}/${s.groupId}`) ?? []), s]);
    expect(byGroup.size).toBeGreaterThan(10);
    for (const [g, ms] of byGroup) for (const m of ms) { expect(m.snapshot, g).toEqual(ms[0].snapshot); expect(m.aiEvidence, g).toEqual(ms[0].aiEvidence); }
  });
});

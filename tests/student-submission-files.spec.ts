import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// Student submission (20/9/2569): files are a list — each can be removed before
// submitting, and several can be attached (plus an optional link).

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-sf", name: "Hardware Lab", description: "", status: "active", source: "manual",
  coverColor: "#2DD4BF", iconColor: "#2DD4BF", createdAt: NOW, updatedAt: NOW,
};
const ASSIGNMENT = {
  id: "a-sf", courseId: "c-sf", name: "Hardware Lab Training", description: "Upload your report",
  dueDate: "2099-12-31", maxPoints: 100, submissionType: "individual", maxGroupSize: null,
  acceptsFiles: true, fileTypes: ["pdf"], rubricIds: [], createdAt: NOW, updatedAt: NOW,
};
const ROSTER = { id: "sr-sf", courseId: "c-sf", studentId: "64070501", firstName: "Fah", lastName: "Test", email: "s@kmitl.ac.th", cohort: "CE69" };
const COHORT = { id: "cs-sf", studentId: "64070501", firstName: "Fah", lastName: "Test", email: "s@kmitl.ac.th", cohort: "CE69", program: "CE" };

async function seed(page: Page, submissions: unknown[] = []) {
  await page.addInitScript((data) => {
    // addInitScript re-runs on every navigation — only seed once so what the test saves survives
    if (sessionStorage.getItem("sf_seeded")) return;
    sessionStorage.setItem("sf_seeded", "1");
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Fah Test", email: "s@kmitl.ac.th", role: "student", studentId: "64070501" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([data.course]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([data.assignment]));
    localStorage.setItem("hwai_students_v1", JSON.stringify([data.roster]));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify([data.cohort]));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(data.submissions));
  }, { course: COURSE, assignment: ASSIGNMENT, roster: ROSTER, cohort: COHORT, submissions });
}

const pdf = (name: string) => ({ name, mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.4 ${name}`) });
const fileInput = (page: Page) => page.locator('input[type="file"]');
const storedFiles = (page: Page) =>
  page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("hwai_file_")).length);
const savedSubmissions = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("hwai_submissions_v1") ?? "[]"));

async function open(page: Page, submissions: unknown[] = []) {
  await seed(page, submissions);
  await page.goto(`${BASE}/student/courses/c-sf/classwork/a-sf`);
  await page.waitForLoadState("networkidle");
}

test.describe("Student submission — attach several files, remove any of them", () => {
  test("several files are listed, and one can be removed (its stored copy is freed)", async ({ page }) => {
    await open(page);
    await fileInput(page).setInputFiles([pdf("report.pdf"), pdf("appendix.pdf")]);
    const list = page.getByRole("list", { name: "Selected files" });
    await expect(list.getByText("report.pdf")).toBeVisible();
    await expect(list.getByText("appendix.pdf")).toBeVisible();
    await expect(page.getByText("2 / 10")).toBeVisible();
    expect(await storedFiles(page)).toBe(2);

    await page.getByRole("button", { name: "Remove report.pdf" }).click();
    await expect(list.getByText("report.pdf")).toHaveCount(0);
    await expect(list.getByText("appendix.pdf")).toBeVisible();
    expect(await storedFiles(page)).toBe(1);
  });

  test("the button becomes 'Add another file' and more can be added later", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("button", { name: "Choose file" })).toBeVisible();
    await fileInput(page).setInputFiles(pdf("one.pdf"));
    await expect(page.getByRole("button", { name: "Add another file" })).toBeVisible();
    await fileInput(page).setInputFiles(pdf("two.pdf"));
    await expect(page.getByRole("list", { name: "Selected files" }).getByRole("listitem")).toHaveCount(2);
  });

  test("Submit needs at least one file or link — removing the last file disables it again", async ({ page }) => {
    await open(page);
    const submit = page.getByRole("button", { name: "Submit", exact: true });
    await expect(submit).toBeDisabled();
    await fileInput(page).setInputFiles(pdf("only.pdf"));
    await expect(submit).toBeEnabled();
    await page.getByRole("button", { name: "Remove only.pdf" }).click();
    await expect(submit).toBeDisabled();
  });

  test("at most 10 files — the extra ones are dropped with a message", async ({ page }) => {
    await open(page);
    await fileInput(page).setInputFiles(Array.from({ length: 11 }, (_, i) => pdf(`f${i + 1}.pdf`)));
    await expect(page.getByRole("list", { name: "Selected files" }).getByRole("listitem")).toHaveCount(10);
    await expect(page.getByRole("alert").filter({ hasText: "Up to 10 files" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add another file" })).toBeDisabled();
  });

  test("submitting saves every file plus the link, shows them under 'Submitted work', and clears the form", async ({ page }) => {
    await open(page);
    await page.getByPlaceholder(/Figma, GitHub/).fill("github.com/fah/hardware-lab");
    await fileInput(page).setInputFiles([pdf("report.pdf"), pdf("appendix.pdf")]);
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await page.getByRole("button", { name: "Confirm & Submit" }).click();

    await expect(page.getByText("Submitted — awaiting grade")).toBeVisible();
    await expect(page.getByText("Submitted work (3)")).toBeVisible();
    await expect(page.getByRole("button", { name: /report\.pdf/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /appendix\.pdf/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /github\.com\/fah\/hardware-lab/ })).toBeVisible();
    // the form is empty again for a possible resubmission
    await expect(page.getByRole("list", { name: "Selected files" })).toHaveCount(0);

    const [sub] = await savedSubmissions(page);
    expect(sub.attachments.map((a: { kind: string; name: string }) => [a.kind, a.name]))
      .toEqual([["file", "report.pdf"], ["file", "appendix.pdf"], ["link", "https://github.com/fah/hardware-lab"]]);
    expect(sub.fileUrl).toBe("https://github.com/fah/hardware-lab");
    expect(await storedFiles(page)).toBe(2); // kept — they belong to the submission now
  });

  test("resubmitting replaces the earlier files and frees them", async ({ page }) => {
    await open(page);
    await fileInput(page).setInputFiles(pdf("v1.pdf"));
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await page.getByRole("button", { name: "Confirm & Submit" }).click();
    await expect(page.getByText("Submitted work (1)")).toBeVisible();

    await fileInput(page).setInputFiles([pdf("v2.pdf"), pdf("v2-extra.pdf")]);
    await page.getByRole("button", { name: "Resubmit" }).click();
    await page.getByRole("button", { name: "Confirm & Submit" }).click();
    await expect(page.getByText("Submitted work (2)")).toBeVisible();
    await expect(page.getByRole("button", { name: /v1\.pdf/ })).toHaveCount(0);
    expect(await storedFiles(page)).toBe(2);
    expect((await savedSubmissions(page))).toHaveLength(1);
  });

  test("leaving the page without submitting frees the files that were picked", async ({ page }) => {
    await open(page);
    await fileInput(page).setInputFiles([pdf("draft.pdf")]);
    expect(await storedFiles(page)).toBe(1);
    await page.getByRole("link", { name: "Hardware Lab" }).click(); // breadcrumb — client-side navigation
    await expect(page).toHaveURL(/\/classwork$/, { timeout: 20_000 });
    expect(await storedFiles(page)).toBe(0);
  });

  test("a link that isn't a URL blocks submitting and says why", async ({ page }) => {
    await open(page);
    await page.getByPlaceholder(/Figma, GitHub/).fill("not a link");
    await expect(page.getByRole("alert").filter({ hasText: /doesn't look like a link/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit", exact: true })).toBeDisabled();
    await page.getByPlaceholder(/Figma, GitHub/).fill("figma.com/file/abc");
    await expect(page.getByRole("button", { name: "Submit", exact: true })).toBeEnabled();
  });

  test("a submission saved before multi-file support still shows its link", async ({ page }) => {
    await open(page, [{
      id: "sub-legacy", assignmentId: "a-sf", studentId: "64070501", studentName: "Fah Test", email: "s@kmitl.ac.th",
      submittedAt: NOW, fileUrl: "https://github.com/fah/old", aiScore: null, instructorScore: null, instructorComment: "",
      externalUseConsent: false, status: "not_graded", updatedAt: NOW,
    }]);
    await expect(page.getByText("Submitted work (1)")).toBeVisible();
    await expect(page.getByRole("button", { name: /github\.com\/fah\/old/ })).toBeVisible();
  });
});

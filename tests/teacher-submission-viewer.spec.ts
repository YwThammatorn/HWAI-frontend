import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// Teacher grading screen (20/9/2569): the left pane shows what the student actually
// submitted — images and PDFs inline, links and other files as buttons — instead of
// the old "File preview not available" placeholder.

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-sv", name: "Hardware Lab", description: "", status: "active", source: "manual",
  coverColor: "#2DD4BF", createdAt: NOW, updatedAt: NOW,
};
const TEACHER = { id: "t-sv", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-sv"] };
const ASSIGNMENT = {
  id: "a-sv", courseId: "c-sv", name: "Lab report", description: "", dueDate: "2099-12-31", maxPoints: 100,
  submissionType: "individual", maxGroupSize: null, acceptsFiles: true, fileTypes: ["pdf", "image"],
  rubricIds: ["r-sv"], createdAt: NOW, updatedAt: NOW,
};
const RUBRIC = {
  id: "r-sv", assignmentId: "a-sv", name: "Rubric", createdAt: NOW, updatedAt: NOW,
  criteria: [{ id: "crit-a", name: "Report", description: "", maxPoints: 100, weight: 100, levels: [{ label: "Good", description: "" }, { label: "Poor", description: "" }] }],
};

const PNG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";
const PDF_DATA = "data:application/pdf;base64,JVBERi0xLjQ=";
const DOCX_DATA = "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,UEsDBA==";

function submission(over: Record<string, unknown> = {}) {
  return {
    id: "sub-sv", assignmentId: "a-sv", studentId: "64070701", studentName: "Fah Test", email: "64070701@kmitl.ac.th",
    submittedAt: "2026-01-05T10:00:00.000Z", fileUrl: null, aiScore: 80, instructorScore: null, instructorComment: "",
    externalUseConsent: false, status: "need_review", updatedAt: NOW, ...over,
  };
}

async function open(page: Page, sub: Record<string, unknown>, stored: Record<string, string> = {}) {
  await page.addInitScript((data) => {
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([data.course]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([data.teacher]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([data.assignment]));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify([data.rubric]));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify([data.sub]));
    Object.entries(data.stored).forEach(([k, v]) => localStorage.setItem(k, v));
  }, { course: COURSE, teacher: TEACHER, assignment: ASSIGNMENT, rubric: RUBRIC, sub, stored });
  await page.goto(`${BASE}/teacher/courses/c-sv/assignments/a-sv/recheck?sub=sub-sv`);
  await page.waitForLoadState("networkidle");
}

const strip = (page: Page) => page.getByRole("list", { name: "Files the student submitted" });

test.describe("Teacher grading — the student's submitted files", () => {
  const withFiles = () => submission({
    attachments: [
      { id: "att-img", kind: "image", name: "photo.png", source: "upload", ref: "hwai_file_img" },
      { id: "att-pdf", kind: "file", name: "report.pdf", source: "upload", ref: "hwai_file_pdf" },
      { id: "att-link", kind: "link", name: "https://github.com/fah/lab", source: "url", ref: "https://github.com/fah/lab" },
    ],
  });
  const stored = { hwai_file_img: PNG_1PX, hwai_file_pdf: PDF_DATA };

  test("lists every file and shows the first one inline, with who submitted and when", async ({ page }) => {
    await open(page, withFiles(), stored);
    await expect(strip(page).getByRole("button")).toHaveCount(3);
    await expect(strip(page).getByRole("button", { name: "photo.png" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/Fah Test · Submitted/)).toBeVisible();
    const img = page.getByRole("img", { name: "photo.png" });
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(1);
  });

  test("switching to the PDF opens it in a frame, and to the link offers 'Open link'", async ({ page }) => {
    await open(page, withFiles(), stored);
    await strip(page).getByRole("button", { name: "report.pdf" }).click();
    const frame = page.locator('iframe[title="report.pdf"]');
    await expect(frame).toBeVisible();
    expect(await frame.getAttribute("src")).toMatch(/^blob:/);

    await strip(page).getByRole("button", { name: /github\.com\/fah\/lab/ }).click();
    const link = page.getByRole("link", { name: "Open link" });
    await expect(link).toHaveAttribute("href", "https://github.com/fah/lab");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(page.locator("iframe")).toHaveCount(0);
  });

  test("the zoom buttons scale the file", async ({ page }) => {
    await open(page, withFiles(), stored);
    const img = page.getByRole("img", { name: "photo.png" });
    await expect(img).toHaveCSS("width", "500px");
    await page.getByRole("button", { name: "+", exact: true }).click();
    await expect(img).toHaveCSS("width", "625px");
  });

  test("a file type that can't be previewed is offered as a download", async ({ page }) => {
    await open(page, submission({
      attachments: [{ id: "att-doc", kind: "file", name: "notes.docx", source: "upload", ref: "hwai_file_doc" }],
    }), { hwai_file_doc: DOCX_DATA });
    const dl = page.getByRole("link", { name: "Download" });
    await expect(dl).toBeVisible();
    await expect(dl).toHaveAttribute("download", "notes.docx");
  });

  test("a file that is no longer in storage says so instead of failing", async ({ page }) => {
    await open(page, submission({
      attachments: [{ id: "att-x", kind: "file", name: "gone.pdf", source: "upload", ref: "hwai_file_missing" }],
    }));
    await expect(page.getByText("This file is no longer in storage")).toBeVisible();
  });

  test("a submission saved before multi-file support shows its link", async ({ page }) => {
    await open(page, submission({ fileUrl: "https://github.com/fah/old" }));
    await expect(page.getByRole("link", { name: "Open link" })).toHaveAttribute("href", "https://github.com/fah/old");
  });

  test("nothing attached keeps the original placeholder and no file strip", async ({ page }) => {
    await open(page, submission());
    await expect(page.getByText("File preview not available in sandbox mode")).toBeVisible();
    await expect(strip(page)).toHaveCount(0);
  });
});

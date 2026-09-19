import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// Teacher-supplied reference material on an assignment (files, images, links).
// Added 19/9/2569 — see src/components/AssignmentAttachments.tsx.

const NOW = "2026-01-01T00:00:00.000Z";

const COURSE = {
  id: "c-att", name: "Web Design", description: "", status: "active", source: "manual",
  coverColor: "#2DD4BF", iconColor: "#2DD4BF", courseTemplateId: "ct-att", term: 1, academicYear: 2569,
  sectionNumber: "1", code: "01076099", schedule: "-", room: "-", createdAt: NOW, updatedAt: NOW,
};

// 1x1 transparent PNG
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

async function seedTeacher(page: Page) {
  await page.addInitScript((data) => {
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([data.course]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([]));
  }, { course: COURSE });
}

test.describe("Assignment attachments — teacher form", () => {
  test.beforeEach(async ({ page }) => { await seedTeacher(page); });

  test("attach a file, an image and a link, then create the assignment", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-att/assignments/new`);
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder(/User Research Report/i).fill("Landing page redesign");
    await page.locator('input[type="date"]').fill("2099-12-31");

    await page.locator('input[type="file"]').setInputFiles([
      { name: "brief.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") },
      { name: "example.png", mimeType: "image/png", buffer: PNG_1PX },
    ]);
    const list = page.getByRole("list", { name: "Attached items" });
    await expect(list.getByText("brief.pdf")).toBeVisible();
    await expect(list.getByText("example.png")).toBeVisible();

    await page.getByRole("button", { name: "Add link" }).click();
    await page.getByLabel("Link URL").fill("figma.com/file/abc123");
    await page.getByLabel("Display name").fill("Figma reference");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(list.getByText("Figma reference")).toBeVisible();

    await page.getByRole("button", { name: "Create Assignment" }).click();
    // Rubric is part of the create form now, so we land on the new assignment's page
    await expect(page).toHaveURL(/\/assignments\/(?!new)[^/]+$/, { timeout: 20_000 }); // first visit compiles the route in dev

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_assignments_v1") ?? "[]"));
    expect(saved).toHaveLength(1);
    const kinds = saved[0].attachments.map((a: { kind: string }) => a.kind);
    expect(kinds).toEqual(["file", "image", "link"]);
    // scheme was added to the bare domain, and the link is stored as-is (not a storage key)
    expect(saved[0].attachments[2]).toMatchObject({ source: "url", ref: "https://figma.com/file/abc123", name: "Figma reference" });
    // uploads were actually persisted to mock storage
    const uploadKey = saved[0].attachments[0].ref as string;
    expect(await page.evaluate((k) => localStorage.getItem(k)?.startsWith("data:"), uploadKey)).toBe(true);
  });

  test("rejects a non-http link and removing an upload frees its storage", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-att/assignments/new`);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Add link" }).click();
    await page.getByLabel("Link URL").fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.locator("p[role=alert]")).toContainText("Invalid link");

    await page.locator('input[type="file"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(page.getByText("notes.txt")).toBeVisible();
    const before = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("hwai_file_")).length);
    expect(before).toBe(1);

    await page.getByRole("button", { name: "Remove notes.txt" }).click();
    await expect(page.getByText("notes.txt")).toHaveCount(0);
    const after = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("hwai_file_")).length);
    expect(after).toBe(0);
  });

  test("files over the 2MB mock-storage limit show an error and are not attached", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-att/assignments/new`);
    await page.waitForLoadState("networkidle");
    await page.locator('input[type="file"]').setInputFiles({ name: "big.zip", mimeType: "application/zip", buffer: Buffer.alloc(2 * 1024 * 1024 + 1) });
    await expect(page.locator("p[role=alert]")).toContainText("too large");
    await expect(page.getByText("big.zip")).toHaveCount(0);
  });
});

test.describe("Assignment attachments — teacher edit", () => {
  test("removing a saved upload and saving frees its storage; adding a link persists", async ({ page }) => {
    await page.addInitScript((data) => {
      localStorage.setItem("hwai_lang", "en");
      localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
      localStorage.setItem("hwai_courses_v2", JSON.stringify([data.course]));
      // Only seed once — addInitScript re-runs on every navigation, including the post-save redirect.
      if (localStorage.getItem("seeded")) return;
      localStorage.setItem("seeded", "1");
      localStorage.setItem("hwai_file_seedkey", "data:text/plain;base64,aGVsbG8=");
      localStorage.setItem("hwai_assignments_v1", JSON.stringify([data.assignment]));
    }, {
      course: COURSE,
      assignment: {
        id: "a-edit", courseId: "c-att", name: "Brief", description: "d", dueDate: "2099-12-31", maxPoints: 100,
        acceptsFiles: true, fileTypes: ["pdf"], submissionType: "individual", maxGroupSize: null, rubricIds: [],
        createdAt: NOW, updatedAt: NOW,
        attachments: [{ id: "s1", kind: "file", name: "old.txt", source: "upload", ref: "hwai_file_seedkey" }],
      },
    });
    await page.goto(`${BASE}/teacher/courses/c-att/assignments/a-edit/edit`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("old.txt")).toBeVisible();

    await page.getByRole("button", { name: "Remove old.txt" }).click();
    // original blob must survive until the teacher actually saves (cancel would otherwise lose it)
    expect(await page.evaluate(() => localStorage.getItem("hwai_file_seedkey"))).not.toBeNull();

    await page.getByRole("button", { name: "Add link" }).click();
    await page.getByLabel("Link URL").fill("https://example.com/spec");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("button", { name: /Save/i }).first().click();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("hwai_assignments_v1") ?? "[]")[0]?.attachments?.length)).toBe(1);

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_assignments_v1") ?? "[]")[0].attachments);
    expect(saved[0]).toMatchObject({ kind: "link", ref: "https://example.com/spec" });
    expect(await page.evaluate(() => localStorage.getItem("hwai_file_seedkey"))).toBeNull();
  });
});

test.describe("Assignment attachments — student brief", () => {
  test("student sees the teacher's attachments on the assignment page", async ({ page }) => {
    await page.addInitScript((data) => {
      localStorage.setItem("hwai_lang", "en");
      localStorage.setItem("hwai_user", JSON.stringify({ name: "สมชาย ใจดี", email: "64070501@kmitl.ac.th", role: "student", studentId: "64070501" }));
      localStorage.setItem("hwai_courses_v2", JSON.stringify([data.course]));
      localStorage.setItem("hwai_assignments_v1", JSON.stringify([data.assignment]));
      localStorage.setItem("hwai_students_v1", JSON.stringify([
        { id: "sr-att", courseId: "c-att", studentId: "64070501", firstName: "สมชาย", lastName: "ใจดี", email: "64070501@kmitl.ac.th", cohort: "CE69" },
      ]));
      localStorage.setItem("hwai_cohort_students_v1", JSON.stringify([
        { id: "cs-att", studentId: "64070501", firstName: "สมชาย", lastName: "ใจดี", email: "64070501@kmitl.ac.th", cohort: "CE69", program: "CE", status: "active" },
      ]));
    }, {
      course: COURSE,
      assignment: {
        id: "a-att", courseId: "c-att", name: "Landing page redesign", description: "Redesign the page.",
        dueDate: "2099-12-31", maxPoints: 100, acceptsFiles: true, fileTypes: ["pdf"], submissionType: "individual",
        maxGroupSize: null, rubricIds: [], createdAt: NOW, updatedAt: NOW,
        attachments: [
          { id: "x1", kind: "link", name: "Figma reference", source: "url", ref: "https://figma.com/file/abc123" },
          { id: "x2", kind: "file", name: "brief.pdf", source: "upload", ref: "hwai_file_missing" },
        ],
      },
    });
    await page.goto(`${BASE}/student/courses/c-att/classwork/a-att`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Attachments (2)")).toBeVisible();
    await expect(page.getByRole("button", { name: /Figma reference/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /brief\.pdf/ })).toBeVisible();

    // Link opens in a new tab
    const popup = page.waitForEvent("popup");
    await page.getByRole("button", { name: /Figma reference/ }).click();
    expect((await popup).url()).toContain("figma.com");
  });
});

// Where an assignment is in the teacher's workflow (10/11/2569, advisor: a red "Overdue / Past due" on the teacher side says the STUDENTS are late, not what
// the teacher has to do). One stage per assignment, in the order the work really goes:
//   accepting    — submissions are still open (before the due date, or inside the late window)
//   no-submissions — closed and nobody handed anything in
//   to-grade     — closed, at least one submission is not graded yet
//   to-announce  — everything is graded, the results are not announced
//   announced    — the teacher announced the results
import { submissionClosesAt, type Assignment, type Submission } from "@/lib/assignments";

export type GradingStage = "accepting" | "no-submissions" | "to-grade" | "to-announce" | "announced";

export function gradingStageOf(a: Assignment, subs: Pick<Submission, "status">[], enrolled: number, now: number): GradingStage {
  if (a.gradingFinalized) return "announced";
  const graded = subs.filter((s) => s.status === "graded").length;
  if (a.isExam) return enrolled > 0 && graded >= enrolled ? "to-announce" : "to-grade";   // an exam is never submitted: it is scored for every enrolled student
  const closes = submissionClosesAt(a);
  if (closes && now <= closes.getTime()) return "accepting";
  if (subs.length === 0) return "no-submissions";
  return graded === subs.length ? "to-announce" : "to-grade";
}

export function gradingStageLabel(stage: GradingStage, t: (th: string, en: string) => string): string {
  switch (stage) {
    case "accepting": return t("กำลังรับงาน", "Accepting work");
    case "no-submissions": return t("ไม่มีงานส่ง", "No submissions");
    case "to-grade": return t("รอตรวจ", "To grade");
    case "to-announce": return t("รอประกาศผล", "Ready to announce");
    case "announced": return t("ประกาศผลแล้ว", "Announced");
  }
}

/** Submissions still waiting for a grader (not graded, or graded by the AI and waiting for review), withdrawn students already left out by the caller. */
export function toGradeCount(subs: Pick<Submission, "status">[]): number {
  return subs.filter((s) => s.status !== "graded").length;
}

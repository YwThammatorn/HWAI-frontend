"use client";

import { createContext, useContext } from "react";

/** Teacher-supplied reference material shown to students alongside the
 *  assignment brief (example work, a spec PDF, a Figma link, ...). This is NOT
 *  what students submit — see `Assignment.fileTypes` for that. */
export interface AssignmentAttachment {
  id: string;
  kind: "file" | "image" | "link";
  /** Display label: the file name, or the link's title (falls back to the URL). */
  name: string;
  /** "upload": `ref` is a storage key — resolve with resolveFileUrl() from
   *  @/lib/fileStorage. "url": `ref` is an external link used as-is. */
  source: "upload" | "url";
  ref: string;
}

export interface Assignment {
  id: string;
  courseId: string;
  name: string;
  description: string;
  /** Optional reference files/images/links from the teacher. Absent on assignments created before this existed. */
  attachments?: AssignmentAttachment[];
  /** YYYY-MM-DD. Absent for an Exam (isExam): it has no deadline and students never submit it. */
  dueDate?: string;
  /** Late work (21/10/2569): until when it is accepted and what it costs. Absent = work closes at the deadline. See LatePolicy. */
  latePolicy?: LatePolicy;
  maxPoints: number;
  categoryId?: string; // FK -> GradingCategory, which % of the course grade this assignment counts toward
  acceptsFiles: boolean;
  fileTypes: ("figma" | "pdf" | "image")[];
  submissionType: "individual" | "group";
  maxGroupSize: number | null;
  rubricIds: string[];
  /** Teacher clicked "Finish Grading" on the Grading page once every submission was processed
   *  (23/9/2569) — locks the assignment's cells in the Score Book to view-only (no more click-through
   *  to recheck). Absent/false = still open; reversible via "Reopen grading" so nobody gets stuck. */
  gradingFinalized?: boolean;
  /** Exam-type assignment (23/9/2569): scored with a manually-set max score, no rubric at all —
   *  `rubricIds` stays empty and `maxPoints` is user-entered instead of derived from a rubric's
   *  point total. Absent/false = the normal rubric-graded assignment. */
  isExam?: boolean;
  /** How the teacher grades this assignment (11/10/2569): "ai" = the AI scores each submission first and the teacher
   *  reviews / re-grades, "manual" = the teacher scores everything by hand and no AI result is shown or used.
   *  Absent = "ai". An exam or an assignment without files can only be graded by hand whatever this says — use
   *  isManualGrading(), never this field alone. */
  gradingMode?: "ai" | "manual";
  /** ISO time the rubric's scoring was changed after grading had started (22/10/2569): the earlier scores were cleared, and the
   *  work waits to be graded again under the new rubric. Only labels the AI button "Regrade with new rubric"; cleared as soon
   *  as the AI has graded the work again. Absent = the rubric has not been restarted. */
  rubricRestartedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** True when nothing about this assignment is graded by the AI: an exam, an assignment with no file to check,
 *  or one the teacher switched to manual grading. */
export function isManualGrading(a: Pick<Assignment, "isExam" | "acceptsFiles" | "gradingMode">): boolean {
  return !!a.isExam || a.acceptsFiles === false || a.gradingMode === "manual";
}

// ── when students may submit, what late work costs, and when the teacher may start grading ─────────────────────────────────────
// `dueDate` is a date only; the deadline is the end of that day. Late work is the teacher's choice per assignment (21/10/2569, replacing the
// fixed "one late hour" of 15/10): an optional `latePolicy` sets the last day work is still accepted (`closeDate`) and what each late day costs.
// Without a policy the work closes at the deadline. Grading may start only once submissions have closed: nothing is graded while the work can
// still change. An exam (scores are typed or imported) and an assignment without a due date are never locked. `now` is epoch ms (lib/clock.ts).

/** What a late hand-in costs. `none` = accepted with no deduction; the amounts are a share of the assignment's full score (`percent`) or fixed `points`. */
export interface LatePolicy {
  /** YYYY-MM-DD, after the due date: the last day work is still accepted (the end of that day). */
  closeDate: string;
  mode: "none" | "perDay" | "tiers" | "flat";
  unit: "percent" | "points";
  /** perDay: taken for every late day. flat: taken once, however late. */
  amount?: number;
  /** perDay: the most that can be taken in total, in the same unit. Absent = no limit (the score still never goes below 0). */
  cap?: number;
  /** tiers: sorted by `untilDay`; a hand-in `n` days late pays the first tier with n <= untilDay (the last tier also covers anything later). */
  tiers?: { untilDay: number; amount: number }[];
}

type Dated = Pick<Assignment, "dueDate" | "isExam"> & { latePolicy?: LatePolicy };
const endOfDay = (ymd: string) => new Date(ymd + "T23:59:59");
/** The deadline: 23:59:59 of the due date. Null without one. */
export const dueAt = (a: Pick<Assignment, "dueDate">): Date | null => (a.dueDate ? endOfDay(a.dueDate) : null);
/** The policy when it is usable (a close date after the due date), otherwise undefined: no late work. */
export const activeLatePolicy = (a: Dated): LatePolicy | undefined => {
  const p = a.latePolicy;
  return p && !a.isExam && a.dueDate && p.closeDate > a.dueDate ? p : undefined;
};
/** The last moment a student can still submit: the end of the close date, or the deadline when late work is not accepted. Null without a due date or for an exam. */
export const submissionClosesAt = (a: Dated): Date | null => {
  const d = a.isExam ? null : dueAt(a);
  if (!d) return null;
  const p = activeLatePolicy(a);
  return p ? endOfDay(p.closeDate) : d;
};
/** Past the deadline but still inside the accepted-late period. */
export const isLate = (a: Dated, now: number): boolean => {
  const d = a.isExam ? null : dueAt(a), c = submissionClosesAt(a);
  return !!d && !!c && now > d.getTime() && now <= c.getTime();
};
export const submissionOpen = (a: Dated, now: number): boolean => {
  const c = submissionClosesAt(a);
  return !c || now <= c.getTime();
};
export const gradingOpen = (a: Dated, now: number): boolean => {
  const c = submissionClosesAt(a);
  return !c || now > c.getTime();
};
/** When grading becomes possible (the first second after submissions close), for "opens at …". Null = always open. */
export const gradingOpensAt = (a: Dated): Date | null => {
  const c = submissionClosesAt(a);
  return c ? new Date(c.getTime() + 1000) : null;
};

const ymdLocal = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const DAY_MS = 86_400_000;
/** Whole calendar days a hand-in at `submittedAt` is past the due date: 0 = on time, 1 = the day after, … */
export const daysLate = (a: Pick<Assignment, "dueDate">, submittedAt: string | number): number => {
  if (!a.dueDate) return 0;
  const at = typeof submittedAt === "number" ? submittedAt : new Date(submittedAt).getTime();
  if (Number.isNaN(at) || at <= endOfDay(a.dueDate).getTime()) return 0;
  const due = new Date(a.dueDate + "T00:00:00").getTime(), day = new Date(ymdLocal(at) + "T00:00:00").getTime();
  return Math.max(1, Math.round((day - due) / DAY_MS));
};
/** The deduction, in points, for work handed in `late` days after the deadline under `policy`; whole points, never more than `maxPoints`. */
export function latePenaltyFor(policy: LatePolicy | undefined, late: number, maxPoints: number): number {
  if (!policy || late <= 0 || policy.mode === "none") return 0;
  let amount = 0;
  if (policy.mode === "flat") amount = policy.amount ?? 0;
  else if (policy.mode === "perDay") { amount = (policy.amount ?? 0) * late; if (policy.cap !== undefined) amount = Math.min(amount, policy.cap); }
  else {
    const tiers = [...(policy.tiers ?? [])].sort((x, y) => x.untilDay - y.untilDay);
    const tier = tiers.find((t) => late <= t.untilDay) ?? tiers[tiers.length - 1];
    amount = tier?.amount ?? 0;
  }
  const points = policy.unit === "percent" ? (amount / 100) * maxPoints : amount;
  return Math.min(maxPoints, Math.max(0, Math.round(points)));
}
/** Points taken off a submission for being late (0 when on time, or no policy). Uses the latest hand-in's time. */
export const latePenaltyOf = (a: Dated & Pick<Assignment, "maxPoints">, s: { submittedAt: string }): number =>
  latePenaltyFor(activeLatePolicy(a), daysLate(a as Pick<Assignment, "dueDate">, s.submittedAt), a.maxPoints);
/** The score that counts: the teacher's (or else the AI's) score minus the late deduction, never below 0. Null when nothing is scored. */
export function finalScoreOf(a: Dated & Pick<Assignment, "maxPoints">, s: { submittedAt: string; instructorScore: number | null; aiScore: number | null }): number | null {
  const raw = s.instructorScore ?? s.aiScore;
  return raw === null || raw === undefined ? null : Math.max(0, raw - latePenaltyOf(a, s));
}
/** The days between the due date and the close date, i.e. how many late days the policy covers. */
export const lateDaysCovered = (dueDate: string, closeDate: string): number =>
  Math.max(0, Math.round((new Date(closeDate + "T00:00:00").getTime() - new Date(dueDate + "T00:00:00").getTime()) / DAY_MS));
/** The day after `ymd` (YYYY-MM-DD) — the earliest close date. */
export const dayAfter = (ymd: string): string => { const d = new Date(ymd + "T00:00:00"); d.setDate(d.getDate() + 1); return ymdLocal(d.getTime()); };
/** Why a late policy cannot be saved, or null when it can. Keys are stable so forms can show their own wording. */
export function latePolicyProblem(p: LatePolicy, dueDate: string): "close" | "amount" | "tiers" | null {
  if (!dueDate || !p.closeDate || p.closeDate <= dueDate) return "close";
  const okAmt = (n: number | undefined) => typeof n === "number" && Number.isFinite(n) && n >= 0 && (p.unit === "points" || n <= 100);
  if (p.mode === "flat" && !okAmt(p.amount)) return "amount";
  if (p.mode === "perDay" && (!okAmt(p.amount) || (p.cap !== undefined && !okAmt(p.cap)))) return "amount";
  if (p.mode === "tiers") {
    const ts = p.tiers ?? [];
    if (ts.length === 0 || ts.some((x) => !Number.isInteger(x.untilDay) || x.untilDay < 1 || !okAmt(x.amount))) return "tiers";
    if (new Set(ts.map((x) => x.untilDay)).size !== ts.length) return "tiers";
  }
  return null;
}
/** Only the fields the chosen mode uses, tiers sorted — what gets stored. */
export function cleanLatePolicy(p: LatePolicy): LatePolicy {
  const base = { closeDate: p.closeDate, mode: p.mode, unit: p.unit };
  if (p.mode === "none") return base;
  if (p.mode === "flat") return { ...base, amount: p.amount ?? 0 };
  if (p.mode === "perDay") return { ...base, amount: p.amount ?? 0, ...(p.cap !== undefined ? { cap: p.cap } : {}) };
  return { ...base, tiers: [...(p.tiers ?? [])].sort((x, y) => x.untilDay - y.untilDay) };
}
/** One line saying what late work costs, e.g. "10% of the score per late day, up to 30%" — for forms and the student's page. */
export function describeLatePolicy(p: LatePolicy, t: (th: string, en: string) => string): string {
  const u = (n: number) => (p.unit === "percent" ? `${n}%` : t(`${n} คะแนน`, `${n} pt${n === 1 ? "" : "s"}`));
  if (p.mode === "none") return t("ส่งช้าได้ ไม่หักคะแนน", "Late work accepted with no deduction");
  if (p.mode === "flat") return t(`ส่งช้าหัก ${u(p.amount ?? 0)} (ครั้งเดียว)`, `Late work loses ${u(p.amount ?? 0)} (once)`);
  if (p.mode === "perDay") return t(`ส่งช้าหัก ${u(p.amount ?? 0)} ต่อวัน${p.cap !== undefined ? ` สูงสุด ${u(p.cap)}` : ""}`, `Late work loses ${u(p.amount ?? 0)} per day${p.cap !== undefined ? `, up to ${u(p.cap)}` : ""}`);
  const ts = [...(p.tiers ?? [])].sort((x, y) => x.untilDay - y.untilDay);
  return ts.map((x) => t(`ช้า ≤${x.untilDay} วัน −${u(x.amount)}`, `≤${x.untilDay} d late −${u(x.amount)}`)).join(" · ");
}
/** What a resubmission clears: the earlier file's result must not stay on the new file. */
export const CLEARED_RESULT = {
  aiScore: null, instructorScore: null, instructorComment: "", criterionScores: undefined, aiCriterionScores: undefined, criterionComments: undefined, aiEvidence: undefined,
} as const;

/** A submission the AI graded and the teacher has not scored by hand — what "switch to manual" sends back to not graded. */
export const isAiOnlyGraded = (s: Pick<Submission, "status" | "instructorScore" | "aiScore">) =>
  s.status !== "not_graded" && s.instructorScore === null;

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string; // denormalized for display; replace with join when API is ready
  email: string;       // denormalized for display
  submittedAt: string;
  /** What the student submitted: up to 10 files/images plus an optional link. */
  attachments?: AssignmentAttachment[];
  aiScore: number | null;
  instructorScore: number | null;
  instructorComment: string;
  /** Per-criterion note, keyed by RubricCriterion.id — typically why the
   *  instructor moved a criterion's score away from the AI's suggestion. */
  criterionComments?: Record<string, string>;
  /** Per-criterion points earned, keyed by RubricCriterion.id — saved whenever the recheck
   *  page saves a score. Absent on submissions graded before this existed or given no rubric;
   *  callers that need a breakdown for those fall back to splitting the total by criterion weight
   *  (the same math the recheck page itself starts from — see RecheckPage's initial-scores effect). */
  criterionScores?: Record<string, number>;
  /** What the AI gave each criterion, keyed by RubricCriterion.id (12/10/2569) — set when the teacher sends the work to the AI, so the
   *  Grade screen can start from it and Calibration can compare it with the teacher's own levels. Never shown to students. */
  aiCriterionScores?: Record<string, number>;
  /** The AI's reason for each criterion, with where in the work it looked (10/11/2569; R22 "reasons and evidence"). Written together with
   *  `aiCriterionScores`; cleared with them. Every criterion the AI scores has a reason (7/11/2569); `refs` is empty when there are no frozen
   *  frames to point into. Teacher/TA only — `studentVisibleSubmission` removes it, announced or not (R38). */
  aiEvidence?: Record<string, CriterionEvidence>;
  /** The work as it was when it was submitted — frozen frames of a design link (R35: the evidence must not change after the deadline). */
  snapshot?: WorkSnapshot;
  /** Handed in after the due date, inside the late window (15/10/2569). Absent/false = on time. Set again on every resubmission. */
  late?: boolean;
  status: "not_graded" | "need_review" | "graded";
  /** Set when this submission was created as part of a group assignment —
   *  every StudentGroup member gets their own row sharing this id, so a
   *  future "grade once, apply to the whole team" flow has something to
   *  group by without another data migration. */
  groupId?: string;
  updatedAt: string;
}

/** One frame of a design file, saved as an image (a path under /mock-data/frames/ in the demo; a stored file in a real deployment). */
export interface SnapshotFrame { id: string; name: string; image: string }
/** Frozen copy of a linked design: when it was taken, the live file's address (it may have changed since), and the frames. */
export interface WorkSnapshot { takenAt: string; sourceUrl?: string; frames: SnapshotFrame[] }
/** A place in the work the AI points at: a frame, optionally a box on it (all four numbers are fractions of the frame, 0..1). */
export interface EvidenceRef { frameId: string; label?: string; box?: { x: number; y: number; w: number; h: number } }
export interface CriterionEvidence { reason: string; refs: EvidenceRef[] }

/** Everything a submission holds, including ones saved before multi-file support. */
export function submissionAttachments(sub: Submission | undefined): AssignmentAttachment[] {
  if (!sub) return [];
  return sub.attachments ?? [];
}

/** A submission saved before attachments existed (localStorage mock data) kept its one link in `fileUrl`. Returns it with
 *  that link in `attachments` and without `fileUrl` — the same move the database migration made for server rows
 *  (20261110100000_drop_unused_columns). A blob: URL from an old upload can't be reopened, so it is dropped. */
export function withoutFileUrl(sub: Submission): Submission {
  const { fileUrl, ...rest } = sub as Submission & { fileUrl?: string | null };
  if (fileUrl === undefined) return sub;
  if (rest.attachments?.length || !fileUrl || !/^https?:\/\//i.test(fileUrl)) return rest;
  return { ...rest, attachments: [{ id: `legacy-${sub.id}`, kind: "link", name: fileUrl, source: "url", ref: fileUrl }] };
}

/** Student deadline thresholds (25/9/2569), one place so the pages agree: an unsubmitted assignment
 *  due within DUE_SOON_DAYS sits in the "Due soon" group; under URGENT_HOURS it also turns red
 *  ("Due soon!" badge on the card, red dot + date on the home page). */
export const DUE_SOON_DAYS = 3;
export const URGENT_HOURS = 48;

/** What a STUDENT may see of a submission (25/9/2569). Scores are announced by the teacher's "Finish &
 *  announce" (gradingFinalized) — until then a graded submission reads as plain "submitted, awaiting
 *  grade": no score, no comment, no breakdown. Teacher-side code keeps using the raw submission. */
export function studentVisibleSubmission(assignment: Assignment | undefined, sub: Submission): Submission {
  // The AI's reasons are the teacher's working material, never a student's: removed before AND after the announcement (R38, 10/11/2569)
  const visible: Submission = { ...sub, aiEvidence: undefined };
  if (sub.status !== "graded" || assignment?.gradingFinalized) return visible;
  return { ...visible, status: "not_graded", aiScore: null, instructorScore: null, instructorComment: "", criterionScores: undefined, aiCriterionScores: undefined, criterionComments: undefined };
}

export interface CriterionLevel {
  label: string;
  description: string;
}

export const DEFAULT_LEVELS: CriterionLevel[] = [
  { label: "Excellent", description: "" },
  { label: "Good", description: "" },
  { label: "Needs Improvement", description: "" },
];

/**
 * Which level a score falls in. Levels carry no point ranges, only an order (best first), so the
 * 0–max range is split evenly: with 3 levels, ≥ 2/3 of max is the 1st, ≥ 1/3 the 2nd, the rest the 3rd.
 */
export function achievedLevelIndex(earned: number, maxPoints: number, levelCount: number): number | null {
  if (levelCount <= 0 || maxPoints <= 0) return null;
  const clamped = Math.min(maxPoints, Math.max(0, earned));
  return Math.min(levelCount - 1, Math.max(0, Math.ceil((levelCount * (maxPoints - clamped)) / maxPoints) - 1));
}

/** Share of a criterion's points a level is worth, best level first: with 4 levels 100 / 66.67 / 33.33 / 0 %, the scale of the
 *  UX/UI rubric file (UXUI_Final_Rubric_draft1.xlsx). Generalised to any 2-6 levels. */
export function levelShare(levelIndex: number, levelCount: number): number {
  return levelCount <= 1 ? 1 : (levelCount - 1 - levelIndex) / (levelCount - 1);
}

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  maxPoints: number;
  weight: number; // 0–100, sum of all criteria must equal 100
  levels: CriterionLevel[];
  /** The course's learning outcomes (CLO.id) this criterion measures (11/10/2569). Metadata only — it never changes how
   *  a score is computed, so editing it does not restart grading. Absent = not linked to any CLO. */
  cloIds?: string[];
}

export interface Rubric {
  id: string;
  assignmentId: string;
  name: string;
  criteria: RubricCriterion[];
  /** The rubric this one was copied from ("Use a rubric from before", 14/10/2569) — which assignments a rubric came from
   *  (rubric history). Absent = written from scratch (or copied before this existed). */
  sourceRubricId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentContextValue {
  assignments: Assignment[];
  submissions: Submission[];
  rubrics: Rubric[];
  addAssignment: (data: Omit<Assignment, "id" | "createdAt" | "updatedAt">) => Assignment;
  updateAssignment: (id: string, data: Partial<Omit<Assignment, "id" | "courseId" | "createdAt" | "updatedAt">>) => void;
  removeAssignment: (id: string) => void;
  getAssignment: (id: string) => Assignment | undefined;
  getAssignmentsByCourse: (courseId: string) => Assignment[];
  addSubmission: (data: Omit<Submission, "id" | "updatedAt">) => Submission;
  updateSubmission: (id: string, data: Partial<Pick<Submission, "aiScore" | "instructorScore" | "instructorComment" | "criterionComments" | "criterionScores" | "aiCriterionScores" | "aiEvidence" | "snapshot" | "status" | "attachments" | "submittedAt" | "late">>) => void;
  /** A student hands the work in again: on screen the result is cleared (CLEARED_RESULT), the status goes back to
   *  not graded and submittedAt / late are the new ones. The server is sent only what a student may change —
   *  `{ attachments, status: "not_graded" }` — and clears the result and sets the time itself. */
  resubmitSubmission: (id: string, data: { attachments: AssignmentAttachment[]; submittedAt: string; late: boolean }) => void;
  getSubmissionsByAssignment: (assignmentId: string) => Submission[];
  addRubric: (data: Omit<Rubric, "id" | "createdAt" | "updatedAt">) => Rubric;
  updateRubric: (id: string, data: Partial<Omit<Rubric, "id" | "assignmentId" | "createdAt" | "updatedAt">>) => void;
  removeRubric: (id: string) => void;
  getRubric: (id: string) => Rubric | undefined;
  getRubricsByAssignment: (assignmentId: string) => Rubric[];
}

export const AssignmentContext = createContext<AssignmentContextValue | null>(null);

export function useAssignments(): AssignmentContextValue {
  const ctx = useContext(AssignmentContext);
  if (!ctx) throw new Error("useAssignments must be used within AssignmentProvider");
  return ctx;
}

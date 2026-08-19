"use client";

import { useState, useEffect, useCallback } from "react";
import { AssignmentContext, Assignment, Submission, Rubric } from "@/lib/assignments";

const LS_ASSIGNMENTS = "hwai_assignments_v1";
const LS_SUBMISSIONS = "hwai_submissions_v1";
const LS_RUBRICS = "hwai_rubrics_v1";

const SEED_ASSIGNMENTS: Assignment[] = [
  {
    id: "a-seed-1-1", courseId: "seed-1",
    name: "User Research Report",
    description: "จัดทำรายงานการวิจัยผู้ใช้ โดยสัมภาษณ์ผู้ใช้งานจริงอย่างน้อย 5 คน วิเคราะห์ความต้องการ และสรุปเป็น User Persona อย่างน้อย 2 คน พร้อม Pain Points และ Insight",
    dueDate: "2026-08-05", maxPoints: 100,
    acceptsFiles: true, fileTypes: ["figma", "pdf"], submissionType: "individual", maxGroupSize: null, rubricIds: ["r-seed-1-1"],
    createdAt: "2026-07-20T09:00:00.000Z", updatedAt: "2026-07-20T09:00:00.000Z",
  },
  {
    id: "a-seed-1-2", courseId: "seed-1",
    name: "Wireframe Prototype",
    description: "สร้าง Wireframe ระดับ Mid-fidelity ใน Figma ครอบคลุมอย่างน้อย 8 screens ของแอปพลิเคชันที่เลือก พร้อม flow diagram และ annotation ประกอบ",
    dueDate: "2026-08-15", maxPoints: 100,
    acceptsFiles: true, fileTypes: ["figma"], submissionType: "individual", maxGroupSize: null, rubricIds: [],
    createdAt: "2026-07-25T09:00:00.000Z", updatedAt: "2026-07-25T09:00:00.000Z",
  },
  {
    id: "a-seed-1-3", courseId: "seed-1",
    name: "Final UI Design (Figma)",
    description: "ส่ง Figma file ที่มี UI Design ระดับ High-fidelity ครบทุก screen พร้อม component library, style guide และ prototype link",
    dueDate: "2026-08-30", maxPoints: 100,
    acceptsFiles: true, fileTypes: ["figma"], submissionType: "group", maxGroupSize: 3, rubricIds: [],
    createdAt: "2026-08-01T09:00:00.000Z", updatedAt: "2026-08-01T09:00:00.000Z",
  },
  {
    id: "a-seed-2-1", courseId: "seed-2",
    name: "Interaction Flow Diagram",
    description: "ออกแบบ Interaction Flow Diagram สำหรับ digital product ที่เลือก ครอบคลุม user journey อย่างน้อย 3 flows หลัก พร้อม annotation อธิบาย trigger และ feedback",
    dueDate: "2026-07-28", maxPoints: 100,
    acceptsFiles: true, fileTypes: ["figma", "pdf"], submissionType: "individual", maxGroupSize: null, rubricIds: [],
    createdAt: "2026-07-10T09:00:00.000Z", updatedAt: "2026-07-10T09:00:00.000Z",
  },
  {
    id: "a-seed-2-2", courseId: "seed-2",
    name: "Usability Test Report",
    description: "ดำเนินการ Usability Testing กับกลุ่มตัวอย่าง 5 คน บันทึกผลการทดสอบ วิเคราะห์ปัญหาตาม Severity Rating และเสนอแนวทางแก้ไขพร้อม mockup",
    dueDate: "2026-08-12", maxPoints: 100,
    acceptsFiles: true, fileTypes: ["pdf"], submissionType: "individual", maxGroupSize: null, rubricIds: [],
    createdAt: "2026-07-20T09:00:00.000Z", updatedAt: "2026-07-20T09:00:00.000Z",
  },
];

const SEED_RUBRICS: Rubric[] = [
  {
    id: "r-seed-1-1", assignmentId: "a-seed-1-1",
    name: "User Research Rubric",
    criteria: [
      { id: "rc-1-1-1", name: "การสัมภาษณ์ผู้ใช้", description: "คุณภาพและความลึกของการสัมภาษณ์ผู้ใช้งาน", maxPoints: 30, weight: 30 },
      { id: "rc-1-1-2", name: "User Persona", description: "ความครบถ้วนและความแม่นยำของ Persona", maxPoints: 40, weight: 40 },
      { id: "rc-1-1-3", name: "Insight และสรุปผล", description: "ความลึกและความเข้าใจของ Pain Points และ Insights", maxPoints: 30, weight: 30 },
    ],
    createdAt: "2026-07-20T09:00:00.000Z", updatedAt: "2026-07-20T09:00:00.000Z",
  },
];

const SEED_SUBMISSIONS: Submission[] = [
  // a-seed-1-1: User Research Report — all graded
  { id: "sub-1-1-1", assignmentId: "a-seed-1-1", studentId: "s1", studentName: "สมชาย ใจดี", email: "somchai.j@kmitl.ac.th", submittedAt: "2026-08-04T14:30:00.000Z", fileUrl: null, aiScore: 88, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "graded", updatedAt: "2026-08-05T10:00:00.000Z" },
  { id: "sub-1-1-2", assignmentId: "a-seed-1-1", studentId: "s2", studentName: "สมหญิง รักดี", email: "somying.r@kmitl.ac.th", submittedAt: "2026-08-04T16:00:00.000Z", fileUrl: null, aiScore: 76, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "graded", updatedAt: "2026-08-05T10:00:00.000Z" },
  { id: "sub-1-1-3", assignmentId: "a-seed-1-1", studentId: "s3", studentName: "วิชัย สุขสันต์", email: "wichai.s@kmitl.ac.th", submittedAt: "2026-08-05T09:00:00.000Z", fileUrl: null, aiScore: 92, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "graded", updatedAt: "2026-08-05T10:00:00.000Z" },
  { id: "sub-1-1-4", assignmentId: "a-seed-1-1", studentId: "s4", studentName: "นภา แสงทอง", email: "napa.s@kmitl.ac.th", submittedAt: "2026-08-03T11:20:00.000Z", fileUrl: null, aiScore: 85, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "graded", updatedAt: "2026-08-05T10:00:00.000Z" },
  { id: "sub-1-1-5", assignmentId: "a-seed-1-1", studentId: "s5", studentName: "ธนภัทร มีสุข", email: "thanapat.m@kmitl.ac.th", submittedAt: "2026-08-05T08:45:00.000Z", fileUrl: null, aiScore: 79, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "graded", updatedAt: "2026-08-05T10:00:00.000Z" },
  // a-seed-1-2: Wireframe Prototype — mixed
  { id: "sub-1-2-1", assignmentId: "a-seed-1-2", studentId: "s1", studentName: "สมชาย ใจดี", email: "somchai.j@kmitl.ac.th", submittedAt: "2026-08-14T20:15:00.000Z", fileUrl: null, aiScore: 82, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "need_review", updatedAt: "2026-08-15T08:00:00.000Z" },
  { id: "sub-1-2-2", assignmentId: "a-seed-1-2", studentId: "s3", studentName: "วิชัย สุขสันต์", email: "wichai.s@kmitl.ac.th", submittedAt: "2026-08-13T10:00:00.000Z", fileUrl: null, aiScore: 91, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "graded", updatedAt: "2026-08-15T08:00:00.000Z" },
  { id: "sub-1-2-3", assignmentId: "a-seed-1-2", studentId: "s6", studentName: "กานต์ดา พรหมดี", email: "kanda.p@kmitl.ac.th", submittedAt: "2026-08-15T22:55:00.000Z", fileUrl: null, aiScore: 74, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "need_review", updatedAt: "2026-08-16T00:00:00.000Z" },
  { id: "sub-1-2-4", assignmentId: "a-seed-1-2", studentId: "s7", studentName: "ปิยะ วงศ์ดี", email: "piya.w@kmitl.ac.th", submittedAt: "2026-08-16T01:10:00.000Z", fileUrl: null, aiScore: null, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "not_graded", updatedAt: "2026-08-16T01:10:00.000Z" },
  // a-seed-2-1: Interaction Flow Diagram — all graded
  { id: "sub-2-1-1", assignmentId: "a-seed-2-1", studentId: "t1", studentName: "ณัฐพล เจริญสุข", email: "nattapon.j@kmitl.ac.th", submittedAt: "2026-07-27T14:00:00.000Z", fileUrl: null, aiScore: 90, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "graded", updatedAt: "2026-07-28T10:00:00.000Z" },
  { id: "sub-2-1-2", assignmentId: "a-seed-2-1", studentId: "t2", studentName: "ศิริพร วัฒนา", email: "siriporn.w@kmitl.ac.th", submittedAt: "2026-07-26T16:30:00.000Z", fileUrl: null, aiScore: 85, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "graded", updatedAt: "2026-07-28T10:00:00.000Z" },
  { id: "sub-2-1-3", assignmentId: "a-seed-2-1", studentId: "t3", studentName: "ภาณุวัฒน์ สมบูรณ์", email: "panuwat.s@kmitl.ac.th", submittedAt: "2026-07-28T08:00:00.000Z", fileUrl: null, aiScore: 72, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "graded", updatedAt: "2026-07-28T10:00:00.000Z" },
  { id: "sub-2-1-4", assignmentId: "a-seed-2-1", studentId: "t4", studentName: "ชนิดา ดีเลิศ", email: "chanida.d@kmitl.ac.th", submittedAt: "2026-07-25T11:00:00.000Z", fileUrl: null, aiScore: 95, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "graded", updatedAt: "2026-07-28T10:00:00.000Z" },
  { id: "sub-2-1-5", assignmentId: "a-seed-2-1", studentId: "t5", studentName: "ธีรศักดิ์ แก้วใส", email: "teerasak.k@kmitl.ac.th", submittedAt: "2026-07-27T19:00:00.000Z", fileUrl: null, aiScore: 88, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "graded", updatedAt: "2026-07-28T10:00:00.000Z" },
  { id: "sub-2-1-6", assignmentId: "a-seed-2-1", studentId: "t6", studentName: "มาลี สุดสวย", email: "malee.su@kmitl.ac.th", submittedAt: "2026-07-28T07:30:00.000Z", fileUrl: null, aiScore: 78, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "graded", updatedAt: "2026-07-28T10:00:00.000Z" },
  { id: "sub-2-1-7", assignmentId: "a-seed-2-1", studentId: "t7", studentName: "กิตติ พันธุ์ดี", email: "kitti.p@kmitl.ac.th", submittedAt: "2026-07-26T13:00:00.000Z", fileUrl: null, aiScore: 82, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "graded", updatedAt: "2026-07-28T10:00:00.000Z" },
  { id: "sub-2-1-8", assignmentId: "a-seed-2-1", studentId: "t8", studentName: "วรรณี ชัยชนะ", email: "wannee.c@kmitl.ac.th", submittedAt: "2026-07-27T10:00:00.000Z", fileUrl: null, aiScore: 86, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "graded", updatedAt: "2026-07-28T10:00:00.000Z" },
  // a-seed-2-2: Usability Test Report — mixed
  { id: "sub-2-2-1", assignmentId: "a-seed-2-2", studentId: "t1", studentName: "ณัฐพล เจริญสุข", email: "nattapon.j@kmitl.ac.th", submittedAt: "2026-08-11T18:00:00.000Z", fileUrl: null, aiScore: 87, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "need_review", updatedAt: "2026-08-12T00:00:00.000Z" },
  { id: "sub-2-2-2", assignmentId: "a-seed-2-2", studentId: "t2", studentName: "ศิริพร วัฒนา", email: "siriporn.w@kmitl.ac.th", submittedAt: "2026-08-10T22:00:00.000Z", fileUrl: null, aiScore: 79, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "need_review", updatedAt: "2026-08-12T00:00:00.000Z" },
  { id: "sub-2-2-3", assignmentId: "a-seed-2-2", studentId: "t4", studentName: "ชนิดา ดีเลิศ", email: "chanida.d@kmitl.ac.th", submittedAt: "2026-08-09T14:00:00.000Z", fileUrl: null, aiScore: 93, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "graded", updatedAt: "2026-08-12T00:00:00.000Z" },
  { id: "sub-2-2-4", assignmentId: "a-seed-2-2", studentId: "t5", studentName: "ธีรศักดิ์ แก้วใส", email: "teerasak.k@kmitl.ac.th", submittedAt: "2026-08-12T11:55:00.000Z", fileUrl: null, aiScore: null, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "not_graded", updatedAt: "2026-08-12T11:55:00.000Z" },
  { id: "sub-2-2-5", assignmentId: "a-seed-2-2", studentId: "t6", studentName: "มาลี สุดสวย", email: "malee.su@kmitl.ac.th", submittedAt: "2026-08-11T09:30:00.000Z", fileUrl: null, aiScore: 81, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "need_review", updatedAt: "2026-08-12T00:00:00.000Z" },
  { id: "sub-2-2-6", assignmentId: "a-seed-2-2", studentId: "t3", studentName: "ภาณุวัฒน์ สมบูรณ์", email: "panuwat.s@kmitl.ac.th", submittedAt: "2026-08-10T16:00:00.000Z", fileUrl: null, aiScore: 88, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "graded", updatedAt: "2026-08-12T00:00:00.000Z" },
];

function loadData<T>(key: string, fallback: T[]): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : fallback;
  } catch { return fallback; }
}

const ASSIGNMENT_DEFAULTS = {
  acceptsFiles: true,
  fileTypes: ["figma", "pdf"] as Assignment["fileTypes"],
  submissionType: "individual" as const,
  maxGroupSize: null,
  rubricIds: [] as string[],
};

export default function AssignmentProvider({ children }: { children: React.ReactNode }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const rawA = loadData<Assignment>(LS_ASSIGNMENTS, SEED_ASSIGNMENTS);
    // migrate old assignments that lack new fields
    setAssignments(rawA.map(a => ({ ...ASSIGNMENT_DEFAULTS, ...a })));
    setSubmissions(loadData<Submission>(LS_SUBMISSIONS, SEED_SUBMISSIONS));
    setRubrics(loadData<Rubric>(LS_RUBRICS, SEED_RUBRICS));
    setReady(true);
  }, []);

  const persistA = useCallback((next: Assignment[]) => {
    setAssignments(next);
    localStorage.setItem(LS_ASSIGNMENTS, JSON.stringify(next));
  }, []);

  const persistS = useCallback((next: Submission[]) => {
    setSubmissions(next);
    localStorage.setItem(LS_SUBMISSIONS, JSON.stringify(next));
  }, []);

  const persistR = useCallback((next: Rubric[]) => {
    setRubrics(next);
    localStorage.setItem(LS_RUBRICS, JSON.stringify(next));
  }, []);

  const addAssignment = useCallback((data: Omit<Assignment, "id" | "createdAt" | "updatedAt">): Assignment => {
    const now = new Date().toISOString();
    const a: Assignment = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    persistA([...assignments, a]);
    return a;
  }, [assignments, persistA]);

  const updateAssignment = useCallback((id: string, data: Partial<Omit<Assignment, "id" | "courseId" | "createdAt" | "updatedAt">>) => {
    persistA(assignments.map(a => a.id === id ? { ...a, ...data, updatedAt: new Date().toISOString() } : a));
  }, [assignments, persistA]);

  const removeAssignment = useCallback((id: string) => {
    persistA(assignments.filter(a => a.id !== id));
    persistS(submissions.filter(s => s.assignmentId !== id)); // cascade
    persistR(rubrics.filter(r => r.assignmentId !== id)); // cascade
  }, [assignments, submissions, rubrics, persistA, persistS, persistR]);

  const getAssignment = useCallback((id: string) => assignments.find(a => a.id === id), [assignments]);

  const getAssignmentsByCourse = useCallback((courseId: string) =>
    assignments.filter(a => a.courseId === courseId), [assignments]);

  const addSubmission = useCallback((data: Omit<Submission, "id" | "updatedAt">): Submission => {
    const now = new Date().toISOString();
    const s: Submission = { ...data, id: crypto.randomUUID(), updatedAt: now };
    persistS([...submissions, s]);
    return s;
  }, [submissions, persistS]);

  const updateSubmission = useCallback((
    id: string,
    data: Partial<Pick<Submission, "aiScore" | "instructorScore" | "instructorComment" | "status" | "fileUrl">>
  ) => {
    persistS(submissions.map(s => s.id === id ? { ...s, ...data, updatedAt: new Date().toISOString() } : s));
  }, [submissions, persistS]);

  const getSubmissionsByAssignment = useCallback((assignmentId: string) =>
    submissions.filter(s => s.assignmentId === assignmentId), [submissions]);

  const addRubric = useCallback((data: Omit<Rubric, "id" | "createdAt" | "updatedAt">): Rubric => {
    const now = new Date().toISOString();
    const r: Rubric = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    persistR([...rubrics, r]);
    return r;
  }, [rubrics, persistR]);

  const updateRubric = useCallback((id: string, data: Partial<Omit<Rubric, "id" | "assignmentId" | "createdAt" | "updatedAt">>) => {
    persistR(rubrics.map(r => r.id === id ? { ...r, ...data, updatedAt: new Date().toISOString() } : r));
  }, [rubrics, persistR]);

  const removeRubric = useCallback((id: string) => {
    persistR(rubrics.filter(r => r.id !== id));
  }, [rubrics, persistR]);

  const getRubricsByAssignment = useCallback((assignmentId: string) =>
    rubrics.filter(r => r.assignmentId === assignmentId), [rubrics]);

  if (!ready) return null;

  return (
    <AssignmentContext.Provider value={{
      assignments, submissions, rubrics,
      addAssignment, updateAssignment, removeAssignment,
      getAssignment, getAssignmentsByCourse,
      addSubmission, updateSubmission, getSubmissionsByAssignment,
      addRubric, updateRubric, removeRubric, getRubricsByAssignment,
    }}>
      {children}
    </AssignmentContext.Provider>
  );
}

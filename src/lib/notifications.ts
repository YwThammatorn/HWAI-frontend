export type NotifType =
  | "ai_grading_complete"
  | "late_submission"
  | "ta_invitation"
  | "plagiarism_alert"
  | "joining_approved";

export interface Notif {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  createdAt: Date;
  read: boolean;
  meta?: {
    courseId?: string;
    assignmentId?: string;
    courseName?: string;
    studentName?: string;
    requesterEmail?: string;
  };
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3_600_000);
}

function daysAgo(d: number, hour = 14, min = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() - d);
  date.setHours(hour, min, 0, 0);
  return date;
}

export const INITIAL_NOTIFS: Notif[] = [
  {
    id: "n1",
    type: "ai_grading_complete",
    title: "AI Grading Complete: AP Physics Quiz 3",
    body: "HWAI Agent has finished grading 24 submissions. Review the suggested scores and feedback before releasing to students.",
    createdAt: hoursAgo(2),
    read: false,
    meta: { courseId: "c1", assignmentId: "a1" },
  },
  {
    id: "n2",
    type: "late_submission",
    title: "Late Submission Received",
    body: "Michael Chen submitted 'History Essay: The Industrial Revolution'. This was due yesterday.",
    createdAt: hoursAgo(4),
    read: false,
    meta: { courseId: "c2", assignmentId: "a2", studentName: "Michael Chen" },
  },
  {
    id: "n3",
    type: "ta_invitation",
    title: "Chemistry Lab : TA Invitation Request",
    body: "ElenaRodriguez@school.edu sent you a request for collaborating as TA with Chemistry Lab course.",
    createdAt: daysAgo(1, 16, 20),
    read: false,
    meta: { courseId: "c3", courseName: "Chemistry Lab", requesterEmail: "ElenaRodriguez@school.edu" },
  },
  {
    id: "n4",
    type: "plagiarism_alert",
    title: "Plagiarism Alert Detected",
    body: "High similarity score (85%) detected in submission by James Doe for 'Biology Lab Report'.",
    createdAt: daysAgo(3, 10, 0),
    read: true,
    meta: { courseId: "c4", assignmentId: "a4", studentName: "James Doe" },
  },
  {
    id: "n5",
    type: "joining_approved",
    title: "World Literature : Joining Request Approved",
    body: "Your request to join World Literature is approved by its teacher.",
    createdAt: daysAgo(9, 14, 0),
    read: true,
    meta: { courseName: "World Literature" },
  },
];

export function formatNotifTime(date: Date): string {
  const now = new Date();
  const diffH = (now.getTime() - date.getTime()) / 3_600_000;

  if (diffH < 1) return "Just now";
  if (diffH < 24) {
    const h = Math.floor(diffH);
    return `${h} hour${h > 1 ? "s" : ""} ago`;
  }

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);

  if (date >= yesterdayStart) {
    return `Yesterday, ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }

  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function groupNotifs(notifs: Notif[]): {
  today: Notif[];
  yesterday: Notif[];
  older: Notif[];
} {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);

  return {
    today: notifs.filter((n) => n.createdAt >= todayStart),
    yesterday: notifs.filter((n) => n.createdAt >= yesterdayStart && n.createdAt < todayStart),
    older: notifs.filter((n) => n.createdAt < yesterdayStart),
  };
}

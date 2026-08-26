"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { useCourses } from "@/lib/courses";
import { useLanguage } from "@/context/LanguageContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type CollabRole = "Teacher" | "Teaching Assistant";
type CollabStatus = "Active" | "Offline";

interface Collaborator {
  id: string;
  name: string;
  email: string;
  role: CollabRole;
  permissions: string;
  status: CollabStatus;
  initials: string;
  avatarBg: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const INITIAL_COLLABS: Collaborator[] = [
  {
    id: "c1",
    name: "Prof. John Doe",
    email: "john.doe@university.edu",
    role: "Teacher",
    permissions: "Full Access",
    status: "Active",
    initials: "JD",
    avatarBg: "#1B2A4A",
  },
  {
    id: "c2",
    name: "Emily Sanders",
    email: "emily.sanders@university.edu",
    role: "Teaching Assistant",
    permissions: "Can grade & edit",
    status: "Offline",
    initials: "ES",
    avatarBg: "#4F46E5",
  },
  {
    id: "c3",
    name: "Michael Chen",
    email: "m.chen.grad@university.edu",
    role: "Teaching Assistant",
    permissions: "Can grade & edit",
    status: "Active",
    initials: "MC",
    avatarBg: "#0F766E",
  },
];

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ─── Components ───────────────────────────────────────────────────────────────

function Avatar({ initials, bg }: { initials: string; bg: string }) {
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
      style={{ background: bg }}
    >
      {initials}
    </div>
  );
}

function StatusBadge({ status }: { status: CollabStatus }) {
  const { t } = useLanguage();
  return status === "Active" ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      {t("ออนไลน์", "Active")}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
      <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
      {t("ออฟไลน์", "Offline")}
    </span>
  );
}

function RowMenu({
  collabId,
  isOwner,
  onRemove,
}: {
  collabId: string;
  isOwner: boolean;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const { t } = useLanguage();
  if (isOwner) return <div className="w-8" />;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        aria-label={t("ตัวเลือกเพิ่มเติม", "More options")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 bg-white border border-gray-100 rounded-xl shadow-lg py-1 w-36">
          <button
            onClick={() => { onRemove(collabId); setOpen(false); }}
            className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
          >
            {t("ลบออก", "Remove")}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CollaboratorsPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const course = getCourse(id);

  const [collabs, setCollabs] = useState<Collaborator[]>(INITIAL_COLLABS);
  const [search, setSearch] = useState("");
  const [inviteCode, setInviteCode] = useState("CVD1FT");
  const [copied, setCopied] = useState(false);

  const ROLE_LABELS: Record<string, string> = {
    Teacher:             t("อาจารย์", "Teacher"),
    "Teaching Assistant": t("ผู้ช่วยสอน", "Teaching Assistant"),
  };
  const PERM_LABELS: Record<string, string> = {
    "Full Access":      t("เข้าถึงได้ทั้งหมด", "Full Access"),
    "Can grade & edit": t("ตรวจและแก้ไขได้", "Can grade & edit"),
  };

  const filtered = collabs.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  function remove(id: string) {
    const target = collabs.find((c) => c.id === id);
    const msg = t(
      `ลบ "${target?.name ?? ""}" ออกจาก course นี้?`,
      `Remove "${target?.name ?? ""}" from this course?`
    );
    if (!window.confirm(msg)) return;
    setCollabs((prev) => prev.filter((c) => c.id !== id));
  }

  function copyCode() {
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!course) {
    return (
      <AppShell>
        <main className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          {t("ไม่พบรายวิชานี้", "Course not found")} —{" "}
          <Link href="/courses" className="text-[var(--accent)] ml-1 hover:underline">{t("กลับไปหน้าหลัก", "Back to home")}</Link>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="w-full max-w-[900px] mx-auto px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/courses" className="hover:text-[var(--accent)] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="inline -mt-0.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </Link>
          <span>/</span>
          <Link href={`/courses/${id}`} className="hover:text-[var(--accent)] transition-colors">{course.name}</Link>
          <span>/</span>
          <span className="text-[var(--accent)] font-medium">{t("ผู้ร่วมงาน", "Collaborators")}</span>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t("จัดการผู้ร่วมงาน", "Collaborators Management")}</h1>
        <p className="text-sm text-gray-500 mb-8">
          {t("จัดการอาจารย์และผู้ช่วยสอนสำหรับ", "Manage teachers and teaching assistants for")} <strong className="text-[var(--text-primary)]">{course.name}</strong>.
        </p>

        {/* Course Team card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-5">
          {/* Card header */}
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-gray-50">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">{t("ทีมรายวิชา", "Course Team")}</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {t("รายชื่อผู้ร่วมงานทั้งหมดที่มีสิทธิ์จัดการหรือตรวจงาน", "A list of all collaborators with administrative or grading access to this course.")}
              </p>
            </div>
            <div className="relative shrink-0">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder={t("ค้นหาชื่อหรืออีเมล", "Search by name or email")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors w-56"
              />
            </div>
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-gray-500">{t("ไม่พบผู้ร่วมงานที่ตรงกัน", "No matching collaborators found")}</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map((c) => (
                <div key={c.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors">
                  <Avatar initials={c.initials} bg={c.avatarBg} />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.email}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{ROLE_LABELS[c.role] ?? c.role}</p>
                    <p className="text-xs text-gray-500">{PERM_LABELS[c.permissions] ?? c.permissions}</p>
                  </div>

                  <div className="w-24 flex justify-end">
                    <StatusBadge status={c.status} />
                  </div>

                  <RowMenu collabId={c.id} isOwner={c.role === "Teacher"} onRemove={remove} />
                </div>
              ))}
            </div>
          )}

          {/* Card footer */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-50">
            <p className="text-xs text-gray-500">
              {t("แสดง", "Showing")} <strong className="text-[var(--text-primary)]">{filtered.length}</strong> {t("ผู้ร่วมงาน", filtered.length !== 1 ? "collaborators" : "collaborator")}
            </p>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {t("ผู้ดูแลระบบสามารถจัดการสิทธิ์ได้ในการตั้งค่า", "Admins can manage roles in Settings")}
            </p>
          </div>
        </div>

        {/* Invite Code card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-start justify-between gap-6 px-6 py-5">
            <div className="flex-1">
              <h2 className="text-base font-bold text-[var(--text-primary)] mb-1">{t("รหัสเชิญ", "Invite Code")}</h2>
              <p className="text-sm text-gray-500 leading-relaxed max-w-sm">
                {t("แชร์รหัสนี้เพื่อให้ผู้ช่วยสอนขอเข้าร่วม คำขอต้องได้รับการอนุมัติจากคุณ", "Share this code to allow TAs to request access to this course. Requests will need your approval.")}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-mono font-semibold text-[var(--text-primary)] bg-gray-50 min-w-[80px] text-center tracking-widest">
                {inviteCode}
              </div>
              <button
                onClick={copyCode}
                className={[
                  "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-colors",
                  copied
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "border-gray-200 text-[var(--text-primary)] hover:bg-gray-50",
                ].join(" ")}
              >
                {copied ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    {t("คัดลอกแล้ว", "Copied")}
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    {t("คัดลอก", "Copy")}
                  </>
                )}
              </button>
              <button
                onClick={() => setInviteCode(generateCode())}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-[var(--text-primary)] hover:bg-gray-50 transition-colors"
              >
                {t("สร้างใหม่", "Regenerate")}
              </button>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}

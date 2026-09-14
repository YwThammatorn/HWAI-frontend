"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useCourses } from "@/lib/courses";
import { useAnnouncements, announcementReachesCourse } from "@/lib/announcements";
import EmptyState from "@/components/EmptyState";

function fmtDateTime(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function StudentAnnouncementsPage() {
  const { secId } = useParams<{ secId: string }>();
  const { t, lang } = useLanguage();
  const { getCourse } = useCourses();
  const { announcements } = useAnnouncements();

  const course = getCourse(secId);

  const visible = useMemo(() => {
    if (!course) return [];
    return announcements
      .filter((a) => announcementReachesCourse(a, course))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [announcements, course]);

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">{t("ประกาศ", "Announcements")}</h1>

      {visible.length === 0 ? (
        <EmptyState
          iconColor="var(--accent-bright)"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/>
            </svg>
          }
          title={t("ยังไม่มีประกาศ", "No announcements yet")}
          description={t("อาจารย์จะโพสต์ประกาศสำคัญที่นี่", "Your instructor will post important announcements here")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((a) => (
            <div key={a.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{a.title}</p>
              <p className="text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed whitespace-pre-wrap">{a.body}</p>
              <p className="text-xs text-[var(--text-muted)] mt-3">{fmtDateTime(a.createdAt, lang)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

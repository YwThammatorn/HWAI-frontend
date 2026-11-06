"use client";

import { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCourses } from "@/lib/courses";
import { useAnnouncements, announcementReachesCourse, AnnouncementScope } from "@/lib/announcements";
import { useLanguage } from "@/context/LanguageContext";
import { ANNOUNCEMENTS_DISABLED } from "@/lib/featureFlags";

import Icon from "@/components/Icon";
import IconTile from "@/components/IconTile";
import IconButton from "@/components/IconButton";
function fmtDateTime(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function TeacherAnnouncementsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, lang } = useLanguage();
  const { courses, getCourse } = useCourses();
  const { announcements, addAnnouncement, removeAnnouncement } = useAnnouncements();

  useEffect(() => {
    if (ANNOUNCEMENTS_DISABLED) router.replace(`/teacher/courses/${id}`);
  }, [router, id]);

  const course = getCourse(id);

  const siblingSections = useMemo(() => {
    if (!course?.courseTemplateId) return [];
    return courses.filter((c) =>
      c.id !== course.id &&
      c.courseTemplateId === course.courseTemplateId &&
      String(c.term) === String(course.term) &&
      c.academicYear === course.academicYear
    );
  }, [courses, course]);

  const visible = useMemo(() => {
    if (!course) return [];
    return announcements
      .filter((a) => announcementReachesCourse(a, course))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [announcements, course]);

  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<AnnouncementScope>("this-section");

  function openAdd() {
    setTitle("");
    setBody("");
    setScope("this-section");
    setFormOpen(true);
  }

  function handleSave() {
    if (!course) return;
    const t_ = title.trim();
    const b = body.trim();
    if (!t_ || !b) return;
    addAnnouncement({
      authorCourseId: course.id,
      scope,
      courseTemplateId: course.courseTemplateId,
      term: course.term,
      academicYear: course.academicYear,
      title: t_,
      body: b,
    });
    setFormOpen(false);
  }

  function handleDelete(id_: string, announcementTitle: string) {
    if (!window.confirm(t(`ลบประกาศ "${announcementTitle}" ถาวร? ไม่สามารถกู้คืนได้`, `Permanently delete "${announcementTitle}"? Cannot be undone.`))) return;
    removeAnnouncement(id_);
  }

  if (!course) {
    return (
        <main className="flex-1 flex items-center justify-center text-sm text-[var(--text-secondary)]">
          {t("ไม่พบวิชา", "Course not found")}
        </main>
    );
  }

  if (ANNOUNCEMENTS_DISABLED) return null;

  const showEmpty = visible.length === 0 && !formOpen;

  return (
      <main className="w-full px-8 py-10">

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t("ประกาศรายวิชา", "Course Announcements")}</h1>
            <p className="text-sm text-[var(--text-secondary)]">{course.name}</p>
          </div>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-medium transition-colors mt-1"
          >
            <Icon name="plus" />
            {t("เพิ่มประกาศ", "New Announcement")}
          </button>
        </div>

        {showEmpty ? (
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-14 text-center">
            <IconTile icon="bell" size="lg" tone="accent" className="mx-auto mb-4" />
            <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">{t("ยังไม่มีประกาศ", "No announcements yet")}</p>
            <p className="text-xs text-[var(--text-secondary)] mb-6">{t("ประกาศข่าวสารให้นักศึกษาในวิชานี้เห็น", "Post updates for students in this course")}</p>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-medium transition-colors"
            >
              {t("ประกาศแรก", "Post First Announcement")}
            </button>
          </div>
        ) : (
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm overflow-hidden">
            {visible.map((a, idx) => (
              <div
                key={a.id}
                className={[
                  "py-4 px-5 transition-colors hover:bg-[var(--bg-subtle)]/50",
                  idx < visible.length - 1 ? "border-b border-[var(--border-subtle)]" : "",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{a.title}</p>
                      {a.scope === "all-sections" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] text-[10px] font-semibold uppercase tracking-wide">
                          {t("ทุก Sec", "All Sections")}
                        </span>
                      )}
                      {a.authorCourseId !== course.id && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--bg-app)] text-[var(--text-secondary)] text-[10px] font-medium">
                          {t("จาก Section อื่น", "From another section")}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed whitespace-pre-wrap">{a.body}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-2">{fmtDateTime(a.createdAt, lang)}</p>
                  </div>
                  {a.authorCourseId === course.id && (
                    <IconButton icon="trash" label={t("ลบ", "Delete")} tone="danger" onClick={() => handleDelete(a.id, a.title)} />
                  )}
                </div>
              </div>
            ))}

            {formOpen && (
              <div className="border-t-2 border-[var(--accent)]/20 bg-[var(--accent-subtle)]/40 p-6">
                <p className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wider mb-4">{t("เพิ่มประกาศ", "New Announcement")}</p>

                <div className="mb-3">
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    {t("หัวข้อ", "Title")} <span className="text-[var(--s-err-text)]">*</span>
                  </label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="เช่น เลื่อนกำหนดส่งงาน"
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    {t("เนื้อหา", "Message")} <span className="text-[var(--s-err-text)]">*</span>
                  </label>
                  <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] resize-none transition-colors"
                  />
                </div>

                <div className="mb-2">
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">{t("ประกาศไปที่", "Post to")}</label>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setScope("this-section")}
                      className={[
                        "text-left px-3.5 py-2.5 rounded-xl border text-sm transition-colors",
                        scope === "this-section" ? "border-[var(--accent)] bg-[var(--bg-surface)] text-[var(--text-primary)]" : "border-[var(--border)] text-[var(--text-secondary)] bg-[var(--bg-surface)] hover:border-[var(--border)]",
                      ].join(" ")}
                    >
                      <span className="font-medium">{t("เฉพาะ Section นี้", "This section only")}</span>
                      <span className="block text-xs text-[var(--text-secondary)] mt-0.5">
                        {course.code}{course.sectionNumber ? ` · ${t("กลุ่ม", "Sec.")} ${course.sectionNumber}` : ""}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={siblingSections.length === 0}
                      onClick={() => setScope("all-sections")}
                      className={[
                        "text-left px-3.5 py-2.5 rounded-xl border text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                        scope === "all-sections" ? "border-[var(--accent)] bg-[var(--bg-surface)] text-[var(--text-primary)]" : "border-[var(--border)] text-[var(--text-secondary)] bg-[var(--bg-surface)] hover:border-[var(--border)]",
                      ].join(" ")}
                    >
                      <span className="font-medium">{t("ทุก Section ของวิชานี้", "All sections of this subject")}</span>
                      <span className="block text-xs text-[var(--text-secondary)] mt-0.5">
                        {siblingSections.length > 0
                          ? t(
                              `จะเห็นด้วย: ${siblingSections.map(s => `Sec. ${s.sectionNumber ?? "?"}`).join(", ")}`,
                              `Also reaches: ${siblingSections.map(s => `Sec. ${s.sectionNumber ?? "?"}`).join(", ")}`
                            )
                          : t("วิชานี้เปิดสอนแค่ Section เดียว", "This subject only has one section")}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setFormOpen(false)}
                    className="px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
                  >
                    {t("ยกเลิก", "Cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!title.trim() || !body.trim()}
                    className="px-4 py-2 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("ประกาศ", "Post")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
  );
}

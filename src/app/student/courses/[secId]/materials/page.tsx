"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useCourses } from "@/lib/courses";
import { useTeachingMaterials, TeachingMaterial, TeachingMaterialType } from "@/lib/teachingMaterials";
import { resolveFileUrl } from "@/lib/fileStorage";
import EmptyState from "@/components/EmptyState";
import { MATERIALS_DISABLED } from "@/lib/featureFlags";

const TYPE_ICON: Record<TeachingMaterialType, React.ReactNode> = {
  link: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
  file: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
  recording: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <polygon points="23 7 16 12 23 17 23 7"/>
      <rect x="1" y="5" width="15" height="14" rx="2"/>
    </svg>
  ),
};

export default function StudentMaterialsPage() {
  const { secId } = useParams<{ secId: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const { getMaterialsByCourse } = useTeachingMaterials();

  useEffect(() => {
    if (MATERIALS_DISABLED) router.replace(`/student/courses/${secId}/classwork`);
  }, [router, secId]);

  const TYPE_LABEL: Record<TeachingMaterialType, string> = {
    link: t("ลิงก์", "Link"),
    file: t("ไฟล์แนบ", "File"),
    recording: t("บันทึกการสอน", "Recording"),
  };

  const course = getCourse(secId);
  const materials = course ? getMaterialsByCourse(secId) : [];

  function openMaterial(m: TeachingMaterial) {
    const href = m.source === "url" ? m.ref : resolveFileUrl(m.ref);
    if (href) window.open(href, "_blank", "noopener,noreferrer");
  }

  if (MATERIALS_DISABLED) return null;

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">{t("สื่อการสอน", "Materials")}</h1>

      {materials.length === 0 ? (
        <EmptyState
          iconColor="var(--accent-bright)"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
          }
          title={t("ยังไม่มีสื่อการสอน", "No materials yet")}
          description={t("อาจารย์ยังไม่ได้แนบลิงก์ เอกสาร หรือบันทึกการสอน", "Your instructor hasn't attached any links, documents, or recordings yet")}
        />
      ) : (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
          {materials.map((m, idx) => (
            <button
              key={m.id}
              onClick={() => openMaterial(m)}
              className={[
                "w-full flex items-center gap-3 py-3.5 px-5 text-left hover:bg-[var(--bg-subtle)]/50 transition-colors",
                idx < materials.length - 1 ? "border-b border-[var(--border-subtle)]" : "",
              ].join(" ")}
            >
              <span className="shrink-0 w-9 h-9 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center">
                {TYPE_ICON[m.type]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{m.title}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{TYPE_LABEL[m.type]}</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-[var(--text-muted)]" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

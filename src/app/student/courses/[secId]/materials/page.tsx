"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useCourses } from "@/lib/courses";
import { useTeachingMaterials, TeachingMaterial, TeachingMaterialType } from "@/lib/teachingMaterials";
import { resolveFileUrl } from "@/lib/fileStorage";
import EmptyState from "@/components/EmptyState";
import { MATERIALS_DISABLED } from "@/lib/featureFlags";

import Icon, { type IconName } from "@/components/Icon";
import IconTile from "@/components/IconTile";
const TYPE_ICON: Record<TeachingMaterialType, IconName> = {
  link: "link",
  file: "file",
  recording: "video",
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
          icon="file"
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
              <IconTile icon={TYPE_ICON[m.type]} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{m.title}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{TYPE_LABEL[m.type]}</p>
              </div>
              <Icon name="external-link" size="sm" className="shrink-0 text-[var(--text-muted)]" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  INITIAL_NOTIFS,
  formatNotifTime,
  groupNotifs,
  type Notif,
  type NotifType,
} from "@/lib/notifications";
import { useLanguage } from "@/context/LanguageContext";
import { NOTIFICATIONS_DISABLED } from "@/lib/featureFlags";

import Icon from "@/components/Icon";
import IconTile, { type IconTileTone } from "@/components/IconTile";
import type { IconName } from "@/components/Icon";
// ─── Icons ────────────────────────────────────────────────────────────────────

const ICON_CONFIG: Record<Notif["type"], { icon: IconName; tone: IconTileTone }> = {
  ai_grading_complete: { icon: "check", tone: "accent" },
  late_submission: { icon: "clock", tone: "info" },
  ta_invitation: { icon: "message-square", tone: "ta" },
  plagiarism_alert: { icon: "alert-triangle", tone: "warn" },
  joining_approved: { icon: "check", tone: "accent" },
};

// ─── Notification Card ────────────────────────────────────────────────────────

function NotifCard({
  notif,
  onDismiss,
  onAccept,
  onDecline,
}: {
  notif: Notif;
  onDismiss: (id: string) => void;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const { t } = useLanguage();
  const icon = ICON_CONFIG[notif.type];

  const actions: React.ReactNode = (() => {
    switch (notif.type) {
      case "ai_grading_complete":
        return (
          <>
            <button className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-xs font-medium hover:bg-[var(--accent-solid-hover)] transition-colors">
              {t("ดูผลลัพธ์", "View Results")}
              <Icon name="arrow-right" size="sm" />
            </button>
            <button
              onClick={() => onDismiss(notif.id)}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-secondary)] transition-colors px-1"
            >
              {t("ปิด", "Dismiss")}
            </button>
          </>
        );
      case "late_submission":
        return (
          <button className="inline-flex items-center px-4 py-1.5 rounded-lg border border-[var(--accent)] text-[var(--accent)] text-xs font-medium hover:bg-[var(--accent)]/5 transition-colors">
            {t("ตรวจงาน", "Grade Now")}
          </button>
        );
      case "ta_invitation":
        return (
          <>
            <button
              onClick={() => onAccept(notif.id)}
              className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-solid-hover)] transition-colors"
            >
              {t("ยอมรับ", "Accept")}
            </button>
            <button
              onClick={() => onDecline(notif.id)}
              className="text-xs font-semibold text-[var(--s-err-text)] hover:opacity-80 transition-colors"
            >
              {t("ปฏิเสธ", "Decline")}
            </button>
          </>
        );
      case "plagiarism_alert":
        return (
          <button className="inline-flex items-center px-4 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] text-xs font-medium hover:bg-[var(--bg-subtle)] transition-colors">
            {t("ดูรายละเอียด", "View Detail")}
          </button>
        );
      default:
        return null;
    }
  })();

  return (
    <div
      className={[
        "bg-[var(--bg-surface)] rounded-2xl border shadow-sm p-4 flex gap-3.5 transition-opacity",
        notif.read ? "border-[var(--border-subtle)] opacity-70" : "border-[var(--border-subtle)]",
      ].join(" ")}
    >
      {/* Icon */}
      <IconTile icon={icon.icon} size="md" tone={icon.tone} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug">{notif.title}</p>
          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
            <span className="text-xs text-[var(--text-secondary)] whitespace-nowrap">{formatNotifTime(notif.createdAt)}</span>
            {!notif.read && <span className="w-2 h-2 rounded-full bg-[var(--s-ok-text)] shrink-0" />}
          </div>
        </div>

        <p className="text-sm text-[var(--text-secondary)] mt-0.5 leading-relaxed"
          dangerouslySetInnerHTML={{
            __html: notif.body.replace(
              /\*\*(.+?)\*\*/g,
              '<strong class="text-[var(--text-primary)] font-semibold">$1</strong>'
            ),
          }}
        />

        {actions && <div className="flex items-center gap-4 mt-2.5">{actions}</div>}
      </div>
    </div>
  );
}

// ─── Group Header ─────────────────────────────────────────────────────────────

function GroupLabel({ label }: { label: string }) {
  return (
    <p className="text-xs font-semibold text-[var(--text-secondary)] tracking-widest uppercase mb-3 mt-6 first:mt-0">
      {label}
    </p>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notif[]>(INITIAL_NOTIFS);

  // Hidden while NOTIFICATIONS_DISABLED — the page stays in the codebase, but a direct visit bounces away.
  useEffect(() => {
    if (NOTIFICATIONS_DISABLED) router.replace("/teacher/courses");
  }, [router]);

  function dismiss(id: string) {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
  }

  function accept(id: string) {
    setNotifs((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true, type: "joining_approved" as NotifType } : n))
    );
  }

  function decline(id: string) {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
  }

  const { today, yesterday, older } = groupNotifs(notifs);
  const isEmpty = notifs.length === 0;

  if (NOTIFICATIONS_DISABLED) return null;

  return (
        <main className="w-full px-8 py-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">{t("การแจ้งเตือน", "Notifications")}</h1>

          {isEmpty ? (
            <div className="flex flex-col items-center justify-center py-24 text-[var(--text-secondary)]">
              <Icon name="bell" size="xl" className="mb-3 opacity-40" />
              <p className="text-sm">{t("ไม่มีการแจ้งเตือน", "No notifications")}</p>
            </div>
          ) : (
            <div className="max-w-2xl space-y-2">
              {today.length > 0 && (
                <>
                  <GroupLabel label={t("วันนี้", "Today")} />
                  {today.map((n) => (
                    <NotifCard key={n.id} notif={n} onDismiss={dismiss} onAccept={accept} onDecline={decline} />
                  ))}
                </>
              )}

              {yesterday.length > 0 && (
                <>
                  <GroupLabel label={t("เมื่อวาน", "Yesterday")} />
                  {yesterday.map((n) => (
                    <NotifCard key={n.id} notif={n} onDismiss={dismiss} onAccept={accept} onDecline={decline} />
                  ))}
                </>
              )}

              {older.length > 0 && (
                <>
                  <GroupLabel label={t("ก่อนหน้า", "Older")} />
                  {older.map((n) => (
                    <NotifCard key={n.id} notif={n} onDismiss={dismiss} onAccept={accept} onDecline={decline} />
                  ))}
                </>
              )}
            </div>
          )}
        </main>
  );
}

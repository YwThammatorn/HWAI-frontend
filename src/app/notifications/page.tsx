"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";
import {
  INITIAL_NOTIFS,
  formatNotifTime,
  groupNotifs,
  type Notif,
  type NotifType,
} from "@/lib/notifications";

// ─── Icons ────────────────────────────────────────────────────────────────────

const ICON_CONFIG: Record<
  NotifType,
  { bg: string; el: React.ReactNode }
> = {
  ai_grading_complete: {
    bg: "bg-[#2DD4BF]/15",
    el: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2.5" strokeLinecap="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  late_submission: {
    bg: "bg-blue-100",
    el: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    ),
  },
  ta_invitation: {
    bg: "bg-purple-100",
    el: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  plagiarism_alert: {
    bg: "bg-orange-100",
    el: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2" strokeLinecap="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  joining_approved: {
    bg: "bg-[#2DD4BF]/15",
    el: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2.5" strokeLinecap="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
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
  const icon = ICON_CONFIG[notif.type];

  const actions: React.ReactNode = (() => {
    switch (notif.type) {
      case "ai_grading_complete":
        return (
          <>
            <button className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#0F766E] text-white text-xs font-medium hover:bg-[#0D6B63] transition-colors">
              View Results
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
            <button
              onClick={() => onDismiss(notif.id)}
              className="text-xs text-gray-500 hover:text-gray-600 transition-colors px-1"
            >
              Dismiss
            </button>
          </>
        );
      case "late_submission":
        return (
          <button className="inline-flex items-center px-4 py-1.5 rounded-lg border border-[var(--accent)] text-[var(--accent)] text-xs font-medium hover:bg-[#0F766E]/5 transition-colors">
            Grade Now
          </button>
        );
      case "ta_invitation":
        return (
          <>
            <button
              onClick={() => onAccept(notif.id)}
              className="text-xs font-semibold text-[var(--accent)] hover:text-[#0D6B63] transition-colors"
            >
              Accept
            </button>
            <button
              onClick={() => onDecline(notif.id)}
              className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors"
            >
              Decline
            </button>
          </>
        );
      case "plagiarism_alert":
        return (
          <button className="inline-flex items-center px-4 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors">
            View Detail
          </button>
        );
      default:
        return null;
    }
  })();

  return (
    <div
      className={[
        "bg-white rounded-2xl border shadow-sm p-4 flex gap-3.5 transition-opacity",
        notif.read ? "border-gray-100 opacity-70" : "border-gray-100",
      ].join(" ")}
    >
      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${icon.bg}`}>
        {icon.el}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug">{notif.title}</p>
          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
            <span className="text-xs text-gray-500 whitespace-nowrap">{formatNotifTime(notif.createdAt)}</span>
            {!notif.read && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />}
          </div>
        </div>

        <p className="text-sm text-gray-500 mt-0.5 leading-relaxed"
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
    <p className="text-xs font-semibold text-gray-500 tracking-widest uppercase mb-3 mt-6 first:mt-0">
      {label}
    </p>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<Notif[]>(INITIAL_NOTIFS);

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

  return (
    <AppShell>
        <main className="w-full max-w-2xl mx-auto px-8 py-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Notifications</h1>

          {isEmpty ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-500">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 opacity-40">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <p className="text-sm">ไม่มีการแจ้งเตือน</p>
            </div>
          ) : (
            <div className="max-w-2xl space-y-2">
              {today.length > 0 && (
                <>
                  <GroupLabel label="Today" />
                  {today.map((n) => (
                    <NotifCard key={n.id} notif={n} onDismiss={dismiss} onAccept={accept} onDecline={decline} />
                  ))}
                </>
              )}

              {yesterday.length > 0 && (
                <>
                  <GroupLabel label="Yesterday" />
                  {yesterday.map((n) => (
                    <NotifCard key={n.id} notif={n} onDismiss={dismiss} onAccept={accept} onDecline={decline} />
                  ))}
                </>
              )}

              {older.length > 0 && (
                <>
                  <GroupLabel label="Older" />
                  {older.map((n) => (
                    <NotifCard key={n.id} notif={n} onDismiss={dismiss} onAccept={accept} onDecline={decline} />
                  ))}
                </>
              )}
            </div>
          )}
        </main>
    </AppShell>
  );
}

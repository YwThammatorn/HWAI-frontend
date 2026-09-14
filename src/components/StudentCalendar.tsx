"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

export interface StudentCalendarItem {
  date: string; // YYYY-MM-DD
  assignmentId: string;
  name: string;
  courseId: string;
  courseName: string;
  isOverdue: boolean;
}

function toKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function StudentCalendar({ items }: { items: StudentCalendarItem[] }) {
  const { t, lang } = useLanguage();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string | null>(toKey(today.getFullYear(), today.getMonth(), today.getDate()));

  const itemsByDate = useMemo(() => {
    const map = new Map<string, StudentCalendarItem[]>();
    items.forEach((item) => {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    });
    return map;
  }, [items]);

  const WEEKDAYS_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
  const WEEKDAYS_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const weekdays = lang === "th" ? WEEKDAYS_TH : WEEKDAYS_EN;

  const MONTHS_TH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthLabel = lang === "th" ? `${MONTHS_TH[viewMonth]} ${viewYear + 543}` : `${MONTHS_EN[viewMonth]} ${viewYear}`;

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay(); // 0 = Sunday

  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function goMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    else if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
    setSelectedDate(null);
  }

  const todayKey = toKey(today.getFullYear(), today.getMonth(), today.getDate());
  const selectedItems = selectedDate ? itemsByDate.get(selectedDate) ?? [] : [];

  return (
    <div className="flex flex-col gap-3">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => goMonth(-1)}
          aria-label={t("เดือนก่อนหน้า", "Previous month")}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <p className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">{monthLabel}</p>
        <button
          onClick={() => goMonth(1)}
          aria-label={t("เดือนถัดไป", "Next month")}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1">
        {weekdays.map((w) => (
          <div key={w} className="text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{w}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const key = toKey(viewYear, viewMonth, day);
          const dayItems = itemsByDate.get(key) ?? [];
          const hasItems = dayItems.length > 0;
          const hasOverdue = dayItems.some((it) => it.isOverdue);
          const isToday = key === todayKey;
          const isSelected = key === selectedDate;
          return (
            <button
              key={key}
              onClick={() => setSelectedDate(isSelected ? null : key)}
              aria-pressed={isSelected}
              aria-label={hasItems ? t(`${day} มีงาน ${dayItems.length} ชิ้น`, `${day}, ${dayItems.length} assignment(s) due`) : String(day)}
              className={[
                "relative h-9 rounded-lg text-xs font-medium tabular-nums transition-colors flex items-center justify-center",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]",
                isSelected
                  ? "bg-[var(--accent-solid)] text-[var(--accent-solid-text)]"
                  : isToday
                    ? "border border-[var(--accent-bright)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                    : "text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]",
              ].join(" ")}
            >
              {day}
              {hasItems && (
                <span
                  aria-hidden="true"
                  className={[
                    "absolute bottom-1 w-1 h-1 rounded-full",
                    isSelected ? "bg-[var(--accent-solid-text)]" : hasOverdue ? "bg-[var(--danger-solid)]" : "bg-[var(--accent-bright)]",
                  ].join(" ")}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day's due assignments */}
      <div className="pt-2 border-t border-[var(--border-subtle)]">
        {selectedItems.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">
            {selectedDate ? t("ไม่มีงานกำหนดส่งวันนี้", "No assignments due this day") : t("เลือกวันที่เพื่อดูงาน", "Select a date to see assignments")}
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {selectedItems.map((item) => (
              <Link
                key={item.assignmentId}
                href={`/student/courses/${item.courseId}/classwork/${item.assignmentId}`}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--bg-subtle)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.isOverdue ? "bg-[var(--danger-solid)]" : "bg-[var(--accent-bright)]"}`} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate">{item.name}</p>
                  <p className="text-[11px] text-[var(--text-muted)] truncate">{item.courseName}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

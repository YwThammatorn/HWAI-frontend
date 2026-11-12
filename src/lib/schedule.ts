/**
 * Shared "Day + Time Slot" picker options for editing a Course's `schedule`
 * field, used by both the admin New/Edit Course popup and the teacher's
 * inline course-detail editor. `schedule` itself stays a free-text string
 * on Course (e.g. "จันทร์ 13:00-16:00") — these options + parseSchedule are
 * just how the UI composes/decomposes that string.
 */
export const DAY_OPTIONS = [
  { value: "จันทร์", labelTh: "จันทร์", labelEn: "Monday" },
  { value: "อังคาร", labelTh: "อังคาร", labelEn: "Tuesday" },
  { value: "พุธ", labelTh: "พุธ", labelEn: "Wednesday" },
  { value: "พฤหัสบดี", labelTh: "พฤหัสบดี", labelEn: "Thursday" },
  { value: "ศุกร์", labelTh: "ศุกร์", labelEn: "Friday" },
  { value: "เสาร์", labelTh: "เสาร์", labelEn: "Saturday" },
  { value: "อาทิตย์", labelTh: "อาทิตย์", labelEn: "Sunday" },
] as const;

export const SLOT_OPTIONS = [
  { value: "9:00-12:00", labelTh: "คาบเช้า (9:00-12:00)", labelEn: "Morning (9:00-12:00)" },
  { value: "13:00-16:00", labelTh: "คาบบ่าย (13:00-16:00)", labelEn: "Afternoon (13:00-16:00)" },
  { value: "16:00-19:00", labelTh: "คาบเย็น (16:00-19:00)", labelEn: "Evening (16:00-19:00)" },
] as const;

export function parseSchedule(schedule?: string): { day: string; slot: string } {
  if (!schedule) return { day: "", slot: "" };
  const day = DAY_OPTIONS.find((d) => schedule.startsWith(d.value))?.value ?? "";
  const slot = SLOT_OPTIONS.find((s) => schedule.includes(s.value))?.value ?? "";
  return { day, slot };
}

/**
 * Split a free-text schedule ("Thursday 13:00-15:00", "จันทร์ 9:00-12:00") into the day and the time, so a card can show them as
 * two fields (the advisor asked for "day / time" in separate boxes, 11/11/2569). Anything that has no clock time stays whole as the day.
 */
export function splitSchedule(schedule?: string): { day: string; time: string } {
  const s = (schedule ?? "").trim();
  const m = s.match(/^(.*?)\s*(\d{1,2}[:.]\d{2}.*)$/);
  return m ? { day: m[1].trim(), time: m[2].trim() } : { day: s, time: "" };
}

/**
 * Weekly Plan, Materials, and Announcements hidden across both teacher and
 * student roles at the user's request (15/9/2569, temporary — plan to bring
 * them back later). Each feature has its own flag so any one of them can be
 * restored independently: flip to false to bring back its nav entry/entries,
 * page(s), and (for Announcements) the student home feed card. Underlying
 * pages, data, and tests are untouched — same "flag it off, don't delete"
 * pattern as TEACHER_COURSE_CREATION_DISABLED / LANGUAGE_TOGGLE_DISABLED.
 */
export const WEEKLY_PLAN_DISABLED = true;
export const MATERIALS_DISABLED = true;
export const ANNOUNCEMENTS_DISABLED = true;

/**
 * Grading Split (teacher, per-course) hidden at the user's request
 * (16/9/2569, "เก็บไว้ก่อน" — temporary). Same "flag it off, don't delete"
 * pattern as the flags above: flip to false to restore the nav entry and page.
 */
export const GRADING_SPLIT_DISABLED = true;

/**
 * Teacher "History" + "Dashboard" nav entries, and Admin "Dashboard" nav
 * entry, hidden at the user's request (17/9/2569). Same "flag it off,
 * don't delete" pattern as the flags above: flip to false to restore the
 * nav entry and page. Both pages still exist and redirect away if visited
 * directly while disabled.
 */
export const TEACHER_HISTORY_DISABLED = true;
export const TEACHER_DASHBOARD_DISABLED = true;
export const ADMIN_DASHBOARD_DISABLED = true;

/**
 * Notifications (the bell in the teacher and admin top bars, and the
 * /teacher/notifications page) hidden at the user's request (21/9/2569,
 * "พับเก็บ feature นี้ไปก่อน" — temporary). Same "flag it off, don't delete"
 * pattern as the flags above: flip to false to bring back the bell and the
 * page. The page redirects away if visited directly while disabled; the
 * notification data/model in lib/notifications.ts is untouched. The student
 * top bar never had a bell.
 */
export const NOTIFICATIONS_DISABLED = true;

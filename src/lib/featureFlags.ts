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

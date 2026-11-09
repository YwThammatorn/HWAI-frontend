// Which teacher pages the TA hat may open (10/11/2569, the user's list): My Courses, and inside a course Overview, Assignments (list + one
// assignment, read-only), Grading (the queue, an assignment's Grading page, the Grade / recheck screen), Score Book (the course's and an
// assignment's) and Students (read-only). Everything else — creating or editing a course or an assignment, Rubrics, Calibration, CLO,
// Collaborators, Settings, Announcements, Materials, Teaching Plan, Grading Split, Notifications — is not a TA's. Pure, so it can be tested.

const COURSE = "/teacher/courses/([^/]+)";
const ALLOWED: RegExp[] = [
  /^\/teacher\/courses$/,
  new RegExp(`^${COURSE}$`),
  new RegExp(`^${COURSE}/assignments$`),
  new RegExp(`^${COURSE}/assignments/[^/]+$`),
  new RegExp(`^${COURSE}/assignments/[^/]+/(grading|recheck|results)$`),
  new RegExp(`^${COURSE}/(grading|results|students)$`),
];
// "new" and "[assignmentId]/edit" would otherwise match the generic id segments above
const BLOCKED: RegExp[] = [
  /^\/teacher\/courses\/new$/,
  new RegExp(`^${COURSE}/assignments/new$`),
  new RegExp(`^${COURSE}/assignments/[^/]+/edit$`),
];

export function taPathAllowed(pathname: string): { allowed: boolean; courseId?: string } {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (BLOCKED.some((re) => re.test(path))) return { allowed: false };
  for (const re of ALLOWED) {
    const m = path.match(re);
    if (m) return { allowed: true, courseId: m[1] };
  }
  return { allowed: false };
}

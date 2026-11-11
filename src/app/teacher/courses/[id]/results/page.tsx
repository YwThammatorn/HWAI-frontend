"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCourses } from "@/lib/courses";
import { useStudents, isWithdrawn } from "@/lib/students";
import { useCohortStudents } from "@/lib/cohort-students";
import { useAssignments, type Assignment } from "@/lib/assignments";
import { useGradingCategories } from "@/lib/gradingCategories";
import { buildScoreBook, scoreBookToCsv, toneForPct, SCORE_TEXT_CLASSES, PENDING_TEXT_CLASSES, MISSING_TEXT_CLASSES, type ScoreCell, type ScoreBookRow } from "@/lib/scoreBook";
import { useLanguage } from "@/context/LanguageContext";
import SearchInput from "@/components/SearchInput";
import FilterSelect from "@/components/FilterSelect";
import SortableTh from "@/components/SortableTh";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import RubricBreakdownModal from "@/components/RubricBreakdownModal";
import WithdrawnTabs, { type WithdrawnTab } from "@/components/WithdrawnTabs";
import PillTabBar from "@/components/PillTabBar";
import ScoreSummaryView from "@/components/ScoreSummaryView";
import { buildScoreSummary } from "@/lib/scoreSummary";

import Icon from "@/components/Icon";
import IconButton from "@/components/IconButton";
type SortKey = "id" | "name" | "total";

// Sticky column geometry (px) — the sticky offsets below depend on these widths.
const ID_W = 120;
const NAME_W = 232;
const TOTAL_W = 132;
const HEAD1_H = 45; // height of the category row (h-10 at the 4.5px spacing unit), where row 2 sticks

const TEAM_GLYPH = (
  <Icon name="users" size="xs" />
);

export default function ScoreBookPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const { getStudentsByCourse } = useStudents();
  const { findByStudentId } = useCohortStudents();
  const { getAssignmentsByCourse, getSubmissionsByAssignment, getRubricsByAssignment } = useAssignments();
  const { getCategoriesByCourse } = useGradingCategories();

  const [search, setSearch] = useState("");
  const [tabState, setTabState] = useState<WithdrawnTab>("active");
  // Matrix = every score, cell by cell; Summary = how the section is doing (4/10/2569).
  const [viewState, setViewState] = useState<"matrix" | "summary">("matrix");
  const [categoryFilter, setCategoryFilter] = useState("all");
  // Which cell's rubric breakdown popup is open (null = closed).
  const [breakdown, setBreakdown] = useState<{ row: ScoreBookRow; assignment: Assignment } | null>(null);
  // Click a header to sort; a third click returns to roster order (the default: by student ID).
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const firstDir = (key: SortKey) => (key === "total" ? "desc" : "asc");
  function cycleSort(key: SortKey) {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: firstDir(key) };
      return s.dir === firstDir(key) ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : null;
    });
  }

  const course = getCourse(id);
  // Withdrawn students sit on their own tab and never count toward the class numbers (24/9/2569) —
  // the book below is built from ONE group at a time, so averages/graded % only ever cover that group.
  const fullRoster = getStudentsByCourse(id);
  const withdrawnRoster = fullRoster.filter(isWithdrawn);
  const activeRoster = fullRoster.filter((s) => !isWithdrawn(s));
  const tab: WithdrawnTab = withdrawnRoster.length === 0 ? "active" : tabState;
  const roster = tab === "active" ? activeRoster : withdrawnRoster;
  // Class-level numbers only make sense for the enrolled group, so the withdrawn tab is always the matrix.
  const view = tab === "active" ? viewState : "matrix";
  const assignments = getAssignmentsByCourse(id);
  const categories = getCategoriesByCourse(id);
  const today = new Date().toISOString().split("T")[0];

  if (!course) {
    return (
      <main className="flex-1 flex items-center justify-center text-[var(--text-secondary)] text-sm">
        {t("ไม่พบรายวิชานี้", "Course not found")} —{" "}
        <Link href="/teacher/courses" className="text-[var(--accent)] ml-1 hover:underline">{t("กลับหน้าหลัก", "Back")}</Link>
      </main>
    );
  }

  // Built once per render and shared by the matrix cells and the rubric-breakdown popup.
  const allSubmissions = assignments.flatMap((a) => getSubmissionsByAssignment(a.id));
  const submissionsById = new Map(allSubmissions.map((s) => [s.id, s]));
  const rubricsByAssignment = new Map(assignments.map((a) => [a.id, getRubricsByAssignment(a.id)[0]]));

  const book = buildScoreBook({
    students: roster.map((s) => ({
      studentId: s.studentId, name: s.name, email: s.email,
      title: findByStudentId(s.studentId)?.title,
    })),
    assignments,
    categories,
    submissions: allSubmissions,
    today,
  });

  const groups = categoryFilter === "all" ? book.groups : book.groups.filter((g) => g.key === categoryFilter);
  const columns = groups.flatMap((g) => g.columns);

  const q = search.trim().toLowerCase();
  const rows = book.rows.filter((r) => !q || [
    r.student.studentId, r.student.title ?? "", r.student.name, r.student.email ?? "",
  ].some((f) => f.toLowerCase().includes(q)));
  if (sort) {
    rows.sort((a, b) => {
      let cmp: number;
      if (sort.key === "total") {
        // ungraded students always sink to the bottom, whichever way the column is sorted
        if (a.total === null || b.total === null) return a.total === b.total ? 0 : a.total === null ? 1 : -1;
        cmp = a.total - b.total;
      } else if (sort.key === "name") {
        cmp = a.student.name.localeCompare(b.student.name, "th");
      } else {
        cmp = a.student.studentId.localeCompare(b.student.studentId, undefined, { numeric: true });
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }

  const summary = view === "summary" ? buildScoreSummary(book) : null;
  const gradedPct = book.totalCells > 0 ? Math.round((book.gradedCells / book.totalCells) * 100) : 0;

  function exportCsv() {
    const csv = scoreBookToCsv(book, {
      id: t("รหัสนักศึกษา", "Student ID"), title: t("คำนำหน้า", "Title"), name: t("ชื่อ-นามสกุล", "Name"),
      total: t("คะแนนรวมเท่าที่ตรวจแล้ว", "Total so far"),
      pending: t("รอตรวจ", "pending"), missing: t("ไม่ส่ง", "missing"),
      categoryPct: (name) => `${name} (%)`,
    });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${course!.code || course!.name}-score-book.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function renderCell(cell: ScoreCell, assignment: Assignment, row: ScoreBookRow) {
    const recheck = (submissionId: string) => `/teacher/courses/${id}/assignments/${assignment.id}/recheck?sub=${submissionId}`;
    // Text only, no box (15/10/2569): the score in its tone colour, "..." while pending, "-" when missing — the words stay for screen readers.
    const chip = "inline-flex items-center gap-1 text-sm font-semibold tabular-nums whitespace-nowrap";
    const link = "hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] rounded-sm";
    const rubric = rubricsByAssignment.get(assignment.id);
    const hasRubric = !!rubric && rubric.criteria.length > 0;
    // Score Book is view-only once the teacher finishes grading an assignment (23/9/2569) — no more
    // click-through to recheck for that column, whichever state a cell is in. Not-yet-finished
    // assignments keep the existing clickable behaviour regardless of how much of them is graded.
    const locked = !!assignment.gradingFinalized;
    switch (cell.kind) {
      case "graded":
        return (
          <div className="inline-flex items-center gap-1">
            {locked ? (
              <span
                title={t("ตรวจเสร็จสิ้นแล้ว — ดูได้อย่างเดียว", "Grading finished — view only")}
                className={`${chip} ${SCORE_TEXT_CLASSES[toneForPct(cell.pct)]}`}
              >
                {assignment.submissionType === "group" && <span aria-label={t("คะแนนทีม", "Team score")}>{TEAM_GLYPH}</span>}
                {Number.isInteger(cell.score) ? cell.score : cell.score.toFixed(1)}
              </span>
            ) : (
              <Link
                href={recheck(cell.submissionId)}
                title={t("เปิดดู/ตรวจใหม่", "Open / recheck")}
                className={`${chip} ${SCORE_TEXT_CLASSES[toneForPct(cell.pct)]} ${link}`}
              >
                {assignment.submissionType === "group" && <span aria-label={t("คะแนนทีม", "Team score")}>{TEAM_GLYPH}</span>}
                {Number.isInteger(cell.score) ? cell.score : cell.score.toFixed(1)}
              </Link>
            )}
            {/* Score comes from the rubric — expand to see what each criterion earned (21/9/2569).
                Still available when locked: viewing the breakdown isn't editing. */}
            {hasRubric && (
              <IconButton icon="chevron-down" dense label={t(
                  `ดูคะแนนรายเกณฑ์ของ ${row.student.name} — ${assignment.name}`,
                  `See the rubric breakdown for ${row.student.name} — ${assignment.name}`,
                )} onClick={() => setBreakdown({ row, assignment })} />
            )}
          </div>
        );
      case "pending": {
        const body = (<><span aria-hidden="true">...</span><span className="sr-only">{t("รอตรวจ", "Pending")}</span></>);
        return locked ? (
          <span title={t("รอตรวจ", "Pending")} className={`${chip} ${PENDING_TEXT_CLASSES}`}>{body}</span>
        ) : (
          <Link href={recheck(cell.submissionId)} title={t("รอตรวจ", "Pending")} className={`${chip} ${PENDING_TEXT_CLASSES} ${link}`}>{body}</Link>
        );
      }
      case "missing":
        return (
          <span title={t("ไม่ส่ง", "Missing")} className={`${chip} ${MISSING_TEXT_CLASSES}`}>
            <span aria-hidden="true">-</span><span className="sr-only">{t("ไม่ส่ง", "Missing")}</span>
          </span>
        );
      default:
        return <span className="text-[var(--text-muted)]" title={t("ยังไม่ส่ง", "Not submitted yet")}>—</span>;
    }
  }

  // The established table pattern (admin Students tab, teacher roster) keeps the header the same
  // white/surface as the body and differentiates it with a border + muted uppercase text, never a
  // tinted fill — bg-subtle is reserved for hover. A tinted header here sat right at the card's top
  // edge, one shade off the page's own pale background, and visually fused with it (flagged by the
  // teacher on a real screen, 21/9/2569 — this is what "still blending" actually meant).
  const stickyHead = "sticky z-30 bg-[var(--bg-surface)]";
  const headBase = "bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-muted)] whitespace-nowrap";
  const headCaps = "uppercase tracking-wider"; // category / summary labels; assignment names keep their own case

  return (
    <main className="w-full px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mb-6">
        <IconButton icon="home" label={t("รายวิชาทั้งหมด", "All courses")} href="/teacher/courses" />
        <span>/</span>
        <Link href={`/teacher/courses/${id}`} className="hover:text-[var(--accent)] transition-colors">{course.name}</Link>
        <span>/</span>
        <span className="text-[var(--accent)] font-medium">{t("สมุดคะแนน", "Score Book")}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t("สมุดคะแนน", "Score Book")}</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {course.name} · {roster.length} {t("นักศึกษา", "students")} · {assignments.length} {t("งาน", "assignments")}
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={roster.length === 0 || assignments.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] active:scale-[.97] disabled:opacity-50 disabled:pointer-events-none transition-colors shrink-0"
        >
          <Icon name="file-download" />
          {t("ส่งออก CSV", "Export CSV")}
        </button>
      </div>

      {assignments.length > 0 && roster.length > 0 && tab === "active" && (
        <div className="mb-4">
          <PillTabBar
            ariaLabel={t("มุมมองสมุดคะแนน", "Score Book view")}
            activeKey={view}
            onChange={(k) => setViewState(k as "matrix" | "summary")}
            tabs={[
              { key: "matrix", label: t("ตารางคะแนน", "Score matrix") },
              { key: "summary", label: t("สรุปผลทั้งห้อง", "Class summary") },
            ]}
          />
        </div>
      )}

      <WithdrawnTabs tab={tab} onChange={setTabState} activeCount={activeRoster.length} withdrawnCount={withdrawnRoster.length} />

      {assignments.length === 0 || roster.length === 0 ? (
        <EmptyState
          icon="bar-chart"
          title={roster.length === 0 ? t("ยังไม่มีนักศึกษาในวิชานี้", "No students in this course yet") : t("ยังไม่มีชิ้นงาน", "No assignments yet")}
          description={roster.length === 0
            ? t("เพิ่มนักศึกษาก่อน คะแนนจะขึ้นที่นี่", "Add students first — their scores will appear here")
            : t("สร้างชิ้นงานก่อน คะแนนจะขึ้นที่นี่", "Create an assignment first — scores will appear here")}
          action={
            <Link
              href={roster.length === 0 ? `/teacher/courses/${id}/students` : `/teacher/courses/${id}/assignments/new`}
              className="inline-flex items-center h-9 px-4 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[.97] transition-colors"
            >
              {roster.length === 0 ? t("ไปที่รายชื่อนักศึกษา", "Go to Students") : t("สร้างชิ้นงาน", "Create Assignment")}
            </Link>
          }
        />
      ) : (
        <>
          {/* Summary — class numbers, so not shown for the withdrawn group, nor on the Class summary view (16/10/2569: the chart there gets the room instead) */}
          {tab === "active" && view !== "summary" && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label={t("นักศึกษา", "Students")} value={roster.length}
              tone="info" icon="users"
            />
            <StatCard
              label={t("ตรวจแล้ว", "Graded")} value={gradedPct} suffix="%"
              tone="ok" icon="check-circle"
            />
            <StatCard
              label={t("เฉลี่ยทั้งห้อง", "Class average")} value={book.classAverage === null ? 0 : Math.round(book.classAverage)} suffix={book.classAverage === null ? "—" : "%"}
              tone="accent" icon="bar-chart"
            />
            <StatCard
              label={t("รอตรวจ", "Awaiting grading")} value={book.pendingCells}
              onClick={() => router.push(`/teacher/courses/${id}/grading`)}
              tone="warn" icon="hourglass"
            />
          </div>}

          {view === "summary" && summary ? (
            <ScoreSummaryView
              courseId={id}
              book={book}
              summary={summary}
              onShowStudent={(studentId) => { setSearch(studentId); setViewState("matrix"); }}
            />
          ) : (<>
          {/* Toolbar + legend */}
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder={t("ค้นหานักศึกษา...", "Search students...")}
                ariaLabel={t("ค้นหานักศึกษา", "Search students")}
                suggestions={roster.flatMap((s) => [s.name, s.studentId])}
                className="w-56 shrink-0"
              />
              {book.groups.length > 1 && (
                <FilterSelect
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  ariaLabel={t("กรองตามหมวดคะแนน", "Filter by category")}
                  icon={<Icon name="align-center" size="xs" />}
                >
                  <option value="all">{t("ทุกหมวด", "All categories")}</option>
                  {book.groups.map((g) => (
                    <option key={g.key} value={g.key}>{g.category ? `${g.category.name} (${g.category.weight}%)` : t("ไม่มีหมวด", "No category")}</option>
                  ))}
                </FilterSelect>
              )}
            </div>
            {/* The legend shows the same text colours the cells use — no boxes (15/10/2569). */}
            <ul className="flex items-center gap-3 text-xs text-[var(--text-secondary)]" aria-label={t("คำอธิบายสี", "Legend")}>
              <li className={`font-semibold tabular-nums ${SCORE_TEXT_CLASSES.ok}`}>≥ 80%</li>
              <li className={`font-semibold tabular-nums ${SCORE_TEXT_CLASSES.info}`}>60–79%</li>
              <li className={`font-semibold tabular-nums ${SCORE_TEXT_CLASSES.err}`}>&lt; 60%</li>
              <li className={`font-semibold ${PENDING_TEXT_CLASSES}`}><span aria-hidden="true">...</span> {t("รอตรวจ", "Pending")}</li>
              <li className={`font-semibold ${MISSING_TEXT_CLASSES}`}><span aria-hidden="true">-</span> {t("ไม่ส่ง", "Missing")}</li>
            </ul>
          </div>

          {/* Matrix */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="overflow-auto max-h-[calc(100vh-380px)] min-h-[320px]">
              <table className="w-max min-w-full text-sm border-separate border-spacing-0">
                <thead>
                  <tr style={{ height: HEAD1_H }}>
                    <th colSpan={2} className={`${stickyHead} top-0 left-0`} aria-hidden="true" />
                    {groups.map((g) => (
                      <th
                        key={g.key}
                        colSpan={g.columns.length}
                        scope="colgroup"
                        className={`sticky top-0 z-20 px-4 text-left ${headBase} ${headCaps} !text-[var(--accent)]`}
                      >
                        {g.category ? `${g.category.name} · ${g.category.weight}%` : t("ไม่มีหมวด", "No category")}
                      </th>
                    ))}
                    <th scope="colgroup" className={`${stickyHead} top-0 right-0 px-4 text-left ${headBase} ${headCaps}`}>
                      {t("สรุป", "Summary")}
                    </th>
                  </tr>
                  <tr>
                    <SortableTh
                      label={t("รหัส", "Student ID")}
                      dir={sort?.key === "id" ? sort.dir : undefined}
                      onClick={() => cycleSort("id")}
                      hint={t("คลิกเพื่อเรียงตามรหัส (น้อย→มาก → มาก→น้อย → ลำดับเดิม)", "Click to sort by student ID (ascending → descending → roster order)")}
                      className={`${stickyHead} left-0 border-b border-[var(--border-subtle)]`}
                      style={{ top: HEAD1_H, width: ID_W, minWidth: ID_W }}
                    />
                    <SortableTh
                      label={t("ชื่อ-นามสกุล", "Name")}
                      dir={sort?.key === "name" ? sort.dir : undefined}
                      onClick={() => cycleSort("name")}
                      hint={t("คลิกเพื่อเรียงตามชื่อ (ก–ฮ → ฮ–ก → ลำดับเดิม)", "Click to sort by name (A–Z → Z–A → roster order)")}
                      className={`${stickyHead} border-b border-[var(--border-subtle)]`}
                      style={{ top: HEAD1_H, left: ID_W, width: NAME_W, minWidth: NAME_W }}
                    />
                    {columns.map((a) => (
                      <th
                        key={a.id}
                        scope="col"
                        className={`sticky z-20 px-3 py-1 text-left border-b border-l border-[var(--border-subtle)] ${headBase}`}
                        style={{ top: HEAD1_H, minWidth: 96 }}
                      >
                        <Link
                          href={`/teacher/courses/${id}/assignments/${a.id}/grading`}
                          title={a.name}
                          className="block truncate max-w-[8rem] text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline"
                        >
                          {a.name}
                        </Link>
                        <span className="block font-normal text-[var(--text-muted)] tabular-nums">
                          {a.maxPoints} {t("คะแนน", "pts")}{a.submissionType === "group" ? ` · ${t("กลุ่ม", "group")}` : ""}
                        </span>
                      </th>
                    ))}
                    <SortableTh
                      label={t("รวม", "Total")}
                      dir={sort?.key === "total" ? sort.dir : undefined}
                      onClick={() => cycleSort("total")}
                      hint={t("คลิกเพื่อเรียงตามคะแนนรวม (มาก→น้อย → น้อย→มาก → ลำดับเดิม)", "Click to sort by total (high → low → low → high → roster order)")}
                      className={`${stickyHead} border-b border-l border-[var(--border-subtle)]`}
                      style={{ top: HEAD1_H, right: 0, width: TOTAL_W, minWidth: TOTAL_W }}
                    />
                  </tr>
                </thead>
                {/* the last row has no bottom line: the footer's top line (or the card's own border) closes it — before, the two stacked into a double line */}
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={columns.length + 4} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                        {t("ไม่พบผลการค้นหา", "No results found")}
                      </td>
                    </tr>
                  )}
                  {rows.map((r) => (
                    <tr key={r.student.studentId} className="group">
                      <td
                        className="sticky left-0 z-10 px-4 py-1 tabular-nums text-[var(--text-secondary)] bg-[var(--bg-surface)] group-hover:bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)]"
                        style={{ width: ID_W, minWidth: ID_W }}
                      >
                        {r.student.studentId}
                      </td>
                      <td
                        className="sticky z-10 px-4 py-1 bg-[var(--bg-surface)] group-hover:bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)]"
                        style={{ left: ID_W, width: NAME_W, minWidth: NAME_W }}
                      >
                        <span className="block truncate font-medium text-[var(--text-primary)]" style={{ maxWidth: NAME_W - 32 }}>
                          {r.student.title && <span className="font-normal text-[var(--text-secondary)]">{r.student.title} </span>}
                          {r.student.name}
                        </span>
                      </td>
                      {columns.map((a) => (
                        <td key={a.id} className="px-3 py-1 border-b border-l border-[var(--border-subtle)] group-hover:bg-[var(--bg-subtle)]">
                          {renderCell(r.cells[a.id], a, r)}
                        </td>
                      ))}
                      <td
                        className="sticky z-10 px-4 py-1 tabular-nums bg-[var(--bg-surface)] group-hover:bg-[var(--bg-subtle)] border-b border-l border-[var(--border-subtle)]"
                        style={{ right: 0, width: TOTAL_W, minWidth: TOTAL_W }}
                      >
                        {r.total === null ? (
                          <span className="text-[var(--text-muted)]">—</span>
                        ) : (
                          <span title={t(`คิดจากหมวดที่มีงานตรวจแล้ว (น้ำหนักรวม ${r.gradedWeight}%)`, `Counts only categories with graded work (${r.gradedWeight}% of the total so far)`)}>
                            <span className="font-semibold text-[var(--text-primary)]">{r.total.toFixed(1)}</span>
                            <span className="text-[var(--text-muted)]"> / {r.gradedWeight}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* class averages only make sense for the enrolled group */}
                {tab === "active" && <tfoot>
                  <tr>
                    <td colSpan={2} className="sticky left-0 bottom-0 z-20 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--bg-surface)] border-t border-r border-[var(--border-subtle)]">
                      {t("เฉลี่ยทั้งห้อง", "Class average")}
                    </td>
                    {columns.map((a) => {
                      const avg = book.columnAverages[a.id];
                      return (
                        <td key={a.id} className="sticky bottom-0 z-10 px-3 py-1.5 tabular-nums text-[var(--text-secondary)] bg-[var(--bg-surface)] border-t border-l border-[var(--border-subtle)]">
                          {avg === null ? "—" : `${Math.round(avg)}%`}
                        </td>
                      );
                    })}
                    <td className="sticky right-0 bottom-0 z-20 px-4 py-1.5 tabular-nums text-[var(--text-secondary)] bg-[var(--bg-surface)] border-t border-l border-[var(--border-subtle)]">
                      {book.classAverage === null ? "—" : `${book.classAverage.toFixed(1)}%`}
                    </td>
                  </tr>
                </tfoot>}
              </table>
            </div>
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]" aria-live="polite">
            {q
              ? t(`พบ ${rows.length} จาก ${roster.length} คน`, `${rows.length} of ${roster.length} students`)
              : t("“รวม” นับเฉพาะหมวดที่มีงานตรวจแล้ว — ค่าเดียวกับที่นักศึกษาเห็นในหน้าผลการประเมิน", "“Total” counts only categories with graded work — the same number students see on their Evaluation page")}
          </p>
          </>)}
        </>
      )}

      {/* Rubric breakdown for one graded cell — what each criterion earned, not just the total. */}
      {breakdown && (() => {
        const cell = breakdown.row.cells[breakdown.assignment.id];
        const rubric = rubricsByAssignment.get(breakdown.assignment.id);
        if (cell.kind !== "graded" || !rubric) return null;
        const submission = submissionsById.get(cell.submissionId);
        const stored = submission?.criterionScores;
        const student = breakdown.row.student;
        const studentLine = `${student.title ? `${student.title} ` : ""}${student.name}`;
        return (
          <RubricBreakdownModal
            open
            onClose={() => setBreakdown(null)}
            assignmentName={breakdown.assignment.name}
            subtitle={t(`${studentLine} · รหัส ${student.studentId}`, `${studentLine} · ID ${student.studentId}`)}
            rubric={rubric}
            cell={cell}
            storedCriterionScores={stored}
          />
        );
      })()}
    </main>
  );
}

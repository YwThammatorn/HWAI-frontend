/** Table column header that sorts on click. `dir` undefined = not the active sort column.
 *  Shared by the admin Students tab and the teacher course roster so both read the same. */
export default function SortableTh({ label, dir, onClick, hint, className = "", style }: {
  label: string;
  dir?: "asc" | "desc";
  onClick: () => void;
  hint: string;
  /** Extra classes for the <th> (e.g. sticky positioning in a wide matrix). */
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <th
      scope="col"
      aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
      className={`px-4 py-1 text-left text-xs font-semibold uppercase tracking-wider ${className}`}
      style={style}
    >
      <button
        type="button"
        onClick={onClick}
        title={hint}
        className={`group -mx-1.5 px-1.5 py-0.5 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md uppercase tracking-wider transition-colors hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] ${
          dir ? "text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        }`}
      >
        {label}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          className={dir ? "text-[var(--accent)]" : "text-[var(--text-secondary)] opacity-60 group-hover:opacity-100"}>
          {dir === "asc" && <><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></>}
          {dir === "desc" && <><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></>}
          {!dir && <><polyline points="8 9 12 5 16 9" /><polyline points="8 15 12 19 16 15" /></>}
        </svg>
      </button>
    </th>
  );
}

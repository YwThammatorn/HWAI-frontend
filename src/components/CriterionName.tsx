import { splitCriterionName } from "@/lib/rubricName";

/**
 * A rubric criterion's name, laid out the way the rubric file's headings are: the code (C1) as a small badge, the main name
 * in bold and the other language under it in a quieter tone — instead of one long "C1 · English / ไทย" line that wraps
 * anywhere. A name a teacher typed freely (no code, no second language) just shows as plain text.
 */
export default function CriterionName({ name, className = "" }: { name: string; className?: string }) {
  const { code, main, second } = splitCriterionName(name);
  return (
    <div className={`flex min-w-0 items-start gap-2.5 ${className}`}>
      {code && (
        <span className="mt-0.5 inline-flex h-6 min-w-8 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-app)] px-1.5 text-xs font-bold tabular-nums text-[var(--text-secondary)]">{code}</span>
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-snug text-[var(--text-primary)]">{main}</p>
        {second && <p className="mt-0.5 text-xs leading-snug text-[var(--text-secondary)]">{second}</p>}
      </div>
    </div>
  );
}

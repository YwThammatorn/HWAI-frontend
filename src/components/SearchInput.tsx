"use client";

import { useState } from "react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  rounded?: "xl" | "full";
  /** Candidate values to suggest from as the user types (e.g. names/ids).
   *  Omit to keep this a plain search box with no dropdown. */
  suggestions?: string[];
}

export default function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className = "",
  ariaLabel,
  rounded = "xl",
  suggestions,
}: SearchInputProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const query = value.trim().toLowerCase();
  const matches = suggestions && query
    ? suggestions.filter((s) => s.toLowerCase().includes(query) && s.toLowerCase() !== query).slice(0, 6)
    : [];
  const showDropdown = open && matches.length > 0;

  function select(s: string) {
    onChange(s);
    setOpen(false);
  }

  return (
    <div className={`relative ${className}`}>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="search"
        role={suggestions ? "combobox" : undefined}
        aria-expanded={suggestions ? showDropdown : undefined}
        aria-autocomplete={suggestions ? "list" : undefined}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!showDropdown) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, matches.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); select(matches[highlight]); }
          else if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className={`w-full h-9 pl-8 pr-3 border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)] ${rounded === "full" ? "rounded-full" : "rounded-xl"}`}
      />
      {showDropdown && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 mt-1 z-20 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-lg overflow-hidden max-h-56 overflow-y-auto"
        >
          {matches.map((s, i) => (
            <li key={s} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                // onMouseDown (not onClick) so this fires before the input's onBlur closes the dropdown
                onMouseDown={(e) => { e.preventDefault(); select(s); }}
                className={`w-full text-left px-3 py-2 text-sm truncate transition-colors ${
                  i === highlight ? "bg-[var(--accent-bright)]/10 text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                }`}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

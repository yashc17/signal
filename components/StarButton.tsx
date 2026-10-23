"use client";
import { useWatchlist } from "@/lib/watchlist";

export function StarButton({ slug, withLabel = false }: { slug: string; withLabel?: boolean }) {
  const { list, toggle } = useWatchlist();
  const on = !!list[slug];
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(slug);
      }}
      aria-pressed={on}
      aria-label={on ? "Remove from watchlist" : "Add to watchlist"}
      title={on ? "On your watchlist" : "Add to watchlist"}
      className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm hover:bg-surface-2 ${on ? "text-[var(--s4)]" : "text-muted"}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9 6.75 19.6l1-5.8L3.5 9.7l5.9-.9z" strokeLinejoin="round" />
      </svg>
      {withLabel && <span className="text-ink-2">{on ? "Watching" : "Watch"}</span>}
    </button>
  );
}

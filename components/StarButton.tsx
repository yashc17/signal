"use client";
import { Star } from "lucide-react";
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
      className={`focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg px-1.5 text-[13px] font-medium transition-colors hover:bg-surface-2 ${on ? "text-[var(--star)]" : "text-muted hover:text-ink"}`}
    >
      <Star size={16} strokeWidth={1.9} fill={on ? "currentColor" : "none"} className={on ? "animate-scale-in" : ""} />
      {withLabel && <span className={on ? "text-ink" : ""}>{on ? "Watching" : "Watch"}</span>}
    </button>
  );
}

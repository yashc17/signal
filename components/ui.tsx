import Link from "next/link";
import { Boxes, FlaskConical } from "lucide-react";
import { SECTOR_META, STAGE_LABEL, TRACK_META } from "@/lib/meta";
import type { Sector, Stage, Track } from "@/lib/schema";

export const sectorColor = (s: Sector) => `var(--s${SECTOR_META[s].slot})`;

/** Page width + gutters. The graph page opts out to go full-bleed. */
export function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

export function PageHeader({ eyebrow, title, sub, right }: { eyebrow?: string; title: string; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 pb-8 pt-10 sm:pt-14">
      <div className="max-w-2xl animate-fade-up">
        {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
        <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[40px]">{title}</h1>
        {sub && <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/** App-icon style avatar: sector-tinted tile with initials. Deterministic, crisp, offline. */
export function Monogram({ name, sector, size = 36 }: { name: string; sector: Sector; size?: number }) {
  const clean = name.replace(/\(.*\)/, "").trim();
  const words = clean.split(/[\s-]+/).filter(Boolean);
  const initials = (words.length > 1 && words[1][0] && /[A-Za-z0-9]/.test(words[1][0]) ? words[0][0] + words[1][0] : clean.slice(0, 2)).toUpperCase();
  const c = sectorColor(sector);
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 select-none items-center justify-center font-semibold tracking-[-0.02em]"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        fontSize: size * 0.36,
        color: `color-mix(in srgb, ${c} 55%, var(--ink))`,
        background: `linear-gradient(145deg, color-mix(in srgb, ${c} 20%, var(--surface)), color-mix(in srgb, ${c} 7%, var(--surface)))`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c} 22%, transparent)`,
      }}
    >
      {initials}
    </span>
  );
}

export function TrackBadge({ track }: { track: Track }) {
  const Icon = track === "research" ? FlaskConical : Boxes;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11.5px] font-medium text-ink-2">
      <Icon size={11} strokeWidth={2.2} />
      {TRACK_META[track].label}
    </span>
  );
}

export function SectorChip({ sector, href = true }: { sector: Sector; href?: boolean }) {
  const inner = (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-[11.5px] font-medium text-ink-2 transition-colors hover:text-ink">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: sectorColor(sector) }} />
      {SECTOR_META[sector].label}
    </span>
  );
  return href ? <Link href={`/companies/?sector=${sector}`}>{inner}</Link> : inner;
}

export function StageChip({ stage }: { stage: Stage }) {
  return <span className="rounded-full border border-line px-2 py-0.5 text-[11.5px] font-medium text-ink-2">{STAGE_LABEL[stage]}</span>;
}

/** Signal score as a ring: one value, so ink on a hairline track. */
export function ScoreRing({ score, size = 34, stroke = 3 }: { score: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} title={`Signal score ${score}/100`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ink)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * c} ${c}`}
        />
      </svg>
      <span className="tabular absolute font-semibold" style={{ fontSize: size * 0.32 }}>
        {score}
      </span>
    </span>
  );
}

/** Compact inline meter for dense rows. */
export function ScoreMeter({ score, width = 56 }: { score: number; width?: number }) {
  return (
    <span className="inline-flex items-center gap-2" title={`Signal score ${score}/100`}>
      <span className="relative inline-block h-1 overflow-hidden rounded-full bg-surface-3" style={{ width }}>
        <span className="absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: `${score}%` }} />
      </span>
      <span className="tabular w-6 text-right text-xs font-medium text-ink-2">{score}</span>
    </span>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-1">
      <div className="eyebrow">{label}</div>
      <div className="tabular mt-1.5 text-[28px] font-semibold leading-none tracking-[-0.03em]">{value}</div>
      {sub && <div className="mt-1.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function SectionTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  full = false,
}: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
  full?: boolean;
}) {
  return (
    <div role="tablist" className={`${full ? "flex" : "inline-flex"} shrink-0 rounded-[10px] bg-surface-2 p-[3px]`}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`focus-ring inline-flex items-center justify-center gap-1.5 ${full ? "flex-1" : ""} rounded-[8px] font-medium transition-all ${size === "sm" ? "h-[26px] px-2.5 text-xs" : "h-[28px] px-3 text-[13px]"} ${
            value === o.value ? "bg-surface text-ink shadow-[var(--shadow-sm)] ring-1 ring-[var(--border)]" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

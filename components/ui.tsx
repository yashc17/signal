import Link from "next/link";
import { SECTOR_META, STAGE_LABEL, TRACK_META } from "@/lib/meta";
import type { Sector, Stage, Track } from "@/lib/schema";

export function TrackBadge({ track }: { track: Track }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs text-ink-2">
      <span className="h-2 w-2 rounded-full" style={{ background: `var(--s${TRACK_META[track].slot})` }} />
      {TRACK_META[track].label}
    </span>
  );
}

export function SectorChip({ sector, href = true }: { sector: Sector; href?: boolean }) {
  const inner = (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-2">
      <span className="h-1.5 w-1.5 rounded-sm" style={{ background: `var(--s${SECTOR_META[sector].slot})` }} />
      {SECTOR_META[sector].label}
    </span>
  );
  return href ? <Link href={`/companies/?sector=${sector}`}>{inner}</Link> : inner;
}

export function StageChip({ stage }: { stage: Stage }) {
  return <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-2">{STAGE_LABEL[stage]}</span>;
}

/** Signal score as a meter: fill carries the value, the track is a lighter step of the same hue. */
export function ScoreMeter({ score, width = 64 }: { score: number; width?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative inline-block h-1.5 overflow-hidden rounded-full" style={{ width, background: "var(--accent-wash)" }}>
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${score}%`, background: "var(--accent)" }} />
      </span>
      <span className="tabular w-6 text-right text-xs text-ink-2">{score}</span>
    </span>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-2">{sub}</div>}
    </div>
  );
}

export function SectionTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-ink-2">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

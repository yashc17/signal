"use client";
// Dot plot: every disclosed round, x = date, y = amount (log). Color = track (2 series → legend + selective labels).
import { scaleLog, scaleTime } from "d3-scale";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatMonth, formatUsd, ROUND_LABEL, TRACK_META } from "@/lib/meta";
import { useWidth } from "./useSize";

export type RoundPoint = {
  slug: string;
  name: string;
  track: "research" | "applied";
  date: string;
  amount: number;
  type: string;
  lead: string[];
};

const H = 340;
const M = { top: 16, right: 24, bottom: 28, left: 52 };

const toDate = (s: string) => new Date(`${s.length === 7 ? `${s}-15` : s}T00:00:00`);

export function RoundsTimeline({ points, since = "2023-01" }: { points: RoundPoint[]; since?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [focusTrack, setFocusTrack] = useState<null | "research" | "applied">(null);

  const data = useMemo(() => points.filter((p) => p.date >= since && p.amount >= 1e6), [points, since]);
  const x = useMemo(
    () => scaleTime().domain([toDate(since), new Date()]).range([M.left, width - M.right]),
    [width, since],
  );
  const y = useMemo(() => scaleLog().domain([5e6, 1.5e11]).range([H - M.bottom, M.top]).clamp(true), []);
  const px = data.map((p) => ({ ...p, cx: x(toDate(p.date)), cy: y(p.amount) }));

  // Label the few largest rounds only (selective direct labels): one per company, skipping any that would collide.
  const labeled = new Set<string>();
  const placed: { x: number; y: number }[] = [];
  const seen = new Set<string>();
  for (const p of [...px].sort((a, b) => b.amount - a.amount)) {
    if (labeled.size >= 6) break;
    if (seen.has(p.slug)) continue;
    seen.add(p.slug);
    if (placed.some((q) => Math.abs(q.y - p.cy) < 16 && Math.abs(q.x - p.cx) < 150)) continue;
    placed.push({ x: p.cx, y: p.cy });
    labeled.add(`${p.slug}:${p.date}`);
  }
  const yTicks = [1e7, 1e8, 1e9, 1e10, 1e11];
  const xTicks = x.ticks(width < 600 ? 4 : 8);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    let best = -1;
    let bestD = 24 * 24; // 24px nearest-point hit radius
    px.forEach((p, i) => {
      if (focusTrack && p.track !== focusTrack) return;
      const d = (p.cx - mx) ** 2 + (p.cy - my) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best >= 0 ? best : null);
  }

  const h = hover != null ? px[hover] : null;

  return (
    <div ref={ref} className="relative">
      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-ink-2" role="group" aria-label="Legend">
        {(["research", "applied"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFocusTrack(focusTrack === t ? null : t)}
            className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-surface-2 ${focusTrack && focusTrack !== t ? "opacity-40" : ""}`}
            aria-pressed={focusTrack === t}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(--s${TRACK_META[t].slot})` }} />
            {t === "research" ? "Research labs" : "Applied startups"}
          </button>
        ))}
        <span className="text-muted">· log scale · {data.length} rounds</span>
      </div>
      <svg
        width={width}
        height={H}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label="Funding rounds over time by amount"
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)" className="tabular">
              {formatUsd(t)}
            </text>
          </g>
        ))}
        <line x1={M.left} x2={width - M.right} y1={H - M.bottom} y2={H - M.bottom} stroke="var(--axis)" />
        {xTicks.map((t) => (
          <text key={+t} x={x(t)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--muted)" className="tabular">
            {t.getMonth() === 0 ? t.getFullYear() : t.toLocaleString("en", { month: "short" })}
          </text>
        ))}
        {px.map((p, i) => {
          const dim = focusTrack && p.track !== focusTrack;
          return (
            <circle
              key={`${p.slug}:${p.date}:${i}`}
              cx={p.cx}
              cy={p.cy}
              r={hover === i ? 6 : 4.5}
              fill={`var(--s${TRACK_META[p.track].slot})`}
              stroke="var(--surface)"
              strokeWidth={2}
              opacity={dim ? 0.12 : 0.9}
            />
          );
        })}
        {px
          .filter((p) => labeled.has(`${p.slug}:${p.date}`) && (!focusTrack || p.track === focusTrack))
          .map((p) => (
            <text
              key={`l:${p.slug}:${p.date}`}
              x={p.cx > width - 140 ? p.cx - 9 : p.cx + 9}
              y={p.cy}
              dy="0.32em"
              textAnchor={p.cx > width - 140 ? "end" : "start"}
              fontSize={11}
              fill="var(--ink-2)"
              paintOrder="stroke"
              stroke="var(--surface)"
              strokeWidth={3}
            >
              {p.name.replace(/ \(.*\)$/, "")}
            </text>
          ))}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute z-10 min-w-44 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(h.cx + 12, width - 200), top: Math.max(0, h.cy + 20) }}
        >
          <div className="text-sm font-semibold">{formatUsd(h.amount)}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-ink-2">
            <span className="inline-block h-0.5 w-3" style={{ background: `var(--s${TRACK_META[h.track].slot})` }} />
            {h.name}
          </div>
          <div className="mt-0.5 text-muted">
            {ROUND_LABEL[h.type] ?? h.type} · {formatMonth(h.date)}
          </div>
        </div>
      )}
      <details className="mt-2 text-xs text-ink-2">
        <summary className="cursor-pointer text-muted">Table view</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full text-left">
            <tbody>
              {[...data].sort((a, b) => b.date.localeCompare(a.date)).map((p, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="py-1 pr-3 tabular">{formatMonth(p.date)}</td>
                  <td className="py-1 pr-3">
                    <Link className="link" href={`/companies/${p.slug}/`}>{p.name}</Link>
                  </td>
                  <td className="py-1 pr-3">{ROUND_LABEL[p.type] ?? p.type}</td>
                  <td className="py-1 tabular text-right">{formatUsd(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

"use client";
// Dot plot: every disclosed round, x = date, y = amount (log). Color = sector (site-wide identity);
// the legend isolates a sector, the segmented control filters labs vs applied.
import { scaleLog, scaleTime } from "d3-scale";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatMonth, formatUsd, ROUND_LABEL, SECTOR_META } from "@/lib/meta";
import type { Sector } from "@/lib/schema";
import { Segmented, sectorColor } from "../ui";
import { useWidth } from "./useSize";

export type RoundPoint = {
  slug: string;
  name: string;
  track: "research" | "applied";
  sector: Sector;
  date: string;
  amount: number;
  type: string;
  lead: string[];
};

const H = 360;
const M = { top: 16, right: 24, bottom: 28, left: 52 };

const toDate = (s: string) => new Date(`${s.length === 7 ? `${s}-15` : s}T00:00:00`);

/** `until` comes from the build so server and client agree on the x-domain (no hydration drift). */
export function RoundsTimeline({ points, since = "2023-01", until }: { points: RoundPoint[]; since?: string; until: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [focusSector, setFocusSector] = useState<Sector | null>(null);
  const [track, setTrack] = useState<"all" | "research" | "applied">("all");

  const data = useMemo(
    () => points.filter((p) => p.date >= since && p.amount >= 1e6 && (track === "all" || p.track === track)),
    [points, since, track],
  );
  const x = useMemo(() => scaleTime().domain([toDate(since), new Date(until)]).range([M.left, width - M.right]), [width, since, until]);
  const y = useMemo(() => scaleLog().domain([5e6, 1.5e11]).range([H - M.bottom, M.top]).clamp(true), []);
  const px = data.map((p) => ({ ...p, cx: x(toDate(p.date)), cy: y(p.amount) }));
  const sectors = (Object.keys(SECTOR_META) as Sector[]).filter((s) => points.some((p) => p.sector === s));

  // Label the few largest rounds only (selective direct labels): one per company, skipping any that would collide.
  const labeled = new Set<string>();
  const placed: { x: number; y: number }[] = [];
  const seen = new Set<string>();
  for (const p of [...px].filter((p) => !focusSector || p.sector === focusSector).sort((a, b) => b.amount - a.amount)) {
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
      if (focusSector && p.sector !== focusSector) return;
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Legend: click a sector to isolate it">
          {sectors.map((s) => (
            <button
              key={s}
              onClick={() => setFocusSector(focusSector === s ? null : s)}
              aria-pressed={focusSector === s}
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11.5px] font-medium transition-all hover:bg-surface-2 ${
                focusSector && focusSector !== s ? "text-faint" : "text-ink-2"
              } ${focusSector === s ? "bg-surface-2 text-ink" : ""}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: sectorColor(s), opacity: focusSector && focusSector !== s ? 0.35 : 1 }} />
              {SECTOR_META[s].label.replace(/ & .*/, "")}
            </button>
          ))}
        </div>
        <Segmented
          size="sm"
          value={track}
          onChange={setTrack}
          options={[
            { value: "all", label: "All" },
            { value: "research", label: "Labs" },
            { value: "applied", label: "Applied" },
          ]}
        />
      </div>
      <svg width={width} height={H} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="Funding rounds over time by amount">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={M.left - 10} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)" className="tabular">
              {formatUsd(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={+t} x={x(t)} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--muted)" className="tabular">
            {t.getMonth() === 0 ? t.getFullYear() : t.toLocaleString("en", { month: "short" })}
          </text>
        ))}
        {h && <line x1={h.cx} x2={h.cx} y1={M.top} y2={H - M.bottom} stroke="var(--axis)" strokeDasharray="2 3" />}
        {px.map((p, i) => {
          const dim = focusSector && p.sector !== focusSector;
          return (
            <circle
              key={`${p.slug}:${p.date}:${i}`}
              cx={p.cx}
              cy={p.cy}
              r={hover === i ? 6.5 : 5}
              fill={sectorColor(p.sector)}
              stroke="var(--surface)"
              strokeWidth={2}
              opacity={dim ? 0.1 : 0.92}
              style={{ transition: "opacity 200ms, r 120ms" }}
            />
          );
        })}
        {px
          .filter((p) => labeled.has(`${p.slug}:${p.date}`))
          .map((p) => (
            <text
              key={`l:${p.slug}:${p.date}`}
              x={p.cx > width - 140 ? p.cx - 10 : p.cx + 10}
              y={p.cy}
              dy="0.32em"
              textAnchor={p.cx > width - 140 ? "end" : "start"}
              fontSize={11.5}
              fontWeight={500}
              fill="var(--ink-2)"
              paintOrder="stroke"
              stroke="var(--surface)"
              strokeWidth={4}
              strokeLinejoin="round"
            >
              {p.name.replace(/ \(.*\)$/, "")}
            </text>
          ))}
      </svg>
      {h && (
        <div
          className="glass animate-scale-in pointer-events-none absolute z-10 min-w-48 rounded-xl px-3 py-2.5 text-xs"
          style={{ left: Math.min(h.cx + 14, width - 210), top: Math.max(44, h.cy + 24) }}
        >
          <div className="tabular text-[15px] font-semibold tracking-[-0.01em]">{formatUsd(h.amount)}</div>
          <div className="mt-1 flex items-center gap-1.5 font-medium text-ink">
            <span className="h-2 w-2 rounded-full" style={{ background: sectorColor(h.sector) }} />
            {h.name}
          </div>
          <div className="mt-0.5 text-muted">
            {ROUND_LABEL[h.type] ?? h.type} · {formatMonth(h.date)}
            {h.lead.length ? ` · ${h.lead.slice(0, 2).join(", ")}` : ""}
          </div>
        </div>
      )}
      <details className="mt-3 text-xs text-ink-2">
        <summary className="cursor-pointer text-muted hover:text-ink">Table view</summary>
        <div className="scroll-quiet mt-2 max-h-64 overflow-auto">
          <table className="w-full text-left">
            <tbody>
              {[...data]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((p, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="tabular py-1.5 pr-3">{formatMonth(p.date)}</td>
                    <td className="py-1.5 pr-3">
                      <Link className="link" href={`/companies/${p.slug}/`}>
                        {p.name}
                      </Link>
                    </td>
                    <td className="py-1.5 pr-3">{ROUND_LABEL[p.type] ?? p.type}</td>
                    <td className="tabular py-1.5 text-right">{formatUsd(p.amount)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

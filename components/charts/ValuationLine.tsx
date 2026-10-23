"use client";
// Single series: post-money valuation at each priced round. Log y, 2px line, ringed markers, value at the end.
import { scaleLog, scaleTime } from "d3-scale";
import { useState } from "react";
import { formatMonth, formatUsd } from "@/lib/meta";
import { useWidth } from "./useSize";

const H = 180;
const M = { top: 14, right: 64, bottom: 24, left: 48 };
const toDate = (s: string) => new Date(`${s.length === 7 ? `${s}-15` : s}T00:00:00`);

export function ValuationLine({ points }: { points: { date: string; value: number; label: string }[] }) {
  const [ref, width] = useWidth<HTMLDivElement>(520);
  const [hover, setHover] = useState<number | null>(null);
  const dates = points.map((p) => toDate(p.date));
  const lo = Math.min(...points.map((p) => p.value));
  const hi = Math.max(...points.map((p) => p.value));
  const x = scaleTime().domain([dates[0], dates.at(-1)!]).range([M.left, width - M.right]);
  const y = scaleLog().domain([lo / 1.6, hi * 1.6]).range([H - M.bottom, M.top]);
  const xy = points.map((p, i) => ({ ...p, cx: x(dates[i]), cy: y(p.value) }));
  const ticks = y.ticks(4).filter((t) => [1, 3].includes(Number(String(t)[0])));
  const last = xy.at(-1)!;

  return (
    <div ref={ref} className="relative">
      <svg width={width} height={H} role="img" aria-label="Valuation over time" onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const mx = e.clientX - e.currentTarget.getBoundingClientRect().left;
          let best = 0;
          xy.forEach((p, i) => { if (Math.abs(p.cx - mx) < Math.abs(xy[best].cx - mx)) best = i; });
          setHover(best);
        }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
            <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)">{formatUsd(t)}</text>
          </g>
        ))}
        <line x1={M.left} x2={width - M.right} y1={H - M.bottom} y2={H - M.bottom} stroke="var(--axis)" />
        {x.ticks(4).map((t) => (
          <text key={+t} x={x(t)} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">{t.getFullYear()}</text>
        ))}
        {hover != null && <line x1={xy[hover].cx} x2={xy[hover].cx} y1={M.top} y2={H - M.bottom} stroke="var(--axis)" />}
        <path d={xy.map((p, i) => `${i ? "L" : "M"}${p.cx},${p.cy}`).join(" ")} fill="none" stroke="var(--s1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {xy.map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.cy} r={hover === i ? 6 : 4.5} fill="var(--s1)" stroke="var(--surface)" strokeWidth={2} />
        ))}
        <text x={last.cx + 10} y={last.cy} dy="0.32em" fontSize={12} fill="var(--ink)" fontWeight={600}>{formatUsd(last.value)}</text>
      </svg>
      {hover != null && (
        <div className="pointer-events-none absolute z-10 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(xy[hover].cx + 10, width - 160), top: Math.max(0, xy[hover].cy - 50) }}>
          <div className="text-sm font-semibold">{formatUsd(xy[hover].value)}</div>
          <div className="text-ink-2">{xy[hover].label} · {formatMonth(xy[hover].date)}</div>
        </div>
      )}
    </div>
  );
}

"use client";
// Horizontal bars: neutral ink by default (or a per-bar identity color), value at the tip, per-bar hover with the detail list.
import Link from "next/link";
import { useState } from "react";
import { formatUsd } from "@/lib/meta";
import { useWidth } from "./useSize";

export type Bar = { label: string; value: number; href?: string; detail?: string; color?: string };

const ROW = 30;
const THICK = 12;

export function HBars({
  bars,
  unit = "count",
  labelWidth = 150,
  color = "color-mix(in srgb, var(--ink) 78%, var(--surface))",
}: {
  bars: Bar[];
  /** Serializable so server components can pass it. */
  unit?: "count" | "usd";
  labelWidth?: number;
  color?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>(480);
  const [hover, setHover] = useState<number | null>(null);
  const format = (v: number) => (unit === "usd" ? formatUsd(v) : String(v));
  const max = Math.max(...bars.map((b) => b.value), 1);
  const valueGutter = 64;
  const plotW = Math.max(40, width - labelWidth - valueGutter);
  const H = bars.length * ROW;

  return (
    <div ref={ref} className="relative">
      <svg width={width} height={H} role="img" aria-label="Bar chart">
        <line x1={labelWidth} x2={labelWidth} y1={0} y2={H} stroke="var(--axis)" />
        {bars.map((b, i) => {
          const w = Math.max(2, (b.value / max) * plotW);
          const y = i * ROW + (ROW - THICK) / 2;
          const label = (
            <text x={labelWidth - 10} y={i * ROW + ROW / 2} dy="0.32em" textAnchor="end" fontSize={12.5} fill="var(--ink-2)">
              {b.label.length > 22 ? `${b.label.slice(0, 21)}…` : b.label}
            </text>
          );
          return (
            <g
              key={b.label}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              style={{ cursor: b.href ? "pointer" : "default" }}
            >
              <rect x={0} y={i * ROW} width={width} height={ROW} rx={8} fill={hover === i ? "var(--surface-2)" : "transparent"} />
              {b.href ? <Link href={b.href}>{label}</Link> : label}
              {/* 4px rounded data-end, square at the baseline */}
              <path
                d={`M${labelWidth},${y} h${w - 4} a4,4 0 0 1 4,4 v${THICK - 8} a4,4 0 0 1 -4,4 h${-(w - 4)} z`}
                opacity={hover == null || hover === i ? 1 : 0.4}
                style={{ fill: b.color ?? color, transition: "opacity 150ms" }}
              />
              <text x={labelWidth + w + 8} y={i * ROW + ROW / 2} dy="0.32em" fontSize={12} fontWeight={500} fill="var(--ink)" className="tabular">
                {format(b.value)}
              </text>
            </g>
          );
        })}
      </svg>
      {hover != null && bars[hover].detail && (
        <div
          className="glass animate-scale-in pointer-events-none absolute z-10 max-w-72 rounded-xl px-3 py-2 text-xs"
          style={{ left: labelWidth + 12, top: (hover + 1) * ROW + 4 }}
        >
          <div className="text-sm font-semibold">{format(bars[hover].value)}</div>
          <div className="text-ink-2">{bars[hover].label}</div>
          <div className="mt-1 text-muted">{bars[hover].detail}</div>
        </div>
      )}
    </div>
  );
}

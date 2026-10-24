// Static preview of the sector map for the hero: same positions as the graph's Sectors lens, drawn as SVG.
import type { UnifiedGraph } from "@/lib/graph";
import { SECTOR_META } from "@/lib/meta";
import type { Sector } from "@/lib/schema";
import { sectorColor } from "./ui";

export function Constellation({ data }: { data: UnifiedGraph }) {
  const cos = data.nodes.filter((n) => n.kind === "company" && n.pos.sector);
  const pos = new Map(cos.map((n) => [n.id, n.pos.sector!]));
  const related = data.edges.filter((e) => e.v === "sector" && e.kind === "related" && pos.has(e.s) && pos.has(e.t));
  // Label the biggest companies, skipping any that would collide with a label already placed.
  const placed: [number, number][] = [];
  const top = new Set<string>();
  for (const n of [...cos].sort((a, b) => b.size - a.size)) {
    if (top.size >= 9) break;
    const [x, y] = n.pos.sector!;
    if (placed.some(([px, py]) => Math.abs(px - x) < 520 && Math.abs(py - y) < 90)) continue;
    placed.push([x, y]);
    top.add(n.id);
  }
  const sectors = Object.keys(data.centroids) as Sector[];

  return (
    <svg viewBox="-1250 -1250 2500 2500" overflow="visible" className="h-full w-full" role="img" aria-label="Preview of the sector map">
      <defs>
        {sectors.map((s) => (
          <radialGradient key={s} id={`glow-${s}`}>
            <stop offset="0%" stopColor={sectorColor(s)} stopOpacity="0.22" />
            <stop offset="100%" stopColor={sectorColor(s)} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      {sectors.map((s) => {
        const [x, y, r] = data.centroids[s]!;
        return <circle key={s} cx={x} cy={y} r={r * 1.9 + 120} fill={`url(#glow-${s})`} />;
      })}
      <g stroke="var(--ink)" strokeOpacity="0.12" strokeWidth="3">
        {related.map((e, i) => {
          const a = pos.get(e.s)!;
          const b = pos.get(e.t)!;
          return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />;
        })}
      </g>
      {sectors.map((s, i) => (
        <g key={s} className="constellation-island" style={{ animationDelay: `${i * -1.1}s` }}>
          {cos
            .filter((n) => n.sector === s)
            .map((n) => {
              const [x, y] = n.pos.sector!;
              return <circle key={n.id} cx={x} cy={y} r={n.size * 2.3} fill={sectorColor(s)} stroke="var(--surface)" strokeWidth={6} />;
            })}
        </g>
      ))}
      {sectors.map((s) => {
        const [x, y, r] = data.centroids[s]!;
        return (
          <text key={s} x={x} y={y - r - 70} textAnchor="middle" fontSize="62" fontWeight="600" fill="var(--ink-2)" letterSpacing="-0.5">
            {SECTOR_META[s].label.replace(/ & .*/, "")}
          </text>
        );
      })}
      {cos
        .filter((n) => top.has(n.id))
        .map((n) => {
          const [x, y] = n.pos.sector!;
          return (
            <text
              key={n.id}
              x={x + n.size * 2.3 + 18}
              y={y + 18}
              fontSize="50"
              fontWeight="500"
              fill="var(--ink)"
              stroke="var(--surface)"
              strokeWidth="14"
              paintOrder="stroke"
              strokeLinejoin="round"
            >
              {n.label.replace(/ \(.*\)$/, "")}
            </text>
          );
        })}
    </svg>
  );
}

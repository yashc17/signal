"use client";
import Graph from "graphology";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type Sigma from "sigma";
import type { GNode, GraphPayload, GraphView } from "@/lib/graph";
import { SECTOR_META, TRACK_META } from "@/lib/meta";
import type { Sector } from "@/lib/schema";

const VIEWS: { id: GraphView; label: string; blurb: string }[] = [
  {
    id: "lineage",
    label: "Talent lineage",
    blurb: "Companies linked to the labs, schools and companies their founders came from. Big green hubs are the 'mafias'. Companies with no recorded founder background are hidden.",
  },
  {
    id: "capital",
    label: "Capital",
    blurb: "Companies linked to investors backing 2+ tracked companies. Companies without such an investor are hidden.",
  },
  {
    id: "sector",
    label: "Sectors",
    blurb: "Companies clustered around their sector, sub-grouped by shared tags, with explicit competitor/sibling links.",
  },
];

type Palette = Record<string, string>;

function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  const p: Palette = {};
  for (const k of ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6", "--s7", "--s8", "--ink", "--ink-2", "--muted", "--grid", "--axis", "--surface", "--hub"])
    p[k] = v(k);
  return p;
}

function nodeColor(n: GNode, view: GraphView, pal: Palette) {
  if (view === "sector") {
    if (n.kind === "company" || n.kind === "sector") return pal[`--s${SECTOR_META[n.sector as Sector].slot}`];
    return pal["--hub"];
  }
  if (n.kind === "company") return pal[`--s${TRACK_META[n.track!].slot}`];
  return pal["--s3"];
}

export function GraphExplorer({ graphs }: { graphs: Record<GraphView, GraphPayload> }) {
  const container = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const [view, setView] = useState<GraphView>("lineage");
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [themeTick, setThemeTick] = useState(0);
  const state = useRef({ hovered: null as string | null, selected: null as string | null, hidden: new Set<string>() });

  const payload = graphs[view];
  const byId = useMemo(() => new Map(payload.nodes.map((n) => [n.id, n])), [payload]);

  // Read the view from the URL once (?view=capital), and track theme changes for canvas colors.
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("view") as GraphView | null;
    if (v && graphs[v]) setView(v);
    const bump = () => setThemeTick((t) => t + 1);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", bump);
    window.addEventListener("signal:theme", bump);
    return () => {
      mq.removeEventListener("change", bump);
      window.removeEventListener("signal:theme", bump);
    };
  }, [graphs]);

  const groupOf = useCallback(
    (n: GNode) => (view === "sector" ? (n.kind === "tag" ? "tag" : n.sector!) : n.kind === "company" ? n.track! : "hub"),
    [view],
  );

  // Build graph + renderer whenever the view or theme changes.
  useEffect(() => {
    let killed = false;
    let renderer: Sigma | null = null;
    (async () => {
      const { default: SigmaCtor } = await import("sigma");
      if (killed || !container.current) return;
      const pal = readPalette();
      const g = new Graph({ type: "undirected" });
      const topCompanies = new Set(
        payload.nodes
          .filter((n) => n.kind === "company")
          .sort((a, b) => b.size - a.size)
          .slice(0, 18)
          .map((n) => n.id),
      );
      for (const n of payload.nodes) {
        g.addNode(n.id, {
          x: n.x,
          y: n.y,
          size: n.size,
          label: n.label,
          color: nodeColor(n, view, pal),
          forceLabel: n.kind === "sector" || ((n.kind === "org" || n.kind === "investor") && (n.count ?? 0) >= 5) || topCompanies.has(n.id),
        });
      }
      for (const e of payload.edges) {
        if (!g.hasNode(e.source) || !g.hasNode(e.target) || g.hasEdge(e.source, e.target)) continue;
        g.addEdge(e.source, e.target, { size: Math.min(3, 0.5 + e.weight * 0.35), color: pal["--grid"] });
      }
      graphRef.current = g;

      renderer = new SigmaCtor(g, container.current, {
        labelFont: "system-ui, -apple-system, Segoe UI, sans-serif",
        labelSize: 12,
        labelWeight: "500",
        labelColor: { color: pal["--ink-2"] },
        labelRenderedSizeThreshold: 9,
        labelDensity: 0.6,
        zIndex: true,
        stagePadding: 60,
        minCameraRatio: 0.08,
        maxCameraRatio: 3,
        defaultDrawNodeHover: (ctx, data, settings) => {
          // Theme-aware hover label (Sigma's default is a white box).
          const size = settings.labelSize;
          ctx.font = `600 ${size}px ${settings.labelFont}`;
          const label = data.label ?? "";
          const w = ctx.measureText(label).width + 12;
          const h = size + 10;
          ctx.fillStyle = pal["--surface"];
          ctx.strokeStyle = pal["--axis"];
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(data.x + data.size + 4, data.y - h / 2, w, h, 6);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(data.x, data.y, data.size + 2, 0, Math.PI * 2);
          ctx.fillStyle = pal["--surface"];
          ctx.fill();
          ctx.beginPath();
          ctx.arc(data.x, data.y, data.size, 0, Math.PI * 2);
          ctx.fillStyle = data.color;
          ctx.fill();
          ctx.fillStyle = pal["--ink"];
          ctx.fillText(label, data.x + data.size + 10, data.y + size / 3);
        },
        nodeReducer: (node, data) => {
          const { hovered, selected, hidden } = state.current;
          const n = byIdRef.current.get(node);
          if (n && hidden.has(groupOfRef.current(n))) return { ...data, hidden: true };
          const focus = hovered ?? selected;
          if (!focus) return data;
          if (node === focus) return { ...data, highlighted: true, zIndex: 2, forceLabel: true };
          if (g.areNeighbors(node, focus)) return { ...data, zIndex: 1, forceLabel: true };
          return { ...data, color: pal["--grid"], label: "", zIndex: 0, forceLabel: false };
        },
        edgeReducer: (edge, data) => {
          const { hovered, selected, hidden } = state.current;
          const [s, t] = g.extremities(edge);
          const ns = byIdRef.current.get(s);
          const nt = byIdRef.current.get(t);
          if ((ns && hidden.has(groupOfRef.current(ns))) || (nt && hidden.has(groupOfRef.current(nt)))) return { ...data, hidden: true };
          const focus = hovered ?? selected;
          if (!focus) return data;
          if (s === focus || t === focus) return { ...data, color: pal["--muted"], size: Math.max(1, data.size), zIndex: 1 };
          return { ...data, hidden: true };
        },
      });
      renderer.on("enterNode", ({ node }) => {
        state.current.hovered = node;
        setHovered(node);
        renderer?.refresh({ skipIndexation: true });
        if (container.current) container.current.style.cursor = "pointer";
      });
      renderer.on("leaveNode", () => {
        state.current.hovered = null;
        setHovered(null);
        renderer?.refresh({ skipIndexation: true });
        if (container.current) container.current.style.cursor = "default";
      });
      renderer.on("clickNode", ({ node }) => {
        state.current.selected = node;
        setSelected(node);
        renderer?.refresh({ skipIndexation: true });
      });
      renderer.on("clickStage", () => {
        state.current.selected = null;
        setSelected(null);
        renderer?.refresh({ skipIndexation: true });
      });
      sigmaRef.current = renderer;
    })();
    return () => {
      killed = true;
      renderer?.kill();
      sigmaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, payload, themeTick]);

  // Keep reducer inputs current without re-creating the renderer.
  const byIdRef = useRef(byId);
  byIdRef.current = byId;
  const groupOfRef = useRef(groupOf);
  groupOfRef.current = groupOf;
  useEffect(() => {
    state.current.hidden = hiddenGroups;
    sigmaRef.current?.refresh({ skipIndexation: true });
  }, [hiddenGroups]);

  const switchView = (v: GraphView) => {
    setSelected(null);
    setHovered(null);
    state.current.selected = null;
    state.current.hovered = null;
    setHiddenGroups(new Set());
    setView(v);
    const url = new URL(window.location.href);
    url.searchParams.set("view", v);
    window.history.replaceState(null, "", url);
  };

  const focusNode = (id: string) => {
    const r = sigmaRef.current;
    if (!r) return;
    state.current.selected = id;
    setSelected(id);
    const d = r.getNodeDisplayData(id);
    if (d) r.getCamera().animate({ x: d.x, y: d.y, ratio: 0.35 }, { duration: 500 });
    r.refresh({ skipIndexation: true });
  };

  const legend = useMemo(() => {
    if (view === "sector")
      return [
        ...Object.entries(SECTOR_META).map(([k, m]) => ({ key: k, label: m.label, color: `var(--s${m.slot})` })),
        { key: "tag", label: "Shared tags", color: "var(--hub)" },
      ];
    return [
      { key: "research", label: "Research labs", color: "var(--s1)" },
      { key: "applied", label: "Applied startups", color: "var(--s2)" },
      { key: "hub", label: view === "lineage" ? "Where founders came from" : "Investors (2+ portfolio cos)", color: "var(--s3)" },
    ];
  }, [view]);

  const toggleGroup = (k: string) =>
    setHiddenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const focus = selected ?? hovered;
  const focusNodeData = focus ? byId.get(focus) : null;
  const neighbors = useMemo(() => {
    if (!focus) return [];
    const out: { node: GNode; label?: string; weight: number }[] = [];
    for (const e of payload.edges) {
      const other = e.source === focus ? e.target : e.target === focus ? e.source : null;
      if (!other) continue;
      const n = byId.get(other);
      if (n) out.push({ node: n, label: e.label, weight: e.weight });
    }
    return out.sort((a, b) => b.weight - a.weight || b.node.size - a.node.size);
  }, [focus, payload, byId]);

  const matches = query.trim()
    ? payload.nodes.filter((n) => n.label.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr_300px]">
      <aside className="space-y-4">
        <div className="card p-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => switchView(v.id)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${view === v.id ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:text-ink"}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-2">{VIEWS.find((v) => v.id === view)!.blurb}</p>
        <div className="relative">
          <input className="control w-full" placeholder="Find a node…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find a node" />
          {matches.length > 0 && (
            <ul className="card absolute z-20 mt-1 w-full overflow-hidden text-sm shadow-lg">
              {matches.map((m) => (
                <li key={m.id}>
                  <button
                    className="block w-full px-3 py-1.5 text-left hover:bg-surface-2"
                    onClick={() => {
                      focusNode(m.id);
                      setQuery("");
                    }}
                  >
                    {m.label} <span className="text-xs text-muted">{m.kind}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="mb-1.5 text-xs text-muted">Legend · click to hide/show</div>
          <ul className="space-y-0.5">
            {legend.map((l) => (
              <li key={l.key}>
                <button
                  onClick={() => toggleGroup(l.key)}
                  className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-surface-2 ${hiddenGroups.has(l.key) ? "opacity-35" : "text-ink-2"}`}
                  aria-pressed={!hiddenGroups.has(l.key)}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: l.color }} />
                  {l.label}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Node size ∝ valuation or capital raised (companies), portfolio/alumni count (hubs).</p>
        </div>
      </aside>

      <div className="card relative h-[72vh] min-h-[480px] overflow-hidden">
        <div ref={container} className="absolute inset-0" />
        <div className="pointer-events-none absolute bottom-2 left-3 text-xs text-muted">
          {payload.nodes.length} nodes · {payload.edges.length} edges · scroll to zoom, drag to pan
        </div>
        <div className="absolute right-2 top-2 flex flex-col gap-1">
          {[
            ["+", () => sigmaRef.current?.getCamera().animatedZoom({ duration: 250 })],
            ["−", () => sigmaRef.current?.getCamera().animatedUnzoom({ duration: 250 })],
            ["⟲", () => sigmaRef.current?.getCamera().animatedReset({ duration: 300 })],
          ].map(([l, fn]) => (
            <button key={l as string} onClick={fn as () => void} className="control h-8 w-8 p-0 text-center" aria-label={`zoom ${l}`}>
              {l as string}
            </button>
          ))}
        </div>
      </div>

      <aside className="card h-fit max-h-[72vh] overflow-auto p-4">
        {focusNodeData ? (
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">{focusNodeData.kind === "org" ? "Founder source" : focusNodeData.kind}</div>
            <h3 className="mt-1 text-lg font-semibold leading-tight">{focusNodeData.label}</h3>
            {focusNodeData.subtitle && <p className="mt-1 text-sm text-ink-2">{focusNodeData.subtitle}</p>}
            {focusNodeData.slug && (
              <Link className="link mt-2 inline-block text-sm" href={`/companies/${focusNodeData.slug}/`}>
                Open profile →
              </Link>
            )}
            <div className="mt-4 text-xs text-muted">{neighbors.length} connections</div>
            <ul className="mt-1 divide-y divide-[var(--border)]">
              {neighbors.map(({ node, label }) => (
                <li key={node.id}>
                  <button className="w-full py-1.5 text-left hover:bg-surface-2" onClick={() => focusNode(node.id)}>
                    <div className="text-sm">{node.label}</div>
                    {label && <div className="text-xs text-muted">via {label}</div>}
                  </button>
                </li>
              ))}
            </ul>
            {selected && (
              <button
                className="mt-3 text-xs text-ink-2 hover:text-ink"
                onClick={() => {
                  state.current.selected = null;
                  setSelected(null);
                  sigmaRef.current?.refresh({ skipIndexation: true });
                }}
              >
                Clear selection
              </button>
            )}
          </div>
        ) : (
          <div className="text-sm text-ink-2">
            <p className="font-medium text-ink">Hover or click a node.</p>
            <p className="mt-2">
              Try <em>Google DeepMind</em> in Talent lineage to see every company its alumni founded, or <em>a16z</em> in Capital to see its AI
              portfolio.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

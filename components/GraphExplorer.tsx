"use client";
// Full-canvas knowledge graph. One node set with a precomputed position per lens; switching lenses
// morphs shared nodes to their new places while lens-specific hubs fade in and out.
import Graph from "graphology";
import { ArrowUpRight, Building2, Landmark, Maximize2, Minus, MousePointerClick, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type Sigma from "sigma";
import type { CompanyInfo, GraphView, UnifiedGraph, UNode } from "@/lib/graph";
import { formatUsd, SECTOR_META, TRACK_META } from "@/lib/meta";
import type { Sector } from "@/lib/schema";
import { StarButton } from "./StarButton";
import { Monogram, Segmented, sectorColor } from "./ui";

const LENSES: { id: GraphView; label: string; title: string; blurb: string }[] = [
  {
    id: "lineage",
    label: "Talent",
    title: "Where founders came from",
    blurb: "Startups orbit the labs, schools and companies their founders left. The biggest hubs are today's talent mafias.",
  },
  {
    id: "capital",
    label: "Capital",
    title: "Who funds whom",
    blurb: "Investors backing two or more tracked companies, linked to their portfolio. Heavier lines mark rounds they led.",
  },
  {
    id: "sector",
    label: "Sectors",
    title: "What they build",
    blurb: "Territories by sector, pulled together by shared themes. Lines connect direct competitors and siblings.",
  },
];

type Track = "all" | "research" | "applied";
type Pal = { sector: Record<Sector, string>; page: string; surface: string; ink: string; ink2: string; muted: string; dark: boolean; font: string };
type Morph = { from: GraphView; to: GraphView; t: number };
type Neighbor = { id: string; w: number; label?: string; kind: string };

const SECTORS = Object.keys(SECTOR_META) as Sector[];
const MORPH_MS = 850;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const band = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgba = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
};
// WebGL layers ignore alpha here, so "transparency" is an opaque blend toward the page color.
let PAGE: [number, number, number] = [255, 255, 255];
const blend = (hex: string, a: number) => {
  const c = hexToRgb(hex);
  const k = Math.max(0, Math.min(1, a));
  return `rgb(${c.map((v, i) => Math.round(PAGE[i] + (v - PAGE[i]) * k)).join(",")})`;
};

function readPalette(): Pal {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  const sector = {} as Record<Sector, string>;
  for (const s of SECTORS) sector[s] = v(`--s${SECTOR_META[s].slot}`);
  const page = v("--page");
  PAGE = hexToRgb(page);
  return {
    sector,
    page,
    surface: v("--surface"),
    ink: v("--ink"),
    ink2: v("--ink-2"),
    muted: v("--muted"),
    dark: hexToRgb(page)[0] < 60,
    font: getComputedStyle(document.body).fontFamily,
  };
}

export function GraphExplorer({ data }: { data: UnifiedGraph }) {
  const wrap = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const underlay = useRef<HTMLCanvasElement>(null);
  const labelRefs = useRef<Partial<Record<Sector, HTMLButtonElement | null>>>({});
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const rafRef = useRef<number>(0);

  const [view, setView] = useState<GraphView>("lineage");
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [track, setTrack] = useState<Track>("all");
  const [hiddenSectors, setHiddenSectors] = useState<Set<Sector>>(new Set());
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [ready, setReady] = useState(false);

  const byId = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data]);

  // Per-lens adjacency (the graph is multi-lens, so neighbors must be scoped to the active lens).
  const adj = useMemo(() => {
    const out = {} as Record<GraphView, Map<string, Neighbor[]>>;
    for (const v of ["lineage", "capital", "sector"] as GraphView[]) out[v] = new Map();
    for (const e of data.edges) {
      const m = out[e.v];
      if (!m.has(e.s)) m.set(e.s, []);
      if (!m.has(e.t)) m.set(e.t, []);
      m.get(e.s)!.push({ id: e.t, w: e.w, label: e.label, kind: e.kind });
      m.get(e.t)!.push({ id: e.s, w: e.w, label: e.label, kind: e.kind });
    }
    return out;
  }, [data]);

  // Labels shown without interaction: big hubs plus the largest companies in each lens.
  const forced = useMemo(() => {
    const out = {} as Record<GraphView, Set<string>>;
    for (const v of ["lineage", "capital", "sector"] as GraphView[]) {
      const inView = data.nodes.filter((n) => n.pos[v]);
      const hubs = inView.filter((n) => (n.kind === "org" || n.kind === "investor") && (n.count ?? 0) >= (v === "capital" ? 6 : 4));
      const cos = inView.filter((n) => n.kind === "company").sort((a, b) => b.size - a.size).slice(0, v === "sector" ? 22 : 12);
      out[v] = new Set([...hubs, ...cos].map((n) => n.id));
    }
    return out;
  }, [data]);

  // Mutable render state read by Sigma reducers (kept outside React to avoid re-creating the renderer).
  const st = useRef({
    morph: { from: "lineage", to: "lineage", t: 1 } as Morph,
    focus: null as null | { center: string; set: Set<string> },
    track: "all" as Track,
    hiddenSectors: new Set<Sector>(),
    pal: null as Pal | null,
  });

  const visibleCompany = useCallback((n: UNode) => {
    const s = st.current;
    if (n.kind !== "company") return true;
    if (s.track !== "all" && n.track !== s.track) return false;
    return !s.hiddenSectors.has(n.sector!);
  }, []);

  const presence = useCallback((n: UNode) => {
    const { from, to, t } = st.current.morph;
    const a = !!n.pos[from];
    const b = !!n.pos[to];
    if (a && b) return 1;
    if (b) return band(t, 0.35, 1);
    if (a && from !== to) return 1 - band(t, 0, 0.45);
    return 0;
  }, []);

  const computeFocus = useCallback(
    (center: string | null, v: GraphView) => {
      if (!center) return null;
      const set = new Set([center]);
      for (const nb of adj[v].get(center) ?? []) set.add(nb.id);
      return { center, set };
    },
    [adj],
  );

  /* ---------- Renderer (created once) ---------- */
  useEffect(() => {
    let killed = false;
    let renderer: Sigma | null = null;
    let ro: ResizeObserver | null = null;
    (async () => {
      const [{ default: SigmaCtor }, { createNodeBorderProgram }] = await Promise.all([import("sigma"), import("@sigma/node-border")]);
      if (killed || !container.current) return;
      st.current.pal = readPalette();

      const params = new URLSearchParams(window.location.search);
      const initial = (["lineage", "capital", "sector"] as GraphView[]).find((v) => v === params.get("view")) ?? "lineage";
      st.current.morph = { from: initial, to: initial, t: 1 };
      setView(initial);

      const g = new Graph({ type: "undirected", multi: true });
      for (const n of data.nodes) {
        const p = n.pos[initial] ?? n.pos.sector ?? n.pos.lineage ?? n.pos.capital ?? [0, 0];
        g.addNode(n.id, { x: p[0], y: p[1], size: n.kind === "company" ? n.size * 1.05 : n.size, label: n.label, type: "border" });
      }
      data.edges.forEach((e, i) => {
        if (g.hasNode(e.s) && g.hasNode(e.t)) g.addEdgeWithKey(`${e.v}:${i}`, e.s, e.t, { v: e.v, kind: e.kind, w: e.w, size: Math.min(2.6, 0.45 + e.w * 0.3) });
      });
      graphRef.current = g;

      const drawLabel = (ctx: CanvasRenderingContext2D, d: Record<string, any>) => {
        if (!d.label) return;
        const pal = st.current.pal!;
        const size = d.hub ? 12.5 : 11.5;
        ctx.font = `${d.hub ? 600 : 500} ${size}px ${pal.font}`;
        const x = d.x + d.size + 5;
        const y = d.y + size / 3;
        ctx.lineJoin = "round";
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = rgba(pal.page, 0.9 * d.alpha);
        ctx.strokeText(d.label, x, y);
        ctx.fillStyle = rgba(d.hub ? pal.ink : pal.ink2, d.alpha);
        ctx.fillText(d.label, x, y);
      };

      renderer = new SigmaCtor(g, container.current, {
        nodeProgramClasses: {
          border: createNodeBorderProgram({
            borders: [
              { size: { attribute: "borderSize", defaultValue: 0.12 }, color: { attribute: "borderColor" } },
              { size: { fill: true }, color: { attribute: "color" } },
            ],
          }),
        },
        defaultNodeType: "border",
        labelFont: st.current.pal.font,
        labelRenderedSizeThreshold: 7,
        labelDensity: 0.55,
        labelGridCellSize: 110,
        zIndex: true,
        stagePadding: 48,
        minCameraRatio: 0.06,
        maxCameraRatio: 2.5,
        defaultDrawNodeLabel: (ctx, d) => drawLabel(ctx, d as any),
        defaultDrawNodeHover: (ctx, d) => {
          const pal = st.current.pal!;
          const label = (d as any).label as string;
          if (!label) return;
          const size = 12.5;
          ctx.font = `600 ${size}px ${pal.font}`;
          const w = ctx.measureText(label).width + 16;
          const h = size + 12;
          const x = d.x + d.size + 6;
          ctx.save();
          ctx.shadowColor = pal.dark ? "rgba(0,0,0,0.6)" : "rgba(9,9,11,0.14)";
          ctx.shadowBlur = 14;
          ctx.shadowOffsetY = 4;
          ctx.fillStyle = pal.surface;
          ctx.beginPath();
          ctx.roundRect(x, d.y - h / 2, w, h, 8);
          ctx.fill();
          ctx.restore();
          ctx.strokeStyle = pal.dark ? "rgba(255,255,255,0.1)" : "rgba(9,9,11,0.08)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = pal.ink;
          ctx.fillText(label, x + 8, d.y + size / 3);
        },
        nodeReducer: (id, attr) => {
          const s = st.current;
          const pal = s.pal!;
          const n = byId.get(id)!;
          if (n.kind === "sector" || n.kind === "tag") return { ...attr, hidden: true };
          let alpha = presence(n);
          if (alpha <= 0.01 || !visibleCompany(n)) return { ...attr, hidden: true };
          const hub = n.kind === "org" || n.kind === "investor";
          let label: string | null = attr.label;
          let forceLabel = forced[s.morph.to].has(id) && alpha > 0.6;
          let zIndex = hub ? 1 : 0;
          if (s.focus) {
            if (s.focus.set.has(id)) {
              forceLabel = true;
              zIndex = id === s.focus.center ? 4 : 3;
            } else {
              alpha *= pal.dark ? 0.16 : 0.13;
              label = null;
              forceLabel = false;
            }
          }
          // Islands are dense, so companies draw a little smaller in the sector lens (eased during morphs).
          const { from, to, t } = s.morph;
          const k = (v: GraphView) => (v === "sector" && n.kind === "company" ? 0.74 : 1);
          const size = attr.size * (k(from) + (k(to) - k(from)) * ease(t));
          const fill = hub ? pal.surface : pal.sector[n.sector!];
          const border = hub ? (pal.dark ? pal.ink2 : pal.ink) : pal.surface;
          return {
            ...attr,
            size,
            color: blend(fill, alpha),
            borderColor: blend(border, hub ? alpha * 0.85 : alpha),
            borderSize: hub ? 0.2 : 0.13,
            label,
            forceLabel,
            zIndex,
            hub,
            alpha,
          };
        },
        edgeReducer: (_id, attr) => {
          const s = st.current;
          const pal = s.pal!;
          const { from, to, t } = s.morph;
          if (attr.kind === "sector" || attr.kind === "tag") return { ...attr, hidden: true };
          const alpha = attr.v === to ? (from === to ? 1 : band(t, 0.55, 1)) : attr.v === from ? 1 - band(t, 0, 0.3) : 0;
          if (alpha <= 0.01) return { ...attr, hidden: true };
          const [a, b] = g.extremities(_id);
          const na = byId.get(a)!;
          const nb = byId.get(b)!;
          if (!visibleCompany(na) || !visibleCompany(nb)) return { ...attr, hidden: true };
          if (s.focus) {
            const c = s.focus.center;
            if (a !== c && b !== c) return { ...attr, hidden: true };
            const cn = byId.get(c)!;
            const col = cn.kind === "company" ? pal.sector[cn.sector!] : pal.ink2;
            return { ...attr, color: blend(col, 0.6 * alpha), size: attr.size + 0.6, zIndex: 2 };
          }
          const weight = attr.kind === "lead" ? 1.5 : attr.kind === "investor" ? 0.75 : 1;
          return { ...attr, color: blend(pal.ink, (pal.dark ? 0.14 : 0.11) * weight * alpha) };
        },
      });
      renderer.setCustomBBox({ x: [-1000, 1000], y: [-1000, 1000] });
      if ((wrap.current?.clientWidth ?? 0) >= 1024) renderer.getCamera().setState({ x: 0.54, y: 0.5, ratio: 1.04 });

      // Underlay: sector territories (soft glows) and the selection halo. Sector labels ride on top as HTML.
      const drawUnderlay = () => {
        const cv = underlay.current;
        const r = renderer;
        if (!cv || !r) return;
        const ctx = cv.getContext("2d")!;
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cv.width, cv.height);
        const s = st.current;
        const pal = s.pal!;
        const { from, to, t } = s.morph;
        const sectorAlpha = (to === "sector" ? (from === "sector" ? 1 : band(t, 0.4, 1)) : 0) + (from === "sector" && to !== "sector" ? 1 - band(t, 0, 0.4) : 0);
        const o = r.graphToViewport({ x: 0, y: 0 });
        const unit = Math.abs(r.graphToViewport({ x: 100, y: 0 }).x - o.x) / 100;
        if (sectorAlpha > 0.01) {
          const rad = 115 * unit;
          ctx.globalCompositeOperation = pal.dark ? "lighter" : "multiply";
          g.forEachNode((id, a) => {
            const n = byId.get(id)!;
            if (n.kind !== "company" || !n.pos.sector || !visibleCompany(n)) return;
            const p = r.graphToViewport({ x: a.x, y: a.y });
            const dim = s.focus && !s.focus.set.has(id) ? 0.35 : 1;
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
            grad.addColorStop(0, rgba(pal.sector[n.sector!], (pal.dark ? 0.09 : 0.11) * sectorAlpha * dim));
            grad.addColorStop(1, rgba(pal.sector[n.sector!], 0));
            ctx.fillStyle = grad;
            ctx.fillRect(p.x - rad, p.y - rad, rad * 2, rad * 2);
          });
          ctx.globalCompositeOperation = "source-over";
        }
        for (const sec of SECTORS) {
          const el = labelRefs.current[sec];
          const c = data.centroids[sec];
          if (!el || !c) continue;
          // Sit just above the island, whichever way the camera maps "up".
          const a = r.graphToViewport({ x: c[0], y: c[1] + c[2] });
          const b = r.graphToViewport({ x: c[0], y: c[1] - c[2] });
          const p = a.y < b.y ? a : b;
          const hidden = s.hiddenSectors.has(sec);
          const dim = s.focus && s.focus.center !== `s:${sec}` ? 0.25 : 1;
          el.style.transform = `translate(${p.x}px, ${p.y - 16}px) translate(-50%, -100%)`;
          el.style.opacity = String(hidden ? 0 : sectorAlpha * dim);
          el.style.pointerEvents = sectorAlpha > 0.5 && !hidden ? "auto" : "none";
        }
        if (s.focus) {
          const d = r.getNodeDisplayData(s.focus.center);
          const n = byId.get(s.focus.center);
          if (d && !d.hidden && n && n.kind !== "sector") {
            const p = r.framedGraphToViewport({ x: d.x, y: d.y });
            const rad = r.scaleSize(d.size) + 5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
            ctx.strokeStyle = rgba(pal.ink, 0.55);
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(p.x, p.y, rad + 9, 0, Math.PI * 2);
            ctx.fillStyle = rgba(n.kind === "company" ? pal.sector[n.sector!] : pal.ink, pal.dark ? 0.16 : 0.1);
            ctx.fill();
          }
        }
      };
      const sizeUnderlay = () => {
        const cv = underlay.current;
        const box = wrap.current;
        if (!cv || !box) return;
        const dpr = window.devicePixelRatio || 1;
        cv.width = box.clientWidth * dpr;
        cv.height = box.clientHeight * dpr;
        cv.style.width = `${box.clientWidth}px`;
        cv.style.height = `${box.clientHeight}px`;
        drawUnderlay();
      };
      renderer.on("afterRender", drawUnderlay);
      ro = new ResizeObserver(sizeUnderlay);
      if (wrap.current) ro.observe(wrap.current);
      sizeUnderlay();

      renderer.on("enterNode", ({ node }) => {
        setHovered(node);
        if (container.current) container.current.style.cursor = "pointer";
      });
      renderer.on("leaveNode", () => {
        setHovered(null);
        if (container.current) container.current.style.cursor = "";
      });
      renderer.on("clickNode", ({ node }) => selectRef.current(node));
      renderer.on("clickStage", () => selectRef.current(null));
      sigmaRef.current = renderer;
      setReady(true);

      const focus = params.get("focus");
      if (focus && byId.get(focus)) setTimeout(() => selectRef.current(focus), 150);
    })();
    return () => {
      killed = true;
      cancelAnimationFrame(rafRef.current);
      ro?.disconnect();
      renderer?.kill();
      sigmaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Theme changes: re-read the palette and repaint (no rebuild needed).
  useEffect(() => {
    const bump = () =>
      requestAnimationFrame(() => {
        st.current.pal = readPalette();
        sigmaRef.current?.refresh({ skipIndexation: true });
      });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", bump);
    window.addEventListener("signal:theme", bump);
    return () => {
      mq.removeEventListener("change", bump);
      window.removeEventListener("signal:theme", bump);
    };
  }, []);

  // Hover/selection → focus set.
  useEffect(() => {
    st.current.focus = computeFocus(hovered ?? selected, view);
    sigmaRef.current?.refresh({ skipIndexation: true });
  }, [hovered, selected, view, computeFocus]);

  useEffect(() => {
    st.current.track = track;
    st.current.hiddenSectors = hiddenSectors;
    sigmaRef.current?.refresh();
  }, [track, hiddenSectors]);

  /* ---------- Camera ---------- */
  const fitTo = useCallback((ids: string[] | null) => {
    const r = sigmaRef.current;
    if (!r) return;
    const cam = r.getCamera();
    const desktop = (wrap.current?.clientWidth ?? 0) >= 1024;
    if (!ids || ids.length === 0) {
      cam.animate({ x: desktop ? 0.54 : 0.5, y: 0.5, ratio: desktop ? 1.04 : 1, angle: 0 }, { duration: 600, easing: "cubicInOut" });
      return;
    }
    const pts = ids.map((id) => r.getNodeDisplayData(id)).filter((d): d is NonNullable<typeof d> => !!d && !d.hidden);
    if (!pts.length) return;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    const ratio = Math.min(1.1, Math.max(0.16, Math.max(w, h) * 1.45 + 0.1));
    cam.animate(
      { x: (Math.min(...xs) + Math.max(...xs)) / 2 + (desktop ? ratio * 0.17 : 0), y: (Math.min(...ys) + Math.max(...ys)) / 2 + (desktop ? 0 : ratio * 0.18), ratio },
      { duration: 650, easing: "cubicInOut" },
    );
  }, []);

  /* ---------- Lens morph ---------- */
  const morphTo = useCallback(
    (to: GraphView, then?: () => void) => {
      const g = graphRef.current;
      const r = sigmaRef.current;
      if (!g || !r) return;
      const from = st.current.morph.to;
      cancelAnimationFrame(rafRef.current);
      if (from === to) {
        then?.();
        return;
      }
      const starts = new Map<string, [number, number]>();
      g.forEachNode((id, a) => starts.set(id, [a.x, a.y]));
      const t0 = performance.now();
      st.current.morph = { from, to, t: 0 };
      fitTo(null);
      const step = (now: number) => {
        const raw = Math.min(1, (now - t0) / MORPH_MS);
        const t = ease(raw);
        st.current.morph = { from, to, t: raw };
        g.updateEachNodeAttributes((id, a) => {
          const n = byId.get(id)!;
          const [x0, y0] = starts.get(id)!;
          const target = n.pos[to];
          if (!target) return a;
          if (!n.pos[from]) return { ...a, x: target[0], y: target[1] };
          return { ...a, x: x0 + (target[0] - x0) * t, y: y0 + (target[1] - y0) * t };
        });
        if (raw < 1) rafRef.current = requestAnimationFrame(step);
        else {
          st.current.morph = { from: to, to, t: 1 };
          r.refresh();
          then?.();
        }
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [byId, fitTo],
  );

  const syncUrl = (v: GraphView, focus: string | null) => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", v);
    if (focus) url.searchParams.set("focus", focus);
    else url.searchParams.delete("focus");
    window.history.replaceState(null, "", url);
  };

  const switchView = (v: GraphView) => {
    if (v === view) return;
    setSelected(null);
    setHovered(null);
    st.current.focus = null;
    setView(v);
    syncUrl(v, null);
    morphTo(v);
  };

  // Select a node; if it isn't part of the current lens, move to a lens that has it first.
  const select = useCallback(
    (id: string | null) => {
      if (!id) {
        setSelected(null);
        syncUrl(st.current.morph.to, null);
        fitTo(null);
        return;
      }
      const n = byId.get(id);
      if (!n) return;
      const cur = st.current.morph.to;
      const target: GraphView = n.pos[cur] ? cur : n.pos.lineage ? "lineage" : n.pos.capital ? "capital" : "sector";
      const run = () => {
        setSelected(id);
        syncUrl(target, id);
        const f = computeFocus(id, target);
        if (f) fitTo([...f.set].filter((x) => !x.startsWith("s:") && !x.startsWith("t:")));
      };
      if (target !== cur) {
        setView(target);
        st.current.focus = null;
        morphTo(target, run);
      } else run();
    },
    [byId, computeFocus, fitTo, morphTo],
  );
  const selectRef = useRef(select);
  selectRef.current = select;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !/INPUT/.test((e.target as HTMLElement).tagName)) select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);

  /* ---------- Derived UI data ---------- */
  const lens = LENSES.find((l) => l.id === view)!;
  const inView = useMemo(() => data.nodes.filter((n) => n.pos[view] && n.kind !== "tag"), [data, view]);
  const companiesInView = inView.filter((n) => n.kind === "company").length;
  const totalCompanies = Object.keys(data.companies).length;

  const starters = useMemo(() => {
    if (view === "sector")
      return SECTORS.map((s) => ({
        id: `s:${s}`,
        label: SECTOR_META[s].label,
        count: (adj.sector.get(`s:${s}`) ?? []).length,
        color: sectorColor(s) as string | undefined,
      })).sort((a, b) => b.count - a.count);
    const kind = view === "lineage" ? "org" : "investor";
    return inView
      .filter((n) => n.kind === kind)
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .slice(0, 8)
      .map((n) => ({ id: n.id, label: n.label, count: n.count ?? 0, color: undefined as string | undefined }));
  }, [view, inView, adj]);
  const starterMax = Math.max(...starters.map((s) => s.count), 1);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return data.nodes
      .filter((n) => n.kind !== "tag" && n.label.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          Number(!!b.pos[view]) - Number(!!a.pos[view]) ||
          Number(b.label.toLowerCase().startsWith(q)) - Number(a.label.toLowerCase().startsWith(q)) ||
          b.size - a.size,
      )
      .slice(0, 7);
  }, [query, data, view]);

  const toggleSector = (s: Sector) =>
    setHiddenSectors((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const sel = selected ? byId.get(selected) : null;
  const hov = hovered && hovered !== selected ? byId.get(hovered) : null;

  return (
    <div ref={wrap} className="dot-grid relative h-[calc(100dvh-57px)] min-h-[560px] overflow-hidden">
      <canvas ref={underlay} className="pointer-events-none absolute inset-0" aria-hidden />
      <div ref={container} className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`} aria-label="Knowledge graph canvas" />
      {!ready && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">Laying out the graph…</div>}

      {/* Sector territory labels (positioned every frame from the renderer) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {SECTORS.map((s) => (
          <button
            key={s}
            ref={(el) => {
              labelRefs.current[s] = el;
            }}
            onClick={() => select(`s:${s}`)}
            className="absolute left-0 top-0 flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[13px] font-semibold tracking-[-0.01em] text-ink opacity-0 transition-[opacity] hover:bg-[var(--glass)]"
            style={{ textShadow: "0 0 6px var(--page), 0 0 2px var(--page)" }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: sectorColor(s) }} />
            {SECTOR_META[s].label}
          </button>
        ))}
      </div>

      {/* Top-left: lens + search */}
      <div className="absolute left-3 right-3 top-3 z-10 sm:right-auto sm:w-[340px] lg:left-4 lg:top-4">
        <div className="glass animate-fade-up rounded-2xl p-3">
          <div className="grid grid-cols-1">
            <Segmented value={view} onChange={switchView} options={LENSES.map((l) => ({ value: l.id, label: l.label }))} full />
          </div>
          <div className="mt-3 flex items-start justify-between gap-3 px-0.5">
            <div className="text-[14px] font-semibold tracking-[-0.01em]">{lens.title}</div>
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
          <div className="px-0.5">
            <p className="mt-1 hidden text-[12.5px] leading-relaxed text-ink-2 sm:block">{lens.blurb}</p>
          </div>
          <div className="relative mt-3">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="control h-9 w-full pl-8"
              placeholder="Find a company, lab or investor"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 120)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && matches[0]) {
                  select(matches[0].id);
                  setQuery("");
                }
              }}
              aria-label="Find a node"
            />
            {searchOpen && matches.length > 0 && (
              <ul className="glass animate-scale-in absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl p-1 text-sm">
                {matches.map((m) => (
                  <li key={m.id}>
                    <button
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        select(m.id);
                        setQuery("");
                        setSearchOpen(false);
                      }}
                    >
                      <NodeIcon n={m} size={24} />
                      <span className="min-w-0 flex-1 truncate font-medium">{m.label}</span>
                      <span className="text-[11px] text-muted">{kindLabel(m)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Bottom-left: legend (sector filter) */}
      <div className="absolute bottom-4 left-4 z-10 hidden max-w-[340px] md:block">
        <div className="glass rounded-2xl p-3">
          <div className="mb-2 flex items-center justify-between text-[11px] text-muted">
            <span>Color = sector · click to filter</span>
            {hiddenSectors.size > 0 && (
              <button className="font-medium text-ink-2 hover:text-ink" onClick={() => setHiddenSectors(new Set())}>
                Show all
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {SECTORS.map((s) => (
              <button
                key={s}
                onClick={() => toggleSector(s)}
                aria-pressed={!hiddenSectors.has(s)}
                className={`inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-[3px] text-[11.5px] font-medium transition-opacity hover:bg-surface-2 ${hiddenSectors.has(s) ? "opacity-35" : "text-ink-2"}`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: sectorColor(s) }} />
                {SECTOR_META[s].label.replace(/ & .*/, "")}
              </button>
            ))}
            {view !== "sector" && (
              <span className="inline-flex items-center gap-1.5 px-2 py-[3px] text-[11.5px] text-muted">
                <span className="h-2.5 w-2.5 rounded-full border-[2px] border-ink-2 bg-surface" />
                {view === "lineage" ? "Founder origin" : "Investor"}
              </span>
            )}
          </div>
          <div className="mt-2.5 text-[11px] text-muted">
            {companiesInView} of {totalCompanies} companies in this lens · size = valuation
          </div>
        </div>
      </div>

      {/* Bottom-right: camera */}
      <div className="absolute bottom-4 right-4 z-10 hidden flex-col gap-1 sm:flex lg:right-[392px]">
        <div className="glass flex flex-col rounded-xl p-1">
          <button className="icon-btn" aria-label="Zoom in" onClick={() => sigmaRef.current?.getCamera().animatedZoom({ duration: 250 })}>
            <Plus size={15} />
          </button>
          <button className="icon-btn" aria-label="Zoom out" onClick={() => sigmaRef.current?.getCamera().animatedUnzoom({ duration: 250 })}>
            <Minus size={15} />
          </button>
          <button className="icon-btn" aria-label="Fit to screen" onClick={() => fitTo(null)}>
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* Hover peek (desktop) */}
      {hov && <HoverPeek n={hov} data={data} view={view} adj={adj} />}

      {/* Right: inspector */}
      <aside className={`glass animate-slide-in scroll-quiet absolute bottom-3 left-3 right-3 z-10 max-h-[46vh] overflow-y-auto rounded-2xl lg:bottom-4 lg:left-auto lg:right-4 lg:top-4 lg:block lg:max-h-none lg:w-[360px] ${sel ? "" : "hidden"}`}>
        {sel ? (
          <Inspector key={sel.id} n={sel} data={data} view={view} adj={adj} byId={byId} onSelect={select} />
        ) : (
          <div className="p-4">
            <div className="flex items-center gap-2 text-[12px] font-medium text-muted">
              <MousePointerClick size={14} /> Start here
            </div>
            <h3 className="mt-2 text-[15px] font-semibold tracking-[-0.01em]">
              {view === "lineage" ? "Biggest founder pipelines" : view === "capital" ? "Most connected investors" : "Sectors by company count"}
            </h3>
            <p className="mt-1 text-[12.5px] text-ink-2">
              {view === "lineage"
                ? "Companies founded by alumni of each org. Pick one to see its startups light up."
                : view === "capital"
                  ? "Tracked companies in each portfolio. Pick one to trace its bets."
                  : "Pick a sector to see who's building there."}
            </p>
            <ul className="mt-3 space-y-0.5">
              {starters.map((s) => (
                <li key={s.id}>
                  <button className="group w-full rounded-lg px-2 py-1.5 text-left hover:bg-surface-2" onClick={() => select(s.id)}>
                    <div className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="flex min-w-0 items-center gap-2 truncate font-medium">
                        {s.color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />}
                        {s.label}
                      </span>
                      <span className="tabular text-xs text-muted">{s.count}</span>
                    </div>
                    <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${(s.count / starterMax) * 100}%`, background: s.color ?? "var(--ink-2)" }}
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 hidden gap-x-4 gap-y-1.5 border-t border-line pt-3 text-[11.5px] text-muted lg:grid lg:grid-cols-2">
              <span>Click: focus a node</span>
              <span>Scroll: zoom</span>
              <span>Drag: pan</span>
              <span>Esc: clear</span>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function kindLabel(n: UNode) {
  if (n.kind === "company") return n.track === "research" ? "Lab" : "Applied";
  if (n.kind === "org") return "Origin";
  if (n.kind === "investor") return "Investor";
  return "Sector";
}

function NodeIcon({ n, size = 28 }: { n: UNode; size?: number }) {
  if (n.kind === "company") return <Monogram name={n.label} sector={n.sector!} size={size} />;
  if (n.kind === "sector")
    return (
      <span className="inline-flex shrink-0 items-center justify-center rounded-[9px] bg-surface-2" style={{ width: size, height: size }}>
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: sectorColor(n.sector!) }} />
      </span>
    );
  const Icon = n.kind === "org" ? Building2 : Landmark;
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-[9px] border border-line bg-surface text-ink-2" style={{ width: size, height: size }}>
      <Icon size={size * 0.5} strokeWidth={1.8} />
    </span>
  );
}

function HoverPeek({ n, data, view, adj }: { n: UNode; data: UnifiedGraph; view: GraphView; adj: Record<GraphView, Map<string, Neighbor[]>> }) {
  const c = n.slug ? data.companies[n.slug] : null;
  const deg = (adj[view].get(n.id) ?? []).filter((x) => !x.id.startsWith("s:") && !x.id.startsWith("t:")).length;
  return (
    <div className="glass animate-scale-in pointer-events-none absolute left-1/2 top-4 z-20 hidden -translate-x-1/2 items-center gap-3 rounded-xl px-3 py-2 lg:flex">
      <NodeIcon n={n} size={28} />
      <div>
        <div className="text-[13px] font-semibold">{n.label}</div>
        <div className="text-[11.5px] text-muted">
          {c
            ? [TRACK_META[c.track].label, c.valuation ? `${formatUsd(c.valuation)} valuation` : c.raised ? `${formatUsd(c.raised)} raised` : null]
                .filter(Boolean)
                .join(" · ")
            : `${deg} ${deg === 1 ? "connection" : "connections"}`}
        </div>
      </div>
    </div>
  );
}

function Inspector({
  n,
  data,
  view,
  adj,
  byId,
  onSelect,
}: {
  n: UNode;
  data: UnifiedGraph;
  view: GraphView;
  adj: Record<GraphView, Map<string, Neighbor[]>>;
  byId: Map<string, UNode>;
  onSelect: (id: string | null) => void;
}) {
  const close = (
    <button className="icon-btn -mr-1 -mt-1" onClick={() => onSelect(null)} aria-label="Clear selection">
      <X size={15} />
    </button>
  );

  if (n.kind === "company") {
    const c = data.companies[n.slug!];
    return <CompanyInspector c={c} close={close} data={data} byId={byId} onSelect={onSelect} />;
  }

  // Hubs: list the companies around them in this lens.
  const nbs = (adj[view].get(n.id) ?? [])
    .filter((x) => x.id.startsWith("c:"))
    .map((x) => ({ ...x, c: data.companies[x.id.slice(2)] }))
    .filter((x) => x.c)
    .sort((a, b) => b.c.score - a.c.score);
  const heading =
    n.kind === "org"
      ? `${nbs.length} ${nbs.length === 1 ? "company" : "companies"} founded by alumni`
      : n.kind === "investor"
        ? `${nbs.length} tracked ${nbs.length === 1 ? "company" : "companies"} in portfolio`
        : `${nbs.length} companies`;
  const totalVal = nbs.reduce((s, x) => s + (x.c.valuation ?? 0), 0);

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <NodeIcon n={n} size={40} />
          <div>
            <div className="text-[11.5px] font-medium text-muted">{n.kind === "org" ? "Founder origin" : n.kind === "investor" ? n.subtitle : "Sector"}</div>
            <h3 className="text-[17px] font-semibold leading-tight tracking-[-0.02em]">{n.label}</h3>
          </div>
        </div>
        {close}
      </div>
      {n.kind === "sector" && <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{SECTOR_META[n.sector!].blurb}</p>}
      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-[var(--border)]">
        <MiniStat label={n.kind === "investor" ? "Portfolio" : "Companies"} value={String(nbs.length)} />
        <MiniStat label="Combined valuation" value={totalVal ? formatUsd(totalVal) : "—"} />
      </div>
      <div className="mb-1.5 mt-5 text-[12px] font-medium text-muted">{heading}</div>
      <ul className="-mx-1.5">
        {nbs.map(({ id, c, label, kind }) => (
          <li key={id}>
            <button className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-surface-2" onClick={() => onSelect(id)}>
              <Monogram name={c.name} sector={c.sector} size={28} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                  {c.name}
                  {kind === "lead" && <span className="rounded bg-surface-3 px-1 text-[10px] font-semibold text-ink-2">LEAD</span>}
                </div>
                <div className="truncate text-[11.5px] text-muted">{label ? `via ${label}` : n.kind === "sector" ? c.description : SECTOR_META[c.sector].label}</div>
              </div>
              <span className="tabular text-[12px] text-ink-2">{c.valuation ? formatUsd(c.valuation) : c.raised ? formatUsd(c.raised) : "—"}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CompanyInspector({
  c,
  close,
  data,
  byId,
  onSelect,
}: {
  c: CompanyInfo;
  close: React.ReactNode;
  data: UnifiedGraph;
  byId: Map<string, UNode>;
  onSelect: (id: string | null) => void;
}) {
  const origins = c.orgs.map((p) => (data.companies[p] ? `c:${p}` : `o:${p}`)).filter((id) => data.names[id]);
  const leads = new Set(c.leads);
  const investors = [...c.investors].sort((a, b) => Number(leads.has(b)) - Number(leads.has(a))).map((s) => `i:${s}`);
  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Monogram name={c.name} sector={c.sector} size={44} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: sectorColor(c.sector) }} />
              {SECTOR_META[c.sector].label}
            </div>
            <h3 className="truncate text-[18px] font-semibold leading-tight tracking-[-0.02em]">{c.name}</h3>
          </div>
        </div>
        {close}
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{c.description}</p>
      <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-[var(--border)]">
        <MiniStat label="Valuation" value={formatUsd(c.valuation)} />
        <MiniStat label="Raised" value={formatUsd(c.raised)} />
        <MiniStat label="Signal" value={String(c.score)} />
      </div>
      <div className="mt-4 flex gap-2">
        <Link href={`/companies/${c.slug}/`} className="btn btn-primary flex-1">
          Open profile <ArrowUpRight size={14} />
        </Link>
        <div className="btn btn-secondary px-1.5">
          <StarButton slug={c.slug} withLabel />
        </div>
      </div>
      <ChipGroup title="Founders came from" ids={origins} data={data} byId={byId} onSelect={onSelect} empty="No founder background recorded yet." />
      <ChipGroup title="Backed by" ids={investors} data={data} byId={byId} onSelect={onSelect} lead={leads} empty="No investors recorded yet." />
      {c.related.length > 0 && <ChipGroup title="Related" ids={c.related.map((r) => `c:${r}`)} data={data} byId={byId} onSelect={onSelect} />}
    </div>
  );
}

function ChipGroup({
  title,
  ids,
  data,
  byId,
  onSelect,
  lead,
  empty,
}: {
  title: string;
  ids: string[];
  data: UnifiedGraph;
  byId: Map<string, UNode>;
  onSelect: (id: string) => void;
  lead?: Set<string>;
  empty?: string;
}) {
  return (
    <div className="mt-5">
      <div className="mb-2 text-[12px] font-medium text-muted">{title}</div>
      {ids.length === 0 ? (
        <div className="text-[12.5px] text-faint">{empty}</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {ids.map((id) => {
            const node = byId.get(id);
            const isLead = lead?.has(id.slice(2));
            const cls = `inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium ${isLead ? "border-line-strong text-ink" : "border-line text-ink-2"}`;
            const name = data.names[id] ?? id.slice(2);
            return node ? (
              <button key={id} className={`${cls} transition-colors hover:border-line-strong hover:bg-surface-2 hover:text-ink`} onClick={() => onSelect(id)}>
                {node.kind === "company" && <span className="h-1.5 w-1.5 rounded-full" style={{ background: sectorColor(node.sector!) }} />}
                {name}
                {isLead && <span className="text-[10px] text-muted">lead</span>}
              </button>
            ) : (
              <span key={id} className={cls} title="Backs only one tracked company, so it isn't a graph hub">
                {name}
                {isLead && <span className="text-[10px] text-muted">lead</span>}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-3 py-2.5">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="tabular mt-0.5 text-[15px] font-semibold tracking-[-0.01em]">{value}</div>
    </div>
  );
}

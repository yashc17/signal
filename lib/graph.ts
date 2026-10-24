// Build-time knowledge graph: three views over the same entities, each with a precomputed layout.
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { circular } from "graphology-layout";
import noverlap from "graphology-layout-noverlap";
import type { Dataset } from "./data";
import { SECTOR_META } from "./meta";
import type { Sector } from "./schema";

export type GraphView = "lineage" | "capital" | "sector";

export type GNode = {
  id: string;
  label: string;
  kind: "company" | "org" | "investor" | "sector" | "tag";
  track?: "research" | "applied";
  sector?: Sector;
  size: number;
  x: number;
  y: number;
  /** For companies: slug for linking. For hubs: count of connected companies. */
  slug?: string;
  count?: number;
  subtitle?: string;
};
export type GEdge = { source: string; target: string; weight: number; kind: string; label?: string };
export type GraphPayload = { view: GraphView; nodes: GNode[]; edges: GEdge[] };

function companySize(capital: number | null) {
  // $10M → ~4px, $1B → ~10px, $50B → ~16px
  if (!capital) return 3.5;
  return Math.max(3.5, Math.min(18, (Math.log10(capital) - 6.5) * 3.2 + 4));
}

function addCompanies(g: Graph, ds: Dataset) {
  for (const c of ds.companies) {
    g.addNode(`c:${c.slug}`, {
      label: c.name,
      kind: "company",
      track: c.track,
      sector: c.sector,
      slug: c.slug,
      size: companySize(c.latestValuation ?? c.totalRaised),
      subtitle: `${c.track === "research" ? "Research lab" : "Applied"} · ${SECTOR_META[c.sector].label}`,
    });
  }
}

function layout(g: Graph, seedSalt: number) {
  g.forEachNode((n) => {
    if (g.degree(n) === 0) g.dropNode(n);
  });
  circular.assign(g, { scale: 100 });
  // Deterministic jitter so hubs don't start collinear.
  let i = seedSalt;
  g.forEachNode((n, a) => {
    i = (i * 9301 + 49297) % 233280;
    g.mergeNodeAttributes(n, { x: a.x + (i / 233280 - 0.5) * 20, y: a.y + ((i * 7) % 233280) / 233280 - 0.5 });
  });
  const settings = forceAtlas2.inferSettings(g);
  forceAtlas2.assign(g, {
    iterations: 900,
    settings: { ...settings, gravity: 0.6, scalingRatio: 6, linLogMode: true, barnesHutOptimize: g.order > 300, outboundAttractionDistribution: true },
    getEdgeWeight: "weight",
  });
  // Push apart overlapping discs so every node stays hoverable.
  noverlap.assign(g, { maxIterations: 300, settings: { margin: 2, ratio: 1.15, expansion: 1.1 } });
}

function toPayload(view: GraphView, g: Graph): GraphPayload {
  // Isolated nodes carry no relationship information; the company pages still list them.
  const nodes: GNode[] = [];
  g.forEachNode((id, a) => {
    if (g.degree(id) === 0) return;
    nodes.push({ id, ...(a as Omit<GNode, "id">), x: Math.round(a.x * 100) / 100, y: Math.round(a.y * 100) / 100 });
  });
  const edges: GEdge[] = [];
  g.forEachEdge((_e, a, s, t) => edges.push({ source: s, target: t, weight: a.weight, kind: a.kind, label: a.label }));
  return { view, nodes, edges };
}

function upsertEdge(g: Graph, s: string, t: string, kind: string, w: number, label?: string) {
  if (g.hasEdge(s, t)) {
    g.updateEdgeAttribute(s, t, "weight", (x: number) => x + w);
    if (label) g.updateEdgeAttribute(s, t, "label", (x: string | undefined) => (x ? `${x}, ${label}` : label));
  } else g.addEdge(s, t, { kind, weight: w, label });
}

/** Talent lineage: where founders came from. Company ↔ prior org (weighted by # founders). */
export function buildLineage(ds: Dataset): GraphPayload {
  const g = new Graph({ type: "undirected" });
  addCompanies(g, ds);
  for (const c of ds.companies) {
    for (const f of c.founders) {
      for (const p of f.prev) {
        if (ds.companyBySlug.has(p)) {
          upsertEdge(g, `c:${c.slug}`, `c:${p}`, "alumni", 1, f.name);
          continue;
        }
        const org = ds.orgBySlug.get(p);
        if (!org) continue;
        const id = `o:${p}`;
        if (!g.hasNode(id)) g.addNode(id, { label: org.name, kind: "org", size: 4, subtitle: org.kind.replace("-", " ") });
        upsertEdge(g, `c:${c.slug}`, id, "alumni", 1, f.name);
      }
    }
  }
  g.forEachNode((n, a) => {
    if (a.kind === "org") {
      const companies = g.degree(n);
      g.mergeNodeAttributes(n, { count: companies, size: Math.min(22, 4 + Math.sqrt(companies) * 3.2) });
    }
  });
  layout(g, 1);
  return toPayload("lineage", g);
}

/** Capital: who funds whom. Investors appear when they back 2+ tracked companies. */
export function buildCapital(ds: Dataset): GraphPayload {
  const g = new Graph({ type: "undirected" });
  addCompanies(g, ds);
  const portfolio = new Map<string, Set<string>>();
  for (const c of ds.companies)
    for (const s of c.allInvestors) portfolio.set(s, (portfolio.get(s) ?? new Set()).add(c.slug));
  for (const [inv, cos] of portfolio) {
    if (cos.size < 2) continue;
    const meta = ds.investorBySlug.get(inv);
    g.addNode(`i:${inv}`, {
      label: meta?.name ?? inv,
      kind: "investor",
      count: cos.size,
      size: Math.min(20, 3.5 + Math.sqrt(cos.size) * 3),
      subtitle: meta ? `Tier ${meta.tier} · ${meta.kind}` : "investor",
    });
  }
  for (const c of ds.companies) {
    const leads = new Set(c.rounds.flatMap((r) => r.lead));
    for (const s of c.allInvestors) {
      if (!g.hasNode(`i:${s}`)) continue;
      upsertEdge(g, `c:${c.slug}`, `i:${s}`, leads.has(s) ? "lead" : "investor", leads.has(s) ? 2 : 1);
    }
  }
  layout(g, 2);
  return toPayload("capital", g);
}

/** Sectors: each sector is laid out as its own island (sub-clustered by shared tags), then islands are
 *  arranged around the largest one like a map. Hidden sector hubs keep "who's in this sector" queryable. */
export function buildSector(ds: Dataset): GraphPayload {
  const nodes: GNode[] = [];
  const edges: GEdge[] = [];
  const islands: { sector: Sector; g: Graph; r: number }[] = [];
  for (const sector of Object.keys(SECTOR_META) as Sector[]) {
    const cos = ds.companies.filter((c) => c.sector === sector);
    if (!cos.length) continue;
    const g = new Graph({ type: "undirected" });
    addCompanies(g, { ...ds, companies: cos });
    const tagCount = new Map<string, number>();
    for (const c of cos) for (const t of c.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
    for (const c of cos) {
      for (const t of c.tags) {
        if ((tagCount.get(t) ?? 0) < 2) continue;
        if (!g.hasNode(`t:${t}`)) g.addNode(`t:${t}`, { kind: "tag", label: t, size: 1 });
        upsertEdge(g, `c:${c.slug}`, `t:${t}`, "tag", 1);
      }
      for (const r of c.related) if (g.hasNode(`c:${r}`) && r !== c.slug) upsertEdge(g, `c:${c.slug}`, `c:${r}`, "related", 1.5);
    }
    // Lone companies still need a spring so the island stays compact.
    g.addNode("hub", { kind: "tag", size: 1 });
    for (const c of cos) upsertEdge(g, `c:${c.slug}`, "hub", "sector", 0.6);
    circular.assign(g, { scale: 50 });
    forceAtlas2.assign(g, {
      iterations: 600,
      settings: { ...forceAtlas2.inferSettings(g), gravity: 1.2, scalingRatio: 4, linLogMode: true },
      getEdgeWeight: "weight",
    });
    g.dropNode("hub");
    g.forEachNode((n, a) => a.kind === "tag" && g.dropNode(n));
    noverlap.assign(g, { maxIterations: 600, settings: { margin: 5, ratio: 2.1, expansion: 1.08 } });
    // Re-center and measure the island.
    let cx = 0;
    let cy = 0;
    g.forEachNode((_n, a) => {
      cx += a.x / g.order;
      cy += a.y / g.order;
    });
    let r = 0;
    g.forEachNode((n, a) => {
      g.mergeNodeAttributes(n, { x: a.x - cx, y: a.y - cy });
      r = Math.max(r, Math.hypot(a.x - cx, a.y - cy) + a.size);
    });
    islands.push({ sector, g, r: Math.max(r, 30) });
  }

  // Largest island in the middle, the rest on a ring around it.
  islands.sort((a, b) => b.g.order - a.g.order);
  const [core, ...ring] = islands;
  const gap = core.r * 0.35;
  const ringR = core.r + gap + Math.max(...ring.map((i) => i.r));
  const centers = new Map<Sector, [number, number]>([[core.sector, [0, 0]]]);
  ring.forEach((isl, i) => {
    const a = -Math.PI / 2 + (i / ring.length) * Math.PI * 2;
    centers.set(isl.sector, [Math.cos(a) * ringR, Math.sin(a) * ringR]);
  });

  for (const { sector, g, r } of islands) {
    const [ox, oy] = centers.get(sector)!;
    g.forEachNode((id, a) => nodes.push({ id, ...(a as Omit<GNode, "id" | "x" | "y">), x: a.x + ox, y: a.y + oy }));
    nodes.push({ id: `s:${sector}`, label: SECTOR_META[sector].label, kind: "sector", sector, size: 1, x: ox, y: oy, count: g.order, subtitle: `${Math.round(r)}` });
    g.forEachNode((id) => edges.push({ source: id, target: `s:${sector}`, weight: 1, kind: "sector" }));
  }
  // Competitor/sibling links, including the ones that cross islands.
  const seen = new Set<string>();
  for (const c of ds.companies)
    for (const r of c.related) {
      const key = [c.slug, r].sort().join("|");
      if (!ds.companyBySlug.has(r) || r === c.slug || seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: `c:${c.slug}`, target: `c:${r}`, weight: 1.5, kind: "related" });
    }
  return { view: "sector", nodes, edges };
}

export function buildAllGraphs(ds: Dataset) {
  return { lineage: buildLineage(ds), capital: buildCapital(ds), sector: buildSector(ds) };
}

/* ---------- Unified graph: one node set, a position per lens, so the client can morph between lenses. ---------- */

export const VIEWS: GraphView[] = ["lineage", "capital", "sector"];
const EXTENT = 1000;

export type UNode = Omit<GNode, "x" | "y"> & { pos: Partial<Record<GraphView, [number, number]>> };
export type UEdge = { s: string; t: string; v: GraphView; kind: string; w: number; label?: string };
export type CompanyInfo = {
  slug: string;
  name: string;
  track: "research" | "applied";
  sector: Sector;
  stage: string;
  description: string;
  raised: number | null;
  valuation: number | null;
  score: number;
  orgs: string[];
  investors: string[];
  leads: string[];
  related: string[];
};
export type UnifiedGraph = {
  nodes: UNode[];
  edges: UEdge[];
  /** Center and radius of each sector island in the sector lens, for territory labels. */
  centroids: Partial<Record<Sector, [number, number, number]>>;
  companies: Record<string, CompanyInfo>;
  names: Record<string, string>;
};

/** Center each layout and scale it into the same [-EXTENT, EXTENT] box so lenses share one camera. */
function normalize(p: GraphPayload) {
  const xs = p.nodes.map((n) => n.x);
  const ys = p.nodes.map((n) => n.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const half = Math.max(Math.max(...xs) - cx, Math.max(...ys) - cy) || 1;
  const k = EXTENT / half;
  return new Map(p.nodes.map((n) => [n.id, [Math.round((n.x - cx) * k * 10) / 10, Math.round((n.y - cy) * k * 10) / 10] as [number, number]]));
}

export function buildUnifiedGraph(ds: Dataset): UnifiedGraph {
  const payloads = buildAllGraphs(ds);
  const nodes = new Map<string, UNode>();
  const edges: UEdge[] = [];
  for (const v of VIEWS) {
    const p = payloads[v];
    const pos = normalize(p);
    for (const { x: _x, y: _y, ...n } of p.nodes) {
      const u = nodes.get(n.id) ?? { ...n, pos: {} };
      u.pos[v] = pos.get(n.id)!;
      nodes.set(n.id, u);
    }
    for (const e of p.edges) edges.push({ s: e.source, t: e.target, v, kind: e.kind, w: e.weight, label: e.label });
  }

  const centroids: UnifiedGraph["centroids"] = {};
  for (const s of Object.keys(SECTOR_META) as Sector[]) {
    const hub = nodes.get(`s:${s}`);
    if (!hub?.pos.sector) continue;
    const [cx, cy] = hub.pos.sector;
    let r = 0;
    for (const n of nodes.values())
      if (n.kind === "company" && n.sector === s && n.pos.sector) r = Math.max(r, Math.hypot(n.pos.sector[0] - cx, n.pos.sector[1] - cy));
    centroids[s] = [cx, cy, Math.round(r)];
  }

  const companies: UnifiedGraph["companies"] = {};
  for (const c of ds.companies) {
    companies[c.slug] = {
      slug: c.slug,
      name: c.name,
      track: c.track,
      sector: c.sector,
      stage: c.stage,
      description: c.description,
      raised: c.totalRaised,
      valuation: c.latestValuation,
      score: c.score,
      orgs: [...new Set(c.founders.flatMap((f) => f.prev))],
      investors: c.allInvestors,
      leads: [...new Set(c.rounds.flatMap((r) => r.lead))],
      related: c.related.filter((r) => ds.companyBySlug.has(r)),
    };
  }
  const names: Record<string, string> = {};
  for (const o of ds.orgs) names[`o:${o.slug}`] = o.name;
  for (const i of ds.investors) names[`i:${i.slug}`] = i.name;
  for (const c of ds.companies) names[`c:${c.slug}`] = c.name;

  return { nodes: [...nodes.values()], edges, centroids, companies, names };
}

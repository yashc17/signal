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

/** Sectors: companies around sector hubs, sub-clustered by shared tags, plus explicit "related" links. */
export function buildSector(ds: Dataset): GraphPayload {
  const g = new Graph({ type: "undirected" });
  addCompanies(g, ds);
  for (const [s, meta] of Object.entries(SECTOR_META)) {
    g.addNode(`s:${s}`, { label: meta.label, kind: "sector", sector: s, size: 16, subtitle: meta.blurb });
  }
  const tagCount = new Map<string, number>();
  for (const c of ds.companies) for (const t of c.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  for (const c of ds.companies) {
    upsertEdge(g, `c:${c.slug}`, `s:${c.sector}`, "sector", 3);
    for (const t of c.tags) {
      if ((tagCount.get(t) ?? 0) < 3) continue;
      const id = `t:${t}`;
      if (!g.hasNode(id)) g.addNode(id, { label: `#${t}`, kind: "tag", size: 3 + Math.sqrt(tagCount.get(t)!) * 1.5, count: tagCount.get(t) });
      upsertEdge(g, `c:${c.slug}`, id, "tag", 1);
    }
    for (const r of c.related) if (ds.companyBySlug.has(r) && r !== c.slug) upsertEdge(g, `c:${c.slug}`, `c:${r}`, "related", 1.5);
  }
  layout(g, 3);
  return toPayload("sector", g);
}

export function buildAllGraphs(ds: Dataset) {
  return { lineage: buildLineage(ds), capital: buildCapital(ds), sector: buildSector(ds) };
}

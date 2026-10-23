// Build-time data loader. Server-only: reads YAML from /data, validates, and derives fields.
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import {
  CompanySchema,
  InvestorSchema,
  OrgSchema,
  type Company,
  type Investor,
  type Org,
  type Round,
} from "./schema";

const DATA_DIR = path.join(process.cwd(), "data");

export type ScoreBreakdown = { capital: number; valuation: number; investors: number; founders: number; momentum: number };

export type EnrichedCompany = Company & {
  slug: string;
  totalRaised: number | null;
  latestValuation: number | null;
  latestValuationDate: string | null;
  lastRound: Round | null;
  score: number;
  breakdown: ScoreBreakdown;
  reasons: string[];
  /** Facts without a source URL — the refinement queue. */
  unsourced: number;
  allInvestors: string[];
};

export type Dataset = {
  companies: EnrichedCompany[];
  orgs: Org[];
  investors: Investor[];
  orgBySlug: Map<string, Org>;
  investorBySlug: Map<string, Investor>;
  companyBySlug: Map<string, EnrichedCompany>;
  generatedAt: string;
};

function readYaml(file: string): unknown {
  return YAML.parse(fs.readFileSync(file, "utf8"));
}

export function loadRaw() {
  const errors: string[] = [];
  const companies: (Company & { slug: string })[] = [];
  const dir = path.join(DATA_DIR, "companies");
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".yaml")).sort()) {
    const slug = f.replace(/\.yaml$/, "");
    const parsed = CompanySchema.safeParse(readYaml(path.join(dir, f)));
    if (!parsed.success) {
      errors.push(`data/companies/${f}:\n  ${z.prettifyError(parsed.error).split("\n").join("\n  ")}`);
      continue;
    }
    companies.push({ ...parsed.data, slug });
  }
  const orgs = z.array(OrgSchema).parse(readYaml(path.join(DATA_DIR, "orgs.yaml")));
  const investors = z.array(InvestorSchema).parse(readYaml(path.join(DATA_DIR, "investors.yaml")));
  return { companies, orgs, investors, errors };
}

const log10 = Math.log10;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const monthsBetween = (a: string, b: Date) => {
  const [y, m] = a.split("-").map(Number);
  return (b.getFullYear() - y) * 12 + (b.getMonth() + 1 - m);
};

function enrich(
  c: Company & { slug: string },
  orgBySlug: Map<string, Org>,
  investorBySlug: Map<string, Investor>,
  companySlugs: Set<string>,
  now: Date,
): EnrichedCompany {
  const rounds = [...c.rounds].sort((a, b) => a.date.localeCompare(b.date));
  const summed = rounds.filter((r) => r.type !== "debt").reduce((s, r) => s + (r.amount ?? 0), 0);
  const totalRaised = c.total_raised ?? (summed > 0 ? summed : null);
  const lastRound = rounds.at(-1) ?? null;

  const valued = rounds.filter((r) => r.valuation != null);
  let latestValuation: number | null = valued.at(-1)?.valuation ?? null;
  let latestValuationDate: string | null = valued.at(-1)?.date ?? null;
  if (c.valuation != null && (!latestValuationDate || (c.valuation_date ?? "9999") >= latestValuationDate)) {
    latestValuation = c.valuation;
    latestValuationDate = c.valuation_date ?? latestValuationDate;
  }

  const leads = new Set(rounds.flatMap((r) => r.lead));
  const allInvestors = [...new Set(rounds.flatMap((r) => [...r.lead, ...r.investors]))];
  const reasons: string[] = [];

  // Capital: $1M → 0, $1B+ → 30 (log scale)
  // No disclosed rounds but a reported valuation (e.g. DeepSeek, stealthy neolabs): assume ~10% was raised.
  const capitalBase = totalRaised ?? (latestValuation ? latestValuation * 0.1 : null);
  const capital = capitalBase ? clamp(((log10(capitalBase) - 6) / 3) * 30, 0, 30) : 0;
  if (!totalRaised && latestValuation) reasons.push("Capital estimated from valuation (no disclosed rounds)");
  // Valuation: $100M → 0, $10B+ → 15
  const valuation = latestValuation ? clamp(((log10(latestValuation) - 8) / 2) * 15, 0, 15) : 0;
  if (totalRaised && totalRaised >= 1e8) reasons.push(`Raised ${fmt(totalRaised)}`);
  if (latestValuation && latestValuation >= 1e9) reasons.push(`Valued at ${fmt(latestValuation)}`);

  // Investors: tier-1 leads weigh most
  let inv = 0;
  const t1 = new Set<string>();
  for (const s of allInvestors) {
    const i = investorBySlug.get(s);
    if (!i) continue;
    const isLead = leads.has(s);
    if (i.tier === 1) {
      inv += isLead ? 8 : 4;
      t1.add(i.name);
    } else if (i.tier === 2) inv += isLead ? 3 : 1.5;
  }
  const investors = clamp(inv, 0, 20);
  if (t1.size) reasons.push(`Tier-1 backers: ${[...t1].slice(0, 3).join(", ")}${t1.size > 3 ? ` +${t1.size - 3}` : ""}`);

  // Founders: alumni of pedigree orgs (frontier labs, top research groups, standout companies)
  const pedigreeOrgs = new Set<string>();
  let pedigreeFounders = 0;
  for (const f of c.founders) {
    const hits = f.prev.filter((p) => orgBySlug.get(p)?.pedigree || companySlugs.has(p));
    if (hits.length) pedigreeFounders++;
    hits.forEach((h) => pedigreeOrgs.add(orgBySlug.get(h)?.name ?? h));
  }
  const founders = clamp(pedigreeFounders * 10, 0, 25);
  if (pedigreeOrgs.size) reasons.push(`Founders from ${[...pedigreeOrgs].slice(0, 3).join(", ")}`);

  // Momentum: raised recently
  const age = lastRound ? monthsBetween(lastRound.date, now) : 999;
  const momentum = age <= 12 ? 10 : age <= 24 ? 5 : 0;
  if (age <= 6) reasons.push("Raised in the last 6 months");

  const breakdown = { capital, valuation, investors, founders, momentum };
  const score = Math.round(capital + valuation + investors + founders + momentum);

  const unsourced =
    rounds.filter((r) => !r.source).length +
    c.events.filter((e) => !e.source).length +
    (c.valuation != null && !c.valuation_source && c.sources.length === 0 ? 1 : 0);

  return {
    ...c,
    rounds,
    totalRaised,
    latestValuation,
    latestValuationDate,
    lastRound,
    score,
    breakdown,
    reasons,
    unsourced,
    allInvestors,
  };
}

function fmt(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace(/\.0$/, "")}B`;
  return `$${Math.round(n / 1e6)}M`;
}

let cache: Dataset | null = null;

export function getDataset(): Dataset {
  if (cache) return cache;
  const { companies, orgs, investors, errors } = loadRaw();
  if (errors.length) throw new Error(`Invalid data files:\n${errors.join("\n")}`);
  const orgBySlug = new Map(orgs.map((o) => [o.slug, o]));
  const investorBySlug = new Map(investors.map((i) => [i.slug, i]));
  const companySlugs = new Set(companies.map((c) => c.slug));
  const now = new Date();
  const enriched = companies
    .map((c) => enrich(c, orgBySlug, investorBySlug, companySlugs, now))
    .sort((a, b) => b.score - a.score);
  cache = {
    companies: enriched,
    orgs,
    investors,
    orgBySlug,
    investorBySlug,
    companyBySlug: new Map(enriched.map((c) => [c.slug, c])),
    generatedAt: now.toISOString(),
  };
  return cache;
}

/** Resolve a `prev` slug to a display name (org or tracked company). */
export function nameOf(ds: Dataset, slug: string): string {
  return ds.orgBySlug.get(slug)?.name ?? ds.companyBySlug.get(slug)?.name ?? ds.investorBySlug.get(slug)?.name ?? slug;
}

/** Slim, serializable row for client-side tables/charts. */
export function toRow(c: EnrichedCompany) {
  return {
    slug: c.slug,
    name: c.name,
    track: c.track,
    sector: c.sector,
    tags: c.tags,
    stage: c.stage,
    hq: c.hq,
    founded: c.founded ?? null,
    description: c.description,
    totalRaised: c.totalRaised,
    valuation: c.latestValuation,
    lastRoundDate: c.lastRound?.date ?? null,
    lastRoundType: c.lastRound?.type ?? null,
    lastRoundAmount: c.lastRound?.amount ?? null,
    score: c.score,
    reasons: c.reasons,
    founders: c.founders.map((f) => f.name),
    investors: c.allInvestors,
    internships: c.internships,
    careers: c.links.careers ?? null,
    website: c.website ?? null,
  };
}
export type CompanyRow = ReturnType<typeof toRow>;

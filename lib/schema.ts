import { z } from "zod";

/**
 * The data contract for Signal. Every company lives in data/companies/<slug>.yaml
 * and must parse against `CompanySchema`. Run `npm run validate` before opening a PR.
 */

export const TRACKS = ["research", "applied"] as const;

export const SECTORS = [
  "frontier-models",
  "world-models-media",
  "physical-ai",
  "science",
  "coding-devtools",
  "infra-compute",
  "vertical-apps",
  "defense-security",
] as const;

export const STAGES = [
  "stealth",
  "pre-seed",
  "seed",
  "series-a",
  "series-b",
  "series-c",
  "series-d",
  "growth",
  "acquired",
  "public",
  "nonprofit",
] as const;

export const ROUND_TYPES = [
  "pre-seed",
  "seed",
  "series-a",
  "series-b",
  "series-c",
  "series-d",
  "series-e",
  "series-f",
  "series-g",
  "series-h",
  "growth",
  "strategic",
  "debt",
  "grant",
  "undisclosed",
] as const;

/** confirmed = company/primary announcement; reported = credible press; estimate = tracker/aggregator */
export const CONFIDENCE = ["confirmed", "reported", "estimate"] as const;

/** Accepts 300000000, "300M", "$1.1B", "850k". Returns USD as a number. */
export const Money = z.union([z.number(), z.string()]).transform((v, ctx) => {
  if (typeof v === "number") return v;
  const m = v.trim().replace(/[$,\s]/g, "").match(/^(\d+(?:\.\d+)?)([kKmMbBtT]?)$/);
  if (!m) {
    ctx.addIssue({ code: "custom", message: `Unparseable money value "${v}" (use e.g. 300M or 1.1B)` });
    return z.NEVER;
  }
  const mult = { "": 1, k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[m[2].toLowerCase() as "" | "k" | "m" | "b" | "t"];
  return Number(m[1]) * mult;
});

/** "2025-09" or "2025-09-14" (YAML may hand us a Date for full dates). */
const YearMonth = z.union([z.string(), z.date()]).transform((v, ctx) => {
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : v;
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(s)) {
    ctx.addIssue({ code: "custom", message: `Date "${s}" must be YYYY-MM or YYYY-MM-DD` });
    return z.NEVER;
  }
  return s;
});

const Url = z.string().url();
const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slugs are lowercase-kebab-case");

export const FounderSchema = z.object({
  name: z.string(),
  /** Slugs from data/orgs.yaml or other company slugs — this is what powers the lineage graph. */
  prev: z.array(Slug).default([]),
  role: z.string().optional(),
  note: z.string().optional(),
});

export const RoundSchema = z.object({
  date: YearMonth,
  type: z.enum(ROUND_TYPES),
  amount: Money.optional(),
  valuation: Money.optional(),
  /** Investor slugs from data/investors.yaml (unknown slugs are allowed but flagged by validate). */
  lead: z.array(Slug).default([]),
  investors: z.array(Slug).default([]),
  confidence: z.enum(CONFIDENCE).default("reported"),
  source: Url.nullable().optional(),
});

export const EventSchema = z.object({
  date: YearMonth,
  type: z.enum(["acquisition", "merger", "ipo", "launch", "talks", "departure", "other"]),
  text: z.string(),
  with: Slug.optional(),
  source: Url.nullable().optional(),
});

export const CompanySchema = z.object({
  name: z.string(),
  track: z.enum(TRACKS),
  sector: z.enum(SECTORS),
  tags: z.array(Slug).default([]),
  description: z.string(),
  website: Url.optional(),
  hq: z.string(),
  founded: z.number().int().min(1990).max(2100).optional(),
  stage: z.enum(STAGES),
  /** Latest known post-money valuation, if any. Rounds also carry valuations. */
  valuation: Money.optional(),
  valuation_date: YearMonth.optional(),
  valuation_confidence: z.enum(CONFIDENCE).optional(),
  valuation_source: Url.nullable().optional(),
  /** Total disclosed capital raised, when known better than the sum of listed rounds. */
  total_raised: Money.optional(),
  founders: z.array(FounderSchema).default([]),
  rounds: z.array(RoundSchema).default([]),
  events: z.array(EventSchema).default([]),
  /** Related companies (competitors, spinouts, siblings). Symmetric in the graph. */
  related: z.array(Slug).default([]),
  links: z
    .object({
      careers: Url.optional(),
      linkedin: Url.optional(),
      x: Url.optional(),
      github: Url.optional(),
    })
    .default({}),
  internships: z.enum(["yes", "no", "unknown"]).default("unknown"),
  /** General sources for the profile (company site, tracker pages, articles). */
  sources: z.array(Url).default([]),
  updated: YearMonth,
});

export const OrgSchema = z.object({
  slug: Slug,
  name: z.string(),
  kind: z.enum(["frontier-lab", "big-tech", "academia", "company", "nonprofit"]),
  /** Pedigree orgs boost the founder signal (frontier labs, top research groups). */
  pedigree: z.boolean().default(false),
});

export const InvestorSchema = z.object({
  slug: Slug,
  name: z.string(),
  kind: z.enum(["vc", "strategic", "angel", "sovereign", "crossover"]).default("vc"),
  /** 1 = top-tier signal, 2 = strong, 3 = everyone else. */
  tier: z.number().int().min(1).max(3).default(3),
});

export type Company = z.infer<typeof CompanySchema>;
export type Founder = z.infer<typeof FounderSchema>;
export type Round = z.infer<typeof RoundSchema>;
export type Org = z.infer<typeof OrgSchema>;
export type Investor = z.infer<typeof InvestorSchema>;
export type Track = (typeof TRACKS)[number];
export type Sector = (typeof SECTORS)[number];
export type Stage = (typeof STAGES)[number];

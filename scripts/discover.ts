// Discovery radar: finds high-signal AI companies that aren't tracked yet.
//
//   npm run discover            → writes data/radar.json (rendered at /radar)
//   npm run discover -- --print → also prints the top candidates
//
// Every source is public and keyless. Signals are deliberately simple and explainable:
// round size, tier-1 investor mentions, frontier-lab founder pedigree, open-weight traction,
// YC top-company status, and how many independent sources mention the company.
// See docs/DISCOVERY.md for the playbook this automates.
import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import { loadRaw } from "../lib/data";

type Evidence = { title: string; url: string; source: string; date?: string };
type Mention = { name: string; source: string; evidence: Evidence; amount?: number; round?: string; signals: string[]; points: number };

const UA = "Mozilla/5.0 (compatible; SignalRadar/0.1; +https://github.com/)";
const now = new Date();

// ---------------------------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------------------------
const { companies, investors } = loadRaw();
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(inc|labs?|ai|technologies|the|co|corp|hq)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
const known = new Set<string>();
for (const c of companies) {
  known.add(norm(c.name));
  known.add(norm(c.slug));
  const paren = c.name.match(/\(([^)]+)\)/)?.[1];
  if (paren) known.add(norm(paren));
  known.add(norm(c.name.replace(/\s*\(.*\)/, "")));
}
// Big companies / frontier labs we never want as candidates.
for (const n of [
  "openai", "anthropic", "google", "deepmind", "meta", "microsoft", "nvidia", "apple", "amazon", "xai", "ibm", "intel", "amd",
  "qwen", "alibaba", "tencent", "baidu", "bytedance", "huggingface", "salesforce", "oracle", "spacex", "tesla", "samsung",
  "stabilityai", "allenai", "ai2", "unsloth", "lmstudio", "mlx", "bartowski", "thebloke", "sentencetransformers", "baai",
  "zai", "zhipu", "moonshot", "minimax", "stepfun", "databricks", "snowflake", "servicenow", "nousresearch", "llmware",
]) known.add(norm(n));

const tier1 = investors.filter((i) => i.tier === 1);
const tier1Patterns = tier1.map((i) => ({
  name: i.name,
  re: new RegExp(`\\b(${[i.name, i.name.replace(/ (Capital|Ventures|Partners)$/, ""), i.slug === "a16z" ? "a16z" : null].filter(Boolean).map((x) => x!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i"),
}));
const PEDIGREE = /\b(ex-|former |alum(?:ni|s)? of |veterans? of |from )(openai|deepmind|google deepmind|anthropic|meta(?: ai| fair)?|xai|google brain|tesla|spacex|stripe|palantir|nvidia)\b|\b(openai|deepmind|anthropic|xai) (?:co-?founder|researchers?|veterans?|alumni|scientists?|executives?)\b/i;
const AI_TERMS = /\b(ai|a\.i\.|artificial intelligence|llm|model|agent|agentic|robot|robotics|humanoid|inference|gpu|autonomous|machine learning|neural|superintelligence|lab)\b/i;

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------
async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

function parseMoney(num: string, unit: string): number | undefined {
  const n = Number(num.replace(/,/g, ""));
  if (!Number.isFinite(n)) return;
  const u = unit.toLowerCase();
  return n * (u.startsWith("b") ? 1e9 : u.startsWith("m") ? 1e6 : u.startsWith("k") ? 1e3 : 1);
}

const ROUND_RE = /\b(pre-seed|seed|series [a-h]|growth round)\b/i;
const FUNDING_RE =
  /^(?:exclusive:\s*)?(.+?)\s+(?:raises|secures|lands|closes|bags|nabs|gets|announces|draws|snags|picks up)\s+(?:a\s+)?(?:record\s+)?(?:new\s+)?(?:about\s+|nearly\s+|over\s+|more than\s+|up to\s+)?[$€£]\s?([\d.,]+)\s*(billion|million|bn|b|m|mn|k)\b/i;

/** Strip descriptors like "AI coding startup", "Ex-OpenAI researchers' new lab" from the subject. */
function cleanName(subject: string): string | null {
  if (/weekly|roundup|round-up|funding news|startups? (?:that )?raised|this week|top \d+/i.test(subject)) return null;
  // "Ex-OpenAI's Kevin Weil's startup" → the company isn't named yet; keep the people as the lead.
  const unnamed = subject.match(/^(.*?)(?:’s|'s)\s+(?:new\s+)?(?:ai\s+)?(?:startup|lab|company|venture)$/i);
  if (unnamed) return `Unnamed startup — ${unnamed[1].replace(/^(?:ex-|former\s+)?[\w-]+(?:’s|'s)\s+/i, "").slice(0, 60)}`;
  let s = subject
    .replace(/^exclusive\s*[|:]\s*/i, "")
    .replace(/^[\w\s.-]+?-backed\s+/i, "")
    .replace(/^.*?(?:’s|'s)\s+(?:new\s+)?(?:ai\s+)?(?:startup|lab|company|venture)\s+/i, "")
    .replace(/^(?:[A-Z][\w.-]*\s?){1,3}(?:’s|'s)\s+(?=[A-Z])/, "")
    .replace(/\s+(?:reportedly|officially|quietly|now|also|just)$/i, "")
    .replace(/^(?:the\s+)?(?:[\w-]+\s+){0,6}?(?:startup|lab|company|maker|platform|firm|developer|provider|unicorn|spinout|spin-out)\s+/i, "")
    .replace(/^(?:ex-|former\s+)[\w\s]+?(?:researchers?|engineers?|founders?|execs?)['’]?s?\s+/i, "")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/[,:;].*$/, "")
    .trim();
  if (s.startsWith("Unnamed startup")) return s;
  // Take the trailing capitalized phrase (company names are usually the last proper noun phrase).
  const m = s.match(/((?:[A-Z0-9][\w.&'’-]*\s?){1,4})$/);
  if (m) s = m[1].trim();
  if (!s || s.length < 2 || s.length > 40) return null;
  if (/^(ai|startup|the|it|this|company|firm|lab)$/i.test(s)) return null;
  if (!/[A-Z0-9]/.test(s[0])) return null;
  return s;
}

function scoreFunding(amount?: number) {
  if (!amount) return 0;
  // $10M → 10, $100M → 25, $1B+ → 40
  return Math.max(0, Math.min(40, (Math.log10(amount) - 6) * 15 - 5));
}

// ---------------------------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------------------------
const xml = new XMLParser({ ignoreAttributes: false });

type RssItem = { title: string; link: string; pubDate?: string; source?: string; description?: string };
async function rss(url: string): Promise<RssItem[]> {
  const doc = xml.parse(await get(url));
  const items = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? [];
  return (Array.isArray(items) ? items : [items]).map((it: Record<string, any>) => ({
    title: String(it.title?.["#text"] ?? it.title ?? ""),
    link: String(it.link?.["@_href"] ?? it.link ?? ""),
    pubDate: it.pubDate ?? it.published ?? it.updated,
    source: typeof it.source === "object" ? it.source?.["#text"] : it.source,
    description: String(it.description ?? it.summary ?? "").replace(/<[^>]+>/g, " "),
  }));
}

function mentionsFromHeadline(it: RssItem, sourceName: string): Mention[] {
  // Google News appends " - Publisher" to titles.
  const title = it.title.replace(/\s+-\s+[^-]+$/, "").trim();
  const text = `${title} ${it.description ?? ""}`;
  const m = title.match(FUNDING_RE);
  if (!m) return [];
  const name = cleanName(m[1]);
  if (!name) return [];
  if (!AI_TERMS.test(text)) return [];
  const amount = parseMoney(m[2], m[3]);
  const signals: string[] = [];
  let points = scoreFunding(amount);
  if (amount) signals.push(`Raised ${amount >= 1e9 ? `$${+(amount / 1e9).toFixed(2)}B` : `$${Math.round(amount / 1e6)}M`}`);
  const round = text.match(ROUND_RE)?.[1];
  if (round) signals.push(round.replace(/\b\w/g, (c) => c.toUpperCase()));
  const t1 = tier1Patterns.filter((p) => p.re.test(text)).map((p) => p.name);
  if (t1.length) {
    points += 15;
    signals.push(`Tier-1: ${t1.slice(0, 3).join(", ")}`);
  }
  const ped = text.match(PEDIGREE);
  if (ped) {
    points += 20;
    signals.push(`Pedigree: ${ped[0].trim()}`);
  }
  // Seed rounds ≥ $20M are unusual and a strong signal of founder quality.
  if (/seed/i.test(round ?? "") && amount && amount >= 2e7) {
    points += 10;
    signals.push("Unusually large seed");
  }
  return [
    {
      name,
      source: sourceName,
      amount,
      round,
      signals,
      points,
      evidence: { title, url: it.link, source: it.source || sourceName, date: it.pubDate ? new Date(it.pubDate).toISOString().slice(0, 10) : undefined },
    },
  ];
}

const NEWS_QUERIES = [
  '"AI" startup raises "Series A"',
  '"AI" startup raises "Series B"',
  '"AI" raises "seed round"',
  "AI lab raises billion valuation",
  "former OpenAI researchers startup raises",
  "ex-DeepMind founders startup raises",
  "robotics startup raises Series",
  "AI agents startup raises led by",
];

async function sourceNews(): Promise<Mention[]> {
  const out: Mention[] = [];
  for (const q of NEWS_QUERIES) {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:30d`)}&hl=en-US&gl=US&ceid=US:en`;
    for (const it of await rss(url)) out.push(...mentionsFromHeadline(it, "Google News"));
  }
  return out;
}

async function sourceTechCrunch(): Promise<Mention[]> {
  const items = await rss("https://techcrunch.com/category/venture/feed/");
  return items.flatMap((it) => mentionsFromHeadline(it, "TechCrunch"));
}

async function sourceValueAdd(): Promise<Mention[]> {
  const items = await rss("https://valueaddvc.com/feed.xml");
  return items.flatMap((it) => mentionsFromHeadline(it, "Value Add VC"));
}

/** Orgs with multiple trending open-weight models are often research labs worth tracking. */
async function sourceHuggingFace(): Promise<Mention[]> {
  const models = JSON.parse(await get("https://huggingface.co/api/models?sort=trendingScore&limit=200")) as { id: string; likes?: number }[];
  const byOrg = new Map<string, { models: string[]; likes: number }>();
  for (const m of models) {
    const org = m.id.split("/")[0];
    const e = byOrg.get(org) ?? { models: [], likes: 0 };
    e.models.push(m.id);
    e.likes += m.likes ?? 0;
    byOrg.set(org, e);
  }
  const out: Mention[] = [];
  for (const [org, e] of byOrg) {
    if (e.models.length < 1 || e.likes < 150) continue;
    // Organizations only (skip individual uploaders / quantizers).
    const res = await fetch(`https://huggingface.co/api/organizations/${org}/overview`, { headers: { "user-agent": UA } }).catch(() => null);
    if (!res?.ok) continue;
    const info = (await res.json()) as { fullname?: string; numFollowers?: number };
    const name = info.fullname || org;
    out.push({
      name,
      source: "Hugging Face",
      signals: [`Trending open weights: ${e.models.slice(0, 2).map((m) => m.split("/")[1]).join(", ")}${e.models.length > 2 ? ` +${e.models.length - 2}` : ""}`],
      points: 12 + Math.min(10, Math.log10(Math.max(10, e.likes)) * 3),
      evidence: { title: `${e.models.length} trending model(s), ${e.likes} likes`, url: `https://huggingface.co/${org}`, source: "Hugging Face" },
    });
  }
  return out;
}

/** YC companies flagged as "top companies" or recent AI companies already scaling. */
async function sourceYC(): Promise<Mention[]> {
  type YC = { name: string; slug: string; one_liner?: string; batch?: string; team_size?: number; top_company?: boolean; isHiring?: boolean; website?: string; status?: string };
  const all = JSON.parse(await get("https://yc-oss.github.io/api/tags/artificial-intelligence.json")) as YC[];
  const year = now.getFullYear();
  const recent = (b?: string) => !!b && [year, year - 1].some((y) => b.includes(String(y)));
  return all
    .filter((c) => c.status !== "Inactive" && c.status !== "Acquired")
    .filter((c) => (c.top_company && (c.team_size ?? 0) >= 20) || (recent(c.batch) && (c.team_size ?? 0) >= 25))
    .map((c) => ({
      name: c.name,
      source: "Y Combinator",
      signals: [c.top_company ? "YC top company" : `Fast-growing ${c.batch} company`, `${c.team_size} people`],
      points: c.top_company ? 14 : 10,
      evidence: { title: `${c.name} — ${c.one_liner ?? ""} (${c.batch})`, url: `https://www.ycombinator.com/companies/${c.slug}`, source: "Y Combinator" },
    }));
}

async function sourceLaunchHN(): Promise<Mention[]> {
  const since = Math.floor(now.getTime() / 1000) - 60 * 86400;
  const data = JSON.parse(
    await get(`https://hn.algolia.com/api/v1/search?query=%22Launch%20HN%22&tags=story&numericFilters=created_at_i>${since},points>120&hitsPerPage=50`),
  ) as { hits: { title: string; objectID: string; points: number; created_at: string }[] };
  return data.hits
    .filter((h) => AI_TERMS.test(h.title))
    .map((h) => {
      const name = h.title.match(/Launch HN:\s*([^(–—:-]+?)\s*(?:\(YC [^)]+\))?\s*[–—:-]/)?.[1]?.trim();
      return name
        ? {
            name,
            source: "Hacker News",
            signals: [`Launch HN · ${h.points} points`],
            points: Math.min(12, h.points / 40),
            evidence: { title: h.title, url: `https://news.ycombinator.com/item?id=${h.objectID}`, source: "Hacker News", date: h.created_at.slice(0, 10) },
          }
        : null;
    })
    .filter(Boolean) as Mention[];
}

// ---------------------------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------------------------
async function main() {
  const sources: [string, () => Promise<Mention[]>][] = [
    ["Google News funding queries", sourceNews],
    ["TechCrunch venture", sourceTechCrunch],
    ["Value Add VC", sourceValueAdd],
    ["Hugging Face trending", sourceHuggingFace],
    ["YC (AI tag)", sourceYC],
    ["Launch HN", sourceLaunchHN],
  ];
  const report: { name: string; ok: boolean; mentions: number; error?: string }[] = [];
  const mentions: Mention[] = [];
  for (const [name, fn] of sources) {
    try {
      const m = await fn();
      mentions.push(...m);
      report.push({ name, ok: true, mentions: m.length });
      console.log(`✓ ${name}: ${m.length} mentions`);
    } catch (e) {
      report.push({ name, ok: false, mentions: 0, error: String(e) });
      console.warn(`✗ ${name}: ${e}`);
    }
  }

  const groups = new Map<string, Mention[]>();
  for (const m of mentions) {
    const k = norm(m.name);
    if (!k || known.has(k)) continue;
    groups.set(k, [...(groups.get(k) ?? []), m]);
  }

  // Merge descriptor-prefixed variants ("Neocloud PaleBlueDot" → "PaleBlueDot").
  const keys = [...groups.keys()].sort((a, b) => a.length - b.length);
  for (const short of keys)
    for (const long of keys)
      if (long !== short && short.length >= 5 && long.endsWith(short) && groups.has(long) && groups.has(short)) {
        groups.set(short, [...groups.get(short)!, ...groups.get(long)!]);
        groups.delete(long);
      }

  const candidates = [...groups.values()]
    .map((ms) => {
      const best = [...ms].sort((a, b) => b.points - a.points)[0];
      const distinctSources = new Set(ms.map((m) => m.evidence.source || m.source));
      const corroboration = Math.min(15, (distinctSources.size - 1) * 5);
      const maxRaise = ms.flatMap((m) => m.signals).filter((s) => s.startsWith("Raised")).sort((a, b) => ms.find((m) => m.signals.includes(b))!.amount! - ms.find((m) => m.signals.includes(a))!.amount!)[0];
      const signals = [...new Set(ms.flatMap((m) => m.signals))].filter((s) => !s.startsWith("Raised") || s === maxRaise);
      if (corroboration) signals.push(`${distinctSources.size} independent sources`);
      const evidence = [...new Map(ms.map((m) => [m.evidence.url, m.evidence])).values()].slice(0, 5);
      return {
        name: best.name,
        score: Math.round(Math.min(100, best.points + corroboration)),
        amount: Math.max(0, ...ms.map((m) => m.amount ?? 0)) || null,
        round: best.round ?? null,
        signals,
        sources: [...new Set(ms.map((m) => m.source))],
        evidence,
      };
    })
    .filter((c) => c.score >= 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, 150);

  const out = { generatedAt: now.toISOString(), sources: report, candidates };
  fs.writeFileSync(path.join(process.cwd(), "data", "radar.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(`\nWrote ${candidates.length} candidates to data/radar.json`);
  if (process.argv.includes("--print"))
    for (const c of candidates.slice(0, 30)) console.log(`${String(c.score).padStart(3)}  ${c.name.padEnd(28)} ${c.signals.join(" · ")}`);
}

main();

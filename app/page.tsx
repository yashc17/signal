import Link from "next/link";
import { HBars } from "@/components/charts/HBars";
import { RoundsTimeline, type RoundPoint } from "@/components/charts/RoundsTimeline";
import { ScoreMeter, SectionTitle, SectorChip, Stat, TrackBadge } from "@/components/ui";
import { getDataset, nameOf } from "@/lib/data";
import { formatMonth, formatUsd, ROUND_LABEL, SECTOR_META } from "@/lib/meta";
import type { Sector } from "@/lib/schema";
import { REPO_URL } from "@/lib/config";

export default function Overview() {
  const ds = getDataset();
  const cos = ds.companies;
  const research = cos.filter((c) => c.track === "research").length;

  const points: RoundPoint[] = cos.flatMap((c) =>
    c.rounds
      .filter((r) => r.amount && r.type !== "debt" && r.type !== "grant")
      .map((r) => ({
        slug: c.slug,
        name: c.name,
        track: c.track,
        date: r.date,
        amount: r.amount!,
        type: r.type,
        lead: r.lead.map((l) => nameOf(ds, l)),
      })),
  );

  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 7);
  const recent = points.filter((p) => p.date >= cutoff);
  const capitalTracked = cos.reduce((s, c) => s + (c.totalRaised ?? 0), 0);
  const unsourced = cos.reduce((s, c) => s + c.unsourced, 0);

  // Capital by sector
  const bySector = new Map<Sector, { value: number; names: string[] }>();
  for (const c of cos) {
    const e = bySector.get(c.sector) ?? { value: 0, names: [] };
    e.value += c.totalRaised ?? 0;
    if (c.totalRaised) e.names.push(c.name);
    bySector.set(c.sector, e);
  }
  const sectorBars = [...bySector.entries()]
    .sort((a, b) => b[1].value - a[1].value)
    .map(([s, e]) => ({
      label: SECTOR_META[s].label,
      value: e.value,
      href: `/companies/?sector=${s}`,
      detail: `${e.names.length} companies with disclosed rounds`,
    }));

  // Where founders come from
  const alumni = new Map<string, Set<string>>();
  for (const c of cos)
    for (const f of c.founders)
      for (const p of f.prev) {
        if (!ds.orgBySlug.get(p)) continue;
        alumni.set(p, (alumni.get(p) ?? new Set()).add(c.name));
      }
  const alumniBars = [...alumni.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 12)
    .map(([slug, names]) => ({ label: nameOf(ds, slug), value: names.size, detail: [...names].slice(0, 8).join(", ") + (names.size > 8 ? "…" : "") }));

  // Most active leads
  const leads = new Map<string, Set<string>>();
  for (const c of cos) for (const r of c.rounds) for (const l of r.lead) leads.set(l, (leads.get(l) ?? new Set()).add(c.name));
  const leadBars = [...leads.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 12)
    .map(([slug, names]) => ({ label: nameOf(ds, slug), value: names.size, detail: [...names].join(", ") }));

  const latest = [...points].sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount).slice(0, 10);

  return (
    <div className="space-y-10">
      <section className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">The high-signal AI startup map</h1>
        <p className="mt-3 text-ink-2">
          Neolabs and applied AI companies that are exceptionally well-funded or founded by people at the top of their field —
          who started them, who backs them, and how they connect. Every number links to a source or is flagged.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Companies tracked" value={String(cos.length)} sub={`${research} research labs · ${cos.length - research} applied`} />
        <Stat label="Disclosed capital" value={formatUsd(capitalTracked)} sub="sum of tracked rounds" />
        <Stat label="Rounds, last 90 days" value={String(recent.length)} sub={formatUsd(recent.reduce((s, p) => s + p.amount, 0))} />
        <a href={`${REPO_URL}/blob/main/CONTRIBUTING.md#verifying-facts`} target="_blank" rel="noreferrer">
          <Stat label="Facts needing a source" value={String(unsourced)} sub="help verify →" />
        </a>
      </section>

      <section className="card p-5">
        <SectionTitle title="Every round, over time" sub="Each dot is a disclosed round. Hover for details; click the legend to isolate a track." />
        <RoundsTimeline points={points} />
      </section>

      <section className="grid items-start gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <SectionTitle title="Where founders come from" sub="Tracked companies with at least one founder from each org" />
          <HBars bars={alumniBars} labelWidth={170} />
        </div>
        <div className="card p-5">
          <SectionTitle title="Most active lead investors" sub="Distinct tracked companies where the firm led a round" />
          <HBars bars={leadBars} labelWidth={170} />
        </div>
      </section>

      <section className="grid items-start gap-6 lg:grid-cols-5">
        <div className="card p-5 lg:col-span-3">
          <SectionTitle title="Capital by sector" sub="Disclosed equity raised, all time" />
          <HBars bars={sectorBars} unit="usd" labelWidth={190} />
        </div>
        <div className="card p-5 lg:col-span-2">
          <SectionTitle title="Latest rounds" right={<Link className="link text-sm" href="/companies/?sort=recent">All →</Link>} />
          <ul className="divide-y divide-[var(--border)]">
            {latest.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <Link href={`/companies/${p.slug}/`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                  <div className="truncate text-xs text-muted">
                    {ROUND_LABEL[p.type]} · {formatMonth(p.date)}
                    {p.lead.length ? ` · led by ${p.lead.join(", ")}` : ""}
                  </div>
                </div>
                <div className="tabular shrink-0 font-medium">{formatUsd(p.amount)}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="card p-5">
        <SectionTitle
          title="Highest signal"
          sub="Score = capital + valuation + tier-1 backers + founder pedigree + momentum. Open a company to see the breakdown."
          right={<Link className="link text-sm" href="/companies/">Explore all →</Link>}
        />
        <div className="grid gap-x-8 sm:grid-cols-2">
          {cos.slice(0, 16).map((c) => (
            <Link key={c.slug} href={`/companies/${c.slug}/`} className="flex items-center justify-between gap-3 border-t border-line py-2.5 hover:bg-surface-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{c.name}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <TrackBadge track={c.track} />
                  <SectorChip sector={c.sector} href={false} />
                </div>
              </div>
              <ScoreMeter score={c.score} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

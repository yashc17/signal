import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { HBars } from "@/components/charts/HBars";
import { RoundsTimeline, type RoundPoint } from "@/components/charts/RoundsTimeline";
import { CompanyCard } from "@/components/CompanyCard";
import { Constellation } from "@/components/Constellation";
import { SearchButton } from "@/components/SearchButton";
import { Container, Monogram, SectionTitle, sectorColor, Stat } from "@/components/ui";
import { REPO_URL } from "@/lib/config";
import { getDataset, nameOf, toRow } from "@/lib/data";
import { buildUnifiedGraph } from "@/lib/graph";
import { formatMonth, formatUsd, ROUND_LABEL, SECTOR_META } from "@/lib/meta";
import type { Sector } from "@/lib/schema";

export default function Overview() {
  const ds = getDataset();
  const cos = ds.companies;
  const research = cos.filter((c) => c.track === "research").length;
  const graph = buildUnifiedGraph(ds);

  const points: RoundPoint[] = cos.flatMap((c) =>
    c.rounds
      .filter((r) => r.amount && r.type !== "debt" && r.type !== "grant")
      .map((r) => ({
        slug: c.slug,
        name: c.name,
        track: c.track,
        sector: c.sector,
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
  const updated = cos.reduce((m, c) => (c.updated > m ? c.updated : m), "");

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
      color: sectorColor(s),
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
    .slice(0, 10)
    .map(([slug, names]) => ({
      label: nameOf(ds, slug),
      value: names.size,
      href: `/graph/?view=lineage&focus=o:${slug}`,
      detail: [...names].slice(0, 8).join(", ") + (names.size > 8 ? "…" : ""),
    }));

  // Most active leads
  const leads = new Map<string, Set<string>>();
  for (const c of cos) for (const r of c.rounds) for (const l of r.lead) leads.set(l, (leads.get(l) ?? new Set()).add(c.name));
  const leadBars = [...leads.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 10)
    .map(([slug, names]) => ({ label: nameOf(ds, slug), value: names.size, href: `/graph/?view=capital&focus=i:${slug}`, detail: [...names].join(", ") }));

  const latest = [...points].sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount).slice(0, 8);
  const sectorTiles = (Object.keys(SECTOR_META) as Sector[])
    .map((s) => ({ s, cos: cos.filter((c) => c.sector === s), raised: bySector.get(s)?.value ?? 0 }))
    .filter((t) => t.cos.length)
    .sort((a, b) => b.cos.length - a.cos.length);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_at_70%_40%,black,transparent_70%)]"
          style={{ backgroundImage: "radial-gradient(var(--dot) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        />
        <Container className="relative grid items-center gap-8 py-14 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div className="animate-fade-up">
            <Link
              href="/radar/"
              className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-[12px] font-medium text-ink-2 shadow-[var(--shadow-sm)] transition-colors hover:text-ink"
            >
              <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] text-page">Updated {formatMonth(updated)}</span>
              {cos.length} companies · {formatUsd(capitalTracked)} tracked
              <ArrowRight size={12} />
            </Link>
            <h1 className="mt-6 text-[44px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[60px]">
              The map of AI&apos;s
              <br />
              <span className="bg-gradient-to-r from-[var(--s1)] via-[var(--s7)] to-[var(--s2)] bg-clip-text text-transparent">highest-signal</span> startups.
            </h1>
            <p className="mt-5 max-w-[520px] text-[17px] leading-relaxed text-ink-2">
              Neolabs and applied AI companies that are exceptionally well-funded or founded by people at the top of their field. See who started
              them, who backs them, and how they all connect.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-2">
              <Link href="/graph/" className="btn btn-primary btn-lg">
                Explore the graph <ArrowRight size={15} />
              </Link>
              <Link href="/companies/" className="btn btn-secondary btn-lg">
                Browse companies
              </Link>
              <SearchButton />
            </div>
          </div>
          <Link
            href="/graph/?view=sector"
            className="group relative mx-auto aspect-square w-full max-w-[540px] animate-fade-up [animation-delay:120ms]"
            aria-label="Open the sector map"
          >
            <Constellation data={graph} />
            <span className="glass absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium opacity-0 transition-opacity group-hover:opacity-100">
              Open the map <ArrowUpRight size={13} />
            </span>
          </Link>
        </Container>
      </section>

      <Container>
        {/* KPIs */}
        <section className="grid grid-cols-2 gap-y-8 border-b border-line py-10 md:grid-cols-4 md:divide-x md:divide-[var(--border)]">
          <div className="md:pr-6">
            <Stat label="Companies tracked" value={String(cos.length)} sub={`${research} research labs · ${cos.length - research} applied`} />
          </div>
          <div className="md:px-6">
            <Stat label="Disclosed capital" value={formatUsd(capitalTracked)} sub="Sum of tracked rounds" />
          </div>
          <div className="md:px-6">
            <Stat label="Rounds, last 90 days" value={String(recent.length)} sub={`${formatUsd(recent.reduce((s, p) => s + p.amount, 0))} raised`} />
          </div>
          <a className="group md:pl-6" href={`${REPO_URL}/blob/main/CONTRIBUTING.md#verifying-facts`} target="_blank" rel="noreferrer">
            <Stat label="Facts needing a source" value={String(unsourced)} sub="Help verify →" />
          </a>
        </section>

        {/* Highest signal */}
        <section className="pt-16">
          <SectionTitle
            title="Highest signal"
            sub="Scored on capital, valuation, tier-1 backers, founder pedigree and momentum."
            right={
              <Link className="btn btn-ghost" href="/companies/">
                View all <ArrowRight size={14} />
              </Link>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cos.slice(0, 6).map((c) => (
              <CompanyCard key={c.slug} c={toRow(c)} />
            ))}
          </div>
        </section>

        {/* Rounds */}
        <section className="card mt-16 p-6">
          <SectionTitle title="Every round, over time" sub="Each dot is a disclosed round, colored by sector. Hover for details; click a sector to isolate it." />
          <RoundsTimeline points={points} until={ds.generatedAt} />
        </section>

        <section className="mt-6 grid items-start gap-6 lg:grid-cols-2">
          <div className="card p-6">
            <SectionTitle title="Where founders come from" sub="Tracked companies with a founder from each org" />
            <HBars bars={alumniBars} labelWidth={170} />
          </div>
          <div className="card p-6">
            <SectionTitle title="Most active lead investors" sub="Distinct tracked companies where the firm led a round" />
            <HBars bars={leadBars} labelWidth={170} />
          </div>
        </section>

        <section className="mt-6 grid items-start gap-6 lg:grid-cols-5">
          <div className="card p-6 lg:col-span-3">
            <SectionTitle title="Capital by sector" sub="Disclosed equity raised, all time" />
            <HBars bars={sectorBars} unit="usd" labelWidth={190} />
          </div>
          <div className="card p-6 lg:col-span-2">
            <SectionTitle
              title="Latest rounds"
              right={
                <Link className="btn btn-ghost h-7 px-2 text-xs" href="/companies/?sort=recent">
                  All <ArrowRight size={13} />
                </Link>
              }
            />
            <ul className="-mx-2">
              {latest.map((p, i) => (
                <li key={i}>
                  <Link href={`/companies/${p.slug}/`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2">
                    <Monogram name={p.name} sector={p.sector} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium">{p.name}</div>
                      <div className="truncate text-xs text-muted">
                        {ROUND_LABEL[p.type]} · {formatMonth(p.date)}
                        {p.lead.length ? ` · ${p.lead[0]}` : ""}
                      </div>
                    </div>
                    <div className="tabular shrink-0 text-[13.5px] font-semibold">{formatUsd(p.amount)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Sectors */}
        <section className="mt-16">
          <SectionTitle title="Browse by sector" sub="Eight territories, from frontier labs to defense." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {sectorTiles.map(({ s, cos: list, raised }) => (
              <Link
                key={s}
                href={`/companies/?sector=${s}`}
                className="card group relative overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-25 blur-2xl transition-opacity group-hover:opacity-45"
                  style={{ background: sectorColor(s) }}
                />
                <div className="flex items-center gap-2 text-[13.5px] font-semibold">
                  <span className="h-2 w-2 rounded-full" style={{ background: sectorColor(s) }} />
                  {SECTOR_META[s].label}
                </div>
                <p className="mt-1.5 line-clamp-2 min-h-[2.6em] text-[12.5px] leading-[1.3] text-muted">{SECTOR_META[s].blurb}</p>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex -space-x-1.5">
                    {list.slice(0, 5).map((c) => (
                      <span key={c.slug} className="rounded-[9px] ring-2 ring-[var(--surface)]">
                        <Monogram name={c.name} sector={s} size={26} />
                      </span>
                    ))}
                  </div>
                  <span className="tabular text-xs text-muted">
                    {list.length} · {formatUsd(raised)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </Container>
    </>
  );
}

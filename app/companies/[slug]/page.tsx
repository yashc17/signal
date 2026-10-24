import { ArrowLeft, ArrowUpRight, Waypoints } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ValuationLine } from "@/components/charts/ValuationLine";
import { StarButton } from "@/components/StarButton";
import { Container, Monogram, ScoreRing, SectionTitle, SectorChip, StageChip, TrackBadge } from "@/components/ui";
import { REPO_URL } from "@/lib/config";
import { getDataset, nameOf } from "@/lib/data";
import { formatMonth, formatUsd, ROUND_LABEL } from "@/lib/meta";

export function generateStaticParams() {
  return getDataset().companies.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = getDataset().companyBySlug.get(slug);
  return { title: c ? `${c.name} — Signal` : "Signal", description: c?.description };
}

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

const BREAKDOWN: { key: keyof ReturnType<typeof getDataset>["companies"][number]["breakdown"]; label: string; max: number }[] = [
  { key: "capital", label: "Capital raised", max: 30 },
  { key: "founders", label: "Founder pedigree", max: 25 },
  { key: "investors", label: "Investor quality", max: 20 },
  { key: "valuation", label: "Valuation", max: 15 },
  { key: "momentum", label: "Momentum", max: 10 },
];

const CONFIDENCE_STYLE: Record<string, string> = {
  confirmed: "text-good",
  reported: "text-ink-2",
  estimate: "text-warn",
};

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ds = getDataset();
  const c = ds.companyBySlug.get(slug);
  if (!c) notFound();

  const valuations = [
    ...c.rounds.filter((r) => r.valuation).map((r) => ({ date: r.date, value: r.valuation!, label: ROUND_LABEL[r.type] })),
    ...(c.valuation && c.valuation_date && !c.rounds.some((r) => r.date === c.valuation_date && r.valuation)
      ? [{ date: c.valuation_date, value: c.valuation, label: `Latest (${c.valuation_confidence ?? "reported"})` }]
      : []),
  ].sort((a, b) => a.date.localeCompare(b.date));

  // Companies sharing the most investors, and alumni siblings
  const mine = new Set(c.allInvestors);
  const coInvested = ds.companies
    .filter((o) => o.slug !== c.slug)
    .map((o) => ({ o, shared: o.allInvestors.filter((i) => mine.has(i)) }))
    .filter((x) => x.shared.length >= 2)
    .sort((a, b) => b.shared.length - a.shared.length)
    .slice(0, 5);
  const myOrgs = new Set(c.founders.flatMap((f) => f.prev).filter((p) => ds.orgBySlug.get(p)?.pedigree));
  const siblings = ds.companies
    .filter((o) => o.slug !== c.slug)
    .map((o) => ({ o, shared: [...new Set(o.founders.flatMap((f) => f.prev))].filter((p) => myOrgs.has(p)) }))
    .filter((x) => x.shared.length)
    .sort((a, b) => b.shared.length - a.shared.length || b.o.score - a.o.score)
    .slice(0, 5);
  const related = c.related.map((r) => ds.companyBySlug.get(r)).filter((x) => !!x);

  const facts: [string, string][] = [
    ["Headquarters", c.hq],
    ["Founded", c.founded ? String(c.founded) : "—"],
    ["Total raised", formatUsd(c.totalRaised)],
    ["Valuation", formatUsd(c.latestValuation)],
    ["Internships", c.internships === "yes" ? "Yes" : c.internships === "no" ? "No" : "Unknown"],
  ];

  return (
    <Container>
      <div className="pt-8">
        <Link href="/companies/" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink">
          <ArrowLeft size={14} /> Companies
        </Link>
      </div>

      {/* Header */}
      <header className="animate-fade-up flex flex-wrap items-start justify-between gap-6 pb-8 pt-6">
        <div className="flex max-w-3xl items-start gap-5">
          <Monogram name={c.name} sector={c.sector} size={64} />
          <div>
            <h1 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-[40px]">{c.name}</h1>
            <p className="mt-2 text-[16px] leading-relaxed text-ink-2">{c.description}</p>
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <TrackBadge track={c.track} />
              <SectorChip sector={c.sector} />
              <StageChip stage={c.stage} />
              {c.tags.map((t) => (
                <Link key={t} href={`/companies/?q=${t}`} className="rounded-full px-1.5 py-0.5 text-[11.5px] text-muted transition-colors hover:text-ink">
                  #{t}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="btn btn-secondary px-1.5">
            <StarButton slug={c.slug} withLabel />
          </div>
          <Link className="btn btn-secondary" href={`/graph/?view=lineage&focus=c:${c.slug}`}>
            <Waypoints size={14} /> Graph
          </Link>
          {c.website && (
            <a className="btn btn-secondary" href={c.website} target="_blank" rel="noreferrer">
              Website <ArrowUpRight size={14} />
            </a>
          )}
          {c.links.careers && (
            <a className="btn btn-primary" href={c.links.careers} target="_blank" rel="noreferrer">
              Careers <ArrowUpRight size={14} />
            </a>
          )}
        </div>
      </header>

      {/* Facts */}
      <div className="card grid grid-cols-2 divide-line sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
        {facts.map(([k, v]) => (
          <div key={k} className="px-5 py-4">
            <div className="eyebrow">{k}</div>
            <div className="tabular mt-1 truncate text-[17px] font-semibold tracking-[-0.02em]">{v}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-6">
            <SectionTitle title="Founders" sub="Prior affiliations power the talent-lineage graph" />
            {c.founders.length === 0 ? (
              <p className="text-sm text-muted">No founders recorded yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {c.founders.map((f) => (
                  <div key={f.name} className="rounded-xl border border-line p-4">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[13px] font-semibold text-ink-2">
                        {f.name
                          .split(" ")
                          .map((w) => w[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-semibold">{f.name}</div>
                        {f.role && <div className="text-xs text-muted">{f.role}</div>}
                      </div>
                    </div>
                    {f.note && <p className="mt-3 text-[13px] leading-snug text-ink-2">{f.note}</p>}
                    {f.prev.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {f.prev.map((p) => {
                          const isCo = ds.companyBySlug.has(p);
                          const pedigree = ds.orgBySlug.get(p)?.pedigree || isCo;
                          const href = isCo ? `/companies/${p}/` : ds.orgBySlug.has(p) ? `/graph/?view=lineage&focus=o:${p}` : null;
                          const chip = (
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-[11.5px] font-medium transition-colors ${
                                pedigree ? "bg-surface-3 text-ink ring-1 ring-inset ring-[var(--border-strong)] hover:bg-surface-2" : "bg-surface-2 text-ink-2 hover:text-ink"
                              }`}
                            >
                              {nameOf(ds, p)}
                            </span>
                          );
                          return href ? (
                            <Link key={p} href={href}>
                              {chip}
                            </Link>
                          ) : (
                            <span key={p}>{chip}</span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card p-6">
            <SectionTitle title="Funding" sub="Confirmed = company announcement · reported = press · estimate = tracker" />
            {valuations.length >= 2 && (
              <div className="mb-6">
                <ValuationLine points={valuations} />
              </div>
            )}
            {c.rounds.length === 0 ? (
              <p className="text-sm text-muted">
                No disclosed rounds yet{c.latestValuation ? `. Latest reported valuation ${formatUsd(c.latestValuation)}` : ""}.
              </p>
            ) : (
              <ol className="relative">
                {[...c.rounds].reverse().map((r, i, arr) => (
                  <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
                    <div className="relative flex w-3 shrink-0 justify-center">
                      <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${i === 0 ? "bg-ink" : "border-2 border-axis bg-surface"}`} />
                      {i < arr.length - 1 && <span className="absolute bottom-[-6px] top-5 w-px bg-[var(--border-strong)]" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <div className="text-[14px] font-semibold">
                          {ROUND_LABEL[r.type]}
                          <span className="ml-2 text-[12.5px] font-normal text-muted">{formatMonth(r.date)}</span>
                        </div>
                        <div className="tabular text-[14px] font-semibold">
                          {formatUsd(r.amount)}
                          {r.valuation && <span className="ml-1.5 text-[12.5px] font-normal text-muted">at {formatUsd(r.valuation)}</span>}
                        </div>
                      </div>
                      {(r.lead.length > 0 || r.investors.length > 0) && (
                        <div className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
                          {r.lead.length > 0 && <span className="font-medium text-ink">Led by {r.lead.map((l) => nameOf(ds, l)).join(", ")}</span>}
                          {r.lead.length > 0 && r.investors.length > 0 && " · "}
                          {r.investors.map((l) => nameOf(ds, l)).join(", ")}
                        </div>
                      )}
                      <div className="mt-1 text-[11.5px]">
                        <span className={CONFIDENCE_STYLE[r.confidence] ?? "text-muted"}>{r.confidence}</span>
                        <span className="text-faint"> · </span>
                        {r.source ? (
                          <a className="text-muted hover:text-ink" href={r.source} target="_blank" rel="noreferrer">
                            {host(r.source)} ↗
                          </a>
                        ) : (
                          <a className="text-warn hover:underline" href={`${REPO_URL}/edit/main/data/companies/${c.slug}.yaml`} target="_blank" rel="noreferrer">
                            needs source
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {c.valuation && (
              <p className="mt-5 border-t border-line pt-4 text-xs text-muted">
                Latest valuation {formatUsd(c.valuation)}
                {c.valuation_date ? ` (${formatMonth(c.valuation_date)})` : ""} · {c.valuation_confidence ?? "reported"}
                {c.valuation_source && (
                  <>
                    {" · "}
                    <a className="hover:text-ink" href={c.valuation_source} target="_blank" rel="noreferrer">
                      {host(c.valuation_source)} ↗
                    </a>
                  </>
                )}
              </p>
            )}
          </section>

          {c.events.length > 0 && (
            <section className="card p-6">
              <SectionTitle title="Timeline" />
              <ul className="space-y-4">
                {[...c.events].reverse().map((e, i) => (
                  <li key={i} className="flex gap-4 text-[13.5px]">
                    <span className="tabular w-20 shrink-0 text-muted">{formatMonth(e.date)}</span>
                    <div className="leading-relaxed">
                      <span className="mr-2 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-2">{e.type}</span>
                      {e.text}{" "}
                      {e.source ? (
                        <a className="text-xs text-muted hover:text-ink" href={e.source} target="_blank" rel="noreferrer">
                          {host(e.source)} ↗
                        </a>
                      ) : (
                        <span className="text-xs text-warn">needs source</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section className="card p-6">
            <div className="flex items-center gap-4">
              <ScoreRing score={c.score} size={64} stroke={5} />
              <div>
                <div className="text-[15px] font-semibold tracking-[-0.01em]">Signal score</div>
                <div className="text-[12.5px] text-muted">How this company ranks, out of 100</div>
              </div>
            </div>
            <ul className="mt-6 space-y-3.5">
              {BREAKDOWN.map((b) => (
                <li key={b.key}>
                  <div className="flex justify-between text-[12.5px]">
                    <span className="text-ink-2">{b.label}</span>
                    <span className="tabular text-muted">
                      {Math.round(c.breakdown[b.key])}
                      <span className="text-faint">/{b.max}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full bg-ink" style={{ width: `${(c.breakdown[b.key] / b.max) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            {c.reasons.length > 0 && (
              <ul className="mt-5 space-y-1.5 border-t border-line pt-4 text-[12.5px] text-ink-2">
                {c.reasons.map((r) => (
                  <li key={r} className="flex gap-2">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-faint" />
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {related.length > 0 && (
            <section className="card p-6">
              <SectionTitle title="Related" sub="Competitors, siblings and spinouts" />
              <MiniList items={related.map((o) => ({ slug: o.slug, name: o.name, sector: o.sector, sub: o.description, score: o.score }))} />
            </section>
          )}
          {siblings.length > 0 && (
            <section className="card p-6">
              <SectionTitle title="Same founder lineage" />
              <MiniList
                items={siblings.map(({ o, shared }) => ({
                  slug: o.slug,
                  name: o.name,
                  sector: o.sector,
                  sub: `Alumni of ${shared.map((s) => nameOf(ds, s)).join(", ")}`,
                  score: o.score,
                }))}
              />
            </section>
          )}
          {coInvested.length > 0 && (
            <section className="card p-6">
              <SectionTitle title="Shares investors with" />
              <MiniList
                items={coInvested.map(({ o, shared }) => ({ slug: o.slug, name: o.name, sector: o.sector, sub: shared.map((s) => nameOf(ds, s)).join(", "), score: o.score }))}
              />
            </section>
          )}

          <section className="px-1 text-xs leading-relaxed text-muted">
            {c.sources.length > 0 && (
              <div className="mb-2">
                Sources:{" "}
                {c.sources.map((s, i) => (
                  <span key={s}>
                    {i > 0 && ", "}
                    <a className="hover:text-ink" href={s} target="_blank" rel="noreferrer">
                      {host(s)}
                    </a>
                  </span>
                ))}
              </div>
            )}
            Last updated {formatMonth(c.updated)} ·{" "}
            <a className="link text-muted" href={`${REPO_URL}/edit/main/data/companies/${c.slug}.yaml`} target="_blank" rel="noreferrer">
              Suggest an edit
            </a>
          </section>
        </aside>
      </div>
    </Container>
  );
}

function MiniList({ items }: { items: { slug: string; name: string; sector: Parameters<typeof Monogram>[0]["sector"]; sub: string; score: number }[] }) {
  return (
    <ul className="-mx-2">
      {items.map((it) => (
        <li key={it.slug}>
          <Link href={`/companies/${it.slug}/`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2">
            <Monogram name={it.name} sector={it.sector} size={30} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-medium">{it.name}</div>
              <div className="truncate text-xs text-muted">{it.sub}</div>
            </div>
            <ScoreRing score={it.score} size={28} stroke={2.5} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

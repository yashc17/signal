import Link from "next/link";
import { notFound } from "next/navigation";
import { ValuationLine } from "@/components/charts/ValuationLine";
import { StarButton } from "@/components/StarButton";
import { ScoreMeter, SectionTitle, SectorChip, StageChip, TrackBadge } from "@/components/ui";
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
    .slice(0, 6);
  const myOrgs = new Set(c.founders.flatMap((f) => f.prev).filter((p) => ds.orgBySlug.get(p)?.pedigree));
  const siblings = ds.companies
    .filter((o) => o.slug !== c.slug)
    .map((o) => ({ o, shared: [...new Set(o.founders.flatMap((f) => f.prev))].filter((p) => myOrgs.has(p)) }))
    .filter((x) => x.shared.length)
    .sort((a, b) => b.shared.length - a.shared.length || b.o.score - a.o.score)
    .slice(0, 6);
  const related = c.related.map((r) => ds.companyBySlug.get(r)).filter(Boolean);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/companies/" className="text-sm text-muted hover:text-ink">
          ← Companies
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight">{c.name}</h1>
            <p className="mt-2 text-ink-2">{c.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <TrackBadge track={c.track} />
              <SectorChip sector={c.sector} />
              <StageChip stage={c.stage} />
              {c.tags.map((t) => (
                <Link key={t} href={`/companies/?q=${t}`} className="text-xs text-muted hover:text-ink">
                  #{t}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StarButton slug={c.slug} withLabel />
            {c.website && (
              <a className="control" href={c.website} target="_blank" rel="noreferrer">
                Website ↗
              </a>
            )}
            {c.links.careers && (
              <a className="control" href={c.links.careers} target="_blank" rel="noreferrer">
                Careers ↗
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["HQ", c.hq],
          ["Founded", c.founded ? String(c.founded) : "—"],
          ["Total raised", formatUsd(c.totalRaised)],
          ["Latest valuation", c.latestValuation ? `${formatUsd(c.latestValuation)}` : "—"],
          ["Internships", c.internships === "yes" ? "Yes" : c.internships === "no" ? "No" : "Unknown"],
        ].map(([k, v]) => (
          <div key={k} className="card px-4 py-3">
            <div className="text-xs text-muted">{k}</div>
            <div className="mt-1 truncate font-medium">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5">
            <SectionTitle title="Founders" sub="Prior affiliations power the talent-lineage graph" />
            <ul className="divide-y divide-[var(--border)]">
              {c.founders.map((f) => (
                <li key={f.name} className="py-2.5">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{f.name}</span>
                    {f.role && <span className="text-xs text-muted">{f.role}</span>}
                  </div>
                  {f.note && <div className="text-sm text-ink-2">{f.note}</div>}
                  {f.prev.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {f.prev.map((p) => {
                        const isCo = ds.companyBySlug.has(p);
                        const pedigree = ds.orgBySlug.get(p)?.pedigree || isCo;
                        const chip = (
                          <span className={`rounded-full px-2 py-0.5 text-xs ${pedigree ? "bg-accent-wash text-ink" : "bg-surface-2 text-ink-2"}`}>
                            {nameOf(ds, p)}
                          </span>
                        );
                        return isCo ? (
                          <Link key={p} href={`/companies/${p}/`}>
                            {chip}
                          </Link>
                        ) : (
                          <span key={p}>{chip}</span>
                        );
                      })}
                    </div>
                  )}
                </li>
              ))}
              {c.founders.length === 0 && <li className="py-2 text-sm text-muted">No founders recorded yet.</li>}
            </ul>
          </section>

          <section className="card p-5">
            <SectionTitle title="Funding" sub="Confidence: confirmed = company announcement · reported = press · estimate = tracker" />
            {valuations.length >= 2 && (
              <div className="mb-4">
                <ValuationLine points={valuations} />
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Round</th>
                    <th className="py-2 pr-3 text-right font-medium">Amount</th>
                    <th className="py-2 pr-3 text-right font-medium">Valuation</th>
                    <th className="py-2 pr-3 font-medium">Investors</th>
                    <th className="py-2 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {[...c.rounds].reverse().map((r, i) => (
                    <tr key={i} className="border-b border-line align-top last:border-0">
                      <td className="tabular whitespace-nowrap py-2 pr-3">{formatMonth(r.date)}</td>
                      <td className="whitespace-nowrap py-2 pr-3">{ROUND_LABEL[r.type]}</td>
                      <td className="tabular py-2 pr-3 text-right">{formatUsd(r.amount)}</td>
                      <td className="tabular py-2 pr-3 text-right">{formatUsd(r.valuation)}</td>
                      <td className="py-2 pr-3 text-xs">
                        {r.lead.length > 0 && <div className="text-ink">Lead: {r.lead.map((l) => nameOf(ds, l)).join(", ")}</div>}
                        {r.investors.length > 0 && <div className="text-ink-2">{r.investors.map((l) => nameOf(ds, l)).join(", ")}</div>}
                      </td>
                      <td className="whitespace-nowrap py-2 text-xs">
                        <span className="text-muted">{r.confidence}</span>{" "}
                        {r.source ? (
                          <a className="link" href={r.source} target="_blank" rel="noreferrer">
                            {host(r.source)} ↗
                          </a>
                        ) : (
                          <span className="text-warn">needs source</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {c.rounds.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-3 text-sm text-muted">
                        No disclosed rounds yet{c.latestValuation ? ` — latest reported valuation ${formatUsd(c.latestValuation)}` : ""}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {c.valuation && (
              <p className="mt-3 text-xs text-muted">
                Latest valuation {formatUsd(c.valuation)}
                {c.valuation_date ? ` (${formatMonth(c.valuation_date)})` : ""} · {c.valuation_confidence ?? "reported"}
                {c.valuation_source && (
                  <>
                    {" · "}
                    <a className="link" href={c.valuation_source} target="_blank" rel="noreferrer">
                      {host(c.valuation_source)} ↗
                    </a>
                  </>
                )}
              </p>
            )}
          </section>

          {c.events.length > 0 && (
            <section className="card p-5">
              <SectionTitle title="Events" />
              <ul className="space-y-3">
                {[...c.events].reverse().map((e, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="tabular w-20 shrink-0 text-muted">{formatMonth(e.date)}</span>
                    <div>
                      <span className="mr-2 rounded bg-surface-2 px-1.5 py-0.5 text-xs text-ink-2">{e.type}</span>
                      {e.text}{" "}
                      {e.source ? (
                        <a className="link text-xs" href={e.source} target="_blank" rel="noreferrer">
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
          <section className="card p-5">
            <SectionTitle title={`Signal ${c.score}`} sub="How the score is built" />
            <ul className="space-y-2.5">
              {BREAKDOWN.map((b) => (
                <li key={b.key}>
                  <div className="flex justify-between text-xs">
                    <span className="text-ink-2">{b.label}</span>
                    <span className="tabular text-muted">
                      {Math.round(c.breakdown[b.key])}/{b.max}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--accent-wash)" }}>
                    <div className="h-full rounded-full" style={{ width: `${(c.breakdown[b.key] / b.max) * 100}%`, background: "var(--accent)" }} />
                  </div>
                </li>
              ))}
            </ul>
            {c.reasons.length > 0 && (
              <ul className="mt-4 space-y-1 text-sm text-ink-2">
                {c.reasons.map((r) => (
                  <li key={r}>· {r}</li>
                ))}
              </ul>
            )}
          </section>

          {related.length > 0 && (
            <section className="card p-5">
              <SectionTitle title="Related" sub="Competitors, siblings and spinouts" />
              <MiniList items={related.map((o) => ({ slug: o!.slug, name: o!.name, sub: o!.description, score: o!.score }))} />
            </section>
          )}
          {siblings.length > 0 && (
            <section className="card p-5">
              <SectionTitle title="Same founder lineage" />
              <MiniList items={siblings.map(({ o, shared }) => ({ slug: o.slug, name: o.name, sub: `Alumni of ${shared.map((s) => nameOf(ds, s)).join(", ")}`, score: o.score }))} />
            </section>
          )}
          {coInvested.length > 0 && (
            <section className="card p-5">
              <SectionTitle title="Shares investors with" />
              <MiniList items={coInvested.map(({ o, shared }) => ({ slug: o.slug, name: o.name, sub: shared.map((s) => nameOf(ds, s)).join(", "), score: o.score }))} />
            </section>
          )}

          <section className="text-xs text-muted">
            {c.sources.length > 0 && (
              <div className="mb-2">
                Sources:{" "}
                {c.sources.map((s, i) => (
                  <span key={s}>
                    {i > 0 && ", "}
                    <a className="link" href={s} target="_blank" rel="noreferrer">
                      {host(s)}
                    </a>
                  </span>
                ))}
              </div>
            )}
            Last updated {formatMonth(c.updated)} ·{" "}
            <a className="link" href={`${REPO_URL}/edit/main/data/companies/${c.slug}.yaml`} target="_blank" rel="noreferrer">
              Suggest an edit
            </a>
          </section>
        </aside>
      </div>
    </div>
  );
}

function MiniList({ items }: { items: { slug: string; name: string; sub: string; score: number }[] }) {
  return (
    <ul className="divide-y divide-[var(--border)]">
      {items.map((it) => (
        <li key={it.slug}>
          <Link href={`/companies/${it.slug}/`} className="flex items-center justify-between gap-3 py-2 hover:bg-surface-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{it.name}</div>
              <div className="truncate text-xs text-muted">{it.sub}</div>
            </div>
            <ScoreMeter score={it.score} width={36} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

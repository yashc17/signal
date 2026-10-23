"use client";
import Link from "next/link";
import MiniSearch from "minisearch";
import { useEffect, useMemo, useState } from "react";
import type { CompanyRow } from "@/lib/data";
import { formatMonth, formatUsd, ROUND_LABEL, SECTOR_META, STAGE_LABEL, TRACK_META } from "@/lib/meta";
import { SECTORS, STAGES } from "@/lib/schema";
import { StarButton } from "./StarButton";
import { ScoreMeter } from "./ui";

type SortKey = "score" | "recent" | "raised" | "valuation" | "name" | "founded";

const FILTER_KEYS = ["q", "track", "sector", "stage", "sort", "interns"] as const;

export function CompanyExplorer({ rows, investorNames }: { rows: CompanyRow[]; investorNames: Record<string, string> }) {
  const [q, setQ] = useState("");
  const [track, setTrack] = useState("");
  const [sector, setSector] = useState("");
  const [stage, setStage] = useState("");
  const [interns, setInterns] = useState("");
  const [sort, setSort] = useState<SortKey>("score");

  // URL ⇄ state, so filtered views are shareable (works with static export).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQ(p.get("q") ?? "");
    setTrack(p.get("track") ?? "");
    setSector(p.get("sector") ?? "");
    setStage(p.get("stage") ?? "");
    setInterns(p.get("interns") ?? "");
    setSort((p.get("sort") as SortKey) ?? "score");
  }, []);
  useEffect(() => {
    const p = new URLSearchParams();
    const vals = { q, track, sector, stage, sort: sort === "score" ? "" : sort, interns };
    for (const k of FILTER_KEYS) if (vals[k]) p.set(k, vals[k]);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [q, track, sector, stage, sort, interns]);

  const search = useMemo(() => {
    const ms = new MiniSearch<CompanyRow & { id: string; text: string }>({
      fields: ["name", "text"],
      storeFields: ["slug"],
      searchOptions: { boost: { name: 3 }, prefix: true, fuzzy: 0.2 },
    });
    ms.addAll(
      rows.map((r) => ({
        ...r,
        id: r.slug,
        text: [r.description, r.hq, r.tags.join(" "), r.founders.join(" "), r.investors.map((i) => investorNames[i] ?? i).join(" ")].join(" "),
      })),
    );
    return ms;
  }, [rows, investorNames]);

  const filtered = useMemo(() => {
    let out = rows;
    if (q.trim()) {
      const hits = new Map(search.search(q.trim()).map((h, i) => [h.id as string, i]));
      out = out.filter((r) => hits.has(r.slug));
      if (sort === "score") out = [...out].sort((a, b) => hits.get(a.slug)! - hits.get(b.slug)!);
    }
    if (track) out = out.filter((r) => r.track === track);
    if (sector) out = out.filter((r) => r.sector === sector);
    if (stage) out = out.filter((r) => r.stage === stage);
    if (interns) out = out.filter((r) => r.internships === interns);
    const by: Record<SortKey, (a: CompanyRow, b: CompanyRow) => number> = {
      score: (a, b) => b.score - a.score,
      recent: (a, b) => (b.lastRoundDate ?? "").localeCompare(a.lastRoundDate ?? ""),
      raised: (a, b) => (b.totalRaised ?? 0) - (a.totalRaised ?? 0),
      valuation: (a, b) => (b.valuation ?? 0) - (a.valuation ?? 0),
      name: (a, b) => a.name.localeCompare(b.name),
      founded: (a, b) => (b.founded ?? 0) - (a.founded ?? 0),
    };
    if (!(q.trim() && sort === "score")) out = [...out].sort(by[sort]);
    return out;
  }, [rows, q, track, sector, stage, interns, sort, search]);

  const reset = () => {
    setQ("");
    setTrack("");
    setSector("");
    setStage("");
    setInterns("");
    setSort("score");
  };
  const anyFilter = q || track || sector || stage || interns;

  return (
    <div>
      {/* One filter row above the content it scopes */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="control w-full sm:w-64"
          placeholder="Search companies, founders, investors…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search"
        />
        <select className="control" value={track} onChange={(e) => setTrack(e.target.value)} aria-label="Track">
          <option value="">All tracks</option>
          {Object.entries(TRACK_META).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}s
            </option>
          ))}
        </select>
        <select className="control" value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Sector">
          <option value="">All sectors</option>
          {SECTORS.map((s) => (
            <option key={s} value={s}>
              {SECTOR_META[s].label}
            </option>
          ))}
        </select>
        <select className="control" value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Stage">
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </select>
        <select className="control" value={interns} onChange={(e) => setInterns(e.target.value)} aria-label="Internships">
          <option value="">Internships: any</option>
          <option value="yes">Hires interns</option>
          <option value="unknown">Unknown</option>
        </select>
        <select className="control" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
          <option value="score">Sort: signal</option>
          <option value="recent">Sort: latest round</option>
          <option value="raised">Sort: total raised</option>
          <option value="valuation">Sort: valuation</option>
          <option value="founded">Sort: newest</option>
          <option value="name">Sort: name</option>
        </select>
        {anyFilter && (
          <button className="text-sm text-ink-2 hover:text-ink" onClick={reset}>
            Clear
          </button>
        )}
        <span className="ml-auto text-sm text-muted">{filtered.length} companies</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="text-xs text-muted">
            <tr className="border-b border-line">
              <th className="w-8 px-2 py-2.5" />
              <th className="px-3 py-2.5 font-medium">Company</th>
              <th className="px-3 py-2.5 font-medium">Sector</th>
              <th className="px-3 py-2.5 font-medium">Stage</th>
              <th className="px-3 py-2.5 font-medium">Latest round</th>
              <th className="px-3 py-2.5 text-right font-medium">Raised</th>
              <th className="px-3 py-2.5 text-right font-medium">Valuation</th>
              <th className="px-3 py-2.5 font-medium">HQ</th>
              <th className="px-3 py-2.5 font-medium">Signal</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.slug} className="border-b border-line last:border-0 hover:bg-surface-2">
                <td className="px-2 py-2.5 align-top">
                  <StarButton slug={r.slug} />
                </td>
                <td className="max-w-80 px-3 py-2.5 align-top">
                  <Link href={`/companies/${r.slug}/`} className="flex items-center gap-2 font-medium hover:underline">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: `var(--s${TRACK_META[r.track].slot})` }}
                      title={TRACK_META[r.track].label}
                    />
                    {r.name}
                  </Link>
                  <div className="mt-0.5 line-clamp-2 text-xs text-ink-2">{r.description}</div>
                </td>
                <td className="px-3 py-2.5 align-top text-xs text-ink-2">{SECTOR_META[r.sector].label}</td>
                <td className="whitespace-nowrap px-3 py-2.5 align-top text-xs text-ink-2">{STAGE_LABEL[r.stage]}</td>
                <td className="whitespace-nowrap px-3 py-2.5 align-top text-xs">
                  {r.lastRoundDate ? (
                    <>
                      <div className="text-ink">
                        {r.lastRoundType ? ROUND_LABEL[r.lastRoundType] : ""} {r.lastRoundAmount ? `· ${formatUsd(r.lastRoundAmount)}` : ""}
                      </div>
                      <div className="text-muted">{formatMonth(r.lastRoundDate)}</div>
                    </>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="tabular px-3 py-2.5 text-right align-top">{formatUsd(r.totalRaised)}</td>
                <td className="tabular px-3 py-2.5 text-right align-top">{formatUsd(r.valuation)}</td>
                <td className="px-3 py-2.5 align-top text-xs text-ink-2">{r.hq}</td>
                <td className="px-3 py-2.5 align-top">
                  <ScoreMeter score={r.score} width={48} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";
import { LayoutGrid, List, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MiniSearch from "minisearch";
import { useEffect, useMemo, useState } from "react";
import type { CompanyRow } from "@/lib/data";
import { formatMonth, formatUsd, ROUND_LABEL, SECTOR_META, STAGE_LABEL } from "@/lib/meta";
import { SECTORS, STAGES } from "@/lib/schema";
import { CompanyCard } from "./CompanyCard";
import { StarButton } from "./StarButton";
import { Monogram, ScoreMeter, Segmented, sectorColor } from "./ui";

type SortKey = "score" | "recent" | "raised" | "valuation" | "name" | "founded";

const FILTER_KEYS = ["q", "track", "sector", "stage", "sort", "interns", "view"] as const;

export function CompanyExplorer({ rows, investorNames }: { rows: CompanyRow[]; investorNames: Record<string, string> }) {
  const [q, setQ] = useState("");
  const [track, setTrack] = useState("");
  const [sector, setSector] = useState("");
  const [stage, setStage] = useState("");
  const [interns, setInterns] = useState("");
  const [sort, setSort] = useState<SortKey>("score");
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const router = useRouter();

  // URL ⇄ state, so filtered views are shareable (works with static export).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQ(p.get("q") ?? "");
    setTrack(p.get("track") ?? "");
    setSector(p.get("sector") ?? "");
    setStage(p.get("stage") ?? "");
    setInterns(p.get("interns") ?? "");
    setSort((p.get("sort") as SortKey) ?? "score");
    setLayout(p.get("view") === "grid" ? "grid" : "list");
  }, []);
  useEffect(() => {
    const p = new URLSearchParams();
    const vals = { q, track, sector, stage, sort: sort === "score" ? "" : sort, interns, view: layout === "grid" ? "grid" : "" };
    for (const k of FILTER_KEYS) if (vals[k]) p.set(k, vals[k]);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [q, track, sector, stage, sort, interns, layout]);

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
      <div className="sticky top-[57px] z-20 -mx-4 mb-5 bg-[color-mix(in_srgb,var(--page)_88%,transparent)] px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="control w-full pl-9"
              placeholder="Search companies, founders, investors…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search"
            />
          </div>
          <Segmented
            value={track || "all"}
            onChange={(v) => setTrack(v === "all" ? "" : v)}
            options={[
              { value: "all", label: "All" },
              { value: "research", label: "Labs" },
              { value: "applied", label: "Applied" },
            ]}
          />
          <select className="control" value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Sector">
            <option value="">All sectors</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {SECTOR_META[s].label}
              </option>
            ))}
          </select>
          <select className="control" value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Stage">
            <option value="">Any stage</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
          <select className="control" value={interns} onChange={(e) => setInterns(e.target.value)} aria-label="Internships">
            <option value="">Interns: any</option>
            <option value="yes">Hires interns</option>
            <option value="unknown">Unknown</option>
          </select>
          {anyFilter && (
            <button className="btn btn-ghost h-[34px] px-2.5" onClick={reset}>
              <X size={14} /> Clear
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className="tabular hidden text-[13px] text-muted xl:inline">{filtered.length}</span>
            <select className="control" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
              <option value="score">Sort: Signal</option>
              <option value="recent">Sort: Latest round</option>
              <option value="raised">Sort: Total raised</option>
              <option value="valuation">Sort: Valuation</option>
              <option value="founded">Sort: Newest</option>
              <option value="name">Sort: Name</option>
            </select>
            <Segmented
              size="sm"
              value={layout}
              onChange={setLayout}
              options={[
                { value: "list", label: <List size={14} aria-label="List view" /> },
                { value: "grid", label: <LayoutGrid size={14} aria-label="Grid view" /> },
              ]}
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <div className="text-[15px] font-semibold">No companies match</div>
          <p className="mt-1 text-sm text-muted">Try a broader search or clear the filters.</p>
          <button className="btn btn-secondary mt-4" onClick={reset}>
            Clear filters
          </button>
        </div>
      ) : layout === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <CompanyCard key={r.slug} c={r} />
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-[13px]">
            <thead className="text-[12px] text-muted">
              <tr className="border-b border-line">
                <th className="py-3 pl-5 pr-3 font-medium">Company</th>
                <th className="px-3 py-3 font-medium">Sector</th>
                <th className="px-3 py-3 font-medium">Stage</th>
                <th className="px-3 py-3 font-medium">Latest round</th>
                <th className="px-3 py-3 text-right font-medium">Raised</th>
                <th className="px-3 py-3 text-right font-medium">Valuation</th>
                <th className="px-3 py-3 font-medium">Signal</th>
                <th className="w-10 py-3 pr-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.slug}
                  onClick={() => router.push(`/companies/${r.slug}/`)}
                  className="group cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-surface-2"
                >
                  <td className="max-w-[380px] py-3 pl-5 pr-3">
                    <div className="flex items-center gap-3">
                      <Monogram name={r.name} sector={r.sector} size={34} />
                      <div className="min-w-0">
                        <Link href={`/companies/${r.slug}/`} className="font-semibold tracking-[-0.01em]" onClick={(e) => e.stopPropagation()}>
                          {r.name}
                        </Link>
                        <div className="truncate text-[12px] text-muted">{r.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-ink-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: sectorColor(r.sector) }} />
                      {SECTOR_META[r.sector].label.replace(/ & .*/, "")}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-ink-2">{STAGE_LABEL[r.stage]}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {r.lastRoundDate ? (
                      <>
                        <div>
                          {r.lastRoundType ? ROUND_LABEL[r.lastRoundType] : ""}
                          {r.lastRoundAmount ? <span className="tabular text-ink-2"> · {formatUsd(r.lastRoundAmount)}</span> : ""}
                        </div>
                        <div className="text-[12px] text-muted">{formatMonth(r.lastRoundDate)}</div>
                      </>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="tabular px-3 py-3 text-right font-medium">{formatUsd(r.totalRaised)}</td>
                  <td className="tabular px-3 py-3 text-right font-medium">{formatUsd(r.valuation)}</td>
                  <td className="px-3 py-3">
                    <ScoreMeter score={r.score} width={48} />
                  </td>
                  <td className="py-3 pr-3" onClick={(e) => e.stopPropagation()}>
                    <StarButton slug={r.slug} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

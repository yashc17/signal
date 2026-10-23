"use client";
import Link from "next/link";
import { useRef } from "react";
import type { CompanyRow } from "@/lib/data";
import { formatMonth, formatUsd, STAGE_LABEL } from "@/lib/meta";
import { STATUSES, useWatchlist, type Status, type Watchlist as WL } from "@/lib/watchlist";
import { StarButton } from "./StarButton";

const STATUS_LABEL: Record<Status, string> = {
  interested: "Interested",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  pass: "Pass",
};

export function Watchlist({ rows }: { rows: CompanyRow[] }) {
  const { list, update, replace } = useWatchlist();
  const file = useRef<HTMLInputElement>(null);
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const entries = Object.entries(list)
    .map(([slug, e]) => ({ slug, e, r: bySlug.get(slug) }))
    .filter((x) => x.r);

  const download = (name: string, text: string, type: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const exportCsv = () => {
    const head = ["company", "status", "note", "added", "stage", "last_round", "careers", "website"];
    const lines = entries.map(({ slug, e, r }) =>
      [r!.name, e.status, e.note ?? "", e.added, r!.stage, r!.lastRoundDate ?? "", r!.careers ?? "", r!.website ?? ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    download("signal-watchlist.csv", [head.join(","), ...lines].join("\n"), "text/csv");
  };

  if (!entries.length)
    return (
      <div className="card p-8 text-center text-sm text-ink-2">
        Nothing here yet. Star companies from the{" "}
        <Link className="link" href="/companies/">
          directory
        </Link>{" "}
        or any company page.
        <div className="mt-4">
          <button className="control" onClick={() => file.current?.click()}>
            Import JSON
          </button>
          <input ref={file} type="file" accept="application/json" hidden onChange={(ev) => importJson(ev, replace)} />
        </div>
      </div>
    );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <span key={s} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-2">
            {STATUS_LABEL[s]} · {entries.filter((x) => x.e.status === s).length}
          </span>
        ))}
        <div className="ml-auto flex gap-2">
          <button className="control" onClick={exportCsv}>
            Export CSV
          </button>
          <button className="control" onClick={() => download("signal-watchlist.json", JSON.stringify(list, null, 2), "application/json")}>
            Export JSON
          </button>
          <button className="control" onClick={() => file.current?.click()}>
            Import JSON
          </button>
          <input ref={file} type="file" accept="application/json" hidden onChange={(ev) => importJson(ev, replace)} />
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs text-muted">
            <tr className="border-b border-line">
              <th className="w-8 px-2 py-2.5" />
              <th className="px-3 py-2.5 font-medium">Company</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Notes</th>
              <th className="px-3 py-2.5 font-medium">Stage</th>
              <th className="px-3 py-2.5 font-medium">Latest round</th>
              <th className="px-3 py-2.5 font-medium">Careers</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(({ slug, e, r }) => (
              <tr key={slug} className="border-b border-line last:border-0">
                <td className="px-2 py-2">
                  <StarButton slug={slug} />
                </td>
                <td className="px-3 py-2">
                  <Link className="font-medium hover:underline" href={`/companies/${slug}/`}>
                    {r!.name}
                  </Link>
                  <div className="text-xs text-muted">added {e.added}</div>
                </td>
                <td className="px-3 py-2">
                  <select className="control" value={e.status} onChange={(ev) => update(slug, { status: ev.target.value as Status })} aria-label="Status">
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    className="control w-full min-w-48"
                    defaultValue={e.note ?? ""}
                    placeholder="Recruiter, referral, deadline…"
                    onBlur={(ev) => update(slug, { note: ev.target.value })}
                    aria-label="Notes"
                  />
                </td>
                <td className="px-3 py-2 text-xs text-ink-2">{STAGE_LABEL[r!.stage]}</td>
                <td className="px-3 py-2 text-xs text-ink-2">
                  {r!.lastRoundDate ? `${formatUsd(r!.lastRoundAmount)} · ${formatMonth(r!.lastRoundDate)}` : "—"}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r!.careers ? (
                    <a className="link" href={r!.careers} target="_blank" rel="noreferrer">
                      Careers ↗
                    </a>
                  ) : r!.website ? (
                    <a className="link" href={r!.website} target="_blank" rel="noreferrer">
                      Website ↗
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function importJson(ev: React.ChangeEvent<HTMLInputElement>, replace: (w: WL) => void) {
  const f = ev.target.files?.[0];
  if (!f) return;
  f.text().then((t) => {
    try {
      replace(JSON.parse(t));
    } catch {
      console.warn("Invalid watchlist JSON");
    }
  });
}

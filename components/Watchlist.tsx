"use client";
// Application board: one column per status. Drag cards between columns (or use the status menu).
import { ArrowUpRight, Download, Star, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import type { CompanyRow } from "@/lib/data";
import { formatMonth, formatUsd } from "@/lib/meta";
import { STATUSES, useWatchlist, type Status, type Watchlist as WL } from "@/lib/watchlist";
import { StarButton } from "./StarButton";
import { Monogram } from "./ui";

const STATUS_META: Record<Status, { label: string; hint: string }> = {
  interested: { label: "Interested", hint: "Starred, not yet applied" },
  applied: { label: "Applied", hint: "Application sent" },
  interviewing: { label: "Interviewing", hint: "In process" },
  offer: { label: "Offer", hint: "Signed or deciding" },
  pass: { label: "Pass", hint: "Closed or not a fit" },
};

export function Watchlist({ rows }: { rows: CompanyRow[] }) {
  const { list, update, replace } = useWatchlist();
  const file = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Status | null>(null);
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const entries = Object.entries(list)
    .map(([slug, e]) => ({ slug, e, r: bySlug.get(slug)! }))
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
    const lines = entries.map(({ e, r }) =>
      [r.name, e.status, e.note ?? "", e.added, r.stage, r.lastRoundDate ?? "", r.careers ?? "", r.website ?? ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    download("signal-watchlist.csv", [head.join(","), ...lines].join("\n"), "text/csv");
  };

  const importInput = <input ref={file} type="file" accept="application/json" hidden onChange={(ev) => importJson(ev, replace)} />;

  if (!entries.length)
    return (
      <div className="card flex flex-col items-center px-6 py-20 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-[var(--star)]">
          <Star size={22} fill="currentColor" />
        </span>
        <h2 className="mt-5 text-[17px] font-semibold tracking-[-0.01em]">Your board is empty</h2>
        <p className="mt-1.5 max-w-sm text-[13.5px] text-ink-2">
          Star companies from the directory, a profile, or the graph. They land here so you can track every application.
        </p>
        <div className="mt-6 flex gap-2">
          <Link className="btn btn-primary" href="/companies/">
            Browse companies
          </Link>
          <button className="btn btn-secondary" onClick={() => file.current?.click()}>
            <Upload size={14} /> Import JSON
          </button>
        </div>
        {importInput}
      </div>
    );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-muted">Drag cards between columns. Notes save when you click away.</p>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={exportCsv}>
            <Download size={14} /> CSV
          </button>
          <button className="btn btn-secondary" onClick={() => download("signal-watchlist.json", JSON.stringify(list, null, 2), "application/json")}>
            <Download size={14} /> JSON
          </button>
          <button className="btn btn-secondary" onClick={() => file.current?.click()}>
            <Upload size={14} /> Import
          </button>
          {importInput}
        </div>
      </div>
      <div className="scroll-quiet -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
        {STATUSES.map((s) => {
          const items = entries.filter((x) => x.e.status === s);
          return (
            <section
              key={s}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(s);
              }}
              onDragLeave={() => setOver((o) => (o === s ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                const slug = e.dataTransfer.getData("text/plain");
                if (slug) update(slug, { status: s });
                setOver(null);
                setDragging(null);
              }}
              className={`flex min-h-[320px] w-[272px] shrink-0 snap-start flex-col rounded-2xl border p-2 transition-colors lg:w-auto ${
                over === s ? "border-line-strong bg-surface-2" : "border-transparent bg-[color-mix(in_srgb,var(--surface-2)_55%,transparent)]"
              }`}
            >
              <header className="flex items-center justify-between px-2 pb-2 pt-1">
                <div>
                  <div className="text-[13px] font-semibold">{STATUS_META[s].label}</div>
                  <div className="text-[11px] text-muted">{STATUS_META[s].hint}</div>
                </div>
                <span className="tabular rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-2 shadow-[var(--shadow-sm)]">{items.length}</span>
              </header>
              <div className="flex flex-1 flex-col gap-2">
                {items.map(({ slug, e, r }) => (
                  <article
                    key={slug}
                    draggable
                    onDragStart={(ev) => {
                      ev.dataTransfer.setData("text/plain", slug);
                      ev.dataTransfer.effectAllowed = "move";
                      setDragging(slug);
                    }}
                    onDragEnd={() => setDragging(null)}
                    className={`card cursor-grab p-3 transition-all active:cursor-grabbing ${dragging === slug ? "opacity-40" : "hover:shadow-[var(--shadow-md)]"}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <Monogram name={r.name} sector={r.sector} size={30} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/companies/${slug}/`} className="block truncate text-[13.5px] font-semibold hover:underline">
                          {r.name}
                        </Link>
                        <div className="truncate text-[11.5px] text-muted">
                          {r.lastRoundDate ? `${formatUsd(r.lastRoundAmount)} · ${formatMonth(r.lastRoundDate)}` : `Added ${e.added}`}
                        </div>
                      </div>
                      <StarButton slug={slug} />
                    </div>
                    <textarea
                      className="mt-2 block min-h-[34px] w-full resize-none rounded-lg bg-transparent px-1.5 py-1 text-[12.5px] leading-snug text-ink-2 outline-none transition-colors placeholder:text-faint hover:bg-surface-2 focus:bg-surface-2"
                      rows={1}
                      defaultValue={e.note ?? ""}
                      placeholder="Add a note…"
                      onBlur={(ev) => update(slug, { note: ev.target.value })}
                      aria-label={`Notes for ${r.name}`}
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <select
                        className="h-7 rounded-md bg-surface-2 px-1.5 text-[11.5px] font-medium text-ink-2 outline-none lg:hidden"
                        value={e.status}
                        onChange={(ev) => update(slug, { status: ev.target.value as Status })}
                        aria-label="Status"
                      >
                        {STATUSES.map((x) => (
                          <option key={x} value={x}>
                            {STATUS_META[x].label}
                          </option>
                        ))}
                      </select>
                      {(r.careers || r.website) && (
                        <a
                          className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-medium text-muted hover:text-ink"
                          href={(r.careers ?? r.website)!}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {r.careers ? "Careers" : "Website"} <ArrowUpRight size={12} />
                        </a>
                      )}
                    </div>
                  </article>
                ))}
                {items.length === 0 && (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line px-3 py-8 text-center text-[12px] text-faint">
                    Drop here
                  </div>
                )}
              </div>
            </section>
          );
        })}
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

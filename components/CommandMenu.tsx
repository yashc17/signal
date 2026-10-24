"use client";
// ⌘K: jump to any company, founder-origin org, investor or page from anywhere.
import MiniSearch from "minisearch";
import { ArrowRight, Building2, CornerDownLeft, FileText, Landmark, Search, Waypoints } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Sector } from "@/lib/schema";
import { Monogram } from "./ui";

export type CommandItem = {
  kind: "company" | "org" | "investor" | "page";
  id: string;
  title: string;
  sub?: string;
  meta?: string;
  sector?: Sector;
  href: string;
  keywords?: string;
};

const PAGES: CommandItem[] = [
  { kind: "page", id: "overview", title: "Overview", sub: "Dashboard of rounds, sectors and top companies", href: "/" },
  { kind: "page", id: "companies", title: "Companies", sub: "Search and filter every tracked startup", href: "/companies/" },
  { kind: "page", id: "graph-lineage", title: "Graph · Talent lineage", sub: "Where founders came from", href: "/graph/?view=lineage" },
  { kind: "page", id: "graph-capital", title: "Graph · Capital", sub: "Who funds whom", href: "/graph/?view=capital" },
  { kind: "page", id: "graph-sector", title: "Graph · Sectors", sub: "The landscape by what they build", href: "/graph/?view=sector" },
  { kind: "page", id: "radar", title: "Radar", sub: "Untracked companies surfacing in the news", href: "/radar/" },
  { kind: "page", id: "watchlist", title: "Watchlist", sub: "Your starred companies and applications", href: "/watchlist/" },
];

const GROUPS: { kind: CommandItem["kind"]; label: string }[] = [
  { kind: "company", label: "Companies" },
  { kind: "org", label: "Founder origins" },
  { kind: "investor", label: "Investors" },
  { kind: "page", label: "Pages" },
];

export const openCommandMenu = () => window.dispatchEvent(new Event("signal:command"));

export function CommandMenu({ items }: { items: CommandItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const all = useMemo(() => [...items, ...PAGES], [items]);
  const byKey = useMemo(() => new Map(all.map((i) => [`${i.kind}:${i.id}`, i])), [all]);

  const search = useMemo(() => {
    const ms = new MiniSearch<CommandItem & { key: string }>({
      idField: "key",
      fields: ["title", "sub", "keywords"],
      searchOptions: { boost: { title: 4 }, prefix: true, fuzzy: 0.2 },
    });
    ms.addAll(all.map((i) => ({ ...i, key: `${i.kind}:${i.id}` })));
    return ms;
  }, [all]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("signal:command", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("signal:command", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      requestAnimationFrame(() => input.current?.focus());
      document.body.style.overflow = "hidden";
    } else document.body.style.overflow = "";
  }, [open]);

  const results = useMemo(() => {
    if (!q.trim()) {
      const top = items.filter((i) => i.kind === "company").slice(0, 6);
      return [...top, ...PAGES];
    }
    return search
      .search(q.trim())
      .slice(0, 24)
      .map((h) => byKey.get(h.id as string)!)
      .filter(Boolean);
  }, [q, search, items, byKey]);

  // Group while keeping each group's best hit order; flat order drives keyboard nav.
  const grouped = useMemo(() => {
    const out: { label: string; items: CommandItem[]; rank: number }[] = [];
    for (const g of GROUPS) {
      const its = results.filter((r) => r.kind === g.kind).slice(0, g.kind === "company" ? 8 : 5);
      if (its.length)
        out.push({ label: q.trim() ? g.label : g.kind === "company" ? "Highest signal" : g.label, items: its, rank: results.indexOf(its[0]) });
    }
    // With a query, the group holding the best hit comes first.
    return q.trim() ? out.sort((a, b) => a.rank - b.rank) : out;
  }, [results, q]);
  const flat = grouped.flatMap((g) => g.items);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    list.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = (it: CommandItem) => {
    setOpen(false);
    router.push(it.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(flat.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && flat[active]) {
      e.preventDefault();
      go(flat[active]);
    } else if (e.key === "Escape") setOpen(false);
  };

  let idx = -1;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="focus-ring group flex h-8 items-center gap-2 rounded-[9px] border border-line bg-surface pl-2.5 pr-1.5 text-[13px] text-muted shadow-[var(--shadow-sm)] transition-colors hover:border-line-strong hover:text-ink"
        aria-label="Search (⌘K)"
      >
        <Search size={14} strokeWidth={2} />
        <span className="hidden pr-6 md:inline">Search…</span>
        <span className="kbd hidden md:inline-flex">⌘K</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal aria-label="Search">
          <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--page)_60%,transparent)] backdrop-blur-[6px]" onClick={() => setOpen(false)} />
          <div className="animate-scale-in relative w-full max-w-[620px] overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-lg)]" onKeyDown={onKeyDown}>
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search size={17} className="text-muted" />
              <input
                ref={input}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search companies, founders, labs, investors…"
                className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
                aria-label="Search"
                aria-activedescendant={flat[active] ? `cmd-${active}` : undefined}
              />
              <span className="kbd">esc</span>
            </div>
            <div ref={list} className="scroll-quiet max-h-[min(60vh,480px)] overflow-y-auto p-2" role="listbox">
              {grouped.map((g) => (
                <div key={g.label} className="mb-1">
                  <div className="px-2.5 pb-1 pt-2 text-[11px] font-medium text-faint">{g.label}</div>
                  {g.items.map((it) => {
                    idx++;
                    const i = idx;
                    const on = i === active;
                    return (
                      <button
                        key={`${it.kind}:${it.id}`}
                        id={`cmd-${i}`}
                        data-idx={i}
                        role="option"
                        aria-selected={on}
                        onMouseMove={() => setActive(i)}
                        onClick={() => go(it)}
                        className={`flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left ${on ? "bg-surface-2" : ""}`}
                      >
                        <ItemIcon it={it} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-medium">{it.title}</div>
                          {it.sub && <div className="truncate text-xs text-muted">{it.sub}</div>}
                        </div>
                        {it.meta && <span className="tabular text-xs text-muted">{it.meta}</span>}
                        {on ? <CornerDownLeft size={14} className="text-muted" /> : <span className="w-[14px]" />}
                      </button>
                    );
                  })}
                </div>
              ))}
              {flat.length === 0 && <div className="px-3 py-10 text-center text-sm text-muted">No matches for “{q}”.</div>}
            </div>
            <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="kbd">↑</span>
                <span className="kbd">↓</span> navigate
              </span>
              <span className="flex items-center gap-1.5">
                <span className="kbd">↵</span> open
              </span>
              <span className="ml-auto flex items-center gap-1">
                Graph results open in the explorer <ArrowRight size={11} />
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ItemIcon({ it }: { it: CommandItem }) {
  if (it.kind === "company" && it.sector) return <Monogram name={it.title} sector={it.sector} size={30} />;
  const Icon = it.kind === "org" ? Building2 : it.kind === "investor" ? Landmark : it.id.startsWith("graph") ? Waypoints : FileText;
  return (
    <span className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] border border-line bg-surface text-ink-2">
      <Icon size={15} strokeWidth={1.8} />
    </span>
  );
}

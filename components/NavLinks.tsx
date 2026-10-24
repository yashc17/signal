"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/companies/", label: "Companies" },
  { href: "/graph/", label: "Graph" },
  { href: "/radar/", label: "Radar" },
  { href: "/watchlist/", label: "Watchlist" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="scroll-quiet flex min-w-0 items-center gap-0.5 overflow-x-auto text-[13px]">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href.replace(/\/$/, ""));
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`focus-ring whitespace-nowrap rounded-lg px-2 py-1.5 font-medium transition-colors sm:px-2.5 ${l.href === "/" ? "hidden sm:block" : ""} ${
              active ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

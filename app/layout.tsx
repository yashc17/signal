import type { Metadata } from "next";
import Link from "next/link";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { CommandMenu, type CommandItem } from "@/components/CommandMenu";
import { Footer } from "@/components/Footer";
import { GithubIcon } from "@/components/icons";
import { NavLinks } from "@/components/NavLinks";
import { ThemeToggle } from "@/components/ThemeToggle";
import { REPO_URL } from "@/lib/config";
import { getDataset } from "@/lib/data";
import { formatUsd, SECTOR_META } from "@/lib/meta";

export const metadata: Metadata = {
  title: "Signal — a map of high-signal AI startups",
  description:
    "An open, sourced map of neolabs and applied AI startups: founders, funding, investors, and how they all connect.",
};

// Runs before paint so the stored theme never flashes.
const themeScript = `try{var t=localStorage.getItem("signal:theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

function commandItems(): CommandItem[] {
  const ds = getDataset();
  const items: CommandItem[] = ds.companies.map((c) => ({
    kind: "company",
    id: c.slug,
    title: c.name,
    sub: SECTOR_META[c.sector].label,
    meta: c.latestValuation ? formatUsd(c.latestValuation) : c.totalRaised ? formatUsd(c.totalRaised) : undefined,
    sector: c.sector,
    href: `/companies/${c.slug}/`,
    keywords: [c.description, c.hq, ...c.tags, ...c.founders.map((f) => f.name)].join(" "),
  }));
  const alumni = new Map<string, number>();
  const portfolio = new Map<string, number>();
  for (const c of ds.companies) {
    for (const p of new Set(c.founders.flatMap((f) => f.prev))) alumni.set(p, (alumni.get(p) ?? 0) + 1);
    for (const i of c.allInvestors) portfolio.set(i, (portfolio.get(i) ?? 0) + 1);
  }
  for (const o of ds.orgs) {
    const n = alumni.get(o.slug) ?? 0;
    if (!n) continue;
    items.push({ kind: "org", id: o.slug, title: o.name, sub: `Alumni founded ${n} ${n === 1 ? "company" : "companies"}`, href: `/graph/?view=lineage&focus=o:${o.slug}` });
  }
  for (const i of ds.investors) {
    const n = portfolio.get(i.slug) ?? 0;
    if (!n) continue;
    items.push({ kind: "investor", id: i.slug, title: i.name, sub: `Backs ${n} tracked ${n === 1 ? "company" : "companies"}`, href: `/graph/?view=capital&focus=i:${i.slug}` });
  }
  return items;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 border-b border-line bg-[var(--glass)] backdrop-blur-xl backdrop-saturate-150">
          <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-1 px-3 sm:gap-2 sm:px-6">
            <Link href="/" className="focus-ring mr-1 flex shrink-0 items-center gap-2 rounded-lg text-[15px] font-semibold tracking-[-0.02em] sm:mr-3" aria-label="Signal home">
              <SignalMark />
              <span className="hidden sm:inline">Signal</span>
            </Link>
            <NavLinks />
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <CommandMenu items={commandItems()} />
              <a className="icon-btn hidden sm:inline-flex" href={REPO_URL} target="_blank" rel="noreferrer" aria-label="GitHub repository">
                <GithubIcon size={17} />
              </a>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <Footer repo={REPO_URL} />
      </body>
    </html>
  );
}

function SignalMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="7" fill="var(--ink)" />
      <path d="M6.5 15.5 L12 9.5 L17.5 13" stroke="var(--page)" strokeOpacity="0.45" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <circle cx="6.5" cy="15.5" r="2" fill="var(--s2)" />
      <circle cx="12" cy="9.5" r="2.4" fill="var(--s1)" />
      <circle cx="17.5" cy="13" r="1.8" fill="var(--s3)" />
    </svg>
  );
}

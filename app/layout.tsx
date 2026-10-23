import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavLinks } from "@/components/NavLinks";
import { REPO_URL } from "@/lib/config";

export const metadata: Metadata = {
  title: "Signal — a map of high-signal AI startups",
  description:
    "An open, sourced map of neolabs and applied AI startups: founders, funding, investors, and how they all connect.",
};

// Runs before paint so the stored theme never flashes.
const themeScript = `try{var t=localStorage.getItem("signal:theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">
        <header className="sticky top-0 z-30 border-b border-line bg-page/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <SignalMark />
              Signal
            </Link>
            <NavLinks />
            <div className="ml-auto flex items-center gap-2">
              <a
                className="hidden text-sm text-ink-2 hover:text-ink sm:block"
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
        <footer className="mx-auto max-w-7xl px-4 pb-10 pt-4 text-xs text-muted sm:px-6">
          Open data, every fact sourced or flagged. Figures marked <em>estimate</em> come from trackers and press reports — verify before
          relying on them.
        </footer>
      </body>
    </html>
  );
}

function SignalMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <circle cx="4" cy="15" r="2.2" fill="var(--s2)" />
      <circle cx="10" cy="9" r="2.6" fill="var(--s1)" />
      <circle cx="16" cy="4" r="2" fill="var(--s3)" />
      <path d="M4 15 L10 9 L16 4" stroke="var(--axis)" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

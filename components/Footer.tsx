"use client";
import { usePathname } from "next/navigation";

// The graph is a full-viewport canvas; everywhere else gets a quiet footer.
export function Footer({ repo }: { repo: string }) {
  const path = usePathname();
  if (path.startsWith("/graph")) return null;
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-8 text-xs text-muted sm:px-6 lg:px-8">
        <p className="max-w-xl leading-relaxed">
          Open data. Every fact links to a source or is flagged. Figures marked <em>estimate</em> come from trackers and press reports, so verify
          before relying on them.
        </p>
        <div className="flex gap-4">
          <a className="hover:text-ink" href={repo} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a className="hover:text-ink" href={`${repo}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noreferrer">
            Contribute
          </a>
          <a className="hover:text-ink" href={`${repo}/issues/new/choose`} target="_blank" rel="noreferrer">
            Suggest a company
          </a>
        </div>
      </div>
    </footer>
  );
}

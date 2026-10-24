import Link from "next/link";
import type { CompanyRow } from "@/lib/data";
import { formatUsd, STAGE_LABEL } from "@/lib/meta";
import { StarButton } from "./StarButton";
import { Monogram, ScoreRing, TrackBadge } from "./ui";

type CardData = Pick<CompanyRow, "slug" | "name" | "sector" | "track" | "stage" | "description" | "valuation" | "totalRaised" | "score">;

export function CompanyCard({ c }: { c: CardData }) {
  return (
    <Link
      href={`/companies/${c.slug}/`}
      className="card group relative flex flex-col p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
    >
      <div className="flex items-start justify-between gap-3">
        <Monogram name={c.name} sector={c.sector} size={40} />
        <div className="opacity-0 transition-opacity group-hover:opacity-100 has-[[aria-pressed=true]]:opacity-100">
          <StarButton slug={c.slug} />
        </div>
      </div>
      <div className="mt-4 text-[15px] font-semibold tracking-[-0.01em]">{c.name}</div>
      <p className="mt-1 line-clamp-2 min-h-[2.6em] text-[13px] leading-[1.3] text-ink-2">{c.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <TrackBadge track={c.track} />
        <span className="text-[11.5px] text-muted">{STAGE_LABEL[c.stage]}</span>
      </div>
      <div className="mt-5 flex items-end justify-between border-t border-line pt-4">
        <div className="flex gap-6">
          <div>
            <div className="text-[11px] text-muted">Valuation</div>
            <div className="tabular mt-0.5 text-[14px] font-semibold">{formatUsd(c.valuation)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted">Raised</div>
            <div className="tabular mt-0.5 text-[14px] font-semibold">{formatUsd(c.totalRaised)}</div>
          </div>
        </div>
        <ScoreRing score={c.score} size={36} />
      </div>
    </Link>
  );
}

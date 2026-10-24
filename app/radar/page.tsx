import fs from "node:fs";
import path from "node:path";
import { ArrowUpRight, Check, Plus, X } from "lucide-react";
import { Container, PageHeader, SectionTitle } from "@/components/ui";
import { REPO_URL } from "@/lib/config";
import { formatUsd } from "@/lib/meta";

export const metadata = { title: "Radar — Signal" };

type Radar = {
  generatedAt: string;
  sources: { name: string; ok: boolean; mentions: number; error?: string }[];
  candidates: {
    name: string;
    score: number;
    amount: number | null;
    round: string | null;
    signals: string[];
    sources: string[];
    evidence: { title: string; url: string; source: string; date?: string }[];
  }[];
};

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

function template(name: string, evidence: string) {
  return `name: ${name}
track: applied        # research | applied
sector: vertical-apps # see lib/schema.ts SECTORS
tags: [ ]
description: TODO one sentence on what they build
website: https://
hq: TODO
founded: ${new Date().getFullYear()}
stage: seed
founders:
  - { name: TODO, prev: [ ] }
rounds:
  - { date: ${new Date().toISOString().slice(0, 7)}, type: seed, amount: TODO, lead: [ ], confidence: reported, source: ${evidence} }
sources: [ ${evidence} ]
updated: ${new Date().toISOString().slice(0, 7)}
`;
}

export default function RadarPage() {
  const file = path.join(process.cwd(), "data", "radar.json");
  const radar: Radar | null = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;

  return (
    <Container>
      <PageHeader
        eyebrow="Discovery pipeline"
        title="Radar"
        sub="Companies surfacing in funding news, investor feeds, Hugging Face, YC and Launch HN that aren't tracked yet. Each is scored on round size, tier-1 investors, founder pedigree and independent mentions. It's a lead list: a human decides what gets in."
      />

      {!radar ? (
        <div className="card p-6 text-sm text-ink-2">
          No radar yet. Run <code className="rounded bg-surface-2 px-1">npm run discover</code> to generate <code>data/radar.json</code>.
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="mr-1 text-muted">
              Last scan {new Date(radar.generatedAt).toLocaleString("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC
            </span>
            {radar.sources.map((s) => (
              <span key={s.name} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-0.5 text-ink-2" title={s.error}>
                {s.ok ? <Check size={11} className="text-good" /> : <X size={11} className="text-warn" />}
                {s.name}
                <span className="tabular text-muted">{s.mentions}</span>
              </span>
            ))}
          </div>

          <section className="card divide-y divide-[var(--border)]">
            {radar.candidates.map((c) => (
              <div key={c.name} className="flex flex-col gap-4 p-5 transition-colors hover:bg-[color-mix(in_srgb,var(--surface-2)_50%,transparent)] md:flex-row md:items-start">
                <div className="flex min-w-0 flex-1 gap-4">
                  <span className="tabular inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-[14px] font-semibold">{c.score}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[15px] font-semibold tracking-[-0.01em]">{c.name}</span>
                      <span className="text-[12.5px] text-muted">{[c.amount ? formatUsd(c.amount) : null, c.round].filter(Boolean).join(" · ")}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.signals.map((s) => (
                        <span key={s} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11.5px] font-medium text-ink-2">
                          {s}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2.5 space-y-1">
                      {c.evidence.slice(0, 3).map((e) => (
                        <a key={e.url} className="group flex min-w-0 items-baseline gap-1.5 text-[12.5px]" href={e.url} target="_blank" rel="noreferrer" title={e.title}>
                          <span className="truncate text-ink-2 group-hover:text-ink">{e.title}</span>
                          <span className="shrink-0 text-[11.5px] text-faint">
                            {e.source}
                            {e.date ? ` · ${e.date}` : ""}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
                <a
                  className="btn btn-secondary shrink-0 self-start"
                  target="_blank"
                  rel="noreferrer"
                  href={`${REPO_URL}/new/main/data/companies?filename=${slugify(c.name)}.yaml&value=${encodeURIComponent(template(c.name, c.evidence[0]?.url ?? ""))}`}
                >
                  <Plus size={14} /> Add to Signal
                </a>
              </div>
            ))}
          </section>
        </>
      )}

      <section className="card mt-6 p-6 text-[13.5px] text-ink-2">
        <SectionTitle title="The manual playbook" sub="What the pipeline can't automate yet. See docs/DISCOVERY.md" />
        <ul className="space-y-2">
          {[
            "Follow people, not companies: frontier-lab researchers who change their bio to \u201cbuilding something new\u201d are the earliest signal.",
            "Watch tier-1 seed and Series A announcements and partner blog posts (a16z, Sequoia, Thrive, Founders Fund, Greylock, Conviction).",
            "Cross-check curated trackers: the cleverhack neolab tracker, neolabs.fyi, Forbes AI 50, Value Add VC rankings.",
            "Look for unusually large seeds (\u2265 $20M). They almost always mean exceptional founders.",
          ].map((t) => (
            <li key={t} className="flex gap-2.5">
              <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-faint" />
              {t}
            </li>
          ))}
        </ul>
        <a className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-ink hover:underline" href={`${REPO_URL}/blob/main/docs/DISCOVERY.md`} target="_blank" rel="noreferrer">
          Read the discovery playbook <ArrowUpRight size={13} />
        </a>
      </section>
    </Container>
  );
}

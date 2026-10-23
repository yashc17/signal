import fs from "node:fs";
import path from "node:path";
import { SectionTitle } from "@/components/ui";
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
    <div className="space-y-6">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Radar</h1>
        <p className="mt-1 text-sm text-ink-2">
          Companies the discovery pipeline found that aren&apos;t tracked yet. It scans funding news, investor feeds, Hugging Face trending models, YC
          and Launch HN, then scores each candidate on round size, tier-1 investors, founder pedigree and how many independent sources mention it. A
          human decides what gets in — this is a lead list, not the dataset.
        </p>
      </div>

      {!radar ? (
        <div className="card p-6 text-sm text-ink-2">
          No radar yet. Run <code className="rounded bg-surface-2 px-1">npm run discover</code> to generate <code>data/radar.json</code>.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-muted">
              Last scan {new Date(radar.generatedAt).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })} ·
            </span>
            {radar.sources.map((s) => (
              <span key={s.name} className="rounded-full border border-line px-2 py-0.5 text-ink-2" title={s.error}>
                {s.ok ? "✓" : "✗"} {s.name} · {s.mentions}
              </span>
            ))}
          </div>

          <section className="card overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-2.5 font-medium">Score</th>
                  <th className="px-3 py-2.5 font-medium">Candidate</th>
                  <th className="px-3 py-2.5 font-medium">Why it surfaced</th>
                  <th className="px-3 py-2.5 font-medium">Evidence</th>
                  <th className="px-3 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {radar.candidates.map((c) => (
                  <tr key={c.name} className="border-b border-line align-top last:border-0">
                    <td className="tabular px-4 py-3 font-semibold">{c.score}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted">
                        {[c.amount ? formatUsd(c.amount) : null, c.round, c.sources.join(", ")].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex max-w-80 flex-wrap gap-1">
                        {c.signals.map((s) => (
                          <span key={s} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-2">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="max-w-96 px-3 py-3 text-xs">
                      {c.evidence.slice(0, 3).map((e) => (
                        <div key={e.url} className="mb-1 truncate">
                          <a className="link" href={e.url} target="_blank" rel="noreferrer" title={e.title}>
                            {e.title}
                          </a>
                          <span className="text-muted">
                            {" "}
                            · {e.source}
                            {e.date ? ` · ${e.date}` : ""}
                          </span>
                        </div>
                      ))}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs">
                      <a
                        className="control"
                        target="_blank"
                        rel="noreferrer"
                        href={`${REPO_URL}/new/main/data/companies?filename=${slugify(c.name)}.yaml&value=${encodeURIComponent(template(c.name, c.evidence[0]?.url ?? ""))}`}
                      >
                        Add →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      <section className="card p-5 text-sm text-ink-2">
        <SectionTitle title="The manual playbook" sub="What the pipeline can't automate (yet) — see docs/DISCOVERY.md" />
        <ul className="list-disc space-y-1 pl-5">
          <li>Follow people, not companies: frontier-lab researchers who change their bio to &ldquo;building something new&rdquo; are the earliest signal.</li>
          <li>Watch tier-1 seed/Series A announcements and partner blog posts (a16z, Sequoia, Thrive, Founders Fund, Greylock, Conviction).</li>
          <li>Cross-check curated trackers: cleverhack neolab tracker, neolabs.fyi, Forbes AI 50, Value Add VC rankings.</li>
          <li>Look for unusually large seeds (≥ $20M) — they almost always mean exceptional founders.</li>
        </ul>
      </section>
    </div>
  );
}

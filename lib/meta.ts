// Display metadata that is safe to import from client components.
import type { Sector, Stage, Track } from "./schema";

export const SECTOR_META: Record<Sector, { label: string; blurb: string; slot: number }> = {
  "frontier-models": {
    label: "Frontier & general models",
    blurb: "General-purpose models, new architectures, recursive self-improvement, continual learning.",
    slot: 1,
  },
  "coding-devtools": {
    label: "Coding & devtools",
    blurb: "AI software engineers, IDEs, app builders, developer platforms.",
    slot: 2,
  },
  "infra-compute": {
    label: "Infra & compute",
    blurb: "Chips, GPU clouds, inference, training and data infrastructure.",
    slot: 3,
  },
  "physical-ai": {
    label: "Physical AI & robotics",
    blurb: "Robot foundation models, humanoids, autonomy.",
    slot: 4,
  },
  "world-models-media": {
    label: "World models & media",
    blurb: "World simulators, video, image, voice and music generation.",
    slot: 5,
  },
  science: {
    label: "AI for science",
    blurb: "AI scientists, drug discovery, materials, mathematics.",
    slot: 6,
  },
  "vertical-apps": {
    label: "Vertical & enterprise apps",
    blurb: "Legal, health, finance, customer experience, search, work.",
    slot: 7,
  },
  "defense-security": {
    label: "Defense & security",
    blurb: "Autonomous defense systems and AI security.",
    slot: 8,
  },
};

export const TRACK_META: Record<Track, { label: string; blurb: string; slot: number }> = {
  research: { label: "Research lab", blurb: "Primary output is new models or methods (neolabs).", slot: 1 },
  applied: { label: "Applied", blurb: "Primary output is a product sold to customers.", slot: 2 },
};

export const STAGE_LABEL: Record<Stage, string> = {
  stealth: "Stealth",
  "pre-seed": "Pre-seed",
  seed: "Seed",
  "series-a": "Series A",
  "series-b": "Series B",
  "series-c": "Series C",
  "series-d": "Series D",
  growth: "Growth (E+)",
  acquired: "Acquired",
  public: "Public",
  nonprofit: "Non-profit",
};

export const ROUND_LABEL: Record<string, string> = {
  "pre-seed": "Pre-seed",
  seed: "Seed",
  "series-a": "Series A",
  "series-b": "Series B",
  "series-c": "Series C",
  "series-d": "Series D",
  "series-e": "Series E",
  "series-f": "Series F",
  "series-g": "Series G",
  "series-h": "Series H",
  growth: "Growth",
  strategic: "Strategic",
  debt: "Debt",
  grant: "Grant",
  undisclosed: "Undisclosed",
};

export function formatUsd(n: number | undefined | null, opts: { digits?: number } = {}): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const d = opts.digits ?? 1;
  const strip = (s: string) => s.replace(/\.0+$/, "");
  if (n >= 1e12) return `$${strip((n / 1e12).toFixed(d + 1))}T`;
  if (n >= 1e9) return `$${strip((n / 1e9).toFixed(n >= 1e10 ? 0 : d))}B`;
  if (n >= 1e6) return `$${strip((n / 1e6).toFixed(0))}M`;
  if (n >= 1e3) return `$${strip((n / 1e3).toFixed(0))}K`;
  return `$${n}`;
}

export function formatMonth(s: string | undefined): string {
  if (!s) return "—";
  const [y, m] = s.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Number(m) - 1]} ${y}`;
}

export const withBase = (p: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${p}`;

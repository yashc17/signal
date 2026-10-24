# Signal

**An open, sourced map of high-signal AI startups.** Neolabs and applied AI companies that are exceptionally well-funded or founded by people at the top of their field. Who started them, who backs them, and how they all connect.

- **Overview**: a live map of the landscape, every disclosed round on one timeline, where founders come from, the most active lead investors, and capital by sector.
- **Knowledge graph**: a full-screen explorer with three lenses on the same companies. *Talent* shows which labs and schools founders came from, *Capital* shows who funds whom, and *Sectors* is a map of territories. Switching lenses morphs the graph in place. Click any node to light up its connections and open an inspector, and share deep links like `/graph/?view=lineage&focus=o:openai`.
- **Companies**: a searchable, filterable directory (track, sector, stage, internships) in list or grid view, with a transparent *signal score*.
- **Company pages**: founders and their lineage, a funding timeline with per-round sources and confidence, related companies, and companies that share investors.
- **⌘K**: jump to any company, founder origin, investor or page from anywhere.
- **Radar**: a discovery pipeline that surfaces companies not yet tracked, with the evidence behind each.
- **Watchlist**: an application board (Interested → Applied → Interviewing → Offer) with drag and drop and notes. It's stored only in your browser; export to CSV or JSON.

## What counts as "high-signal"

A company is included if it meets **at least one**:

| Signal | Bar |
|---|---|
| Capital | ≥ ~$20M from a tier-1 lead, or a valuation ≥ $500M |
| Founders | Senior alumni of frontier labs (OpenAI, Google DeepMind, Anthropic, Meta FAIR, xAI), top-of-field academics, or founders with prior major exits |
| Traction | Clear market pull — category-defining product, top YC company, Forbes AI 50 |
| Research | Ships models, papers or open weights people actually use |

Companies are split into two **tracks**: *research labs* (primary output is new models or methods — "neolabs") and *applied* (primary output is a product).

## The signal score (0–100)

Fully explainable — every company page shows its breakdown.

| Component | Max | How |
|---|---|---|
| Capital raised | 30 | log scale, $1M → 0, $1B+ → 30 (≈10% of valuation if no rounds disclosed) |
| Founder pedigree | 25 | 10 per founder from a `pedigree` org in `data/orgs.yaml` |
| Investor quality | 20 | tier-1 lead 8, tier-1 participant 4, tier-2 lead 3 (`data/investors.yaml`) |
| Valuation | 15 | log scale, $100M → 0, $10B+ → 15 |
| Momentum | 10 | raised in last 12 months 10, last 24 months 5 |

## Data

Everything lives in plain YAML under [`data/`](data) — **git is the database**:

```
data/companies/<slug>.yaml   one file per company (schema: lib/schema.ts)
data/orgs.yaml               where founders come from (powers the lineage graph)
data/investors.yaml          investors and their tier
data/radar.json              latest discovery scan (generated)
```

Every funding round carries a `confidence` (`confirmed` / `reported` / `estimate`) and a `source` URL. Facts without a source are shown as **needs source** in the UI — run `npm run audit-sources` for the queue. Valuations in this space move fast and are often rumors; treat `estimate` figures accordingly.

Data is compiled from public reporting and trackers including the [cleverhack neolab tracker](https://cleverhack.com/neolab-and-emerging-ai-lab-tracker), [neolabs.fyi](https://neolabs.fyi/) and [Value Add VC](https://valueaddvc.com/rankings/ai). Nothing is scraped from paid databases.

## Develop

```bash
npm install
npm run dev            # http://localhost:3000
npm run validate       # schema + cross-reference checks
npm run discover       # refresh the Radar (data/radar.json)
npm run audit-sources  # list facts that still need a citation
npm run new -- "Company Name" research   # scaffold a company file
npm run build          # static export to out/
```

Stack: Next.js (static export) · TypeScript · Tailwind · Geist · Sigma.js + graphology (WebGL graph; every lens is laid out at build time, so the browser only animates) · d3-scale · MiniSearch · lucide icons. No backend — deploys free to GitHub Pages (see `.github/workflows/deploy.yml`).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The most valuable contributions are **sources for existing facts** and **new companies with evidence**. The discovery playbook is in [docs/DISCOVERY.md](docs/DISCOVERY.md); the roadmap is in [PLAN.md](PLAN.md).

## License

Code: [MIT](LICENSE). Data in `data/`: [CC BY-SA 4.0](data/LICENSE).

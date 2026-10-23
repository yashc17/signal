# Signal — plan & roadmap

## Vision
A beautiful, open, trustworthy map of high-signal AI startups — for people choosing where to work (internships!), invest attention, or understand how the ecosystem connects.

## Principles
1. **Explainable inclusion** — written criteria, transparent score.
2. **Every fact sourced or flagged** — confidence levels on every number.
3. **Relationships over lists** — lineage and co-investment are the interesting edges.
4. **Git is the database** — PR-reviewed YAML, no backend.

## Phases
| # | Phase | Status |
|---|---|---|
| 0 | Schema, validation, inclusion criteria, licenses | ✅ |
| 1 | Seed dataset (~136 companies, Oct 2026) | ✅ — 134 facts still need sources (`npm run audit-sources`) |
| 2 | Directory, filters, company pages, search | ✅ |
| 3 | Knowledge graph (lineage / capital / sectors) | ✅ |
| 4 | Overview visualizations | ✅ |
| 5 | Watchlist + application tracker (local) | ✅ |
| 6 | Discovery radar + weekly GitHub Action | ✅ (heuristic extraction) |
| 7 | Open-source polish: README, CONTRIBUTING, CI, Pages deploy, issue form | ✅ |

## Next
- [ ] Source the 134 unsourced facts, starting with the highest-signal companies.
- [ ] Fill `internships` and `links.careers` for every company (the most useful field for recruiting).
- [ ] LLM-assisted extraction in `discover` to draft YAML for radar candidates.
- [ ] Investor pages (portfolio, co-investors) and org pages (alumni companies).
- [ ] Timeline animation of the graph (watch neolabs appear, 2023 → today).
- [ ] People nodes in the lineage graph (founder ↔ company ↔ prior lab).
- [ ] "What changed this week" feed generated from git history.

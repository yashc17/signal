# Contributing to Signal

Thanks for helping keep this map accurate. Three ways to help, in order of impact:

## Verifying facts

Run `npm run audit-sources` to list every round or event without a `source`, highest-signal companies first. Find a primary source (company blog/press release → `confirmed`) or credible press (TechCrunch, Bloomberg, The Information, Reuters, FT → `reported`), then add it:

```yaml
rounds:
  - { date: 2025-09, type: seed, amount: 300M, lead: [ a16z ], confidence: confirmed, source: https://... }
```

Trackers and aggregators (neolabs.fyi, Value Add VC, Sacra, multiples.vc) are fine as a starting point but should be marked `estimate`.

## Adding a company

1. Check it meets an inclusion bar in the [README](README.md#what-counts-as-high-signal). When in doubt, open an issue with the "Suggest a company" form.
2. `npm run new -- "Company Name" research` (or `applied`) and fill in the TODOs. The Radar page's **Add →** button pre-fills the same template on GitHub.
3. Founders' `prev` should reference slugs in `data/orgs.yaml` (or other company slugs). Add an org there if it's missing — set `pedigree: true` only for frontier labs, top research groups, or companies with a strong founder track record.
4. Investors must be slugs from `data/investors.yaml`; add new ones with a tier (1 = elite early-stage AI signal, 2 = strong, 3 = everyone else).
5. `npm run validate` must pass with no errors.

## Changing scores or tiers

Investor tiers and pedigree orgs are opinionated. Open a PR changing `data/investors.yaml` or `data/orgs.yaml` with your reasoning in the description.

## Conventions

- Dates are `YYYY-MM` (or `YYYY-MM-DD`). Money is `300M`, `1.1B`, etc.
- One company per file, filename = slug (lowercase-kebab-case).
- Keep descriptions to one sentence about what they build and why it matters — no marketing copy.
- Never add personal contact info for individuals.

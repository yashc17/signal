# How to find high-signal AI companies

High-signal companies are rarely found by browsing lists of "AI startups". They surface through a few reliable channels, most of which Signal automates (`npm run discover` → `/radar`).

## 1. Follow the money — but only the right money (automated)

Funding announcements are the most reliable public signal. The pipeline queries Google News, TechCrunch Venture and Value Add VC for funding headlines, then extracts company, amount and round. Candidates score higher when:

- **The round is large for its stage.** A seed ≥ $20M almost always means exceptional founders — investors only write those checks for people they've been tracking for years.
- **A tier-1 firm leads.** Named in `data/investors.yaml`. a16z, Sequoia, Thrive, Founders Fund, Greylock, Index, Lux, Conviction, Radical, NFDG, etc.
- **Several independent outlets cover it.** Corroboration filters out press-release noise.

## 2. Follow people, not companies (partly automated)

The earliest signal for a neolab is a **departure**: a senior researcher leaves OpenAI / DeepMind / Anthropic / Meta FAIR, and 3–9 months later a lab appears. The pipeline flags headlines containing pedigree phrases ("ex-OpenAI", "former DeepMind researchers", "xAI co-founder").

Manually, the highest-yield habits are:
- Follow frontier-lab researchers on X and watch for bio changes ("building something new", "stealth").
- Watch the [cleverhack neolab tracker](https://cleverhack.com/neolab-and-emerging-ai-lab-tracker) and its Twitter list.
- Read the "people moves" sections of newsletters (The Information, Semafor Tech, Import AI).
- Use the **Talent lineage** graph in reverse: big hubs (Google DeepMind, OpenAI, Stanford) keep producing founders — their next alumni company is the one to watch.

## 3. Watch what researchers actually use (automated)

The pipeline checks **Hugging Face trending models** and flags organizations (not individual uploaders) with trending open weights that aren't tracked yet. Shipping widely used open weights is one of the strongest signals for a research lab.

## 4. Accelerators and launches (automated)

- **Y Combinator**: AI-tagged companies marked *top company*, or recent batches already above ~25 people.
- **Launch HN** posts with high engagement in the last 60 days.

These score lower — they're good leads for applied companies, rarely for neolabs.

## 5. Curated lists to cross-check (manual)

| Source | Good for |
|---|---|
| [cleverhack neolab tracker](https://cleverhack.com/neolab-and-emerging-ai-lab-tracker) | Neolab news, daily |
| [neolabs.fyi](https://neolabs.fyi/) | Neolab founders, lineage, valuations |
| [Value Add VC rankings](https://valueaddvc.com/rankings/ai) | Biggest rounds, valuations (has RSS) |
| Forbes AI 50 (annual) | Applied leaders |
| Tier-1 VC portfolio pages & partner blogs | Early seeds before press |

## Turning a lead into an entry

1. Open the candidate's evidence links on `/radar`.
2. Check it against the inclusion bar (README).
3. Click **Add →** (or `npm run new`), fill in founders with their `prev` orgs, and cite every round.

## Ideas to extend the pipeline

- **LLM extraction**: pass each headline + article to an LLM to extract structured fields (company, round, amount, lead, founders' prior employers) and draft the YAML automatically for review.
- **arXiv affiliations**: new affiliations appearing on papers by well-known authors.
- **GitHub**: new orgs whose repos gain stars quickly.
- **Job boards**: Ashby/Greenhouse boards appearing for stealth companies (also great for internship timing).

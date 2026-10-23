// Validates every data file against the schema and checks cross-references.
// Exit code 1 on schema errors; unknown slugs are warnings (they still render, just unlinked).
import { loadRaw } from "../lib/data";

const { companies, orgs, investors, errors } = loadRaw();
const companySlugs = new Set(companies.map((c) => c.slug));
const orgSlugs = new Set(orgs.map((o) => o.slug));
const investorSlugs = new Set(investors.map((i) => i.slug));
const warnings: string[] = [];

for (const c of companies) {
  const at = `data/companies/${c.slug}.yaml`;
  for (const f of c.founders)
    for (const p of f.prev)
      if (!orgSlugs.has(p) && !companySlugs.has(p)) warnings.push(`${at}: founder ${f.name} prev "${p}" is not in data/orgs.yaml`);
  for (const r of c.rounds)
    for (const s of [...r.lead, ...r.investors])
      if (!investorSlugs.has(s)) warnings.push(`${at}: investor "${s}" (${r.date}) is not in data/investors.yaml`);
  for (const s of c.related) if (!companySlugs.has(s)) warnings.push(`${at}: related "${s}" is not a tracked company`);
  for (const e of c.events) if (e.with && !companySlugs.has(e.with)) warnings.push(`${at}: event.with "${e.with}" is not a tracked company`);
}

const dupNames = new Map<string, string[]>();
for (const c of companies) {
  const k = c.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  dupNames.set(k, [...(dupNames.get(k) ?? []), c.slug]);
}
for (const [, slugs] of dupNames) if (slugs.length > 1) errors.push(`Duplicate company names: ${slugs.join(", ")}`);

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);
console.log(`\n${companies.length} companies · ${orgs.length} orgs · ${investors.length} investors · ${errors.length} errors · ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);

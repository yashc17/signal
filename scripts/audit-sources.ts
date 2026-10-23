// Lists facts that still need a citation, highest-signal companies first — the verification queue.
import { getDataset } from "../lib/data";

const ds = getDataset();
let total = 0;
for (const c of ds.companies.filter((c) => c.unsourced > 0)) {
  const missing = [
    ...c.rounds.filter((r) => !r.source).map((r) => `round ${r.date} ${r.type}${r.amount ? ` $${r.amount / 1e6}M` : ""}`),
    ...c.events.filter((e) => !e.source).map((e) => `event ${e.date} ${e.type}`),
  ];
  if (!missing.length) continue;
  total += missing.length;
  console.log(`\n${c.name}  (score ${c.score})  data/companies/${c.slug}.yaml`);
  for (const m of missing) console.log(`  - ${m}`);
}
console.log(`\n${total} facts need a source.`);

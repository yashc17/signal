// Scaffold a new company file:  npm run new -- "Company Name" [research|applied]
import fs from "node:fs";
import path from "node:path";

const name = process.argv[2];
const track = process.argv[3] === "research" ? "research" : "applied";
if (!name) {
  console.error('Usage: npm run new -- "Company Name" [research|applied]');
  process.exit(1);
}
const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const file = path.join(process.cwd(), "data", "companies", `${slug}.yaml`);
if (fs.existsSync(file)) {
  console.error(`${file} already exists`);
  process.exit(1);
}
const ym = new Date().toISOString().slice(0, 7);
fs.writeFileSync(
  file,
  `name: ${name}
track: ${track}
sector: ${track === "research" ? "frontier-models" : "vertical-apps"} # frontier-models | world-models-media | physical-ai | science | coding-devtools | infra-compute | vertical-apps | defense-security
tags: [ ]
description: TODO — one sentence on what they build and why it matters.
website: https://TODO
hq: TODO
founded: ${new Date().getFullYear()}
stage: seed # stealth | pre-seed | seed | series-a | series-b | series-c | series-d | growth | acquired | public | nonprofit
founders:
  - { name: TODO, prev: [ ], note: TODO } # prev = slugs from data/orgs.yaml or other company slugs
rounds:
  - { date: ${ym}, type: seed, amount: TODO, lead: [ ], investors: [ ], confidence: reported, source: https://TODO }
related: [ ]
internships: unknown
sources: [ ]
updated: ${ym}
`,
);
console.log(`Created ${path.relative(process.cwd(), file)} — fill in the TODOs, then run npm run validate`);

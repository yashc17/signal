import { CompanyExplorer } from "@/components/CompanyExplorer";
import { getDataset, toRow } from "@/lib/data";

export const metadata = { title: "Companies — Signal" };

export default function CompaniesPage() {
  const ds = getDataset();
  const investorNames = Object.fromEntries(ds.investors.map((i) => [i.slug, i.name]));
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
      <p className="mb-6 mt-1 text-sm text-ink-2">
        Every tracked research lab and applied AI startup. Search matches names, founders, investors, tags and locations.
      </p>
      <CompanyExplorer rows={ds.companies.map(toRow)} investorNames={investorNames} />
    </div>
  );
}

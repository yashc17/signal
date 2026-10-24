import { CompanyExplorer } from "@/components/CompanyExplorer";
import { Container, PageHeader } from "@/components/ui";
import { getDataset, toRow } from "@/lib/data";

export const metadata = { title: "Companies — Signal" };

export default function CompaniesPage() {
  const ds = getDataset();
  const investorNames = Object.fromEntries(ds.investors.map((i) => [i.slug, i.name]));
  return (
    <Container>
      <PageHeader
        eyebrow={`${ds.companies.length} companies`}
        title="Companies"
        sub="Every tracked research lab and applied AI startup. Search matches names, founders, investors, tags and locations."
      />
      <CompanyExplorer rows={ds.companies.map(toRow)} investorNames={investorNames} />
    </Container>
  );
}

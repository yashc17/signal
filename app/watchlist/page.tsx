import { Watchlist } from "@/components/Watchlist";
import { Container, PageHeader } from "@/components/ui";
import { getDataset, toRow } from "@/lib/data";

export const metadata = { title: "Watchlist — Signal" };

export default function WatchlistPage() {
  return (
    <Container>
      <PageHeader
        eyebrow="Your applications"
        title="Watchlist"
        sub="Track every company you're interested in, from first star to offer. Stored only in this browser, so export to back it up."
      />
      <Watchlist rows={getDataset().companies.map(toRow)} />
    </Container>
  );
}

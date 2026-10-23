import { Watchlist } from "@/components/Watchlist";
import { getDataset, toRow } from "@/lib/data";

export const metadata = { title: "Watchlist — Signal" };

export default function WatchlistPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Watchlist</h1>
      <p className="mb-6 mt-1 text-sm text-ink-2">
        Star companies anywhere on the site to track them here, along with where you are in the process. Stored only in this browser — export to back it up.
      </p>
      <Watchlist rows={getDataset().companies.map(toRow)} />
    </div>
  );
}

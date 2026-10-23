import { GraphExplorer } from "@/components/GraphExplorer";
import { getDataset } from "@/lib/data";
import { buildAllGraphs } from "@/lib/graph";

export const metadata = { title: "Graph — Signal" };

export default function GraphPage() {
  const graphs = buildAllGraphs(getDataset());
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Knowledge graph</h1>
      <p className="mb-5 mt-1 text-sm text-ink-2">Three lenses on the same companies: who founded them, who funds them, and what they work on.</p>
      <GraphExplorer graphs={graphs} />
    </div>
  );
}

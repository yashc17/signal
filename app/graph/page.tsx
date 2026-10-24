import { GraphExplorer } from "@/components/GraphExplorer";
import { getDataset } from "@/lib/data";
import { buildUnifiedGraph } from "@/lib/graph";

export const metadata = { title: "Graph — Signal" };

export default function GraphPage() {
  return <GraphExplorer data={buildUnifiedGraph(getDataset())} />;
}

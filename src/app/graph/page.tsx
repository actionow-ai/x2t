import { getGraphData } from "@/lib/stance";
import { GraphCanvas } from "@/components/GraphCanvas";
import { getLocale } from "@/lib/i18n-server";
import { getDict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function GraphPage() {
  const g = await getGraphData();
  const t = getDict(await getLocale());

  return (
    <>
      <h1 className="page-title">{t.graph.title}</h1>
      <p className="page-sub">{t.graph.sub}</p>

      {g.edges.length === 0 ? (
        <div className="empty">{t.graph.emptyData}</div>
      ) : (
        <GraphCanvas influencers={g.influencers} edges={g.edges} />
      )}
    </>
  );
}

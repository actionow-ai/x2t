import { getGraphData } from "@/lib/stance";
import { GraphCanvas } from "@/components/GraphCanvas";

export const dynamic = "force-dynamic";

export default async function GraphPage() {
  const g = await getGraphData();

  return (
    <>
      <h1 className="page-title">关系图谱</h1>
      <p className="page-sub">博主 ↔ 股票（每对取最新立场） · 绿=看多 红=看空 黄=中性</p>

      {g.edges.length === 0 ? (
        <div className="empty">
          还没有分析数据。<br />先 <code>pnpm analyze:once</code> 生成立场。
        </div>
      ) : (
        <GraphCanvas influencers={g.influencers} edges={g.edges} />
      )}
    </>
  );
}

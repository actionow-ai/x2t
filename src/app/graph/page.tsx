import type { Metadata } from "next";
import { getGraphData } from "@/lib/stance";
import { GraphCanvas } from "@/components/GraphCanvas";
import { getLocale } from "@/lib/i18n-server";
import { getDict } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

// 读 cookie locale(双语)→ 必须 force-dynamic;重 RSC 的数据(getGraphData)已有 60s 进程内 memo。
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(await getLocale());
  return pageMetadata({ path: "/graph", title: t.graph.title, description: t.graph.sub });
}

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

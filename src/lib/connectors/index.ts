import type { Connector } from "./types";
import { rssConnector } from "./rss";
import { manualConnector } from "./manual";

// 连接器注册表 —— 新增源类型在这里登记即可（社区可贡献）。
const connectors: Record<string, Connector> = {
  [rssConnector.kind]: rssConnector,
  [manualConnector.kind]: manualConnector,
};

export function getConnector(kind: string): Connector {
  const c = connectors[kind];
  if (!c) throw new Error(`未知抓取连接器: "${kind}"（已注册: ${Object.keys(connectors).join(", ")}）`);
  return c;
}

export { connectors };
export type { Connector, NormalizedPost, InfluencerSource } from "./types";

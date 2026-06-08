import type { Connector, InfluencerSource, FetchResult } from "./types";

// 人工提交不走轮询：帖子由 /submit 表单经 ingest.storePost 直接入库。
// 这里只占位以满足连接器接口（轮询时返回空）。
export const manualConnector: Connector = {
  kind: "manual",
  async fetch(_source: InfluencerSource): Promise<FetchResult> {
    return { posts: [] };
  },
};

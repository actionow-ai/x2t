// 可插拔抓取连接器接口 —— 设计文档 §4
// 实现：rss（默认）、manual（人工提交）、x-api（自带 key，后续切片）

/** 连接器拉回来的、规范化后的一条帖子 */
export type NormalizedPost = {
  /** 去重键：连接器内稳定唯一（RSS 用 guid/link，X-API 用 tweet id） */
  platformPostId: string;
  url?: string;
  contentText: string;
  postedAt: Date;
  media?: unknown;
  raw?: unknown;
};

/** 入库时传给连接器的博主源信息 */
export type InfluencerSource = {
  id: string;
  handle: string;
  platform: string;
  sourceConfig: Record<string, unknown>;
};

export interface Connector {
  /** 连接器标识，匹配 influencer.sourceConfig.connector */
  readonly kind: string;
  /**
   * 拉取该博主的最新帖子。新旧都可返回——去重在入库层（@@unique）做，
   * 连接器只负责"取回 + 规范化"，不关心是否已存在。
   */
  fetch(source: InfluencerSource): Promise<NormalizedPost[]>;
}

import { prisma } from "./db";
import { getConnector } from "./connectors";
import type { NormalizedPost } from "./connectors/types";

/**
 * 入库一条帖子。幂等：靠 Post 的 @@unique([influencerId, platformPostId])。
 * 已存在则不动（不覆盖、不触发重复推送）。
 */
export async function storePost(influencerId: string, p: NormalizedPost) {
  return prisma.post.upsert({
    where: {
      influencerId_platformPostId: {
        influencerId,
        platformPostId: p.platformPostId,
      },
    },
    create: {
      influencerId,
      platformPostId: p.platformPostId,
      url: p.url,
      contentText: p.contentText,
      postedAt: p.postedAt,
      mediaJson: p.media === undefined ? undefined : (p.media as object),
      rawJson: p.raw === undefined ? undefined : (p.raw as object),
    },
    update: {}, // no-op：已存在则保持原样
  });
}

/** 抓取并入库单个博主，返回 { fetched, created }。失败时记录到 influencer.fetchError 并抛出。 */
export async function ingestInfluencer(influencerId: string): Promise<{ fetched: number; created: number }> {
  const inf = await prisma.influencer.findUniqueOrThrow({ where: { id: influencerId } });
  const config = (inf.sourceConfig ?? {}) as Record<string, unknown>;
  const kind = (config.connector as string) ?? "rss";
  const connector = getConnector(kind);

  try {
    const posts = await connector.fetch({
      id: inf.id,
      handle: inf.handle,
      platform: inf.platform,
      sourceConfig: config,
    });

    let created = 0;
    for (const p of posts) {
      const existing = await prisma.post.findUnique({
        where: { influencerId_platformPostId: { influencerId: inf.id, platformPostId: p.platformPostId } },
        select: { id: true },
      });
      await storePost(inf.id, p);
      if (!existing) created++;
    }

    await prisma.influencer.update({
      where: { id: inf.id },
      data: { lastFetchedAt: new Date(), fetchError: null },
    });

    return { fetched: posts.length, created };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.influencer.update({ where: { id: inf.id }, data: { fetchError: message } });
    throw err;
  }
}

/** 抓取所有 active 博主。单个失败不影响其他（错误隔离）。 */
export async function ingestAll(): Promise<{ influencers: number; created: number }> {
  const active = await prisma.influencer.findMany({ where: { active: true } });
  let created = 0;

  for (const inf of active) {
    try {
      const r = await ingestInfluencer(inf.id);
      created += r.created;
      console.log(`[ingest] ${inf.handle}: 取回 ${r.fetched}，新增 ${r.created}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[ingest] ${inf.handle} 失败: ${message}`);
    }
  }

  return { influencers: active.length, created };
}

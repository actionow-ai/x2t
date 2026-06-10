import { prisma } from "./db";
import { getConnector } from "./connectors";
import { notifyNewPost } from "./push";
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
    const { posts, profile } = await connector.fetch({
      id: inf.id,
      handle: inf.handle,
      platform: inf.platform,
      sourceConfig: config,
    });

    // 一次性查出本批已存在的 platformPostId(消除每帖一次 findUnique 的读 N+1)
    const existingIds = posts.length
      ? new Set(
          (
            await prisma.post.findMany({
              where: { influencerId: inf.id, platformPostId: { in: posts.map((p) => p.platformPostId) } },
              select: { platformPostId: true },
            })
          ).map((r) => r.platformPostId),
        )
      : new Set<string>();

    const createdIds: string[] = [];
    for (const p of posts) {
      if (existingIds.has(p.platformPostId)) continue; // 已存在:跳过 upsert(消每帖一次无效写)
      const stored = await storePost(inf.id, p);
      createdIds.push(stored.id);
    }

    await prisma.influencer.update({
      where: { id: inf.id },
      data: {
        lastFetchedAt: new Date(),
        fetchError: null,
        ...(profile?.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
      },
    });

    // 「新帖」事件 → web-push（失败不影响抓取）
    for (const id of createdIds) {
      try {
        await notifyNewPost(id);
      } catch (err) {
        console.error(`[notify] post ${id} 推送失败:`, err instanceof Error ? err.message : err);
      }
    }

    return { fetched: posts.length, created: createdIds.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.influencer.update({ where: { id: inf.id }, data: { fetchError: message } });
    throw err;
  }
}

/** 抓取所有 active 博主。单个失败不影响其他（错误隔离）。 */
export async function ingestAll(): Promise<{ influencers: number; created: number }> {
  // 排除已申请移除(optedOut)的博主;小并发池抓取(原串行,100 源最坏超过轮询周期,性能 P1-6)
  const active = await prisma.influencer.findMany({ where: { active: true, optedOut: false }, select: { id: true, handle: true } });
  const conc = Math.max(1, Math.min(8, Number(process.env.INGEST_CONCURRENCY ?? 5)));
  let created = 0;
  let idx = 0;
  async function worker() {
    while (idx < active.length) {
      const inf = active[idx++];
      try {
        const r = await ingestInfluencer(inf.id);
        created += r.created;
        console.log(`[ingest] ${inf.handle}: 取回 ${r.fetched}，新增 ${r.created}`);
      } catch (err) {
        console.error(`[ingest] ${inf.handle} 失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(conc, active.length) }, () => worker()));
  return { influencers: active.length, created };
}

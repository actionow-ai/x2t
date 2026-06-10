import type { Metadata } from "next";
import { getPostDetail, PostDetail } from "@/components/PostDetail";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/db";
import { articleJsonLd, SITE_URL, pageMetadata, ogImageUrl } from "@/lib/seo";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const locale = await getLocale();
  const post = await prisma.post.findUnique({ where: { id }, include: { influencer: true, analysis: true } });
  if (!post) return {};
  const en = locale === "en";
  const author = post.influencer.displayName ?? post.influencer.handle;
  const content = (en ? post.contentEn : post.contentZh) || post.contentText;
  const summary = (en ? post.analysis?.summaryEn : post.analysis?.summary) || content;
  const title = clip(`${author}: ${content}`, 64);
  const description = clip(summary, 160);
  // 动态 OG 卡(/api/og 用 @napi-rs/canvas 原生渲染,根治旧 next/og 502);失败时路由自回退静态 og.png。
  const st = post.analysis?.overallStance;
  return pageMetadata({
    path: `/p/${id}`,
    title,
    description,
    ogType: "article",
    ogImage: ogImageUrl({
      brand: `@${post.influencer.handle} on X2T`,
      headline: "AI-analyzed market signal",
      sub: st ?? undefined,
      accent: st === "bullish" ? "bull" : st === "bearish" ? "bear" : "neutral",
    }),
  });
}

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getPostDetail(id);
  if (!detail) notFound();
  const locale = await getLocale();
  const p = detail.post;
  const en = locale === "en";
  const author = p.influencer.displayName ?? p.influencer.handle;
  const content = ((en ? p.contentEn : p.contentZh) || p.contentText).replace(/\s+/g, " ").trim();
  const summary = ((en ? p.analysis?.summaryEn : p.analysis?.summary) || content).slice(0, 200);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            articleJsonLd({ url: `${SITE_URL}/p/${id}`, headline: `${author}: ${content}`, description: summary, datePublished: new Date(p.postedAt).toISOString(), author, locale }),
          ),
        }}
      />
      <PostDetail post={detail.post} dataBySymbol={detail.dataBySymbol} myVote={detail.myVote} locale={locale} />
    </>
  );
}

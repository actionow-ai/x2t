import type { Metadata } from "next";
import { getPostDetail, PostDetail } from "@/components/PostDetail";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/db";
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
  return {
    title,
    description,
    alternates: { canonical: `/p/${id}` },
    openGraph: { type: "article", title, description, url: `/p/${id}`, images: ["/og.png"] },
    twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  };
}

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getPostDetail(id);
  if (!detail) notFound();
  return <PostDetail post={detail.post} dataBySymbol={detail.dataBySymbol} locale={await getLocale()} />;
}

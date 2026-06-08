import { getPostDetail, PostDetail } from "@/components/PostDetail";
import { getLocale } from "@/lib/i18n-server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getPostDetail(id);
  if (!detail) notFound();
  return <PostDetail post={detail.post} dataBySymbol={detail.dataBySymbol} locale={await getLocale()} />;
}

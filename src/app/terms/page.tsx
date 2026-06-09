import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n-server";

export const metadata: Metadata = { title: "Terms / 服务条款" };

export default async function TermsPage() {
  const en = (await getLocale()) === "en";
  return (
    <article className="legal">
      <h1 className="page-title">{en ? "Terms of Service" : "服务条款"}</h1>
      {en ? (
        <>
          <p>By using X2T you agree to the following.</p>
          <h2>Not financial advice</h2>
          <p>All content is for information only and is not investment, legal or tax advice. You are solely responsible for your own decisions. Trading involves risk of loss.</p>
          <h2>No warranty</h2>
          <p>X2T is provided “as is”, without warranty of any kind. AI-generated summaries, stance labels and confidence may be inaccurate; market data may be delayed or wrong. We are not liable for any loss arising from use of the service.</p>
          <h2>Content &amp; intellectual property</h2>
          <p>Aggregated posts belong to their original authors and are linked back to the source. If you are a rights holder and want your content removed, contact <a href="mailto:actionow.ai@gmail.com">actionow.ai@gmail.com</a>.</p>
          <h2>Acceptable use</h2>
          <p>Do not abuse, scrape, or overload the service, or use it for unlawful purposes.</p>
        </>
      ) : (
        <>
          <p>使用 X2T 即表示你同意以下条款。</p>
          <h2>非投资建议</h2>
          <p>全部内容仅供参考,不构成投资、法律或税务建议。你需对自己的决策完全负责。交易有亏损风险。</p>
          <h2>不作担保</h2>
          <p>X2T 按「现状」提供,不作任何形式担保。AI 生成的摘要、立场标签与置信度可能不准;市场数据可能延迟或错误。我们不对因使用本服务产生的任何损失负责。</p>
          <h2>内容与知识产权</h2>
          <p>聚合的帖子归原作者所有并回链原帖。若你是权利人并希望下架内容,请联系 <a href="mailto:actionow.ai@gmail.com">actionow.ai@gmail.com</a>。</p>
          <h2>合理使用</h2>
          <p>请勿滥用、爬取或使服务过载,亦不得用于任何违法用途。</p>
        </>
      )}
    </article>
  );
}

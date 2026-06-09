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
          <h2>Data sources</h2>
          <p>X2T accesses public content within the scope each source platform (X / Reddit / news RSS) permits, and links back to the original. If a platform or rights holder requests it, we will stop ingesting that source or remove the content.</p>
          <h2>Operator &amp; governing law</h2>
          <p>This service is operated by <strong>actionow.ai</strong>. The code is open-source under the MIT license (this refers to the project source code only and <strong>not</strong> the aggregated third-party content, whose copyright belongs to the original authors). Disputes are governed by the laws of the operator's jurisdiction.</p>
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
          <h2>数据来源</h2>
          <p>X2T 在各来源平台(X / Reddit / 新闻 RSS)允许的范围内访问其公开内容,并回链原帖。若某平台或权利人要求,我们将停止抓取相应来源或下架相应内容。</p>
          <h2>运营主体与适用法律</h2>
          <p>本服务由 <strong>actionow.ai</strong> 运营。代码以 MIT 许可开源(仅指本项目源代码,<strong>不</strong>包含所聚合的第三方内容,后者版权归原作者)。因使用本服务产生的争议,适用运营方所在地法律。</p>
        </>
      )}
    </article>
  );
}

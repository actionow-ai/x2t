import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n-server";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ path: "/about", title: "About / 关于" });

export default async function AboutPage() {
  const en = (await getLocale()) === "en";
  return (
    <article className="legal">
      <h1 className="page-title">{en ? "About X2T" : "关于 X2T"}</h1>
      {en ? (
        <>
          <p>X2T (X to Trade) aggregates posts from financial influencers on X (Twitter), Reddit and news RSS, then uses AI to summarize each post in Chinese and English, extract the tickers it mentions, and label a bullish / bearish / neutral stance. It also maps an influencer-by-ticker stance graph and per-ticker consensus.</p>
          <h2>What it is — and is not</h2>
          <p>X2T is an aggregation and reading aid. It is <strong>not</strong> investment advice, not a broker, and not affiliated with the influencers it tracks. Stance labels and confidence are generated automatically by a large language model and can be wrong.</p>
          <h2>Data sources</h2>
          <p>Posts come from public sources; copyright belongs to the original authors and each item links back to the original. Market data (quote, news, sentiment, earnings) comes from third-party providers and may be delayed or inaccurate.</p>
          <h2>Open source</h2>
          <p>X2T is open source under the MIT license — code, issues and the self-host guide live at <a href="https://github.com/actionow-ai/x2t" target="_blank" rel="noopener noreferrer">github.com/actionow-ai/x2t</a>.</p>
          <h2>Contact</h2>
          <p>Questions, corrections or content takedown requests: <a href="mailto:actionow.ai@gmail.com">actionow.ai@gmail.com</a>.</p>
        </>
      ) : (
        <>
          <p>X2T(X to Trade)聚合 X(Twitter)、Reddit 与新闻 RSS 上金融博主的帖子,用 AI 把每条帖子做中英双语摘要、抽取提及的标的,并打上看多 / 看空 / 中性立场;还绘制「博主 × 标的」立场图谱与个股共识。</p>
          <h2>它是什么、不是什么</h2>
          <p>X2T 是聚合与阅读辅助工具,<strong>不是</strong>投资建议、不是券商,也与所跟踪的博主无任何隶属关系。立场标签与置信度由大语言模型自动生成,可能出错。</p>
          <h2>数据来源</h2>
          <p>帖子来自公开渠道,版权归原作者,每条均回链原帖;行情/新闻/情绪/财报等市场数据来自第三方,可能延迟或不准。</p>
          <h2>开源</h2>
          <p>X2T 以 MIT 协议开源 —— 代码、Issue 与自部署指南见 <a href="https://github.com/actionow-ai/x2t" target="_blank" rel="noopener noreferrer">github.com/actionow-ai/x2t</a>。</p>
          <h2>联系</h2>
          <p>疑问、纠错或内容下架请联系:<a href="mailto:actionow.ai@gmail.com">actionow.ai@gmail.com</a>。</p>
        </>
      )}
    </article>
  );
}

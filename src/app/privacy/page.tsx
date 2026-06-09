import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n-server";

export const metadata: Metadata = { title: "Privacy / 隐私政策" };

export default async function PrivacyPage() {
  const en = (await getLocale()) === "en";
  return (
    <article className="legal">
      <h1 className="page-title">{en ? "Privacy Policy" : "隐私政策"}</h1>
      {en ? (
        <>
          <p>We collect as little as possible.</p>
          <h2>What we store</h2>
          <ul>
            <li><strong>Email</strong> — only if you log in (passwordless magic link). Used to identify your account and send digests you opt into. No password is stored.</li>
            <li><strong>Follows &amp; push subscriptions</strong> — to deliver the feed and notifications you asked for.</li>
            <li><strong>A language cookie</strong> and, if you follow influencers without logging in, a local follow list in your browser.</li>
          </ul>
          <h2>Analytics</h2>
          <p>We use Google Analytics for aggregate, anonymous usage statistics. We do not sell your data.</p>
          <h2>Your choices</h2>
          <p>To delete your account or data, email <a href="mailto:actionow.ai@gmail.com">actionow.ai@gmail.com</a>.</p>
        </>
      ) : (
        <>
          <p>我们尽可能少地收集数据。</p>
          <h2>我们存什么</h2>
          <ul>
            <li><strong>邮箱</strong>——仅在你登录时(免密魔法链接)。用于标识账户并发送你订阅的摘要。不存储任何密码。</li>
            <li><strong>关注与推送订阅</strong>——用于向你投递所请求的信号流与通知。</li>
            <li><strong>语言 cookie</strong>;若未登录就关注博主,则在你浏览器本地存一份关注列表。</li>
          </ul>
          <h2>分析</h2>
          <p>我们使用 Google Analytics 做匿名的聚合使用统计。我们不出售你的数据。</p>
          <h2>你的选择</h2>
          <p>如需删除账户或数据,请邮件 <a href="mailto:actionow.ai@gmail.com">actionow.ai@gmail.com</a>。</p>
        </>
      )}
    </article>
  );
}

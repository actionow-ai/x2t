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
          <h2>Analytics &amp; sub-processors</h2>
          <p>We use Google Analytics for aggregate, anonymous usage statistics. Other processors used strictly to run the service: an email delivery provider (login links / digests) and our hosting provider. We do not sell your data.</p>
          <h2>Your rights (GDPR / CCPA)</h2>
          <p>Depending on where you live, you may have the right to access, correct, export, or delete your personal data, and to object to or restrict processing. The legal basis for processing your email is performing the service you requested (login, digests). To exercise any right, email <a href="mailto:actionow.ai@gmail.com">actionow.ai@gmail.com</a>.</p>
          <h2>Your choices</h2>
          <p>To delete your account or data, email <a href="mailto:actionow.ai@gmail.com">actionow.ai@gmail.com</a>. You can disable analytics with a browser Do-Not-Track / ad-blocker setting.</p>
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
          <h2>分析与子处理方</h2>
          <p>我们使用 Google Analytics 做匿名聚合统计。为运行服务还会用到:邮件发送方(登录链接/摘要)与托管服务商。我们不出售你的数据。</p>
          <h2>你的权利(GDPR / CCPA)</h2>
          <p>视你所在地区,你可能有权访问、更正、导出或删除你的个人数据,并可反对或限制处理。处理你邮箱的法律依据是履行你请求的服务(登录、摘要)。如需行使任何权利,请邮件 <a href="mailto:actionow.ai@gmail.com">actionow.ai@gmail.com</a>。</p>
          <h2>你的选择</h2>
          <p>如需删除账户或数据,请邮件 <a href="mailto:actionow.ai@gmail.com">actionow.ai@gmail.com</a>;也可用浏览器 Do-Not-Track / 广告拦截关闭分析。</p>
        </>
      )}
    </article>
  );
}

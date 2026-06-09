"use client";

// 全局错误边界:抓取/渲染失败时给可重试的卡片,而非白屏。客户端组件,双语并列。
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="errbox">
      <h2>出错了 · Something went wrong</h2>
      <p>页面加载失败,请稍后重试。 / Failed to load this page. Please try again.</p>
      <button className="btn primary" onClick={reset}>重试 · Retry</button>
      {error?.digest && <code className="errbox-digest">ref: {error.digest}</code>}
    </div>
  );
}

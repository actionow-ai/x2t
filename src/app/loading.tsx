// 路由级 loading:feed 骨架屏,避免抓取期白屏。aria-label 双语(fallback 同步渲染,不便取 locale)。
export default function Loading() {
  return (
    <div className="feed" aria-busy="true" aria-label="加载中 / Loading">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skel-card" />
      ))}
    </div>
  );
}

// 路由级 loading:feed 骨架屏,避免抓取期白屏。
export default function Loading() {
  return (
    <div className="feed" aria-busy="true" aria-label="Loading">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skel-card" />
      ))}
    </div>
  );
}

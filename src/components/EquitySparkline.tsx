// "如果跟单 vs 大盘"累计收益曲线(借鉴 Vibe-Trading / AI-Trader)。纯 SVG 服务端渲染,无 client。
// 蓝线=跟随该博主每条多空判断的累计收益;灰线=同期 SPY;虚线=0。把"跑赢大盘 X%"变成一条轨迹。
export function EquitySparkline({ points, locale = "zh" }: { points: { follow: number; spy: number }[]; locale?: "zh" | "en" }) {
  if (points.length < 2) return null;
  const W = 280;
  const H = 56;
  const pad = 3;
  const all = points.flatMap((p) => [p.follow, p.spy]).concat(0);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;
  const x = (i: number) => pad + (i / (points.length - 1)) * (W - 2 * pad);
  const y = (v: number) => H - pad - ((v - min) / range) * (H - 2 * pad);
  const poly = (key: "follow" | "spy") => points.map((p, i) => `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  const zeroY = y(0).toFixed(1);
  return (
    <svg className="equity" viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label={locale === "en" ? "Cumulative return vs S&P 500 (blue = follow, grey = SPY)" : "累计收益曲线(蓝=跟随,灰=同期 SPY)"}>
      <line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 3" />
      <polyline points={poly("spy")} fill="none" stroke="var(--text-tertiary)" strokeWidth={1.5} />
      <polyline points={poly("follow")} fill="none" stroke="var(--blue)" strokeWidth={2.5} strokeLinejoin="round" />
    </svg>
  );
}

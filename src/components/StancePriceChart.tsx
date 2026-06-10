// 标的"博主集体净立场 vs 实际价格"时序叠加图(竞品借鉴 stocksight)。纯 SVG 服务端渲染,无 client。
// 蓝线=博主累计净立场(看多−看空 的累计和,归一化);灰线=实际收盘价(归一化);虚线=净立场 0 基线。
// 两条线各自归一化到图高:比的是【形状/拐点】是否对齐——群体共识是否领先/滞后价格。
export function StancePriceChart({ points, locale = "zh" }: { points: { t: number; net: number; price: number }[]; locale?: "zh" | "en" }) {
  if (points.length < 2) return null;
  const W = 320;
  const H = 96;
  const pad = 4;
  const nets = points.map((p) => p.net);
  const prices = points.map((p) => p.price);
  const nMin = Math.min(...nets);
  const nMax = Math.max(...nets);
  const nRange = nMax - nMin || 1;
  const pMin = Math.min(...prices);
  const pMax = Math.max(...prices);
  const pRange = pMax - pMin || 1;
  const x = (i: number) => pad + (i / (points.length - 1)) * (W - 2 * pad);
  const yN = (v: number) => H - pad - ((v - nMin) / nRange) * (H - 2 * pad);
  const yP = (v: number) => H - pad - ((v - pMin) / pRange) * (H - 2 * pad);
  const netPoly = points.map((p, i) => `${x(i).toFixed(1)},${yN(p.net).toFixed(1)}`).join(" ");
  const pricePoly = points.map((p, i) => `${x(i).toFixed(1)},${yP(p.price).toFixed(1)}`).join(" ");
  const zeroInRange = nMin <= 0 && nMax >= 0;
  return (
    <svg
      className="stance-price"
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      role="img"
      aria-label={locale === "en" ? "Net influencer stance (blue) vs actual price (grey) over time" : "博主集体净立场(蓝)对比实际价格(灰)随时间变化"}
    >
      {zeroInRange && <line x1={0} y1={yN(0).toFixed(1)} x2={W} y2={yN(0).toFixed(1)} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 3" />}
      <polyline points={pricePoly} fill="none" stroke="var(--text-tertiary)" strokeWidth={1.5} />
      <polyline points={netPoly} fill="none" stroke="var(--blue)" strokeWidth={2.5} strokeLinejoin="round" />
    </svg>
  );
}

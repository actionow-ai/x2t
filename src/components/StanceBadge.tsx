import Link from "next/link";

export function stanceMeta(stance: string): { cls: string; text: string; arrow: string } {
  if (stance === "bullish") return { cls: "bull", text: "看多", arrow: "▲" };
  if (stance === "bearish") return { cls: "bear", text: "看空", arrow: "▼" };
  return { cls: "neutral", text: "中性", arrow: "—" };
}

export function stanceText(stance: string): string {
  return stanceMeta(stance).text;
}

export function StanceBadge({ stance, label }: { stance: string; label?: string }) {
  const s = stanceMeta(stance);
  return (
    <span className={`badge ${s.cls}`}>
      {s.arrow} {label ?? s.text}
    </span>
  );
}

export function TickerBadge({ symbol, stance }: { symbol: string; stance: string }) {
  const s = stanceMeta(stance);
  return (
    <Link href={`/t/${symbol}`} className={`badge ${s.cls}`}>
      {s.arrow} ${symbol}
    </Link>
  );
}

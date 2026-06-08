import Link from "next/link";
import { getDict, type Locale } from "@/lib/i18n";

export function stanceMeta(stance: string, locale: Locale = "zh"): { cls: string; text: string; arrow: string } {
  const s = getDict(locale).stance;
  if (stance === "bullish") return { cls: "bull", text: s.bullish, arrow: "▲" };
  if (stance === "bearish") return { cls: "bear", text: s.bearish, arrow: "▼" };
  return { cls: "neutral", text: s.neutral, arrow: "—" };
}

export function stanceText(stance: string, locale: Locale = "zh"): string {
  return stanceMeta(stance, locale).text;
}

export function StanceBadge({ stance, label, locale = "zh" }: { stance: string; label?: string; locale?: Locale }) {
  const s = stanceMeta(stance, locale);
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

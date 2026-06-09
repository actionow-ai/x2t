import { ImageResponse } from "next/og";
import { getStockConsensus } from "@/lib/stance";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "X2T consensus";

const LIME = "#c9f24a";
const INK = "#0c0c0c";

// 个股共识分享卡:$SYMBOL + 多空票数 + 整体倾向 —— 全拉丁/符号,免 CJK 字体。
export default async function Image({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const c = await getStockConsensus(symbol).catch(() => null);
  const bull = c?.bullish ?? 0;
  const bear = c?.bearish ?? 0;
  const neut = c?.neutral ?? 0;
  const n = c?.stances.length ?? 0;
  const verdict = bull > bear ? { t: "LEANING BULLISH", color: "#16a34a" } : bear > bull ? { t: "LEANING BEARISH", color: "#dc2626" } : { t: "NEUTRAL / SPLIT", color: "#6b6459" };

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: LIME, border: `18px solid ${INK}`, padding: 64, justifyContent: "space-between", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 56, fontWeight: 900, color: INK, letterSpacing: -2 }}>X2T</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: INK, opacity: 0.7 }}>influencer consensus</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 110, fontWeight: 900, color: INK, letterSpacing: -3 }}>${(c?.symbol ?? symbol).toUpperCase()}</div>
          <div style={{ fontSize: 50, fontWeight: 900, color: "#fff", background: verdict.color, padding: "6px 26px", border: `6px solid ${INK}`, alignSelf: "flex-start" }}>{verdict.t}</div>
          <div style={{ fontSize: 40, fontWeight: 800, color: INK, display: "flex", gap: 28 }}>
            <span>▲ {bull}</span><span>▼ {bear}</span><span style={{ opacity: 0.6 }}>● {neut}</span>
            <span style={{ opacity: 0.7 }}>· {n} influencers</span>
          </div>
        </div>
        <div style={{ fontSize: 26, color: INK, fontWeight: 700, opacity: 0.8 }}>x2t.actionow.ai · NOT FINANCIAL ADVICE</div>
      </div>
    ),
    { ...size },
  );
}

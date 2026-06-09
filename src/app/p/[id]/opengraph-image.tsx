import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "X2T signal";

const LIME = "#c9f24a";
const INK = "#0c0c0c";
const STANCE: Record<string, { t: string; c: string }> = {
  bullish: { t: "BULLISH", c: "#16a34a" },
  bearish: { t: "BEARISH", c: "#dc2626" },
  neutral: { t: "NEUTRAL", c: "#6b6459" },
};

// 每帖动态分享卡:博主 + 立场 + 标的 —— 全拉丁/符号,免 CJK 字体依赖。
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await prisma.post
    .findUnique({
      where: { id },
      select: {
        influencer: { select: { handle: true } },
        analysis: { select: { overallStance: true } },
        tickers: { select: { symbol: true } },
      },
    })
    .catch(() => null);

  const handle = post?.influencer.handle ?? "x2t";
  const st = STANCE[post?.analysis?.overallStance ?? "neutral"] ?? STANCE.neutral;
  const tickers = (post?.tickers ?? []).slice(0, 6).map((t) => "$" + t.symbol);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: LIME, border: `18px solid ${INK}`, padding: 64, justifyContent: "space-between", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 64, fontWeight: 900, color: INK, letterSpacing: -2 }}>X2T</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: INK, opacity: 0.7 }}>signal · AI analysis</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 40, color: INK, fontWeight: 700 }}>@{handle}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ fontSize: 56, fontWeight: 900, color: "#fff", background: st.c, padding: "8px 28px", border: `6px solid ${INK}` }}>{st.t}</div>
            <div style={{ fontSize: 44, fontWeight: 800, color: INK }}>{tickers.join("  ") || "—"}</div>
          </div>
        </div>
        <div style={{ fontSize: 26, color: INK, fontWeight: 700, opacity: 0.8 }}>x2t.actionow.ai · NOT FINANCIAL ADVICE</div>
      </div>
    ),
    { ...size },
  );
}

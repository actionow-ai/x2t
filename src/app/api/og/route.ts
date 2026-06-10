import { renderOgCard } from "@/lib/og";
import { getStockStanceTimeline } from "@/lib/stance";
import { baseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

// 动态 OG 分享图:/api/og?brand=&h=&sub=&a=bull|bear[&sym=NVDA]。@napi-rs/canvas 原生渲染(无 wasm,避 next/og 502)。
// 带 sym 时取该票"净立场 vs 价格"时序、降采样后嵌入迷你走势图(数据卡)。任意错误 → 302 回退 /og.png。
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const a = sp.get("a");
    const sym = sp.get("sym");
    let chart: { net: number; price: number }[] | undefined;
    if (sym) {
      const tl = await getStockStanceTimeline(sym);
      if (tl.length >= 2) {
        const step = Math.max(1, Math.ceil(tl.length / 90)); // 降采样到 ≤90 点
        chart = tl.filter((_, i) => i % step === 0).map((p) => ({ net: p.net, price: p.price }));
      }
    }
    const png = renderOgCard({
      brand: (sp.get("brand") ?? "X2T").slice(0, 60),
      headline: (sp.get("h") ?? "").slice(0, 140),
      sub: sp.get("sub")?.slice(0, 48) || undefined,
      accent: a === "bull" || a === "bear" ? a : "neutral",
      chart,
    });
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      },
    });
  } catch (e) {
    console.error("[og] 渲染失败,回退静态 og.png:", e instanceof Error ? e.message : e);
    return Response.redirect(new URL("/og.png", baseUrl(req)).toString(), 302);
  }
}

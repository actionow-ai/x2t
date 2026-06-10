import { renderOgCard } from "@/lib/og";
import { baseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

// 动态 OG 分享图:/api/og?brand=&h=&sub=&a=bull|bear。@napi-rs/canvas 原生渲染(无 wasm,避 Zeabur next/og 502)。
// 任意渲染错误 → 302 回退静态 /og.png,保证 og:image 始终有图(不因 OG 失败拖累页面分享)。
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const a = sp.get("a");
    const png = renderOgCard({
      brand: (sp.get("brand") ?? "X2T").slice(0, 60),
      headline: (sp.get("h") ?? "").slice(0, 140),
      sub: sp.get("sub")?.slice(0, 48) || undefined,
      accent: a === "bull" || a === "bear" ? a : "neutral",
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

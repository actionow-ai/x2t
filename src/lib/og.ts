import { createCanvas, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import { OG_FONT_B64 } from "./og-font";

// 动态 OG 分享卡:用 @napi-rs/canvas(原生,无 wasm)服务端渲染,根治 next/og 在 Zeabur standalone 的 502。
// 字体显式注册(Inter latin 子集),不依赖容器系统字 → 不会出豆腐块。卡片文案走拉丁/数字(无 CJK/几何箭头)。
let registered = false;
function ensureFont() {
  if (!registered) {
    GlobalFonts.register(Buffer.from(OG_FONT_B64, "base64"), "OGInter");
    registered = true;
  }
}

export type OgSpec = { brand: string; headline: string; sub?: string; accent?: "bull" | "bear" | "neutral" };

// 单词级折行 + 末行省略号截断(measureText 量宽)。
function wrapText(ctx: SKRSContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  let line = "";
  let drawn = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      y += lh;
      drawn++;
      line = words[i];
      if (drawn >= maxLines - 1) {
        // 末行:把剩余词拼上,过宽则省略号截断
        line = words.slice(i).join(" ");
        while (ctx.measureText(`${line}…`).width > maxW && line.length > 1) line = line.slice(0, -1);
        if (line !== words.slice(i).join(" ")) line += "…";
        break;
      }
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
}

export function renderOgCard(spec: OgSpec): Buffer {
  ensureFont();
  const W = 1200;
  const H = 630;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, W, H);
  const accent = spec.accent === "bull" ? "#16a34a" : spec.accent === "bear" ? "#dc2626" : "#3b82f6";
  ctx.fillStyle = accent;
  ctx.fillRect(60, 60, 14, 96);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 70px OGInter";
  ctx.fillText("X2T", 92, 134);
  ctx.fillStyle = "#9ca3af";
  ctx.font = "700 36px OGInter";
  ctx.fillText(spec.brand.slice(0, 52), 60, 244);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 78px OGInter";
  wrapText(ctx, spec.headline, 60, 350, W - 120, 92, 3);
  if (spec.sub) {
    ctx.fillStyle = accent;
    ctx.font = "700 54px OGInter";
    ctx.fillText(spec.sub.slice(0, 44), 60, 566);
  }
  ctx.fillStyle = "#6b7280";
  ctx.font = "700 26px OGInter";
  ctx.fillText("x2t.actionow.ai", 60, H - 34);
  ctx.textAlign = "right";
  ctx.fillText("NOT FINANCIAL ADVICE", W - 60, H - 34);
  ctx.textAlign = "left";
  return canvas.toBuffer("image/png");
}

import { createCanvas, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import { ARCHIVO_800_B64, SPACE_MONO_700_B64 } from "./og-font";

// 动态 OG 分享卡:@napi-rs/canvas 原生渲染(无 wasm,避 Zeabur next/og 502)。
// 视觉与站点/ShareButton 分享卡严格一致:米色纸底 + 墨黑粗边 + lime 品牌块 + Archivo/Space Mono。
// 字体显式注册(latin 子集),不依赖容器系统字 → 不出豆腐块。文案走拉丁/数字(字体仅 latin)。
const PAPER = "#f4f1e8";
const INK = "#0c0c0c";
const LIME = "#c9f24a";
const MUTED = "#555555";
const NET = "#2b5cff"; // 站点 --blue:走势图净立场线
const accentColor = (a?: string) => (a === "bull" ? "#0a7d37" : a === "bear" ? "#c41e16" : MUTED);

let registered = false;
function ensureFonts() {
  if (registered) return;
  GlobalFonts.register(Buffer.from(ARCHIVO_800_B64, "base64"), "OGDisplay"); // 品牌 / 主句 / 副句 / 小字
  GlobalFonts.register(Buffer.from(SPACE_MONO_700_B64, "base64"), "OGMono"); // 页脚 / 图例
  registered = true;
}

export type OgSpec = {
  brand: string;
  headline: string;
  sub?: string;
  accent?: "bull" | "bear" | "neutral";
  chart?: { net: number; price: number }[]; // 有则渲染"净立场 vs 价格"迷你走势(/t 个股页)
};

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
        line = words.slice(i).join(" ");
        const full = line;
        while (ctx.measureText(`${line}…`).width > maxW && line.length > 1) line = line.slice(0, -1);
        if (line !== full) line += "…";
        break;
      }
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
}

// 双线迷你走势带:净立场(蓝)+ 价格(墨黑),各自归一化到带高,比形状是否对齐。
function drawSparkband(ctx: SKRSContext2D, pts: { net: number; price: number }[], x: number, y: number, w: number, h: number) {
  const nets = pts.map((p) => p.net);
  const prices = pts.map((p) => p.price);
  const nMin = Math.min(...nets);
  const nR = Math.max(...nets) - nMin || 1;
  const pMin = Math.min(...prices);
  const pR = Math.max(...prices) - pMin || 1;
  const pad = 8; // 垂直内边距:线不贴带子上下边缘(平线/尖峰更耐看)
  const px = (i: number) => x + (i / (pts.length - 1)) * w;
  const line = (val: (p: { net: number; price: number }) => number, min: number, range: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.beginPath();
    pts.forEach((p, i) => {
      const yy = y + h - pad - ((val(p) - min) / range) * (h - 2 * pad);
      if (i) ctx.lineTo(px(i), yy);
      else ctx.moveTo(px(i), yy);
    });
    ctx.stroke();
  };
  line((p) => p.price, pMin, pR, INK);
  line((p) => p.net, nMin, nR, NET);
}

export function renderOgCard(spec: OgSpec): Buffer {
  ensureFonts();
  const W = 1200;
  const H = 630;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // 纸底 + 墨黑粗边框
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, W - 14, H - 14);

  // lime 品牌块 + "X2T"
  ctx.fillStyle = LIME;
  ctx.fillRect(60, 52, 168, 92);
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.strokeRect(60, 52, 168, 92);
  ctx.fillStyle = INK;
  ctx.font = "66px OGDisplay";
  ctx.fillText("X2T", 80, 118);

  const hasChart = !!spec.chart && spec.chart.length >= 2;

  if (hasChart) {
    // 数据卡:紧凑文案在上,迷你走势带在下
    ctx.fillStyle = MUTED;
    ctx.font = "30px OGDisplay";
    ctx.fillText(spec.brand.slice(0, 56), 60, 206);
    ctx.fillStyle = INK;
    ctx.font = "70px OGDisplay";
    ctx.fillText(spec.headline.slice(0, 26), 60, 282);
    if (spec.sub) {
      ctx.fillStyle = accentColor(spec.accent);
      ctx.font = "40px OGDisplay";
      ctx.fillText(spec.sub.slice(0, 44), 60, 338);
    }
    // 图例(色块 + 标签)
    ctx.fillStyle = NET;
    ctx.fillRect(60, 376, 32, 10);
    ctx.fillStyle = MUTED;
    ctx.font = "22px OGMono";
    ctx.fillText("net stance", 102, 388);
    ctx.fillStyle = INK;
    ctx.fillRect(322, 376, 32, 10);
    ctx.fillStyle = MUTED;
    ctx.fillText("price · 12mo", 364, 388);
    // 走势带
    drawSparkband(ctx, spec.chart!, 60, 404, W - 120, 148);
  } else {
    // 文字卡(/i /p)
    ctx.fillStyle = MUTED;
    ctx.font = "32px OGDisplay";
    ctx.fillText(spec.brand.slice(0, 48), 60, 230);
    ctx.fillStyle = INK;
    ctx.font = "76px OGDisplay";
    wrapText(ctx, spec.headline, 60, 330, W - 120, 96, 2);
    if (spec.sub) {
      ctx.fillStyle = accentColor(spec.accent);
      ctx.font = "54px OGDisplay";
      ctx.fillText(spec.sub.slice(0, 40), 60, 510);
    }
  }

  // 页脚条(墨黑底 + lime 域名 + 纸色免责)
  ctx.fillStyle = INK;
  ctx.fillRect(0, H - 66, W, 66);
  ctx.fillStyle = LIME;
  ctx.font = "28px OGMono";
  ctx.fillText("x2t.actionow.ai", 60, H - 24);
  ctx.fillStyle = PAPER;
  ctx.font = "22px OGMono";
  ctx.textAlign = "right";
  ctx.fillText("NOT FINANCIAL ADVICE", W - 60, H - 24);
  ctx.textAlign = "left";

  return canvas.toBuffer("image/png");
}

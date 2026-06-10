"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "./LangProvider";

// 分享图卡:客户端 canvas 渲染(绕开 Zeabur next/og 502)。文(tweet)+ 图(卡片)+ 链接,一键发 X。
export type ShareSpec = {
  brandLine: string; // 顶部小字,如 "$NVDA · NVIDIA"
  headline: string; // 主句,如 "综合 7 位博主,整体看多"
  sub?: string; // 副句,如 "▲4 ▼1 · 2 中性"
  accent?: "bull" | "bear" | "neutral";
  tweetText: string; // 预填推文
  url?: string; // 分享链接(相对路径;省略=当前页 URL)。feed 卡片需指向 /p/[id]
  via?: string; // X handle(twitter 平台博主)→ intent via= 让分享 @提及博主本人,促其转发(最便宜的冷启动分发)
};

const PAPER = "#f4f1e8";
const INK = "#0c0c0c";
const LIME = "#c9f24a";
const accentColor = (a?: string) => (a === "bull" ? "#0a7d37" : a === "bear" ? "#c41e16" : "#555");

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines: number) {
  const chars = [...text];
  let line = "";
  let lines = 0;
  for (let i = 0; i < chars.length && lines < maxLines; i++) {
    const test = line + chars[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = chars[i];
      y += lh;
      lines++;
    } else {
      line = test;
    }
  }
  if (lines < maxLines && line) ctx.fillText(line, x, y);
}

async function drawCard(canvas: HTMLCanvasElement, spec: ShareSpec) {
  const W = 1200;
  const H = 630;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  // 等字体就绪,否则 canvas 用默认字
  try {
    await Promise.all([document.fonts.load("900 88px 'Noto Sans SC'"), document.fonts.load("800 64px Archivo"), document.fonts.load("700 28px 'Space Mono'")]);
  } catch {
    /* 字体加载失败用回退 */
  }

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, W - 14, H - 14);

  // 品牌块
  ctx.fillStyle = LIME;
  ctx.fillRect(60, 56, 168, 92);
  ctx.lineWidth = 6;
  ctx.strokeRect(60, 56, 168, 92);
  ctx.fillStyle = INK;
  ctx.font = "800 66px Archivo, sans-serif";
  ctx.fillText("X2T", 80, 122);

  ctx.fillStyle = "#555";
  ctx.font = "700 34px Archivo, sans-serif";
  ctx.fillText(spec.brandLine.slice(0, 48), 60, 230);

  ctx.fillStyle = INK;
  ctx.font = "900 84px 'Noto Sans SC', Archivo, sans-serif";
  wrapText(ctx, spec.headline, 60, 330, W - 120, 96, 2);

  if (spec.sub) {
    ctx.fillStyle = accentColor(spec.accent);
    ctx.font = "800 56px Archivo, sans-serif";
    ctx.fillText(spec.sub.slice(0, 40), 60, 510);
  }

  // 页脚条
  ctx.fillStyle = INK;
  ctx.fillRect(0, H - 66, W, 66);
  ctx.fillStyle = LIME;
  ctx.font = "700 28px 'Space Mono', monospace";
  ctx.fillText("x2t.actionow.ai", 60, H - 24);
  ctx.fillStyle = PAPER;
  ctx.font = "700 22px 'Space Mono', monospace";
  ctx.textAlign = "right";
  ctx.fillText("非投资建议 · NOT FINANCIAL ADVICE", W - 60, H - 24);
  ctx.textAlign = "left";
}

export function ShareButton({ spec }: { spec: ShareSpec }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setCopied(false);
    // 下一帧画(canvas 已挂载)
    requestAnimationFrame(async () => {
      const c = canvasRef.current;
      if (!c) return;
      await drawCard(c, spec);
      c.toBlob((b) => b && setImgUrl(URL.createObjectURL(b)), "image/png");
    });
  }

  function shareX() {
    // 加 UTM 追踪分享回流(GA 里区分自然流量与分享带来的访问)
    const base = spec.url ? new URL(spec.url, window.location.origin) : new URL(window.location.href);
    base.searchParams.set("utm_source", "twitter");
    base.searchParams.set("utm_medium", "share");
    const params = new URLSearchParams({ text: spec.tweetText, url: base.href });
    if (spec.via) params.set("via", spec.via.replace(/^@/, ""));
    window.open(`https://twitter.com/intent/tweet?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  async function copyImg() {
    try {
      const c = canvasRef.current;
      if (!c) return;
      await new Promise<void>((res) =>
        c.toBlob(async (b) => {
          if (b && navigator.clipboard && "write" in navigator.clipboard) {
            await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]);
            setCopied(true);
          }
          res();
        }, "image/png"),
      );
    } catch {
      /* 浏览器不支持图片剪贴板 → 用户可改用下载 */
    }
  }

  return (
    <>
      <button className="btn ghost share-btn" onClick={toggle}>↗ {t.share.button}</button>
      {open &&
        // portal 到 body:避免被卡片的 hover transform 当成定位祖先而抖动/闪烁
        createPortal(
          <div className="share-modal-backdrop" onClick={() => setOpen(false)} role="dialog" aria-modal="true">
            <div className="share-modal" onClick={(e) => e.stopPropagation()}>
              <div className="share-modal-head">
                <strong>{t.share.button}</strong>
                <button className="share-modal-x" onClick={() => setOpen(false)} aria-label={t.common.close}>✕</button>
              </div>
              <canvas ref={canvasRef} className="share-canvas" />
              <div className="share-actions">
                <button className="btn primary" onClick={shareX}>{t.share.toX}</button>
                {imgUrl && <a className="btn ghost" href={imgUrl} download="x2t-card.png">{t.share.download}</a>}
                <button className="btn ghost" onClick={copyImg}>{copied ? t.share.copied : t.share.copy}</button>
              </div>
              <p className="share-hint">{t.share.hint}</p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

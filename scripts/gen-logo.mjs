// 生成 X2T logo / favicon。用 Anton 字形转 path(neo-brutalism/tape 风格,字形专业且不依赖运行时字体),
// 再用 sharp 光栅化出 PNG、png-to-ico 出 favicon.ico。
// 运行: node scripts/gen-logo.mjs
import opentype from "opentype.js";
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { readFileSync, writeFileSync } from "node:fs";

const INK = "#0c0c0c";
const LIME = "#c9f24a";
const _b = readFileSync("scripts/assets/Anton-Regular.ttf");
const font = opentype.parse(_b.buffer.slice(_b.byteOffset, _b.byteOffset + _b.byteLength));

// 取 "X2T" 字形 path,等比缩放并居中到 (cx,cy) 的 targetW×targetH 框内
function x2t({ cx, cy, targetW, targetH }) {
  const p = font.getPath("X2T", 0, 0, 100);
  const d = p.toPathData(2);
  const b = p.getBoundingBox();
  const w = b.x2 - b.x1;
  const h = b.y2 - b.y1;
  const s = Math.min(targetW / w, targetH / h);
  const tx = cx - ((b.x1 + b.x2) / 2) * s;
  const ty = cy - ((b.y1 + b.y2) / 2) * s;
  return `<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})"><path d="${d}" fill="${INK}"/></g>`;
}

// favicon 源:无阴影、tile 填满边框、字形最大化(小尺寸更清晰)
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img" aria-label="X2T">
<rect x="8" y="8" width="112" height="112" rx="18" fill="${LIME}" stroke="${INK}" stroke-width="8"/>
${x2t({ cx: 64, cy: 65, targetW: 84, targetH: 66 })}
</svg>
`;

// 品牌 logo:硬偏移阴影(tape 风格)
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 132 132" width="132" height="132" role="img" aria-label="X2T">
<rect x="22" y="24" width="96" height="96" rx="14" fill="${INK}"/>
<rect x="14" y="14" width="96" height="96" rx="14" fill="${LIME}" stroke="${INK}" stroke-width="6"/>
${x2t({ cx: 62, cy: 63, targetW: 74, targetH: 58 })}
</svg>
`;

writeFileSync("src/app/icon.svg", icon);
writeFileSync("public/logo.svg", logo);

// 光栅化(SVG 现在是纯 path,无需字体)
const png = (size) => sharp(Buffer.from(icon)).resize(size, size).png().toBuffer();
const b16 = await png(16);
const b32 = await png(32);
const b48 = await png(48);
writeFileSync("src/app/apple-icon.png", await png(180));
writeFileSync("public/icon-512.png", await png(512));
writeFileSync("src/app/favicon.ico", await pngToIco([b16, b32, b48]));

// ---- OG 分享图 1200x630(tape 风格:lime 底 + 粗黑框 + 带阴影徽标 + Anton 字形) ----
function badge(size, x, y) {
  const s = size / 132; // logo 几何在 132 viewBox 上
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <rect x="22" y="24" width="96" height="96" rx="14" fill="${INK}"/>
    <rect x="14" y="14" width="96" height="96" rx="14" fill="${LIME}" stroke="${INK}" stroke-width="6"/>
    ${x2t({ cx: 62, cy: 63, targetW: 74, targetH: 58 })}
  </g>`;
}
function tp(text, x, y, fs) {
  return `<path d="${font.getPath(text.toUpperCase(), x, y, fs).toPathData(2)}" fill="${INK}"/>`;
}
const og = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
<rect width="1200" height="630" fill="${LIME}"/>
<rect x="24" y="24" width="1152" height="582" fill="none" stroke="${INK}" stroke-width="16"/>
${badge(340, 95, 145)}
${tp("X2T", 500, 330, 220)}
${tp("SIGNALS AND AI ANALYSIS", 506, 408, 48)}
${tp("NOT FINANCIAL ADVICE", 508, 456, 30)}
</svg>
`;
writeFileSync("public/og.png", await sharp(Buffer.from(og)).png().toBuffer());

console.log("✓ generated: icon.svg, logo.svg, favicon.ico, apple-icon.png, icon-512.png, og.png");

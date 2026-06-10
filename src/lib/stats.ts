// 零依赖统计工具:精确单侧二项检验 + Benjamini-Hochberg FDR 校正。
// 用于博主战绩排行榜:同时比较 N 个博主时做多重检验校正,避免榜首混进"幸运儿"假阳性。

// 对数 Gamma(Lanczos g=7 近似),供精确二项检验的组合数,避免大 n 阶乘溢出。
function logGamma(x: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function logChoose(n: number, k: number): number {
  return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
}

/**
 * 单侧【精确】二项检验 p 值:P(X >= beats),X ~ Binomial(n, p0)。默认 p0=0.5(是否真的强于抛硬币)。
 * 对数空间精确求和,取代旧的正态近似——排行榜门槛样本(n=10)处正态近似无连续性校正会把 p 低估近 2 倍,
 * 恰好跨过显著线;n 最多几百,精确求和零成本。
 */
export function binomTestGreater(beats: number, n: number, p0 = 0.5): number {
  if (n === 0) return 1;
  if (beats <= 0) return 1; // P(X>=0)=1
  if (beats > n) return 0;
  const lp = Math.log(p0);
  const lq = Math.log(1 - p0);
  let sum = 0;
  for (let k = beats; k <= n; k++) sum += Math.exp(logChoose(n, k) + k * lp + (n - k) * lq);
  return Math.min(1, sum);
}

/** Benjamini-Hochberg FDR:给一组 p 值,返回每个是否在 FDR=alpha 下显著(布尔数组,顺序对应输入)。 */
export function benjaminiHochberg(pvalues: number[], alpha = 0.1): boolean[] {
  const n = pvalues.length;
  const reject = new Array(n).fill(false);
  if (n === 0) return reject;
  const sorted = pvalues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  let maxK = -1;
  for (let k = 0; k < n; k++) {
    if (sorted[k].p <= ((k + 1) / n) * alpha) maxK = k;
  }
  for (let k = 0; k <= maxK; k++) reject[sorted[k].i] = true;
  return reject;
}

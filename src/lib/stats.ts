// 零依赖统计工具(借鉴 AI-Trader research_common.py:确定性 bootstrap + BH-FDR)。
// 用于博主战绩排行榜:在同时比较 N 个博主时做多重检验校正,避免榜首混进"幸运儿"假阳性。

// 确定性 PRNG(种子固定 → bootstrap 结果可复现,不用 Math.random)
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 一组数值均值的 bootstrap 95% 置信区间(确定性:种子随样本量变化但可复现)。 */
export function bootstrapCi(values: number[], iterations = 2000): [number, number] {
  const n = values.length;
  if (n === 0) return [0, 0];
  if (n === 1) return [values[0], values[0]];
  const rnd = mulberry32(0x9e3779b9 ^ n);
  const means: number[] = new Array(iterations);
  for (let i = 0; i < iterations; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) sum += values[Math.floor(rnd() * n)];
    means[i] = sum / n;
  }
  means.sort((a, b) => a - b);
  return [means[Math.floor(iterations * 0.025)], means[Math.floor(iterations * 0.975)]];
}

// 标准正态 CDF(Abramowitz-Stegun erf 近似),供二项检验 p 值。
function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x >= 0 ? 1 - p : p;
}

/** 单侧二项检验 p 值:beats/n 是否显著 > p0(默认 0.5,即"是否真的强于抛硬币")。正态近似。 */
export function binomTestGreater(beats: number, n: number, p0 = 0.5): number {
  if (n === 0) return 1;
  const z = (beats - n * p0) / Math.sqrt(n * p0 * (1 - p0));
  return 1 - normalCdf(z);
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

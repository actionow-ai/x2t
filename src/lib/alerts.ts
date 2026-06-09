import { prisma } from "./db";
import { getStockConsensus } from "./stance";
import { sendAlertToUser } from "./push";

// 可组合告警(借鉴 PanWatch):某标的的共识/翻转满足用户自定义 AND/OR 条件时,推给该用户。
const ALERT_COOLDOWN_MS = Number(process.env.ALERT_COOLDOWN_MS ?? 6 * 3600 * 1000);

// 在分析完一批帖后调用:symbols=本批涉及标的,flipped=本批发生翻转的标的。
export async function evaluateAlerts(symbols: string[], flipped: Set<string>): Promise<number> {
  let fired = 0;
  for (const sym of [...new Set(symbols)]) {
    const rules = await prisma.alertRule.findMany({ where: { active: true, OR: [{ symbol: sym }, { symbol: null }] } });
    if (!rules.length) continue;
    const c = await getStockConsensus(sym);
    for (const r of rules) {
      if (r.lastFiredAt && Date.now() - r.lastFiredAt.getTime() < ALERT_COOLDOWN_MS) continue; // 冷却防轰炸
      const conds: boolean[] = [];
      const parts: string[] = [];
      if (r.minBull > 0) {
        const ok = c.bullish >= r.minBull;
        conds.push(ok);
        if (ok) parts.push(`看多 ${c.bullish}≥${r.minBull}`);
      }
      if (r.minBear > 0) {
        const ok = c.bearish >= r.minBear;
        conds.push(ok);
        if (ok) parts.push(`看空 ${c.bearish}≥${r.minBear}`);
      }
      if (r.onFlip) {
        const ok = flipped.has(sym);
        conds.push(ok);
        if (ok) parts.push(`立场翻转`);
      }
      if (!conds.length) continue;
      const met = r.combine === "and" ? conds.every(Boolean) : conds.some(Boolean);
      if (!met) continue;
      await prisma.alertRule.update({ where: { id: r.id }, data: { lastFiredAt: new Date() } });
      const n = await sendAlertToUser(r.userId, `⚑ $${sym} 触发预警`, parts.join(" · ") || `$${sym}`, `/t/${sym}`);
      if (n) fired++;
    }
  }
  return fired;
}

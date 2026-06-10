import { prisma } from "./db";
import { getStockConsensus } from "./stance";
import { sendAlertToUser } from "./push";
import { notify, pickLocale } from "./notify-format";

// 可组合告警(借鉴 PanWatch):某标的的共识/翻转满足用户自定义 AND/OR 条件时,推给该用户。
const ALERT_COOLDOWN_MS = Number(process.env.ALERT_COOLDOWN_MS ?? 6 * 3600 * 1000);

// 在分析完一批帖后调用:symbols=本批涉及标的,flipped=本批发生翻转的标的。
export async function evaluateAlerts(symbols: string[], flipped: Set<string>): Promise<number> {
  let fired = 0;
  for (const sym of [...new Set(symbols)]) {
    const rules = await prisma.alertRule.findMany({
      where: { active: true, OR: [{ symbol: sym }, { symbol: null }] },
      include: { user: { select: { locale: true } } },
    });
    if (!rules.length) continue;
    const c = await getStockConsensus(sym);
    for (const r of rules) {
      if (r.lastFiredAt && Date.now() - r.lastFiredAt.getTime() < ALERT_COOLDOWN_MS) continue; // 冷却防轰炸
      const locale = pickLocale(r.user?.locale);
      const conds: boolean[] = [];
      const parts: string[] = [];
      if (r.minBull > 0) {
        const ok = c.bullish >= r.minBull;
        conds.push(ok);
        if (ok) parts.push(notify.condBull(locale, c.bullish, r.minBull));
      }
      if (r.minBear > 0) {
        const ok = c.bearish >= r.minBear;
        conds.push(ok);
        if (ok) parts.push(notify.condBear(locale, c.bearish, r.minBear));
      }
      if (r.onFlip) {
        const ok = flipped.has(sym);
        conds.push(ok);
        if (ok) parts.push(notify.condFlip(locale));
      }
      if (!conds.length) continue;
      const met = r.combine === "and" ? conds.every(Boolean) : conds.some(Boolean);
      if (!met) continue;
      // 先发送,确有订阅收到才进入冷却——修 P0:旧逻辑命中即写 lastFiredAt 进 6h 冷却,
      // 但若用户没有效订阅(send 返回 0),这次"命中"被静默吞掉、6 小时内不再尝试。
      const n = await sendAlertToUser(r.userId, notify.alertTitle(locale, sym), parts.join(" · ") || `$${sym}`, `/t/${sym}`);
      if (n) {
        await prisma.alertRule.update({ where: { id: r.id }, data: { lastFiredAt: new Date() } });
        fired++;
      }
    }
  }
  return fired;
}

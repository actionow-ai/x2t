import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { getLocale } from "@/lib/i18n-server";
import { getDict } from "@/lib/i18n";
import { createAlert, deleteAlert } from "./actions";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const uid = await getCurrentUserId();
  const t = getDict(await getLocale());

  if (!uid) {
    return (
      <div className="narrow">
        <h1 className="page-title">{t.alerts.title}</h1>
        <div className="empty">
          {t.alerts.loginFirst} <Link href="/login" style={{ color: "var(--accent)" }}>{t.nav.login}</Link>
        </div>
      </div>
    );
  }

  const rules = await prisma.alertRule.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" } });

  return (
    <div className="narrow">
      <h1 className="page-title">{t.alerts.title}</h1>
      <p className="page-sub">{t.alerts.sub}</p>

      <form className="form alert-form" action={createAlert}>
        <div className="alert-row">
          <input name="symbol" placeholder={t.alerts.symbol} aria-label={t.alerts.symbol} style={{ width: "10rem" }} />
          <label className="alert-num">{t.alerts.minBull} <input name="minBull" type="number" min="0" max="50" defaultValue="0" /></label>
          <label className="alert-num">{t.alerts.minBear} <input name="minBear" type="number" min="0" max="50" defaultValue="0" /></label>
          <label className="alert-check"><input name="onFlip" type="checkbox" /> {t.alerts.onFlip}</label>
          <select name="combine" defaultValue="or" aria-label={`${t.alerts.or} / ${t.alerts.and}`}>
            <option value="or">{t.alerts.or}</option>
            <option value="and">{t.alerts.and}</option>
          </select>
        </div>
        <button className="btn primary" type="submit" style={{ alignSelf: "flex-start" }}>{t.alerts.create}</button>
        <p className="hint">{t.alerts.ruleHint}</p>
      </form>

      {rules.length === 0 ? (
        <div className="empty">{t.alerts.empty}</div>
      ) : (
        <div className="alert-list">
          {rules.map((r) => (
            <div key={r.id} className="alert-item">
              <div className="alert-desc">
                <strong>{r.symbol ? `$${r.symbol}` : t.alerts.anySymbol}</strong>
                <span className="alert-conds">
                  {[
                    r.minBull > 0 ? `${t.alerts.minBull}${r.minBull}` : null,
                    r.minBear > 0 ? `${t.alerts.minBear}${r.minBear}` : null,
                    r.onFlip ? t.alerts.onFlip : null,
                  ]
                    .filter(Boolean)
                    .join(` ${r.combine === "and" ? "AND" : "OR"} `)}
                </span>
              </div>
              <form action={deleteAlert}>
                <input type="hidden" name="id" value={r.id} />
                <button className="btn ghost" type="submit">{t.alerts.delete}</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

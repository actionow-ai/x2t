import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { getDict } from "@/lib/i18n";

// 站点页脚:运营信息 + 法务链接 + 来源/免责披露 + 纠错入口(信任与合规基础设施)。
export async function Footer() {
  const t = getDict(await getLocale()).footer;
  return (
    <footer className="site-footer">
      <div className="inner">
        <div className="foot-brand">X2T · {t.tagline}</div>
        <nav className="foot-links">
          <Link href="/about">{t.about}</Link>
          <Link href="/terms">{t.terms}</Link>
          <Link href="/privacy">{t.privacy}</Link>
          <a href="mailto:actionow.ai@gmail.com?subject=X2T%20report">{t.report}</a>
        </nav>
        <p className="foot-note">{t.notAdvice}</p>
        <p className="foot-note">{t.sourceNote}</p>
        <p className="foot-rights">© 2026 actionow.ai · {t.rights}</p>
      </div>
    </footer>
  );
}

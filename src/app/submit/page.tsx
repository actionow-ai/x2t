import { submitPost } from "./actions";
import { getLocale } from "@/lib/i18n-server";
import { getDict } from "@/lib/i18n";

export default async function SubmitPage() {
  const t = getDict(await getLocale());

  return (
    <div className="narrow">
      <h1 className="page-title">{t.submit.title}</h1>
      <p className="page-sub">{t.submit.sub}</p>

      <form className="form" action={submitPost}>
        <div>
          <label htmlFor="sf-handle">{t.submit.handleLabel} *</label>
          <input id="sf-handle" name="handle" placeholder="serenity" required />
        </div>
        <div>
          <label htmlFor="sf-name">{t.submit.displayNameLabel}</label>
          <input id="sf-name" name="displayName" placeholder="Serenity" />
        </div>
        <div>
          <label htmlFor="sf-content">{t.submit.contentLabel} *</label>
          <textarea id="sf-content" name="contentText" placeholder="Loading up on $NVDA here. Target 1200." required />
        </div>
        <div>
          <label htmlFor="sf-url">{t.submit.urlLabel}</label>
          <input id="sf-url" name="url" placeholder="https://x.com/..." />
        </div>
        <button className="btn primary" type="submit" style={{ alignSelf: "flex-start" }}>
          {t.submit.button}
        </button>
        <p className="hint">{t.submit.hint}</p>
      </form>
    </div>
  );
}

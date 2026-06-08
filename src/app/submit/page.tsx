import { submitPost } from "./actions";
import { getLocale } from "@/lib/i18n-server";
import { getDict } from "@/lib/i18n";

export default async function SubmitPage() {
  const t = getDict(await getLocale());

  return (
    <>
      <h1 className="page-title">{t.submit.title}</h1>
      <p className="page-sub">{t.submit.sub}</p>

      <form className="form" action={submitPost}>
        <div>
          <label>{t.submit.handleLabel} *</label>
          <input name="handle" placeholder="serenity" required />
        </div>
        <div>
          <label>{t.submit.displayNameLabel}</label>
          <input name="displayName" placeholder="Serenity" />
        </div>
        <div>
          <label>{t.submit.contentLabel} *</label>
          <textarea name="contentText" placeholder="Loading up on $NVDA here. Target 1200." required />
        </div>
        <div>
          <label>{t.submit.urlLabel}</label>
          <input name="url" placeholder="https://x.com/..." />
        </div>
        <button className="btn primary" type="submit" style={{ alignSelf: "flex-start" }}>
          {t.submit.button}
        </button>
        <p className="hint">{t.submit.hint}</p>
      </form>
    </>
  );
}

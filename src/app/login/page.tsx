"use client";

import { useState } from "react";
import { useT } from "@/components/LangProvider";

export default function LoginPage() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [devLink, setDevLink] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState("error");
        return;
      }
      setDevLink(data.devLink ?? null);
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return (
    <>
      <h1 className="page-title">{t.login.title}</h1>
      <p className="page-sub">{t.login.sub}</p>

      {state === "sent" ? (
        <div className="form">
          <p>
            ✅ {t.login.sentTo} <strong>{email}</strong>（{t.login.validFor}）。
          </p>
          {devLink && (
            <p className="hint">
              {t.login.devMode}
              <a href={devLink} style={{ color: "var(--accent)" }}>{t.login.devLinkGo}</a>
            </p>
          )}
        </div>
      ) : (
        <form className="form" onSubmit={submit}>
          <div>
            <label htmlFor="login-email">{t.login.emailLabel}</label>
            <input id="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <button className="btn primary" type="submit" disabled={state === "sending"} style={{ alignSelf: "flex-start" }}>
            {state === "sending" ? t.login.sending : t.login.button}
          </button>
          {state === "error" && <p className="hint" style={{ color: "var(--error)" }}>{t.login.error}</p>}
        </form>
      )}
    </>
  );
}

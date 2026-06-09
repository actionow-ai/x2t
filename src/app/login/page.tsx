"use client";

import { useState } from "react";
import { useT } from "@/components/LangProvider";

export default function LoginPage() {
  const t = useT();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (!res.ok) {
        setError(t.login.error);
      } else {
        setDevCode(data.devCode ?? null);
        setStep("code");
      }
    } catch {
      setError(t.login.error);
    }
    setBusy(false);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code }) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.login.codeError);
        setBusy(false);
        return;
      }
      window.location.href = "/?welcome=1";
    } catch {
      setError(t.login.error);
      setBusy(false);
    }
  }

  return (
    <div className="narrow">
      <h1 className="page-title">{t.login.title}</h1>
      <p className="page-sub">{t.login.sub}</p>

      {step === "email" ? (
        <form className="form" onSubmit={requestCode}>
          <div>
            <label htmlFor="login-email">{t.login.emailLabel}</label>
            <input id="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <button className="btn primary" type="submit" disabled={busy} style={{ alignSelf: "flex-start" }}>
            {busy ? t.login.sending : t.login.sendCode}
          </button>
          {error && <p className="hint" style={{ color: "var(--error)" }}>{error}</p>}
        </form>
      ) : (
        <form className="form" onSubmit={verifyCode}>
          <p>
            {t.login.codeSentTo} <strong>{email}</strong>（{t.login.validFor}）。
          </p>
          {devCode && <p className="hint">{t.login.devMode}{devCode}</p>}
          <div>
            <label htmlFor="login-code">{t.login.codeLabel}</label>
            <input
              id="login-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              style={{ letterSpacing: "0.4em", fontFamily: "var(--mono)" }}
            />
          </div>
          <button className="btn primary" type="submit" disabled={busy || code.length !== 6} style={{ alignSelf: "flex-start" }}>
            {busy ? t.login.verifying : t.login.verify}
          </button>
          <button type="button" className="btn ghost" onClick={() => { setStep("email"); setCode(""); setError(""); }} style={{ alignSelf: "flex-start" }}>
            {t.login.changeEmail}
          </button>
          {error && <p className="hint" style={{ color: "var(--error)" }}>{error}</p>}
        </form>
      )}
    </div>
  );
}

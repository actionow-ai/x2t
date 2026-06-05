"use client";

import { useState } from "react";

export default function LoginPage() {
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
      <h1 className="page-title">登录 / 注册</h1>
      <p className="page-sub">邮箱魔法链接登录，无需密码。登录后关注列表云同步、可收邮件摘要。</p>

      {state === "sent" ? (
        <div className="form">
          <p>
            ✅ 登录链接已发送到 <strong>{email}</strong>（15 分钟内有效）。
          </p>
          {devLink && (
            <p className="hint">
              开发模式（未配 SMTP）：
              <a href={devLink} style={{ color: "var(--accent)" }}>点此直接登录 →</a>
            </p>
          )}
        </div>
      ) : (
        <form className="form" onSubmit={submit}>
          <div>
            <label>邮箱</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <button className="btn primary" type="submit" disabled={state === "sending"} style={{ alignSelf: "flex-start" }}>
            {state === "sending" ? "发送中…" : "发送登录链接"}
          </button>
          {state === "error" && <p className="hint" style={{ color: "var(--error)" }}>出错了，请重试。</p>}
        </form>
      )}
    </>
  );
}

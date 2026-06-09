"use client";

import { useState, useTransition } from "react";
import { useT } from "./LangProvider";
import { setDigestOptIn } from "@/lib/digest-action";

// 邮件每日摘要订阅开关(opt-in)。乐观更新,失败回滚。
export function EmailDigestToggle({ initial }: { initial: boolean }) {
  const t = useT();
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    start(async () => {
      const r = await setDigestOptIn(next);
      if (!r.ok) setOn(!next);
    });
  }

  return (
    <button className={`btn ${on ? "primary" : "ghost"}`} onClick={toggle} disabled={pending} title={t.following.digestHint}>
      {on ? t.following.digestOn : t.following.digestOff}
    </button>
  );
}

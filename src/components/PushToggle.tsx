"use client";

import { useEffect, useState } from "react";
import { getFollows, urlBase64ToUint8Array, postSubscription } from "@/lib/follow-client";
import { useT } from "./LangProvider";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type State = "idle" | "on" | "unsupported" | "denied" | "working";

export function PushToggle() {
  const t = useT();
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) setState("on");
    });
  }, []);

  async function enable() {
    if (!VAPID) {
      alert("VAPID 公钥未配置（NEXT_PUBLIC_VAPID_PUBLIC_KEY）");
      return;
    }
    setState("working");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID),
      });
      await postSubscription(sub, getFollows());
      setState("on");
    } catch (e) {
      console.error(e);
      setState("idle");
    }
  }

  if (state === "unsupported") return <span className="hint">{t.push.unsupported}</span>;
  if (state === "denied") return <span className="hint">{t.push.denied}</span>;
  if (state === "on") {
    return (
      <span className="btn ghost" style={{ cursor: "default" }}>
        {t.push.on}
      </span>
    );
  }
  return (
    <button className="btn primary" onClick={enable} disabled={state === "working"}>
      {state === "working" ? t.push.enabling : t.push.enable}
    </button>
  );
}

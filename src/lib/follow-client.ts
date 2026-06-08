"use client";

// 账号无关的关注：关注列表存浏览器 localStorage，并镜像到 push 订阅的 followFilter。
const KEY = "x2t_follows";

export function getFollows(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function isFollowing(id: string): boolean {
  return getFollows().includes(id);
}

// 镜像到 cookie,让服务端(SSR)能按匿名关注过滤信号流。
function writeCookie(follows: string[]) {
  if (typeof document === "undefined") return;
  document.cookie = `${KEY}=${encodeURIComponent(follows.join(","))}; path=/; max-age=31536000; samesite=lax`;
}

// 把本地关注同步到 cookie;幂等,挂载时调用即可。
export function syncFollowsCookie(): void {
  writeCookie(getFollows());
}

export function toggleFollow(id: string): string[] {
  const cur = getFollows();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  localStorage.setItem(KEY, JSON.stringify(next));
  writeCookie(next);
  return next;
}

// VAPID 公钥 base64url -> Uint8Array
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function postSubscription(sub: PushSubscription, followFilter: string[]): Promise<void> {
  const json = sub.toJSON();
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, followFilter }),
  });
}

// 关注变化时：若已有 push 订阅，把最新关注列表同步到服务端
export async function syncFollowFilter(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) await postSubscription(sub, getFollows());
}

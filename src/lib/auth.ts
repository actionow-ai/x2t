import crypto from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";

const COOKIE = "x2t_session";

// 供 route handler 在 NextResponse 上直接设置 cookie（比 cookies() 更稳）
export const SESSION_COOKIE = COOKIE;
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};
export function sessionCookieValue(userId: string, tokenVersion: number): string {
  return sign(`${userId}:${tokenVersion}`);
}

function parsePayload(payload: string): { userId: string; tv: number } | null {
  const i = payload.indexOf(":");
  if (i < 0) return null; // 旧格式(无 tokenVersion)→ 视为失效,强制重新登录
  const tv = Number(payload.slice(i + 1));
  return { userId: payload.slice(0, i), tv: Number.isFinite(tv) ? tv : -1 };
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  // 生产缺失或仍是占位值 → fail-fast，杜绝用公开密钥伪造会话。
  if (!s || s === "change-me-to-a-random-secret" || s === "dev-insecure-secret-change-me") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET 未设置：生产环境必须设为随机值（openssl rand -hex 32）");
    }
    return "dev-insecure-secret-change-me";
  }
  return s;
}

// HMAC 签名 cookie（value.signature）
function sign(value: string): string {
  const sig = crypto.createHmac("sha256", secret()).update(value).digest("base64url");
  return `${value}.${sig}`;
}

function unsign(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx < 0) return null;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = crypto.createHmac("sha256", secret()).update(value).digest("base64url");
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return value;
}

// 仅可在 route handler / server action 中调用（会写 cookie）
export async function setSession(userId: string, tokenVersion: number): Promise<void> {
  const c = await cookies();
  c.set(COOKIE, sessionCookieValue(userId, tokenVersion), { ...SESSION_COOKIE_OPTIONS });
}

export async function clearSession(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE);
}

// 撤销该用户所有会话(登出/泄露):tokenVersion +1,使已签发的旧 cookie 立即失效。
export async function revokeUserSessions(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } }).catch(() => {});
}

// 廉价:仅从有效签名 cookie 取 userId(不查 DB、不校验 tokenVersion)。用于非敏感的"是否登录"。
export async function getCurrentUserId(): Promise<string | null> {
  const c = await cookies();
  const raw = c.get(COOKIE)?.value;
  if (!raw) return null;
  const val = unsign(raw);
  return val ? parsePayload(val)?.userId ?? null : null;
}

// 完整:查 DB 并校验 tokenVersion(撤销点)。敏感读用这个。
export async function getCurrentUser() {
  const c = await cookies();
  const raw = c.get(COOKIE)?.value;
  if (!raw) return null;
  const val = unsign(raw);
  if (!val) return null;
  const p = parsePayload(val);
  if (!p) return null;
  const user = await prisma.user.findUnique({ where: { id: p.userId } });
  if (!user || user.tokenVersion !== p.tv) return null; // 用户不存在或会话已撤销
  return user;
}

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
export function sessionCookieValue(userId: string): string {
  return sign(userId);
}

function secret(): string {
  return process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me";
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
export async function setSession(userId: string): Promise<void> {
  const c = await cookies();
  c.set(COOKIE, sign(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE);
}

export async function getCurrentUserId(): Promise<string | null> {
  const c = await cookies();
  const raw = c.get(COOKIE)?.value;
  return raw ? unsign(raw) : null;
}

export async function getCurrentUser() {
  const id = await getCurrentUserId();
  if (!id) return null;
  return prisma.user.findUnique({ where: { id } });
}

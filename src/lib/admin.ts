import { getCurrentUser } from "./auth";

// 管理员邮箱白名单（ADMIN_EMAILS，逗号分隔）。
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// 登录用户 + 在白名单内即为管理员。
// 未设置 ADMIN_EMAILS 时，任何登录用户都算管理员（仅便于本机；生产务必设置）。
export async function isAdmin(): Promise<boolean> {
  const u = await getCurrentUser();
  if (!u) return false;
  const list = adminEmails();
  return list.length === 0 || list.includes(u.email.toLowerCase());
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("forbidden: admin only");
}

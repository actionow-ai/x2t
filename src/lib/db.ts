import { PrismaClient } from "@prisma/client";

// Next.js dev 下热重载会反复 new PrismaClient，用全局单例避免连接耗尽。
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ["warn", "error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

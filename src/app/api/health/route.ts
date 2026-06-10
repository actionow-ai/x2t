import { readFileSync } from "node:fs";
import { prisma } from "@/lib/db";
import { HEARTBEAT_FILE } from "@/lib/health";
import { lastSuccessAgeMs } from "@/lib/jobrun";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 健康检查:DB 连通 + worker 心跳新鲜度。供 Zeabur/外部探活。
export async function GET() {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }

  let workerLastTickMs: number | null = null;
  try {
    workerLastTickMs = Number(readFileSync(HEARTBEAT_FILE, "utf8").trim()) || null;
  } catch {
    workerLastTickMs = null;
  }
  const ageMs = workerLastTickMs ? Date.now() - workerLastTickMs : null;
  // 心跳超过 ~3 个轮询周期(默认 3×180s=9min)视为可能卡死
  const staleMs = Number(process.env.POLL_INTERVAL_MS ?? 180_000) * 3;
  const workerHealthy = ageMs != null && ageMs < staleMs;
  // 距上次【成功产出】多久(而非仅"心跳活着")——暴露"僵尸 worker:进程活着但轮轮失败"(运维 H3)
  let lastSuccessfulTickAgeMs: number | null = null;
  try {
    lastSuccessfulTickAgeMs = await lastSuccessAgeMs("tick");
  } catch {
    lastSuccessfulTickAgeMs = null;
  }

  const ok = db; // DB 是硬指标;worker 卡死单独标注但不致 503(避免误杀 web)
  return Response.json(
    {
      ok,
      db,
      worker: { lastTickMs: workerLastTickMs, ageMs, healthy: workerHealthy, lastSuccessfulTickAgeMs },
      ts: Date.now(),
    },
    { status: ok ? 200 : 503 },
  );
}

import { Prisma } from "@prisma/client";
import { prisma } from "./db";

// 后台任务运行记录(团队约定"写 DB 观测"而非看日志)。供 digest 调度持久化(防"重启即失忆/谎报发送")、
// /api/health 与 admin 回答"距上次成功多久"。观测失败一律吞掉,绝不阻塞主流程。

export async function startJob(job: string): Promise<string | null> {
  try {
    const r = await prisma.jobRun.create({ data: { job } });
    return r.id;
  } catch {
    return null;
  }
}

export async function finishJob(id: string | null, ok: boolean, stats?: unknown, error?: string): Promise<void> {
  if (!id) return;
  const data: Prisma.JobRunUpdateInput = { finishedAt: new Date(), ok };
  if (stats !== undefined) data.stats = stats as Prisma.InputJsonValue;
  if (error) data.error = error.slice(0, 500);
  await prisma.jobRun.update({ where: { id }, data }).catch(() => {});
}

// 今日(UTC)是否已成功跑过某 job——digest 调度据此持久化:重启不丢、当天不重发。
export async function ranSuccessfullyToday(job: string): Promise<boolean> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const r = await prisma.jobRun.findFirst({ where: { job, ok: true, startedAt: { gte: since } } });
  return !!r;
}

// 距上次成功完成的毫秒数(无记录=null)。供 health/admin 暴露"管道是否在产出"(而非仅"进程活着")。
export async function lastSuccessAgeMs(job: string): Promise<number | null> {
  const r = await prisma.jobRun.findFirst({ where: { job, ok: true }, orderBy: { startedAt: "desc" }, select: { finishedAt: true } });
  return r?.finishedAt ? Date.now() - r.finishedAt.getTime() : null;
}

// worker 心跳文件(web 与 worker 同容器,共享 /tmp)。/api/health 据此判断后台是否存活。
export const HEARTBEAT_FILE = process.env.WORKER_HEARTBEAT_FILE || "/tmp/x2t-worker.heartbeat";

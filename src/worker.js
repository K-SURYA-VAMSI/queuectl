
import { initDb, workerLoop, getConfig } from './index.js';

const id = process.env.QUEUECTL_WORKER_ID || String(process.pid);
const poll = Number(process.env.QUEUECTL_POLL || (getConfig('poll_interval_ms') || 500));

(async () => {
  await initDb();
  await workerLoop(id, poll);
  process.exit(0);
})();

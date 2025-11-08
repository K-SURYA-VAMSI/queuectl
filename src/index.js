
import Database from 'better-sqlite3';
import fs from 'fs-extra';
import { execa } from 'execa';
import os from 'node:os';
import path from 'node:path';
import { customAlphabet } from 'nanoid';
import process from 'node:process';

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 12);
export const HOME = path.join(os.homedir(), '.queuectl');
export const DB_PATH = path.join(HOME, 'queue.db');
export const LOG_DIR = path.join(HOME, 'logs');
export const PID_FILE = path.join(HOME, 'pids.json');

export let _db = null;

export async function ensureDirs() {
  await fs.ensureDir(HOME);
  await fs.ensureDir(LOG_DIR);
}

export function db() {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('busy_timeout = 5000');
  return _db;
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

export async function initDb() {
  await ensureDirs();
  const d = db();
  d.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    command TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    run_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_error TEXT,
    worker_id TEXT,
    scheduled_at TEXT,
    output_log TEXT,
    priority INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs(state);
  CREATE INDEX IF NOT EXISTS idx_jobs_sched ON jobs(scheduled_at);
  CREATE TABLE IF NOT EXISTS dlq (
    id TEXT PRIMARY KEY,
    original_job JSON NOT NULL,
    failed_at TEXT NOT NULL,
    reason TEXT
  );
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS workers (
    id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    heartbeat_at TEXT NOT NULL,
    stopping INTEGER NOT NULL DEFAULT 0
  );
  `);
  const defaults = [
    ['max_retries', '3'],
    ['backoff_base', '2'],
    ['poll_interval_ms', '500'],
    ['job_timeout_ms', '0'] // 0 => no timeout
  ];
  const upsert = d.prepare('INSERT INTO config(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING');
  for (const [k,v] of defaults) upsert.run(k,v);
}

export function getConfig(key) {
  const row = db().prepare('SELECT value FROM config WHERE key=?').get(key);
  return row ? row.value : null;
}
export function setConfig(key, value) {
  db().prepare('INSERT INTO config(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value));
}

function nowIso() { return new Date().toISOString(); }

export function enqueueJob(job) {
  const d = db();
  const id = job.id || nanoid();
  const created = nowIso();
  const run_at = job.run_at || created;
  const scheduled_at = run_at;
  const max_retries = Number.isInteger(job.max_retries) ? job.max_retries : Number(getConfig('max_retries'));
  const priority = Number.isInteger(job.priority) ? job.priority : 0;
  const output_log = path.join(LOG_DIR, `job-${id}.log`);
  d.prepare(`INSERT INTO jobs(id, command, state, attempts, max_retries, run_at, created_at, updated_at, scheduled_at, output_log, priority)
             VALUES(@id, @command, 'pending', 0, @max_retries, @run_at, @created_at, @created_at, @scheduled_at, @output_log, @priority)`)
    .run({ id, command: job.command, max_retries, run_at, created_at: created, scheduled_at, output_log, priority });
  return id;
}

export function listJobs(state=null, limit=50, offset=0) {
  const d = db();
  if (state) {
    return d.prepare('SELECT * FROM jobs WHERE state=? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(state, limit, offset);
  }
  return d.prepare('SELECT * FROM jobs ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
}

export function getStatus() {
  const d = db();
  const counts = Object.fromEntries(d.prepare('SELECT state, COUNT(*) c FROM jobs GROUP BY state').all().map(r => [r.state, r.c]));
  const workers = d.prepare('SELECT * FROM workers').all();
  return { counts, workers };
}

function computeDelaySeconds(attempts) {
  const base = Number(getConfig('backoff_base') || 2);
  // first failure (attempts just incremented) => base^attempts
  return Math.pow(base, attempts);
}

function claimNextJob(worker_id) {
  const d = db();
  d.prepare('BEGIN IMMEDIATE').run();
  try {
    const row = d.prepare(`
      SELECT * FROM jobs
      WHERE state='pending'
        AND (scheduled_at IS NULL OR scheduled_at <= ?)
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
    `).get(nowIso());
    if (!row) {
      d.prepare('COMMIT').run();
      return null;
    }
    d.prepare(`UPDATE jobs SET state='processing', updated_at=?, worker_id=? WHERE id=? AND state='pending'`).run(nowIso(), worker_id, row.id);
    const changed = d.prepare('SELECT changes() c').get().c;
    d.prepare('COMMIT').run();
    if (changed === 0) return null;
    return { ...row, state: 'processing', worker_id };
  } catch (e) {
    d.prepare('ROLLBACK').run();
    throw e;
  }
}

async function runCommandWithOptionalTimeout(cmd, timeoutMs) {
  if (!timeoutMs || timeoutMs <= 0) {
    return await execa(cmd, { shell: true, all: true });
  }
  let timer;
  try {
    const p = execa(cmd, { shell: true, all: true });
    const killer = new Promise((_, rej) => {
      timer = setTimeout(() => {
        try { p.kill('SIGTERM', { forceKillAfterTimeout: 2000 }); } catch {}
        rej(new Error('timeout'));
      }, timeoutMs);
    });
    const res = await Promise.race([p, killer]);
    return res;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function workerLoop(worker_id, pollMs) {
  const d = db();
  d.prepare('INSERT INTO workers(id, started_at, heartbeat_at, stopping) VALUES(?,?,?,0) ON CONFLICT(id) DO UPDATE SET heartbeat_at=excluded.heartbeat_at, stopping=0')
    .run(worker_id, nowIso(), nowIso());

  let stopping = false;
  process.on('SIGTERM', () => { stopping = true; d.prepare('UPDATE workers SET stopping=1 WHERE id=?').run(worker_id); });
  process.on('SIGINT', () => { stopping = true; d.prepare('UPDATE workers SET stopping=1 WHERE id=?').run(worker_id); });

  while (true) {
    d.prepare('UPDATE workers SET heartbeat_at=? WHERE id=?').run(nowIso(), worker_id);

    if (stopping) {
      // graceful exit: finish loop without claiming new jobs
      break;
    }

    const job = claimNextJob(worker_id);
    if (!job) {
      await new Promise(r => setTimeout(r, pollMs));
      continue;
    }

    // Mark as processing
    const logPath = job.output_log || path.join(LOG_DIR, `job-${job.id}.log`);
    await fs.ensureFile(logPath);
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    logStream.write(`[${nowIso()}] START command="${job.command}" (attempt ${job.attempts+1}/${job.max_retries})\n`);

    let success = false;
    let errorText = null;
    try {
      const timeoutMs = Number(getConfig('job_timeout_ms') || 0);
      const result = await runCommandWithOptionalTimeout(job.command, timeoutMs);
      logStream.write(result.all || '');
      success = result.exitCode === 0;
    } catch (err) {
      errorText = (err && err.all) ? err.all : (err && err.message) ? err.message : String(err);
      logStream.write(`\n[${nowIso()}] ERROR: ${errorText}\n`);
      success = false;
    } finally {
      logStream.write(`[${nowIso()}] END\n\n`);
      logStream.end();
    }

    if (success) {
      d.prepare(`UPDATE jobs SET state='completed', updated_at=?, last_error=NULL WHERE id=?`).run(nowIso(), job.id);
    } else {
      const attempts = job.attempts + 1;
      if (attempts > job.max_retries) {
        // Move to DLQ
        d.prepare('BEGIN IMMEDIATE').run();
        try {
          const original = d.prepare('SELECT * FROM jobs WHERE id=?').get(job.id);
          d.prepare('DELETE FROM jobs WHERE id=?').run(job.id);
          d.prepare('INSERT INTO dlq(id, original_job, failed_at, reason) VALUES(?,?,?,?)')
            .run(job.id, JSON.stringify(original), nowIso(), errorText || 'failed');
          d.prepare('COMMIT').run();
        } catch (e) {
          d.prepare('ROLLBACK').run();
          throw e;
        }
      } else {
        const delaySec = computeDelaySeconds(attempts);
        const scheduledAt = new Date(Date.now() + delaySec * 1000).toISOString();
        d.prepare(`UPDATE jobs SET state='pending', attempts=?, updated_at=?, scheduled_at=?, last_error=? WHERE id=?`)
          .run(attempts, nowIso(), scheduledAt, errorText || 'failed', job.id);
      }
    }
  }

  d.prepare('DELETE FROM workers WHERE id=?').run(worker_id);
}

export async function startWorkers(count=1, pollInterval=Number(getConfig('poll_interval_ms')||500)) {
  count = Number(count) || 1;
  await fs.ensureFile(PID_FILE);
  const pids = (await fs.readJson(PID_FILE).catch(() => ({ workers: [] }))) || { workers: [] };
  const { fork } = await import('node:child_process');
  for (let i=0; i<count; i++) {
    const worker_id = nanoid();
    const child = fork(new URL('./worker.js', import.meta.url), [], {
      stdio: 'ignore',
      detached: true,
      env: { ...process.env, QUEUECTL_WORKER_ID: worker_id, QUEUECTL_POLL: String(pollInterval) }
    });
    child.unref(); // Allow parent to exit without waiting for child
    pids.workers.push({ pid: child.pid, id: worker_id, started_at: nowIso() });
  }
  await fs.writeJson(PID_FILE, pids, { spaces: 2 });
  console.log(`started ${count} worker(s)`);
}

export async function stopWorkers() {
  const pids = (await fs.readJson(PID_FILE).catch(() => null));
  if (!pids || !pids.workers || pids.workers.length === 0) {
    console.log('no workers running');
    return;
  }
  for (const w of pids.workers) {
    try { process.kill(w.pid, 'SIGTERM'); } catch {}
  }
  await fs.writeJson(PID_FILE, { workers: [] }, { spaces: 2 });
  console.log('stop signal sent');
}

export function dlqList() {
  return db().prepare('SELECT * FROM dlq ORDER BY failed_at DESC').all();
}
export function dlqRetry(id) {
  const d = db();
  const row = d.prepare('SELECT * FROM dlq WHERE id=?').get(id);
  if (!row) return false;
  const original = JSON.parse(row.original_job);
  // reset fields for re-enqueue
  enqueueJob({ ...original, id, attempts: 0 });
  d.prepare('DELETE FROM dlq WHERE id=?').run(id);
  return true;
}

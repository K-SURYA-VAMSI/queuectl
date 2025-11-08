
# queuectl (Node.js)

A minimal, production-grade **CLI job queue** with **workers**, **retries with exponential backoff**, and a **Dead Letter Queue (DLQ)**. Persistent storage via **SQLite**.

> Tech: Node 18+, `better-sqlite3`, `commander`, `execa`

## ✨ Features

- Enqueue shell commands as jobs (e.g., `sleep 2`, `echo hi`)
- Multiple workers with parallel processing
- Atomic job claiming (no duplicate processing)
- Retries with exponential backoff (`delay = base^attempts`)
- Moves to **DLQ** after `max_retries`
- Persistent storage in `~/.queuectl/queue.db`
- Graceful shutdown (SIGTERM): finish current job, then exit
- Configurable via `queuectl config` (retries, backoff, poll interval, timeout)
- Per-job output logs in `~/.queuectl/logs/job-<id>.log`

## 📦 Install & Run

### Linux / macOS

```bash
# 1) Install dependencies
npm install

# 2) Link the CLI (or run via node bin/queuectl.js)
npm link
# now `queuectl` is available on PATH
```

### 🪟 Windows Setup

**Note**: `better-sqlite3` requires native compilation on Windows.

#### Prerequisites:
- Node.js 18+
- Visual Studio Build Tools

#### Install Build Tools:

**Option 1 - Automated**:
```bash
npm install --global windows-build-tools
```

**Option 2 - Manual**:
1. Download Visual Studio: https://visualstudio.microsoft.com/downloads/
2. Install with "Desktop development with C++" workload

Then:
```bash
npm install
npm link
```

#### Alternative: Use Docker
```dockerfile
# See Dockerfile in repo
docker build -t queuectl .
docker run -it queuectl
```

> Uses `~/.queuectl/` for DB, logs, and PID file.

## 🧪 Quick Demo

```bash
# Start 2 workers
queuectl worker start --count 2

# Enqueue a few jobs
queuectl enqueue '{"command":"echo \"Hello World\""}'
queuectl enqueue '{"command":"bash -lc \"exit 1\""}'           # will retry then DLQ
queuectl enqueue '{"command":"sleep 1 && echo done"}'

# Status
queuectl status

# Stop workers (graceful)
queuectl worker stop

# DLQ
queuectl dlq list
queuectl dlq retry <job-id>
```

## 🔧 CLI Reference

```
queuectl enqueue '<jobJson>' [--run-at <iso>] [--max-retries <n>]
queuectl worker start [--count <n>] [--poll-interval <ms>]
queuectl worker stop
queuectl status
queuectl list [--state <state>] [--limit <n>] [--offset <n>]
queuectl dlq list
queuectl dlq retry <id>
queuectl config get <key>
queuectl config set <key> <value>
```

### Config Keys
- `max_retries` (default `3`)
- `backoff_base` (default `2`)
- `poll_interval_ms` (default `500`)
- `job_timeout_ms` (default `0` = disabled)

## 🏗️ Architecture Overview

- **Persistence**: SQLite (`better-sqlite3`) with WAL mode for safe concurrency.
- **Atomic claim**: Worker uses a transaction to select one `pending` job whose `scheduled_at <= now()`, then `UPDATE ... WHERE state='pending'` to switch it to `processing`. Only one worker can succeed.
- **Execution**: Shell command via `execa` with optional timeout. Stdout/stderr are captured to per-job log file.
- **Retry/Backoff**: On failure, increment `attempts`, compute `delay = base^attempts`, set `scheduled_at = now + delay` and return job to `pending`. If `attempts > max_retries`, move job to `dlq`.
- **Graceful stop**: `queuectl worker stop` sends SIGTERM to PIDs saved in `~/.queuectl/pids.json`. Worker loop exits after current job.
- **DLQ**: Stores original job JSON + reason. `dlq retry <id>` re-enqueues and removes from DLQ.

## 🧷 Schema

Tables: `jobs`, `dlq`, `config`, `workers`

Key job columns:
- `state`: `pending|processing|completed|failed (not stored)|dead (in dlq)`
- `attempts`, `max_retries`
- `scheduled_at` (respects backoff)
- `output_log` (path to log)
- `priority` (higher first; default `0`)

## 🧪 Testing

Basic smoke test:

```bash
npm test
```

Demo run:

```bash
npm run demo
```

## 🧭 Assumptions & Trade-offs

- Uses SQLite for simplicity + durability; WAL mode for concurrency.
- Single-queue (no named queues) but **priority** supported.
- Scheduling via `run_at`/`scheduled_at`; no cron parser.
- Worker `start` runs a tiny supervisor that forks `N` worker processes and writes their PIDs to `~/.queuectl/pids.json`.
- If a worker crashes during a job, the job will be stuck in `processing`. A production system would have **stale processing recovery**; for brevity, not implemented here.

## 🧰 Bonus-ready Hooks

- **Timeouts**: set `job_timeout_ms`.
- **Priorities**: set `priority` when enqueueing.
- **Delayed jobs**: pass `--run-at` ISO time or set `scheduled_at` manually.

## 📹 CLI Demo

[🎥 Watch Working Demo Video](https://drive.google.com/your-link-here)

**Demo shows**:
- Enqueuing jobs with various outcomes
- Starting multiple workers
- Retry with exponential backoff
- Dead Letter Queue management
- Graceful shutdown
- Persistence across restarts

### Recording Your Own Demo

**Option 1: Using asciinema (Recommended for Linux/Mac)**
```bash
# Install asciinema
brew install asciinema  # macOS
# or: sudo apt install asciinema  # Ubuntu/Debian

# Record demo
asciinema rec queuectl-demo.cast

# Run the demo script
./scripts/demo-for-recording.sh

# Stop recording (Ctrl+D)
# Upload to asciinema.org or convert to GIF
```

**Option 2: Automated demo script**
```bash
# This script demonstrates all features with pauses
./scripts/demo-for-recording.sh
```

**Option 3: Manual demo**
```bash
# See "Manual Test Run" section below
```

**Recording Tools**:
- Linux/Mac: `asciinema` (https://asciinema.org/)
- Windows: OBS Studio or Win+G (Game Bar)
- Alternative: `terminalizer` or `vhs` for animated demos

### Manual Test Run

```bash
# Clean start
rm -rf ~/.queuectl

# Start 3 workers
queuectl worker start --count 3

# Enqueue jobs
queuectl enqueue '{"command":"echo Success"}'
queuectl enqueue '{"command":"bash -c \"exit 1\""}'  # Will retry then DLQ
queuectl enqueue '{"command":"sleep 2 && echo Done"}'

# Monitor
queuectl status
queuectl list --state processing

# Wait for retries, check DLQ
sleep 10
queuectl dlq list

# Stop
queuectl worker stop
```

## 📄 License

MIT

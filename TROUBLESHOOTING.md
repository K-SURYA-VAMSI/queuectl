# Troubleshooting Guide

## Common Issues and Solutions

### 1. ❌ `better-sqlite3` Installation Fails on Windows

**Error**:
```
gyp ERR! find VS Could not find any Visual Studio installation to use
```

**Solution**:

**Option A**: Install Visual Studio Build Tools
```bash
# Automated
npm install --global windows-build-tools

# Or manual download:
# https://visualstudio.microsoft.com/downloads/
# Select "Desktop development with C++" workload
```

**Option B**: Use Docker (Recommended for Windows)
```bash
docker build -t queuectl .
docker run -it queuectl /bin/bash
```

**Option C**: Use WSL2 (Windows Subsystem for Linux)
```bash
# In WSL2 Ubuntu terminal
npm install
npm link
```

---

### 2. ❌ `command not found: queuectl`

**Cause**: CLI not linked to PATH

**Solution**:
```bash
# Link globally
npm link

# Or run directly
node bin/queuectl.js --help

# Or use npx
npx queuectl --help
```

**Verify**:
```bash
which queuectl
queuectl --version
```

---

### 3. ❌ Workers Don't Stop with `worker stop`

**Cause**: PID file not found or workers already exited

**Check**:
```bash
# View PID file
cat ~/.queuectl/pids.json

# Check if workers are running
ps aux | grep queuectl

# Manual cleanup if needed
rm ~/.queuectl/pids.json
```

**Force stop** (if graceful stop fails):
```bash
# Find worker processes
ps aux | grep "node.*worker.js"

# Kill manually
kill -9 <PID>

# Clean PID file
rm ~/.queuectl/pids.json
```

---

### 4. ❌ Jobs Stuck in `processing` State

**Cause**: Worker crashed during job execution

**Why it happens**: If a worker process crashes (not graceful shutdown), the job remains in `processing` state.

**Manual Recovery**:
```bash
# Option 1: Reset to pending (will retry)
# Access database directly
sqlite3 ~/.queuectl/queue.db
> UPDATE jobs SET state='pending', worker_id=NULL WHERE state='processing';
> .quit

# Option 2: Move to DLQ
sqlite3 ~/.queuectl/queue.db
> INSERT INTO dlq(id, original_job, failed_at, reason) 
  SELECT id, json_object('id', id, 'command', command), datetime('now'), 'worker_crash' 
  FROM jobs WHERE state='processing';
> DELETE FROM jobs WHERE state='processing';
> .quit
```

**Future Improvement**: Add `queuectl recover` command to automate this.

---

### 5. ❌ Database Locked Errors

**Error**:
```
SQLITE_BUSY: database is locked
```

**Cause**: Multiple processes accessing database simultaneously

**Solution**:

Already implemented in code:
```javascript
db.pragma('journal_mode = WAL');  // Write-Ahead Logging
db.pragma('busy_timeout = 5000'); // Wait up to 5 seconds
```

**If still happening**:
```bash
# Check for orphaned locks
lsof ~/.queuectl/queue.db

# Kill processes holding locks
# Then restart workers
```

---

### 6. ❌ Jobs Not Running at Scheduled Time

**Cause**: Worker poll interval too long or worker not running

**Check**:
```bash
# View config
queuectl config get poll_interval_ms

# Reduce poll interval for faster checks
queuectl config set poll_interval_ms 100

# Check worker status
queuectl status
```

**Also verify**:
```bash
# List pending jobs with schedule time
sqlite3 ~/.queuectl/queue.db
> SELECT id, command, scheduled_at, datetime('now') as now FROM jobs WHERE state='pending';
> .quit
```

---

### 7. ❌ Logs Not Appearing

**Check**:
```bash
# Verify log directory exists
ls -la ~/.queuectl/logs/

# Check job has output_log path
queuectl list --state completed | grep output_log

# View specific log
cat ~/.queuectl/logs/job-<id>.log
```

**If missing**:
```bash
# Ensure log directory is created
mkdir -p ~/.queuectl/logs
```

---

### 8. ❌ DLQ Retry Not Working

**Cause**: Original job data corrupted or job ID not found

**Debug**:
```bash
# View DLQ entry
queuectl dlq list

# Check original_job JSON
sqlite3 ~/.queuectl/queue.db
> SELECT id, original_job FROM dlq;
> .quit

# Verify JSON is valid
queuectl dlq list | jq '.[]'
```

**Manual retry**:
```bash
# Get job ID from DLQ list
queuectl dlq retry <job-id>
```

---

### 9. ❌ "Unexpected token" Error in CLI

**Error**:
```
SyntaxError: Unexpected token '...'
```

**Cause**: Node.js version too old

**Solution**:
```bash
# Check Node version
node --version
# Should be >= 18.0.0

# Update Node
# Using nvm:
nvm install 18
nvm use 18

# Or download from: https://nodejs.org/
```

---

### 10. ❌ Worker Starts But Doesn't Process Jobs

**Debug Steps**:

1. **Check worker is registered**:
```bash
queuectl status
# Look for workers array
```

2. **Check jobs are pending**:
```bash
queuectl list --state pending
```

3. **Check scheduled_at time**:
```bash
sqlite3 ~/.queuectl/queue.db
> SELECT id, command, scheduled_at, datetime('now') FROM jobs WHERE state='pending';
> .quit
# If scheduled_at is in future, job won't run yet
```

4. **Check worker logs**:
```bash
# Workers log to stdout/stderr
# If started with worker start, check terminal output
```

5. **Restart workers**:
```bash
queuectl worker stop
queuectl worker start --count 2
```

---

### 11. ❌ Exponential Backoff Not Working

**Debug**:
```bash
# Check config
queuectl config get backoff_base
# Should be 2 (or your custom value)

# View job details
queuectl list --state pending | jq '.[] | {id, attempts, scheduled_at}'

# Check scheduled_at is in future after retry
sqlite3 ~/.queuectl/queue.db
> SELECT id, attempts, scheduled_at, datetime('now') as now FROM jobs WHERE state='pending' AND attempts > 0;
> .quit
```

**Expected Delays**:
- Attempt 1: immediate
- Attempt 2: 2^1 = 2 seconds
- Attempt 3: 2^2 = 4 seconds  
- Attempt 4: 2^3 = 8 seconds

---

### 12. ❌ Tests Failing

**Smoke Test Fails**:
```bash
# Run with debug
node scripts/smoke-test.js

# Check if dependencies installed
npm install

# Check if database accessible
ls -la ~/.queuectl/
```

**Demo Fails**:
```bash
# Clean state
rm -rf ~/.queuectl

# Run again
npm run demo

# Check for worker errors
queuectl status
```

---

## Database Inspection

Useful SQLite commands for debugging:

```bash
# Open database
sqlite3 ~/.queuectl/queue.db

# View schema
.schema

# Count jobs by state
SELECT state, COUNT(*) FROM jobs GROUP BY state;

# View recent jobs
SELECT id, command, state, attempts, last_error FROM jobs ORDER BY created_at DESC LIMIT 10;

# View DLQ
SELECT * FROM dlq;

# View config
SELECT * FROM config;

# View workers
SELECT * FROM workers;

# Exit
.quit
```

---

## Reset Everything

```bash
# Complete clean slate
rm -rf ~/.queuectl
rm -rf node_modules
npm install
npm link

# Verify
queuectl --version
queuectl config get max_retries
```

---

## Getting Help

If you encounter issues not covered here:

1. **Check logs**: `~/.queuectl/logs/job-*.log`
2. **Check database**: `sqlite3 ~/.queuectl/queue.db`
3. **Check process**: `ps aux | grep queuectl`
4. **Check Node version**: `node --version` (must be >= 18)
5. **Try Docker**: Cross-platform consistent environment

---

## Known Limitations

1. **Stale Processing Jobs**: Workers that crash leave jobs in `processing` state
   - Workaround: Manual database cleanup (see issue #4 above)
   - Future: Add automatic recovery mechanism

2. **Windows Native Modules**: `better-sqlite3` requires compilation
   - Workaround: Use Docker or WSL2
   - Alternative: Use `sql.js` (pure JavaScript)

3. **No Distributed Queue**: Single-machine only
   - Future: Redis-based distributed queue

4. **No Job Dependencies**: Can't chain jobs
   - Future: DAG-based workflow support

---

## Performance Optimization

If experiencing slowdowns:

```bash
# Reduce poll interval (more responsive, higher CPU)
queuectl config set poll_interval_ms 100

# Increase poll interval (less responsive, lower CPU)
queuectl config set poll_interval_ms 1000

# Add more workers
queuectl worker start --count 10

# Vacuum database (after many jobs)
sqlite3 ~/.queuectl/queue.db "VACUUM;"
```

---

## Debug Mode

For verbose logging during development:

```javascript
// In src/index.js, add at top:
const DEBUG = process.env.DEBUG === '1';
function log(...args) {
  if (DEBUG) console.log('[DEBUG]', ...args);
}

// Use throughout code:
log('Claiming job', job.id);
```

Then run:
```bash
DEBUG=1 queuectl worker start --count 1
```

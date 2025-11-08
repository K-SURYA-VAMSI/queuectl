# Testing Guide

## Quick Tests

### 1. Smoke Test
Tests basic enqueue and status functionality.

```bash
npm test
```

**Expected Output**: `OK`

---

### 2. Demo Script
Runs a complete demo with multiple workers and job types.

```bash
npm run demo
```

**What it does**:
- Enqueues 3 jobs (success, failure, delayed)
- Starts 2 workers
- Waits 3 seconds
- Shows status
- Stops workers

---

## Manual Test Scenarios

### Test 1: Basic Job Completion ✅

```bash
# Clean start
rm -rf ~/.queuectl

# Start worker
queuectl worker start --count 1

# Enqueue simple job
queuectl enqueue '{"command":"echo Hello World"}'

# Wait a moment
sleep 2

# Check status - should show 1 completed
queuectl status

# View logs
cat ~/.queuectl/logs/job-*.log

# Stop
queuectl worker stop
```

**Expected**:
- Status shows: `"completed": 1`
- Log file contains "Hello World"

---

### Test 2: Failed Job with Retry and DLQ ✅

```bash
# Clean start
rm -rf ~/.queuectl

# Set low max retries for faster testing
queuectl config set max_retries 2

# Start worker
queuectl worker start --count 1

# Enqueue failing job
queuectl enqueue '{"command":"bash -c \"exit 1\""}'

# Monitor status (job will retry with backoff)
watch -n 1 'queuectl status'
# Wait for: attempt 1 (immediate), attempt 2 (+2s), attempt 3 (+4s), then DLQ

# After ~7-8 seconds, check DLQ
queuectl dlq list

# Stop worker
queuectl worker stop
```

**Expected**:
- Job retries 2 times with exponential backoff
- After final failure, job appears in DLQ
- DLQ list shows the failed job with reason

---

### Test 3: Multiple Workers (No Overlap) ✅

```bash
# Clean start
rm -rf ~/.queuectl

# Enqueue 5 jobs
for i in {1..5}; do
  queuectl enqueue "{\"command\":\"sleep 2 && echo Job $i\"}"
done

# Start 3 workers
queuectl worker start --count 3

# Monitor - should see 3 processing at once
queuectl status

# Wait for completion
sleep 5

# Check status - should show 5 completed, 0 duplicates
queuectl status
queuectl list --state completed

# Verify no duplicate processing in logs
ls -la ~/.queuectl/logs/

# Stop
queuectl worker stop
```

**Expected**:
- 3 jobs process simultaneously
- No job is processed twice (check worker_id in logs)
- All 5 jobs complete successfully

---

### Test 4: Invalid Command Fails Gracefully ✅

```bash
# Clean start
rm -rf ~/.queuectl

queuectl config set max_retries 1

queuectl worker start --count 1

# Enqueue invalid command
queuectl enqueue '{"command":"thisisnotacommand"}'

# Wait for retries
sleep 5

# Check DLQ
queuectl dlq list

# Check log shows error
cat ~/.queuectl/logs/job-*.log

queuectl worker stop
```

**Expected**:
- Job retries once
- Moves to DLQ with error message
- Log file contains command not found error

---

### Test 5: Persistence Across Restarts ✅

```bash
# Clean start
rm -rf ~/.queuectl

# Enqueue jobs
queuectl enqueue '{"command":"echo Job 1"}'
queuectl enqueue '{"command":"echo Job 2"}'
queuectl enqueue '{"command":"echo Job 3"}'

# Verify pending
queuectl list --state pending
# Should show 3 jobs

# Restart (simulate process restart)
# DON'T start workers yet

# Check again - jobs should still be there
queuectl list --state pending
# Should still show 3 jobs

# Now process them
queuectl worker start --count 1
sleep 3
queuectl status
# Should show 3 completed

queuectl worker stop
```

**Expected**:
- Jobs persist in SQLite database
- Available after restart without data loss

---

### Test 6: Graceful Shutdown ✅

```bash
# Clean start
rm -rf ~/.queuectl

# Enqueue long-running job
queuectl enqueue '{"command":"sleep 10 && echo Completed"}'

# Start worker
queuectl worker start --count 1

# Wait for job to start
sleep 1

# Check it's processing
queuectl status
# Should show "processing": 1

# Stop worker (graceful)
queuectl worker stop

# Wait for job to finish (up to 10 seconds)
sleep 11

# Check status - job should be completed, not abandoned
queuectl list --state completed
queuectl list --state processing
```

**Expected**:
- Worker finishes current job before exiting
- Job marked as completed, not stuck in processing

---

### Test 7: Priority Queue (Bonus) ⭐

```bash
# Clean start
rm -rf ~/.queuectl

# Enqueue jobs with different priorities
queuectl enqueue '{"command":"echo Low", "priority": 1}'
queuectl enqueue '{"command":"echo High", "priority": 10}'
queuectl enqueue '{"command":"echo Medium", "priority": 5}'

# Start single worker
queuectl worker start --count 1

# Wait
sleep 2

# Check logs - should process in order: High, Medium, Low
ls -t ~/.queuectl/logs/
cat ~/.queuectl/logs/job-*.log

queuectl worker stop
```

**Expected**:
- Jobs processed in priority order (highest first)

---

### Test 8: Scheduled/Delayed Jobs (Bonus) ⭐

```bash
# Clean start
rm -rf ~/.queuectl

# Get current time + 10 seconds
FUTURE=$(date -u -d '+10 seconds' +"%Y-%m-%dT%H:%M:%SZ")

# Enqueue delayed job
queuectl enqueue "{\"command\":\"echo Delayed\", \"run_at\":\"$FUTURE\"}"

# Enqueue immediate job
queuectl enqueue '{"command":"echo Immediate"}'

# Start worker
queuectl worker start --count 1

# Should process immediate first
sleep 2
queuectl list --state completed
# Should show 1 completed

# Wait for delayed job
sleep 10
queuectl list --state completed
# Should show 2 completed

queuectl worker stop
```

**Expected**:
- Immediate job runs first
- Delayed job waits until scheduled time

---

### Test 9: Job Timeout (Bonus) ⭐

```bash
# Clean start
rm -rf ~/.queuectl

# Set 2 second timeout
queuectl config set job_timeout_ms 2000

# Enqueue long job
queuectl enqueue '{"command":"sleep 10"}'

queuectl worker start --count 1

# Wait for timeout + retries
sleep 10

# Check DLQ - should be there after timeout retries
queuectl dlq list

# Check log shows timeout
cat ~/.queuectl/logs/job-*.log

queuectl worker stop
```

**Expected**:
- Job killed after 2 seconds
- Retried and eventually moved to DLQ
- Log shows timeout error

---

### Test 10: Configuration Management ✅

```bash
# Get default config
queuectl config get max_retries
# Should show: 3

# Update config
queuectl config set max_retries 5
queuectl config set backoff_base 3

# Verify changes
queuectl config get max_retries
# Should show: 5

queuectl config get backoff_base
# Should show: 3

# Reset to defaults
queuectl config set max_retries 3
queuectl config set backoff_base 2
```

**Expected**:
- Config persists in database
- Changes take effect immediately for new jobs

---

## Test Summary Checklist

- [ ] ✅ Test 1: Basic job completion
- [ ] ✅ Test 2: Failed job retry and DLQ
- [ ] ✅ Test 3: Multiple workers without overlap
- [ ] ✅ Test 4: Invalid command handling
- [ ] ✅ Test 5: Data persistence
- [ ] ✅ Test 6: Graceful shutdown
- [ ] ✅ Test 7: Priority queue (bonus)
- [ ] ✅ Test 8: Scheduled jobs (bonus)
- [ ] ✅ Test 9: Job timeout (bonus)
- [ ] ✅ Test 10: Configuration management

---

## Automated Test Suite (Future)

For production, consider adding:
```bash
npm install --save-dev jest
```

Create `tests/` directory with:
- `unit/` - Function-level tests
- `integration/` - Full workflow tests
- `e2e/` - CLI command tests

Example test structure:
```javascript
// tests/unit/backoff.test.js
test('exponential backoff calculation', () => {
  // Test computeDelaySeconds()
});

// tests/integration/worker.test.js
test('worker claims and processes job', async () => {
  // Full workflow test
});
```

---

## Performance Testing

```bash
# Enqueue many jobs
for i in {1..100}; do
  queuectl enqueue "{\"command\":\"echo Job $i\"}"
done

# Start many workers
queuectl worker start --count 10

# Monitor performance
time queuectl status
```

**Metrics to track**:
- Job throughput (jobs/second)
- Database lock contention
- Memory usage
- Log file sizes

---

## Clean Up

```bash
# Remove all data
rm -rf ~/.queuectl

# Reset to fresh state
npm test
```

#!/bin/bash
# Demo script for video recording
# Shows all major features of queuectl

set -e

echo "========================================="
echo "  QueueCTL - Job Queue System Demo"
echo "========================================="
echo ""

# Clean start
echo "🧹 Cleaning previous data..."
rm -rf ~/.queuectl
sleep 1

echo ""
echo "✅ Step 1: Enqueue jobs"
echo "---"
echo "$ queuectl enqueue '{\"command\":\"echo Hello World\"}'"
queuectl enqueue '{"command":"echo Hello World"}'
sleep 1

echo ""
echo "$ queuectl enqueue '{\"command\":\"sleep 2 && echo Done\"}'"
queuectl enqueue '{"command":"sleep 2 && echo Done"}'
sleep 1

echo ""
echo "$ queuectl enqueue '{\"command\":\"bash -c \\\"exit 1\\\"\",\"max_retries\":2}' # Will fail and retry"
queuectl enqueue '{"command":"bash -c \"exit 1\"","max_retries":2}'
sleep 1

echo ""
echo "✅ Step 2: View pending jobs"
echo "---"
echo "$ queuectl list --state pending"
queuectl list --state pending
sleep 2

echo ""
echo "✅ Step 3: Start workers"
echo "---"
echo "$ queuectl worker start --count 2"
queuectl worker start --count 2
sleep 1

echo ""
echo "⏳ Waiting for jobs to process (5 seconds)..."
sleep 5

echo ""
echo "✅ Step 4: Check status"
echo "---"
echo "$ queuectl status"
queuectl status
sleep 2

echo ""
echo "✅ Step 5: View completed jobs"
echo "---"
echo "$ queuectl list --state completed"
queuectl list --state completed
sleep 2

echo ""
echo "⏳ Waiting for failed job to retry and move to DLQ (8 seconds)..."
sleep 8

echo ""
echo "✅ Step 6: Check Dead Letter Queue"
echo "---"
echo "$ queuectl dlq list"
queuectl dlq list
sleep 2

echo ""
echo "✅ Step 7: View job logs"
echo "---"
echo "$ ls ~/.queuectl/logs/"
ls -lh ~/.queuectl/logs/
sleep 2

echo ""
echo "$ cat ~/.queuectl/logs/job-*.log | head -20"
cat ~/.queuectl/logs/job-*.log | head -20
sleep 2

echo ""
echo "✅ Step 8: Configuration management"
echo "---"
echo "$ queuectl config get max_retries"
queuectl config get max_retries
sleep 1

echo ""
echo "$ queuectl config set max_retries 5"
queuectl config set max_retries 5
sleep 1

echo ""
echo "$ queuectl config get max_retries"
queuectl config get max_retries
sleep 2

echo ""
echo "✅ Step 9: Retry job from DLQ"
echo "---"
DLQ_JOB=$(queuectl dlq list | grep '"id"' | head -1 | cut -d'"' -f4)
echo "$ queuectl dlq retry $DLQ_JOB"
queuectl dlq retry $DLQ_JOB
sleep 2

echo ""
echo "✅ Step 10: Graceful shutdown"
echo "---"
echo "$ queuectl worker stop"
queuectl worker stop
sleep 2

echo ""
echo "$ queuectl status"
queuectl status
sleep 2

echo ""
echo "========================================="
echo "  ✅ Demo Complete!"
echo "========================================="
echo ""
echo "Key Features Demonstrated:"
echo "  ✓ Job enqueuing"
echo "  ✓ Multiple workers"
echo "  ✓ Job execution with retry and backoff"
echo "  ✓ Dead Letter Queue (DLQ)"
echo "  ✓ Job output logging"
echo "  ✓ Configuration management"
echo "  ✓ Graceful shutdown"
echo "  ✓ Persistence across restarts"
echo ""
echo "Check ~/.queuectl/ for:"
echo "  - queue.db (SQLite database)"
echo "  - logs/ (job output logs)"
echo "  - pids.json (worker PIDs)"
echo ""

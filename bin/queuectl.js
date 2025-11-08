#!/usr/bin/env node

import { Command } from 'commander';
import { ensureDirs, getConfig, setConfig, db, initDb, enqueueJob, listJobs, getStatus, startWorkers, stopWorkers, dlqList, dlqRetry, closeDb } from '../src/index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();
program
  .name('queuectl')
  .description('CLI-based background job queue with workers, retries, backoff, and DLQ')
  .version(pkg.version);

program
  .command('enqueue')
  .argument('<jobJson>', 'Job as JSON string, minimally { "command": "echo \'hi\'" }')
  .option('--run-at <iso>', 'ISO time to schedule the run (optional)')
  .option('--max-retries <n>', 'Override max retries', (v) => parseInt(v, 10))
  .action(async (jobJson, opts) => {
    await initDb();
    const job = JSON.parse(jobJson);
    if (opts.runAt) job.run_at = opts.runAt;
    if (opts.maxRetries != null) job.max_retries = opts.maxRetries;
    const id = enqueueJob(job);
    console.log(id);
  });

const worker = program.command('worker').description('Manage workers');

worker
  .command('start')
  .option('--count <n>', 'Number of workers', (v) => parseInt(v, 10), 1)
  .option('--poll-interval <ms>', 'Polling interval in ms', (v) => parseInt(v, 10), 500)
  .action(async (opts) => {
    await initDb();
    await startWorkers(opts.count, opts.pollInterval);
    closeDb();
    process.exit(0);
  });

worker
  .command('stop')
  .action(async () => {
    await stopWorkers();
  });

program
  .command('status')
  .description('Show summary of all job states and active workers')
  .action(async () => {
    await initDb();
    const s = getStatus();
    console.log(JSON.stringify(s, null, 2));
  });

program
  .command('list')
  .option('--state <state>', 'Filter by job state (pending|processing|completed|failed|dead)')
  .option('--limit <n>', 'Limit', (v) => parseInt(v, 10), 50)
  .option('--offset <n>', 'Offset', (v) => parseInt(v, 10), 0)
  .action(async (opts) => {
    await initDb();
    const rows = listJobs(opts.state, opts.limit, opts.offset);
    console.log(JSON.stringify(rows, null, 2));
  });

const dlq = program.command('dlq').description('Dead letter queue');

dlq
  .command('list')
  .action(async () => {
    await initDb();
    console.log(JSON.stringify(dlqList(), null, 2));
  });

dlq
  .command('retry')
  .argument('<id>', 'Job ID to retry from DLQ')
  .action(async (id) => {
    await initDb();
    const res = dlqRetry(id);
    console.log(res ? 'enqueued' : 'not-found');
  });

const cfg = program.command('config').description('Configuration');

cfg
  .command('get')
  .argument('<key>', 'Config key')
  .action(async (key) => {
    await initDb();
    console.log(getConfig(key));
  });

cfg
  .command('set')
  .argument('<key>', 'Config key')
  .argument('<value>', 'Config value')
  .action(async (key, value) => {
    await initDb();
    setConfig(key, value);
    console.log('ok');
  });

await program.parseAsync(process.argv);


import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(__dirname, '..', 'bin', 'queuectl.js');

function run(args) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [bin, ...args], { stdio: 'inherit' });
    p.on('close', () => resolve());
  });
}

(async () => {
  console.log('== Demo: enqueue 3 jobs, start 2 workers, show status, stop ==');
  await run(['enqueue', '{"command":"echo \'hello A\'"}']);
  await run(['enqueue', '{"command":"bash -lc \'exit 1\'"}']);
  await run(['enqueue', '{"command":"sleep 1 && echo \'hello B\'"}']);
  await run(['worker','start','--count','2']);
  await sleep(3000);
  await run(['status']);
  await run(['worker','stop']);
  await run(['status']);
  console.log('Check ~/.queuectl/logs for job logs.');
})();

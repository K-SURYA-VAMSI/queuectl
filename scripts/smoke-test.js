
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(__dirname, '..', 'bin', 'queuectl.js');

function run(args) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [bin, ...args], (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve({ stdout: stdout.trim(), stderr });
    });
  });
}

(async () => {
  const id = JSON.parse(await run(['enqueue', '{"command":"echo test"}']).then(r => JSON.stringify(r.stdout)));
  const st = await run(['status']);
  if (!st.stdout) throw new Error('status empty');
  console.log('OK');
})().catch((e)=>{ console.error(e); process.exit(1); });

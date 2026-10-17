import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, unlink, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

const root = dirname(fileURLToPath(import.meta.url));
const repo = join(root, '..');
const runtime = join(root, '.runtime');
const binary = join(root, '.tools', 'cloudflared.exe');
const config = JSON.parse(await readFile(join(root, 'tunnel-settings.local.json'), 'utf8'));
if (!config.accessCode || typeof config.accessCode !== 'string' || config.accessCode.length < 16) {
  throw new Error('Set a private accessCode of at least 16 characters in tunnel-settings.local.json (never commit it).');
}
const port = 3040;
let stopping = false;
let tunnel;
let backend;
let site;
await mkdir(runtime, { recursive: true });
try { await access(binary); }
catch {
  console.log('Downloading the official Cloudflare tunnel tool...');
  const response = await fetch('https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe');
  if (!response.ok) throw new Error(`Cloudflare download failed: HTTP ${response.status}`);
  await mkdir(dirname(binary), { recursive: true });
  await writeFile(binary, Buffer.from(await response.arrayBuffer()));
}
let lock;
try { lock = await writeFile(join(runtime, 'tunnel.lock'), String(process.pid), { flag: 'wx' }).then(() => true); }
catch {
  const previous = Number(await readFile(join(runtime, 'tunnel.lock'), 'utf8'));
  try { process.kill(previous, 0); throw new Error('The public proxy launcher is already running.'); }
  catch (error) { if (error.code !== 'ESRCH') throw error; }
  await writeFile(join(runtime, 'tunnel.lock'), String(process.pid));
  lock = true;
}

function stopChildren() { for (const child of [backend, tunnel, site]) child?.kill(); }
function stop() { stopping = true; stopChildren(); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('exit', stopChildren);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: repo, windowsHide: true, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => output += chunk);
    child.stderr.on('data', chunk => output += chunk);
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve(output.trim()) : reject(new Error(output.trim() || `${command} exited with ${code}`)));
  });
}

async function waitForBackend(child) {
  for (let count = 0; count < 40; count++) {
    if (child.exitCode !== null) throw new Error('The proxy service could not start. Check whether port 3040 is already being used.');
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch { /* Still starting. */ }
    await pause(250);
  }
  throw new Error('The proxy service did not become ready.');
}

async function publish(origin) {
  const relative = 'js/browser-config.js';
  const value = `// Updated automatically by the PC-hosted proxy launcher.\nwindow.FLUX_BROWSER_ORIGIN = ${JSON.stringify(origin)};\n`;
  await writeFile(join(repo, relative), value);
  if (!config.autoPublish) {
    console.log('Local Flux has been updated. GitHub auto-publishing is disabled.');
    return false;
  }
  try {
    const branch = await run('git', ['branch', '--show-current']);
    if (branch !== 'main') throw new Error('Automatic publishing is only enabled on main.');
    await run('git', ['add', '--', relative]);
    const changes = await run('git', ['diff', '--cached', '--name-only', '--', relative]);
    if (changes) await run('git', ['commit', '--only', '-m', 'Update Flux proxy tunnel address', '--', relative]);
    if (config.useDeployKey) {
      const key = join(root, '.tools', 'flux-tunnel-key').replaceAll('\\', '/');
      const hosts = join(root, '.tools', 'known_hosts').replaceAll('\\', '/');
      await run('git', ['-c', `core.sshCommand=ssh -i "${key}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="${hosts}"`, 'push', 'git@github.com:0Coral0/Flux.git', 'HEAD:main']);
    } else await run('git', ['push', 'origin', 'HEAD:main']);
    console.log('New address pushed to GitHub. Vercel will use it after its deployment finishes.');
    return true;
  } catch (error) {
    console.error('The proxy is running, but the live Flux address could not be updated.');
    console.error(error.message);
    console.error('Sign in to GitHub, then push the current main branch. No force-push is performed.');
    return false;
  }
}

try {
  site = spawn(process.execPath, ['serve-flux.mjs'], { cwd: root, windowsHide: true, stdio: 'inherit' });
  site.on('error', error => console.error('Local Flux preview:', error.message));
  while (!stopping) {
    console.log('Starting a Cloudflare tunnel with proxy-side access protection...');
    const args = ['tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', `http://127.0.0.1:${port}`];
    tunnel = spawn(binary, args, { cwd: runtime, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let cloudOutput = '';
    const address = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Cloudflare did not provide a tunnel address within 90 seconds.')), 90000);
      const inspect = chunk => {
        cloudOutput = (cloudOutput + String(chunk)).slice(-24000);
        const match = cloudOutput.match(/https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com\b/);
        if (match) { clearTimeout(timer); resolve(match[0]); }
      };
      tunnel.stdout.on('data', inspect);
      tunnel.stderr.on('data', inspect);
      tunnel.once('error', error => { clearTimeout(timer); reject(error); });
      tunnel.once('exit', () => { clearTimeout(timer); reject(new Error('Cloudflare stopped before creating an address. ' + cloudOutput.slice(-1500))); });
    });
    try {
      const origin = await address;
      if (stopping) break;
      backend = spawn(process.execPath, ['server.mjs'], {
        cwd: root, windowsHide: true, stdio: 'inherit',
        env: { ...process.env, PORT: String(port), PUBLIC_ORIGIN: origin, FLUX_ACCESS_CODE: config.accessCode },
      });
      await waitForBackend(backend);
      await writeFile(join(runtime, 'current-address.txt'), origin + '\n');
      console.log(`Proxy address: ${origin}`);
      console.log('Open that address and sign in using your private access code.');
      console.log('Local Flux: http://127.0.0.1:3031/ — choose Browser.');
      await publish(origin);
      console.log('Keep this launcher open. Press Ctrl+C to stop sharing.');
      const watch = setInterval(() => {
        if (stopping || backend.exitCode !== null) tunnel.kill();
      }, 1000);
      if (tunnel.exitCode === null) await once(tunnel, 'exit');
      clearInterval(watch);
    } catch (error) { console.error(error.message); }
    finally { backend?.kill(); tunnel?.kill(); }
    if (!stopping) { console.log('Reconnecting in 10 seconds...'); await pause(10000); }
  }
} finally {
  stopChildren();
  if (lock) await unlink(join(runtime, 'tunnel.lock')).catch(() => {});
}

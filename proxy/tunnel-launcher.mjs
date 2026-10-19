import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { mkdir, readFile, writeFile, unlink, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { browserConfig, publishAddress } from './address-publisher.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const repo = join(root, '..');
const runtime = join(root, '.runtime');
const binary = '/usr/local/bin/cloudflared';
const config = JSON.parse(await readFile(join(root, 'tunnel-settings.local.json'), 'utf8'));
const autoPublish = config.autoPublish === true || process.env.FLUX_AUTO_PUBLISH === '1';
const publicAccess = config.publicAccess === true || process.env.FLUX_PUBLIC_ACCESS === '1';
if (!publicAccess && (typeof config.accessCode !== 'string' || config.accessCode.trim().length < 16 || config.accessCode === 'REPLACE_WITH_A_LONG_RANDOM_PRIVATE_CODE')) {
  throw new Error('Set a private accessCode of at least 16 characters in tunnel-settings.local.json (never commit it).');
}
const port = 3040;
let stopping = false;
let tunnel;
let backend;
let site;
let publishQueue = Promise.resolve();
await mkdir(runtime, { recursive: true });
try {
  await access(binary, constants.X_OK);
} catch {
  throw new Error('cloudflared is missing or not executable. Install the Linux ARM64 version at /usr/local/bin/cloudflared.');
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
  try {
    let remote = await run('git', ['remote', 'get-url', 'origin']);
    let gitOptions = [];
    if (config.useDeployKey) {
      const key = join(root, '.tools', 'flux-tunnel-key').replaceAll('\\', '/');
      const hosts = join(root, '.tools', 'known_hosts').replaceAll('\\', '/');
      const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
      remote = 'git@github.com:0Coral0/Flux.git';
      gitOptions = ['-c', `core.sshCommand=ssh -i ${quote(key)} -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o ${quote(`UserKnownHostsFile=${hosts}`)}`];
    }
    const changed = await publishAddress({ repo, remote, origin, gitOptions });
    console.log(changed ? 'New address pushed to GitHub. Vercel will use it after its deployment finishes.' : 'GitHub already has the current proxy address.');
    return true;
  } catch (error) {
    console.error('The proxy is running, but the live Flux address could not be updated.');
    console.error(error.message);
    console.error('Check GitHub access; the launcher will retry automatically.');
    return false;
  }
}

try {
  site = spawn(process.execPath, ['serve-flux.mjs'], { cwd: root, windowsHide: true, stdio: 'inherit' });
  const previewFailed = () => {
    if (stopping) return;
    console.error('Local Flux preview stopped; stopping the launcher for restart.');
    process.exitCode = 1;
    stop();
  };
  site.on('error', previewFailed);
  site.on('exit', previewFailed);
  while (!stopping) {
    console.log(publicAccess ? 'Starting a public Cloudflare tunnel with connection limits...' : 'Starting a Cloudflare tunnel with proxy-side access protection...');
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
        env: { ...process.env, PORT: String(port), PUBLIC_ORIGIN: origin, FLUX_PUBLIC_ACCESS: publicAccess ? '1' : '0', FLUX_ACCESS_CODE: publicAccess ? '' : config.accessCode },
      });
      await waitForBackend(backend);
      await writeFile(join(runtime, 'current-address.txt'), origin + '\n');
      console.log(`Proxy address: ${origin}`);
      console.log(publicAccess ? 'The browser is available without a sign-in.' : 'Open that address and sign in using your private access code.');
      console.log('Local Flux: http://127.0.0.1:3031/ — choose Browser.');
      await writeFile(join(repo, 'js/browser-config.js'), browserConfig(origin));
      const currentTunnel = tunnel;
      let published = !autoPublish;
      let publishing = false;
      if (!autoPublish) console.log('Local Flux has been updated. GitHub auto-publishing is disabled.');
      const sync = async () => {
        if (published || publishing || stopping || tunnel.exitCode !== null) return;
        publishing = true;
        try {
          const attempt = publishQueue.then(() => {
            if (stopping || currentTunnel.exitCode !== null || tunnel !== currentTunnel) return false;
            return publish(origin);
          });
          publishQueue = attempt.catch(() => {});
          published = await attempt;
        }
        finally { publishing = false; }
      };
      await sync();
      console.log('Keep this launcher open. Press Ctrl+C to stop sharing.');
      const watch = setInterval(() => {
        if (stopping || backend.exitCode !== null) tunnel.kill();
      }, 1000);
      const retryPublish = setInterval(sync, 30_000);
      if (tunnel.exitCode === null) await once(tunnel, 'exit');
      clearInterval(watch);
      clearInterval(retryPublish);
    } catch (error) { console.error(error.message); }
    finally { backend?.kill(); tunnel?.kill(); }
    if (!stopping) { console.log('Reconnecting in 10 seconds...'); await pause(10000); }
  }
} finally {
  stopChildren();
  if (lock) await unlink(join(runtime, 'tunnel.lock')).catch(() => {});
}

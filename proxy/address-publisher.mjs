import { spawn } from 'node:child_process';
import { mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const configPath = 'js/browser-config.js';
export const isFluxRemote = remote => /^(?:https:\/\/github\.com\/0Coral0\/Flux(?:\.git)?|git@github\.com:0Coral0\/Flux(?:\.git)?|ssh:\/\/git@github\.com\/0Coral0\/Flux(?:\.git)?)$/.test(remote);

export function browserConfig(origin) {
  const parsed = new URL(origin);
  if (parsed.protocol !== 'https:' || parsed.port || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com$/.test(parsed.hostname) || parsed.origin !== origin) {
    throw new Error('Refusing to publish an invalid Quick Tunnel address.');
  }
  return `// Updated automatically by the Flux proxy launcher.\nwindow.FLUX_BROWSER_ORIGIN = ${JSON.stringify(origin)};\n`;
}

function git(repo, args, { env = {}, input, gitOptions = [] } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', [...gitOptions, ...args], {
      cwd: repo, windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never', ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill(), 30000);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr.trim() || `git exited with ${code}`)); });
    child.stdin.end(input);
  });
}

// Build a single-file commit from the current remote main using a private index.
// The checkout, its staged files, and its local commits never enter the push.
export async function publishAddress({ repo, remote, origin, gitOptions = [], verifyRemote = isFluxRemote, attempts = 3 }) {
  if (!verifyRemote(remote)) throw new Error('Refusing to publish to an unexpected Git repository.');
  const value = browserConfig(origin);
  const temp = await mkdtemp(join(tmpdir(), 'flux-publisher-'));
  const index = join(temp, 'index');
  const gitEnv = { GIT_INDEX_FILE: index };
  const identity = {
    GIT_AUTHOR_NAME: 'Flux tunnel updater', GIT_AUTHOR_EMAIL: 'flux-tunnel@users.noreply.github.com',
    GIT_COMMITTER_NAME: 'Flux tunnel updater', GIT_COMMITTER_EMAIL: 'flux-tunnel@users.noreply.github.com',
  };
  try {
    let lastError;
    for (let count = 0; count < attempts; count++) {
      try {
        const refs = await git(repo, ['ls-remote', '--exit-code', remote, 'refs/heads/main'], { gitOptions });
        const match = refs.match(/^([0-9a-f]{40,64})\s+refs\/heads\/main$/);
        if (!match) throw new Error('Could not identify the remote main branch.');
        const parent = match[1];
        await git(repo, ['fetch', '--no-tags', '--no-write-fetch-head', remote, parent], { gitOptions });
        const current = await git(repo, ['show', `${parent}:${configPath}`]);
        if (current === value.trim()) return false;
        await git(repo, ['read-tree', '--reset', parent], { env: gitEnv });
        const blob = await git(repo, ['hash-object', '-w', '--stdin'], { input: value });
        await git(repo, ['update-index', '--add', '--cacheinfo', `100644,${blob},${configPath}`], { env: gitEnv });
        const tree = await git(repo, ['write-tree'], { env: gitEnv });
        const commit = await git(repo, ['commit-tree', tree, '-p', parent, '-m', 'Update Flux proxy tunnel address'], { env: identity });
        await git(repo, ['push', remote, `${commit}:refs/heads/main`], { gitOptions });
        return true;
      } catch (error) { lastError = error; }
    }
    throw lastError;
  } finally {
    await unlink(index).catch(() => {});
    await rmdir(temp).catch(() => {});
  }
}

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

test('automatic publisher updates only the address on current remote main', { timeout: 30000 }, async () => {
  const { publishAddress, browserConfig, isFluxRemote } = await import(pathToFileURL(path.join(__dirname, '../proxy/address-publisher.mjs')));
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'flux-publish-test-'));
  const remote = path.join(temp, 'remote.git');
  const local = path.join(temp, 'local');
  const other = path.join(temp, 'other');
  try {
    git(temp, 'init', '--bare', remote);
    git(temp, 'init', '-b', 'main', local);
    git(local, 'config', 'user.name', 'Test User');
    git(local, 'config', 'user.email', 'test@example.invalid');
    await fs.mkdir(path.join(local, 'js'));
    await fs.writeFile(path.join(local, 'js/browser-config.js'), browserConfig('https://old-address.trycloudflare.com'));
    git(local, 'add', '.');
    git(local, 'commit', '-m', 'initial');
    git(local, 'remote', 'add', 'origin', remote);
    git(local, 'push', 'origin', 'main');
    git(temp, 'clone', '-b', 'main', remote, other);
    git(other, 'config', 'user.name', 'Other User');
    git(other, 'config', 'user.email', 'other@example.invalid');
    await fs.writeFile(path.join(other, 'remote-change.txt'), 'keep remote changes');
    git(other, 'add', '.');
    git(other, 'commit', '-m', 'remote change');
    git(other, 'push', 'origin', 'main');
    const remoteParent = git(other, 'rev-parse', 'HEAD');

    await fs.writeFile(path.join(local, 'local-only.txt'), 'do not publish this commit');
    git(local, 'add', '.');
    git(local, 'commit', '-m', 'local only');
    await fs.writeFile(path.join(local, 'staged.txt'), 'do not publish this staged file');
    git(local, 'add', '.');
    const localHead = git(local, 'rev-parse', 'HEAD');
    const staged = git(local, 'diff', '--cached', '--name-only');
    const origin = 'https://new-address.trycloudflare.com';
    assert.equal(isFluxRemote('https://github.com/0Coral0/Flux.git'), true);
    assert.equal(isFluxRemote('https://github.com/other/Flux.git'), false);
    assert.throws(() => browserConfig('https://example.com'), /invalid Quick Tunnel/);
    await assert.rejects(publishAddress({ repo: local, remote, origin }), /unexpected Git repository/);

    const options = { repo: local, remote, origin, verifyRemote: value => value === remote };
    assert.equal(await publishAddress(options), true);
    const remoteHead = git(temp, '--git-dir', remote, 'rev-parse', 'refs/heads/main');
    assert.equal(git(temp, '--git-dir', remote, 'rev-parse', `${remoteHead}^`), remoteParent);
    assert.equal(git(temp, '--git-dir', remote, 'diff-tree', '--no-commit-id', '--name-only', '-r', remoteHead), 'js/browser-config.js');
    assert.equal(git(temp, '--git-dir', remote, 'show', `${remoteHead}:js/browser-config.js`), browserConfig(origin).trim());
    assert.equal(git(temp, '--git-dir', remote, 'show', `${remoteHead}:remote-change.txt`), 'keep remote changes');
    assert.throws(() => git(temp, '--git-dir', remote, 'cat-file', '-e', `${remoteHead}:local-only.txt`));
    assert.equal(git(local, 'rev-parse', 'HEAD'), localHead);
    assert.equal(git(local, 'diff', '--cached', '--name-only'), staged);
    assert.equal(await publishAddress(options), false);
    assert.equal(git(temp, '--git-dir', remote, 'rev-parse', 'refs/heads/main'), remoteHead);
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});

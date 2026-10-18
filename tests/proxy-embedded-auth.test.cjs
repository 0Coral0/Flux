const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createServer } = require('node:net');
const path = require('node:path');
const WebSocket = require('../proxy/node_modules/ws');

test('embedded and direct sign-in preserve access controls', { timeout: 20000 }, async () => {
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const publicOrigin = 'https://flux-proxy.example';
  const accessCode = 'test-only-private-access-code';
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: path.join(__dirname, '../proxy'),
    env: { ...process.env, PORT: String(port), PUBLIC_ORIGIN: publicOrigin, FLUX_ACCESS_CODE: accessCode },
    stdio: 'ignore',
  });

  try {
    let ready = false;
    for (let i = 0; i < 100 && !ready; i++) {
      if (child.exitCode !== null) throw new Error('Proxy exited before it was ready');
      try { ready = (await fetch(`${base}/healthz`)).ok; } catch {}
      if (!ready) await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, 'proxy started');

    let response = await fetch(`${base}/?embed=1`, { redirect: 'manual' });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/login?embed=1');
    response = await fetch(`${base}/login?embed=1`);
    assert.match(await response.text(), /action="\/login\?embed=1"/);
    const login = (url, code) => fetch(`${base}${url}`, {
      method: 'POST', redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code }),
    });
    response = await login('/login?embed=1', 'incorrect');
    assert.equal(response.status, 401);
    assert.match(await response.text(), /href="\/login\?embed=1"/);
    response = await login('/login?embed=1', accessCode);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), '/?embed=1');
    const embeddedSetCookie = response.headers.get('set-cookie');
    assert.match(embeddedSetCookie, /^flux_embed_session=/);
    for (const flag of [/HttpOnly/i, /Secure/i, /SameSite=None/i, /Partitioned/i]) assert.match(embeddedSetCookie, flag);
    const embeddedCookie = embeddedSetCookie.split(';')[0];

    response = await login('/login', accessCode);
    assert.equal(response.headers.get('location'), '/');
    const directSetCookie = response.headers.get('set-cookie');
    assert.match(directSetCookie, /^flux_session=/);
    assert.match(directSetCookie, /SameSite=Strict/i);
    assert.doesNotMatch(directSetCookie, /Partitioned/i);
    assert.match(directSetCookie, /Secure/i);
    const directCookie = directSetCookie.split(';')[0];

    for (const cookie of [embeddedCookie, directCookie]) {
      response = await fetch(`${base}/sw.js`, { headers: { Cookie: cookie } });
      assert.equal(response.status, 200);
    }
    response = await fetch(`${base}/sw.js`, { redirect: 'manual', headers: { Cookie: 'flux_embed_session=wrong' } });
    assert.equal(response.status, 302);

    async function socketAccepted(cookie, origin) {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/wisp/`, { origin, headers: cookie ? { Cookie: cookie } : {} });
      const result = await new Promise(resolve => {
        socket.once('open', () => resolve(true));
        socket.once('error', () => resolve(false));
      });
      if (result) socket.close();
      return result;
    }
    assert.equal(await socketAccepted('', publicOrigin), false);
    assert.equal(await socketAccepted(embeddedCookie, 'https://wrong.example'), false);
    assert.equal(await socketAccepted(embeddedCookie, publicOrigin), true);
    assert.equal(await socketAccepted(directCookie, publicOrigin), true);
  } finally {
    child.kill();
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import WebSocket from 'ws';
import { PublicTCPSocket, isPublicAddress, resolvePublicAddress, createPublicLimiter } from '../public-safety.mjs';

test('public destination checks reject local, private, mapped and reserved addresses', async () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.1.1', '169.254.169.254', '::1', 'fc00::1', '::ffff:127.0.0.1', '::ffff:10.1.2.3', '192.0.2.1']) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
  await assert.rejects(resolvePublicAddress('test.example', async () => ({ address: '::ffff:127.0.0.1' })), /not a public address/);
  assert.equal(await resolvePublicAddress('test.example', async () => ({ address: '8.8.8.8' })), '8.8.8.8');
  await assert.rejects(new PublicTCPSocket('localhost', 80).connect(), /not a public address/);
});

test('connection limits are global and per visitor, and release when closed', () => {
  const accept = createPublicLimiter({ maxConnections: 2, perClient: 1, perMinute: 2 });
  const socket = () => Object.assign(new EventEmitter(), { bytesRead: 0, bytesWritten: 0, destroy() { this.emit('close'); } });
  const request = ip => ({ headers: { 'cf-connecting-ip': ip }, socket: { remoteAddress: '127.0.0.1' } });
  const first = socket();
  const second = socket();
  assert.equal(accept(request('8.8.8.8'), first), true);
  assert.equal(accept(request('8.8.8.8'), socket()), false);
  assert.equal(accept(request('1.1.1.1'), second), true);
  assert.equal(accept(request('9.9.9.9'), socket()), false);
  first.emit('close'); second.emit('close');
  assert.equal(accept(request('8.8.8.8'), socket()), false, 'rapid reconnects are limited');
  const fourth = socket();
  assert.equal(accept(request('1.1.1.1'), fourth), true);
  fourth.emit('close');
});

test('anonymous service works without code and still restricts Wisp connections', { timeout: 20000 }, async () => {
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const publicOrigin = 'https://proxy.example';
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), PUBLIC_ORIGIN: publicOrigin, FLUX_PUBLIC_ACCESS: '1', FLUX_ACCESS_CODE: '' },
    stdio: 'ignore',
  });
  const openSockets = [];
  try {
    let ready = false;
    for (let i = 0; i < 100 && !ready; i++) {
      if (child.exitCode !== null) throw new Error('Proxy exited before it was ready');
      try { ready = (await fetch(`${base}/healthz`)).ok; } catch {}
      if (!ready) await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready);
    assert.equal((await fetch(`${base}/?embed=1`, { redirect: 'manual' })).status, 200);
    assert.equal((await fetch(`${base}/sw.js`, { redirect: 'manual' })).status, 200);
    const login = await fetch(`${base}/login`, { redirect: 'manual' });
    assert.equal(login.status, 302);
    assert.equal(login.headers.get('location'), '/');

    function connect(origin, path = '/wisp/') {
      const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`, { origin });
      return new Promise(resolve => {
        ws.once('open', () => { openSockets.push(ws); resolve(true); });
        ws.once('error', () => resolve(false));
      });
    }
    assert.equal(await connect('https://wrong.example'), false);
    assert.equal(await connect(publicOrigin, '/wisp/?example.com:80'), false, 'alternate Wisp routing is rejected');
    for (let i = 0; i < 4; i++) assert.equal(await connect(publicOrigin), true);
    assert.equal(await connect(publicOrigin), false, 'fifth simultaneous connection is rejected');
    const ws = openSockets[0];
    const host = Buffer.from('127.0.0.1');
    const packet = Buffer.alloc(8 + host.length);
    packet[0] = 1;
    packet.writeUInt32LE(1, 1);
    packet[5] = 1;
    packet.writeUInt16LE(80, 6);
    host.copy(packet, 8);
    const reason = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for rejection')), 5000);
      ws.on('message', bytes => {
        const data = Buffer.from(bytes);
        if (data[0] === 4 && data.readUInt32LE(1) === 1) { clearTimeout(timer); resolve(data[5]); }
      });
    });
    ws.send(packet);
    assert.equal(await reason, 0x48);
  } finally {
    for (const socket of openSockets) socket.terminate();
    child.kill();
  }
});

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import WebSocket from 'ws';

let processHandle;
let port;
let origin;

before(async () => {
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  origin = `http://127.0.0.1:${port}`;
  processHandle = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: String(port), PUBLIC_ORIGIN: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const timeout = setTimeout(() => processHandle.kill(), 10000);
  try {
    for await (const chunk of processHandle.stdout) if (String(chunk).includes('listening on')) break;
  } finally { clearTimeout(timeout); }
});

after(() => processHandle?.kill());

test('serves the application and its worker', async () => {
  const [page, worker, health] = await Promise.all(['/','/sw.js','/healthz'].map(path => fetch(origin + path)));
  assert.equal(page.status, 200);
  assert.equal(worker.status, 200);
  assert.deepEqual(await health.json(), { ok: true });
});

test('rejects a WebSocket with a different browser origin', async () => {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/wisp/`, { origin: 'https://unrelated.example' });
  const [error] = await once(socket, 'error');
  assert.ok(error);
});

test('rejects a direct loopback destination over an allowed WebSocket', async () => {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/wisp/`, { origin });
  await once(socket, 'open');
  const host = Buffer.from('127.0.0.1');
  const packet = Buffer.alloc(8 + host.length);
  packet[0] = 1; // Wisp CONNECT
  packet.writeUInt32LE(1, 1);
  packet[5] = 1; // TCP
  packet.writeUInt16LE(80, 6);
  host.copy(packet, 8);
  const closed = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for a Wisp rejection')), 5000);
    socket.on('message', bytes => {
      const data = Buffer.from(bytes);
      if (data[0] === 4 && data.readUInt32LE(1) === 1) { clearTimeout(timer); resolve(data[5]); }
    });
  });
  socket.send(packet);
  assert.equal(await closed, 0x48); // HostBlocked
  socket.close();
});

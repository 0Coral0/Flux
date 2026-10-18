import { createRequire } from 'node:module';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

// Wisp 0.5.0 exports the connection API but not its Node socket class.
// This checked adapter pins the resolved address actually used for the connection.
const wispEntry = import.meta.resolve('@mercuryworkshop/wisp-js/server');
const { NodeTCPSocket } = await import(new URL('../server/net.mjs', wispEntry));
const ipaddr = createRequire(wispEntry)('ipaddr.js');

export function isPublicAddress(address) {
  if (!isIP(address)) return false;
  try { return ipaddr.process(address).range() === 'unicast'; }
  catch { return false; }
}

export async function resolvePublicAddress(hostname, resolve = lookup) {
  const result = await resolve(hostname, { order: 'ipv4first' });
  if (!result || !isPublicAddress(result.address)) throw new Error('Destination is not a public address');
  return result.address;
}

export class PublicTCPSocket extends NodeTCPSocket {
  async connect() {
    this.hostname = await resolvePublicAddress(this.hostname);
    return super.connect();
  }
}

// CF-Connecting-IP is used only as an abuse-control hint on the localhost
// Cloudflare Tunnel origin. The global limit still applies if it is missing or spoofed.
export function createPublicLimiter({ maxConnections = 32, perClient = 4, perMinute = 30, globalPerMinute = 1200, maxBytes = 512 * 1024 * 1024, maxLifetimeMs = 2 * 60 * 60 * 1000 } = {}) {
  const active = new Map();
  const attempts = new Map();
  let total = 0;
  let nextSweep = 0;
  let global = { count: 0, until: 0 };
  return function accept(req, socket) {
    const forwarded = req.headers['cf-connecting-ip'];
    const client = typeof forwarded === 'string' && isIP(forwarded) ? forwarded : (req.socket.remoteAddress || 'unknown');
    const now = Date.now();
    if (global.until <= now) global = { count: 0, until: now + 60_000 };
    if (++global.count > globalPerMinute) return false;
    if (now >= nextSweep) {
      for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
      nextSweep = now + 30_000;
    }
    if (!attempts.has(client) && attempts.size >= 4096) return false;
    const entry = attempts.get(client) || { count: 0, until: now + 60_000 };
    entry.count++;
    attempts.set(client, entry);
    if (entry.count > perMinute || total >= maxConnections || (active.get(client) || 0) >= perClient) return false;
    total++;
    active.set(client, (active.get(client) || 0) + 1);
    const timeout = setTimeout(() => socket.destroy(), maxLifetimeMs);
    const meter = setInterval(() => {
      if (socket.bytesRead + socket.bytesWritten > maxBytes) socket.destroy();
    }, 1000);
    socket.once('close', () => {
      clearTimeout(timeout);
      clearInterval(meter);
      total--;
      const left = (active.get(client) || 1) - 1;
      if (left) active.set(client, left); else active.delete(client);
    });
    return true;
  };
}

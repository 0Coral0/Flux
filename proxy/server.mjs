import express from 'express';
import { createServer } from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { server as wisp, logging } from '@mercuryworkshop/wisp-js/server';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3030);
const publicOrigin = process.env.PUBLIC_ORIGIN ? new URL(process.env.PUBLIC_ORIGIN).origin : null;

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');
if (publicOrigin && !publicOrigin.startsWith('https://')) throw new Error('PUBLIC_ORIGIN must use HTTPS.');

// These are defense-in-depth filters. A real deployment also needs an egress firewall.
Object.assign(wisp.options, {
  allow_direct_ip: false,
  allow_private_ips: false,
  allow_loopback_ips: false,
  allow_udp_streams: false,
  port_whitelist: [80, 443],
  stream_limit_total: 100,
  parse_real_ip: false,
  dns_result_order: 'ipv4first',
  hostname_blacklist: [/^localhost\.?$/i, /(^|\.)local\.?$/i, /(^|\.)internal\.?$/i],
});
logging.set_level(logging.WARN);

const accessCode = process.env.FLUX_ACCESS_CODE;
if (publicOrigin && (!accessCode || accessCode.length < 16)) throw new Error('Set FLUX_ACCESS_CODE (at least 16 characters) for public access.');
const sessionToken = randomBytes(32).toString('hex');
const sessionHash = createHash('sha256').update(sessionToken).digest();
const attempts = new Map();
function equals(a, b) {
  const x = createHash('sha256').update(String(a)).digest();
  const y = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(x, y);
}
function authenticated(req) {
  if (!accessCode) return true; // Local-only development.
  const cookie = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('flux_session='));
  return Boolean(cookie && equals(cookie.slice('flux_session='.length), sessionToken));
}
const app = express();
app.use(express.urlencoded({ extended: false, limit: '2kb' }));
app.get('/login', (_req, res) => res.type('html').send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Flux access</title></head><body style="font:16px system-ui;background:#111;color:white;display:grid;place-items:center;min-height:90vh"><form method="POST" action="/login"><h1>Flux Browser</h1><p>Enter your private access code.</p><input name="code" type="password" required autocomplete="off"><button>Unlock</button></form></body></html>`));
app.post('/login', (req, res) => {
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = attempts.get(ip) || { count: 0, until: now + 15 * 60_000 };
  if (entry.until < now) { entry.count = 0; entry.until = now + 15 * 60_000; }
  if (entry.count >= 8) return res.status(429).send('Too many attempts. Try again later.');
  if (!accessCode || !equals(req.body?.code || '', accessCode)) {
    entry.count++; attempts.set(ip, entry);
    return res.status(401).send('Incorrect access code. <a href="/login">Try again</a>');
  }
  attempts.delete(ip);
  res.setHeader('Set-Cookie', `flux_session=${sessionToken}; HttpOnly; SameSite=Strict; Path=/; ${publicOrigin ? 'Secure; ' : ''}Max-Age=86400`);
  res.redirect(303, '/');
});
app.use((req, res, next) => {
  if (req.path === '/healthz' || authenticated(req)) return next();
  if (req.method === 'GET' && (req.accepts('html') || req.path === '/')) return res.redirect(302, '/login');
  return res.status(401).send('Authentication required');
});
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Exact files only: package source, maps, and configuration are not public.
const assets = {
  '/engine/scramjet.js': 'node_modules/@mercuryworkshop/scramjet/dist/scramjet.js',
  '/engine/scramjet.wasm': 'node_modules/@mercuryworkshop/scramjet/dist/scramjet.wasm',
  '/engine/controller.api.js': 'node_modules/@mercuryworkshop/scramjet-controller/dist/controller.api.js',
  '/engine/controller.inject.js': 'node_modules/@mercuryworkshop/scramjet-controller/dist/controller.inject.js',
  '/engine/controller.sw.js': 'node_modules/@mercuryworkshop/scramjet-controller/dist/controller.sw.js',
  '/engine/utils.js': 'node_modules/@mercuryworkshop/scramjet-utils/dist/scramjet-utils.js',
  '/engine/libcurl.js': 'node_modules/@mercuryworkshop/libcurl-transport/dist/index.js',
};
for (const [url, path] of Object.entries(assets)) {
  app.get(url, (_req, res) => res.sendFile(join(root, path)));
}
app.use(express.static(join(root, 'public'), {
  setHeaders(res, path) {
    if (path.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-store');
  },
}));

const server = createServer(app);
server.on('upgrade', (req, socket, head) => {
  const requestPath = new URL(req.url || '/', 'http://localhost').pathname;
  // A browser's WebSocket Origin must be the proxy origin, including behind a reverse proxy.
  const host = req.headers.host || '';
  const localOrigin = /^localhost:\d+$|^127\.0\.0\.1:\d+$/i.test(host) ? `http://${host}` : null;
  if (requestPath !== '/wisp/' || !authenticated(req) || !req.headers.origin || req.headers.origin !== (publicOrigin || localOrigin)) {
    socket.destroy();
    return;
  }
  wisp.routeRequest(req, socket, head);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Flux Browser listening on http://127.0.0.1:${port}`);
  console.log(publicOrigin ? `Expected public origin: ${publicOrigin}` : 'Local access only.');
});

const MAX_THEME_BYTES = 8_000;
const MAX_SETTINGS_BYTES = 16_000;
const THEME_CODE = /^[a-z0-9][a-z0-9_-]{2,39}$/i;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json; charset=utf-8'
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });
const error = (message, status = 400) => json({ error: message }, status);

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function parseJwt(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token.');
  const read = index => JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[index])));
  return { header: read(0), payload: read(1), signed: `${parts[0]}.${parts[1]}`, signature: decodeBase64Url(parts[2]) };
}

async function requireFirebaseUser(request, env) {
  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) throw new Error('Sign in to save account data.');

  const parsed = parseJwt(token);
  const now = Math.floor(Date.now() / 1000);
  if (parsed.header.alg !== 'RS256' || !parsed.header.kid) throw new Error('Unsupported token.');
  if (!parsed.payload.sub || parsed.payload.sub.length > 128 || typeof parsed.payload.exp !== 'number' || typeof parsed.payload.iat !== 'number' || parsed.payload.exp <= now || parsed.payload.iat > now + 60) throw new Error('Expired token.');
  if (parsed.payload.aud !== env.FIREBASE_PROJECT_ID || parsed.payload.iss !== `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`) throw new Error('Token is for another project.');

  const keySet = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com').then(response => {
    if (!response.ok) throw new Error('Could not verify this sign-in.');
    return response.json();
  });
  const jwk = keySet.keys?.find(key => key.kid === parsed.header.kid && key.kty === 'RSA' && key.alg === 'RS256');
  if (!jwk) throw new Error('Sign in again and retry.');

  const publicKey = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const isValid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, parsed.signature, new TextEncoder().encode(parsed.signed));
  if (!isValid) throw new Error('Invalid token.');
  return { uid: parsed.payload.sub, email: parsed.payload.email || '' };
}

async function readJson(request, maximumBytes) {
  const text = await request.text();
  if (text.length > maximumBytes) throw new Error('That save is too large.');
  try { return JSON.parse(text || '{}'); } catch (_) { throw new Error('Invalid JSON.'); }
}

function cleanTheme(theme) {
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) throw new Error('Theme data is required.');
  const result = {};
  const hexFields = { accent: 'accent', bg: 'bg', cardBg: 'cardBg', borderColor: 'borderColor', textColor: 'textColor' };
  for (const [input, output] of Object.entries(hexFields)) {
    if (theme[input] === undefined) continue;
    if (typeof theme[input] !== 'string' || !/^#[0-9a-f]{6}$/i.test(theme[input])) throw new Error(`Invalid ${input} color.`);
    result[output] = theme[input].toLowerCase();
  }
  if (!result.accent || !result.bg) throw new Error('A theme needs an accent and background color.');
  return result;
}

function validateSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('Settings must be an object.');
  return settings;
}

const GLOBAL_ROOM = 'global_general';
const OWNER_EMAILS = new Set(['z.werner1@lodiusd.org', 'xboxmaster83412@gmail.com', 'coralsemail0@gmail.com']);
const CHAT_ROLES = new Set(['mod', 'admin', 'owner']);
const string = (value, limit) => String(value || '').trim().slice(0, limit);
const jsonValue = (value, fallback) => { try { return JSON.parse(value || ''); } catch (_) { return fallback; } };
const roomId = value => /^[a-z0-9_-]{3,128}$/i.test(value || '') ? value : '';
const uuid = () => crypto.randomUUID();

function cleanChatProfile(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const hex = color => /^#[0-9a-f]{6}$/i.test(color || '') ? color.toLowerCase() : '#22c55e';
  const image = value => (/^https:\/\//i.test(value || '') && String(value).length <= 1500) || (/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value || '') && String(value).length <= 30000) ? String(value) : '';
  return { status: string(source.status, 80), pronouns: string(source.pronouns, 32), bio: string(source.bio, 180), color: hex(source.color), color2: hex(source.color2 || source.color), banner: image(source.banner), emoji: Array.from(String(source.emoji || '')).slice(0, 2).join(''), favGame: string(source.favGame, 40) };
}

async function chatRole(env, user) {
  if (OWNER_EMAILS.has(String(user.email || '').toLowerCase())) return 'owner';
  const row = await env.DB.prepare('SELECT role FROM chat_staff WHERE email = ?').bind(String(user.email || '').toLowerCase()).first();
  return CHAT_ROLES.has(row?.role) ? row.role : '';
}

async function chatBan(env, uid) {
  const row = await env.DB.prepare('SELECT * FROM chat_bans WHERE uid = ?').bind(uid).first();
  if (!row) return null;
  if (row.expires_at && row.expires_at <= Date.now()) { await env.DB.prepare('DELETE FROM chat_bans WHERE uid = ?').bind(uid).run(); return null; }
  return { uid: row.uid, name: row.name, reason: row.reason, expiresAt: row.expires_at || null };
}

async function isRoomMember(env, room, uid) {
  if (room === GLOBAL_ROOM) return true;
  const row = await env.DB.prepare('SELECT members_json FROM chat_rooms WHERE id = ?').bind(room).first();
  return Boolean(row && jsonValue(row.members_json, []).includes(uid));
}

async function chatIdentity(request, env) {
  const user = await requireFirebaseUser(request, env);
  const row = await env.DB.prepare('SELECT uid, email, username, avatar, profile_json FROM chat_users WHERE uid = ?').bind(user.uid).first();
  const username = row?.username || string(user.email.split('@')[0], 40) || 'Gamer';
  return { uid: user.uid, email: user.email, username, avatar: row?.avatar || '', profile: jsonValue(row?.profile_json, {}), role: await chatRole(env, user) };
}

async function listChatState(env, identity) {
  const roomRows = await env.DB.prepare('SELECT * FROM chat_rooms WHERE EXISTS (SELECT 1 FROM json_each(members_json) WHERE value = ?) ORDER BY updated_at DESC').bind(identity.uid).all();
  const outgoing = await env.DB.prepare('SELECT * FROM chat_friends WHERE from_uid = ? ORDER BY updated_at DESC').bind(identity.uid).all();
  const incoming = await env.DB.prepare('SELECT * FROM chat_friends WHERE to_uid = ? ORDER BY updated_at DESC').bind(identity.uid).all();
  const mapRoom = row => ({ id: row.id, type: row.type, name: row.name, owner: row.owner_uid, members: jsonValue(row.members_json, []), names: jsonValue(row.names_json, {}), updated: row.updated_at });
  const mapFriend = row => ({ id: row.id, from: row.from_uid, to: row.to_uid, fromName: row.from_name, toName: row.to_name, status: row.status, ts: row.updated_at });
  return { me: identity, ban: await chatBan(env, identity.uid), rooms: roomRows.results.map(mapRoom), outgoing: outgoing.results.map(mapFriend), incoming: incoming.results.map(mapFriend) };
}

async function saveChatProfile(request, env, identity) {
  // Two cropped images can each be just under 30 KB, plus profile text.
  const body = await readJson(request, 70_000);
  const requestedUsername = string(body.username, 20).toLowerCase();
  const username = requestedUsername || identity.username;
  if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new Error('Usernames use 3–20 letters, numbers, or underscores.');
  const taken = await env.DB.prepare('SELECT uid FROM chat_users WHERE username_lower = ? AND uid != ?').bind(username, identity.uid).first();
  if (taken) throw new Error('That username is already taken.');
  const avatar = (/^https?:\/\//i.test(body.avatar || '') && String(body.avatar).length <= 1500) || (/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(body.avatar || '') && String(body.avatar).length <= 30000) ? String(body.avatar) : '';
  const profile = cleanChatProfile(body.profile);
  await env.DB.prepare(`INSERT INTO chat_users (uid, email, username, username_lower, avatar, profile_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(uid) DO UPDATE SET email=excluded.email, username=excluded.username, username_lower=excluded.username_lower, avatar=excluded.avatar, profile_json=excluded.profile_json, updated_at=excluded.updated_at`)
    .bind(identity.uid, identity.email, username, username.toLowerCase(), avatar, JSON.stringify(profile), Date.now()).run();
  return { ...identity, username, avatar, profile };
}

function requireStaff(identity) { if (!CHAT_ROLES.has(identity.role)) throw new Error('Staff access is required.'); }
function allowedBanDuration(role, duration) { return role === 'owner' || (role === 'admin' && duration <= 2592000000) || (role === 'mod' && duration <= 86400000); }

async function chatApi(request, env, url) {
  const path = url.pathname;
  const identity = await chatIdentity(request, env);
  if (path === '/api/chat/me') {
    if (request.method === 'PUT') await saveChatProfile(request, env, identity);
    return json(await listChatState(env, await chatIdentity(request, env)));
  }
  if (path === '/api/chat/users' && request.method === 'GET') {
    const term = string(url.searchParams.get('name'), 40).toLowerCase();
    if (!term) return json({ users: [] });
    const rows = await env.DB.prepare('SELECT uid, username, avatar, profile_json FROM chat_users WHERE username_lower = ? LIMIT 8').bind(term).all();
    return json({ users: rows.results.filter(row => row.uid !== identity.uid).map(row => ({ uid: row.uid, name: row.username, avatar: row.avatar, profile: jsonValue(row.profile_json, {}) })) });
  }
  if (path === '/api/chat/friends' && request.method === 'POST') {
    const body = await readJson(request, 1_000); const to = string(body.uid, 128); if (!to || to === identity.uid) return error('Choose another Flux user.', 400);
    const user = await env.DB.prepare('SELECT username FROM chat_users WHERE uid = ?').bind(to).first(); if (!user) return error('That Flux user was not found.', 404);
    const id = [identity.uid, to].sort().join('_'); const existing = await env.DB.prepare('SELECT * FROM chat_friends WHERE id = ?').bind(id).first();
    if (existing) {
      if (existing.status === 'pending' && existing.to_uid === identity.uid) {
        await env.DB.prepare("UPDATE chat_friends SET status='accepted', updated_at=? WHERE id=?").bind(Date.now(), id).run();
        return json({ ok: true, status: 'accepted' });
      }
      return json({ ok: true, status: existing.status, existing: true });
    }
    await env.DB.prepare("INSERT INTO chat_friends (id, from_uid, to_uid, from_name, to_name, status, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)").bind(id, identity.uid, to, identity.username, user.username, Date.now()).run();
    return json({ ok: true, status: 'pending' });
  }
  const friendMatch = path.match(/^\/api\/chat\/friends\/([^/]+)$/);
  if (friendMatch && request.method === 'DELETE') { const row = await env.DB.prepare('SELECT * FROM chat_friends WHERE id = ?').bind(friendMatch[1]).first(); if (!row || (row.from_uid !== identity.uid && row.to_uid !== identity.uid)) return error('Not found.', 404); await env.DB.prepare('DELETE FROM chat_friends WHERE id = ?').bind(friendMatch[1]).run(); return json({ ok: true }); }
  if (friendMatch && request.method === 'PUT') { const row = await env.DB.prepare('SELECT * FROM chat_friends WHERE id = ?').bind(friendMatch[1]).first(); if (!row || row.to_uid !== identity.uid) return error('Not found.', 404); await env.DB.prepare("UPDATE chat_friends SET status='accepted', updated_at=? WHERE id=?").bind(Date.now(), friendMatch[1]).run(); return json({ ok: true }); }
  if (path === '/api/chat/rooms' && request.method === 'POST') {
    const body = await readJson(request, 4_000); const requested = Array.isArray(body.members) ? body.members.map(value => string(value, 128)).filter(Boolean) : []; const members = [...new Set([identity.uid, ...requested])];
    if (body.type === 'dm' && members.length === 2) { const id = 'dm_' + [...members].sort().join('_'); const other = members.find(uid => uid !== identity.uid); const found = await env.DB.prepare('SELECT username FROM chat_users WHERE uid=?').bind(other).first(); if (!found) return error('That user was not found.', 404); const names = { [identity.uid]: identity.username, [other]: found.username }; await env.DB.prepare('INSERT OR IGNORE INTO chat_rooms (id,type,name,owner_uid,members_json,names_json,updated_at) VALUES (?,\'dm\',\'\',?,?,?,?,?)').bind(id, identity.uid, JSON.stringify(members.sort()), JSON.stringify(names), Date.now()).run(); return json({ room: { id, type: 'dm', members, names } }); }
    if (body.type === 'group' && members.length >= 2 && members.length <= 30) { const id = 'grp_' + uuid().replaceAll('-', ''); const names = { [identity.uid]: identity.username }; for (const uid of members.filter(uid => uid !== identity.uid)) { const found = await env.DB.prepare('SELECT username FROM chat_users WHERE uid=?').bind(uid).first(); if (!found) return error('A chosen user was not found.', 404); names[uid] = found.username; } const groupName = string(body.name, 40); if (!groupName) return error('A group name is required.', 400); await env.DB.prepare('INSERT INTO chat_rooms (id,type,name,owner_uid,members_json,names_json,updated_at) VALUES (?,\'group\',?,?,?,?,?,?)').bind(id, groupName, identity.uid, JSON.stringify(members), JSON.stringify(names), Date.now()).run(); return json({ room: { id, type: 'group', name: groupName, members, names } }); }
    return error('Invalid room request.', 400);
  }
  const roomMessages = path.match(/^\/api\/chat\/rooms\/([^/]+)\/messages$/);
  if (roomMessages && request.method === 'GET') { const room = decodeURIComponent(roomMessages[1]); if (!roomId(room) || !(await isRoomMember(env, room, identity.uid))) return error('Room not found.', 404); const rows = await env.DB.prepare('SELECT * FROM chat_messages WHERE room_id=? ORDER BY timestamp DESC LIMIT 200').bind(room).all(); return json({ messages: rows.results.reverse().map(row => ({ id: row.id, uid: row.uid, username: row.username, avatar: row.avatar, profile: jsonValue(row.profile_json, {}), text: row.text, mentions: jsonValue(row.mentions_json, []), replyTo: jsonValue(row.reply_json, null), role: row.role, timestamp: row.timestamp })) }); }
  const ticketMatch = path.match(/^\/api\/chat\/rooms\/([^/]+)\/ticket$/);
  if (ticketMatch && request.method === 'POST') { const room = decodeURIComponent(ticketMatch[1]); if (!roomId(room) || !(await isRoomMember(env, room, identity.uid))) return error('Room not found.', 404); if (await chatBan(env, identity.uid)) return error('You are banned from Flux chat.', 403); const ticket = uuid().replaceAll('-', ''); const stub = env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName(room)); const socketIdentity = { uid: identity.uid, username: identity.username, role: identity.role, room }; await stub.fetch('https://chat/ticket', { method: 'POST', body: JSON.stringify({ ticket, identity: socketIdentity, expiresAt: Date.now() + 60_000 }) }); return json({ ticket, wsUrl: new URL('/api/chat/ws?room=' + encodeURIComponent(room) + '&ticket=' + ticket, url).toString().replace(/^http/, 'ws') }); }
  if (path === '/api/chat/reports' && request.method === 'POST') { const body = await readJson(request, 2_000); await env.DB.prepare("INSERT INTO chat_reports (id,target_type,reporter_uid,target_uid,target_name,message_id,room_id,text,reason,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(uuid(), string(body.kind, 20) || 'message', identity.uid, string(body.targetUid, 128), string(body.targetName, 40), string(body.messageId, 128), string(body.room, 128), string(body.text, 500), string(body.reason, 120), Date.now()).run(); return json({ ok: true }); }
  if (path === '/api/chat/reports' && request.method === 'GET') { requireStaff(identity); const rows = await env.DB.prepare("SELECT * FROM chat_reports WHERE status='open' ORDER BY created_at DESC LIMIT 50").all(); return json({ reports: rows.results }); }
  const messageMatch = path.match(/^\/api\/chat\/messages\/([^/]+)$/);
  if (messageMatch && request.method === 'DELETE') { const row = await env.DB.prepare('SELECT room_id, uid FROM chat_messages WHERE id=?').bind(messageMatch[1]).first(); if (!row || (row.uid !== identity.uid && !CHAT_ROLES.has(identity.role))) return error('Message not found.', 404); await env.DB.prepare('DELETE FROM chat_messages WHERE id=?').bind(messageMatch[1]).run(); const stub = env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName(row.room_id)); await stub.fetch('https://chat/event', { method: 'POST', body: JSON.stringify({ type: 'delete', id: messageMatch[1] }) }); return json({ ok: true }); }
  return error('Not found.', 404);
}

async function getTheme(request, env, code) {
  const row = await env.DB.prepare('SELECT theme_json, updated_at FROM theme_codes WHERE code = ?').bind(code).first();
  if (!row) return error('Theme code not found.', 404);
  return json({ code, theme: JSON.parse(row.theme_json), updatedAt: row.updated_at });
}

async function putTheme(request, env, code) {
  if (!THEME_CODE.test(code)) return error('Theme codes must be 3–40 letters, numbers, dashes, or underscores.');
  const user = await requireFirebaseUser(request, env);
  const body = await readJson(request, MAX_THEME_BYTES);
  const theme = cleanTheme(body.theme);
  const current = await env.DB.prepare('SELECT owner_uid FROM theme_codes WHERE code = ?').bind(code).first();
  if (current && current.owner_uid !== user.uid) return error('That theme code belongs to someone else.', 403);
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO theme_codes (code, owner_uid, theme_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET theme_json = excluded.theme_json, updated_at = excluded.updated_at`)
    .bind(code, user.uid, JSON.stringify(theme), now, now).run();
  return json({ code, theme, updatedAt: now });
}

async function getSettings(request, env) {
  const user = await requireFirebaseUser(request, env);
  const row = await env.DB.prepare('SELECT settings_json, updated_at FROM user_settings WHERE user_uid = ?').bind(user.uid).first();
  return json({ settings: row ? JSON.parse(row.settings_json) : {}, updatedAt: row?.updated_at || null });
}

async function putSettings(request, env) {
  const user = await requireFirebaseUser(request, env);
  const body = await readJson(request, MAX_SETTINGS_BYTES);
  const settings = validateSettings(body.settings);
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO user_settings (user_uid, settings_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_uid) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at`)
    .bind(user.uid, JSON.stringify(settings), now).run();
  return json({ settings, updatedAt: now });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/') return json({ ok: true, service: 'Flux data API', health: '/api/data/health' });
      if (request.method === 'GET' && url.pathname === '/api/data/health') return json({ ok: true });
      if (url.pathname === '/api/chat/ws' && request.headers.get('Upgrade') === 'websocket') {
        const room = roomId(url.searchParams.get('room'));
        if (!room) return error('Invalid chat room.', 400);
        const stub = env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName(room));
        return stub.fetch(new Request('https://chat/ws?' + url.searchParams.toString(), request));
      }
      if (url.pathname.startsWith('/api/chat/')) return await chatApi(request, env, url);
      const themeMatch = url.pathname.match(/^\/api\/themes\/([^/]+)$/);
      if (themeMatch) {
        const code = decodeURIComponent(themeMatch[1]).trim().toLowerCase();
        if (request.method === 'GET') return await getTheme(request, env, code);
        if (request.method === 'PUT') return await putTheme(request, env, code);
      }
      if (url.pathname === '/api/users/me/settings') {
        if (request.method === 'GET') return await getSettings(request, env);
        if (request.method === 'PUT') return await putSettings(request, env);
      }
      return error('Not found.', 404);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unexpected error.';
      const status = /sign in|token|expired|verify|unsupported|invalid token/i.test(message) ? 401 : 400;
      return error(message, status);
    }
  }
};

export class FluxChatRoom {
  constructor(state, env) { this.state = state; this.env = env; }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/ticket' && request.method === 'POST') {
      const ticket = await request.json();
      if (!ticket?.ticket || !ticket.identity?.uid) return new Response('Bad ticket', { status: 400 });
      await this.state.storage.put('ticket:' + ticket.ticket, ticket);
      return new Response(null, { status: 204 });
    }
    if (url.pathname === '/event' && request.method === 'POST') {
      this.broadcast(await request.json());
      return new Response(null, { status: 204 });
    }
    if (url.pathname !== '/ws' || request.headers.get('Upgrade') !== 'websocket') return new Response('Not found', { status: 404 });
    const ticketKey = 'ticket:' + String(url.searchParams.get('ticket') || '');
    const ticket = await this.state.storage.get(ticketKey);
    if (!ticket || ticket.expiresAt < Date.now()) return new Response('Invalid chat ticket', { status: 401 });
    await this.state.storage.delete(ticketKey);
    const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
    server.serializeAttachment(ticket.identity);
    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  broadcast(value) {
    const payload = JSON.stringify(value);
    for (const socket of this.state.getWebSockets()) { try { socket.send(payload); } catch (_) {} }
  }

  async webSocketMessage(socket, raw) {
    const identity = socket.deserializeAttachment();
    let packet; try { packet = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)); } catch (_) { return; }
    if (packet?.type !== 'send') return;
    const text = string(packet.text, 500); if (!text) return;
    const ban = await chatBan(this.env, identity.uid); if (ban) { try { socket.send(JSON.stringify({ type: 'error', error: 'You are banned from Flux chat.' })); } catch (_) {} return; }
    const mentions = Array.isArray(packet.mentions) ? [...new Set(packet.mentions.map(value => string(value, 40).toLowerCase()))].slice(0, 10) : [];
    const reply = packet.replyTo && typeof packet.replyTo === 'object' ? { id: string(packet.replyTo.id, 128), name: string(packet.replyTo.name, 40), text: string(packet.replyTo.text, 100) } : null;
    const currentProfile = await this.env.DB.prepare('SELECT avatar, profile_json FROM chat_users WHERE uid=?').bind(identity.uid).first();
    const message = { id: uuid(), uid: identity.uid, username: identity.username, avatar: currentProfile?.avatar || '', profile: cleanChatProfile(jsonValue(currentProfile?.profile_json, {})), text, mentions, replyTo: reply, role: identity.role || '', timestamp: Date.now() };
    await this.env.DB.prepare('INSERT INTO chat_messages (id,room_id,uid,username,avatar,profile_json,text,mentions_json,reply_json,role,timestamp) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .bind(message.id, identity.room, message.uid, message.username, message.avatar, JSON.stringify(message.profile), message.text, JSON.stringify(message.mentions), reply ? JSON.stringify(reply) : null, message.role, message.timestamp).run();
    if (identity.room !== GLOBAL_ROOM) await this.env.DB.prepare('UPDATE chat_rooms SET updated_at=? WHERE id=?').bind(message.timestamp, identity.room).run();
    this.broadcast({ type: 'message', message });
  }

  webSocketClose(socket) { try { socket.close(1000, 'Bye'); } catch (_) {} }
}

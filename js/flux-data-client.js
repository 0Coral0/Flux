(function (win) {
  'use strict';
  // Firebase compat is deliberately used here so the same data layer works on
  // Vercel and plain local HTTP previews without ES-module loading issues.
  const account = () => { if (!win.fluxAuthState?.uid) throw new Error('Sign in from Profile to continue.'); return win.fluxAuthState; };
  const name = value => String(value || '').trim().replace(/^@/, '').toLowerCase();
  const image = value => { const source = String(value || ''); return (/^https:\/\//i.test(source) && source.length <= 1500) || (/^data:image\/(png|jpeg|webp);base64,/i.test(source) && source.length <= 40000) ? source : ''; };
  const item = record => ({ id: record.id, ...record.data() });
  const db = () => { if (!win.fluxFirebaseDb || !win.fluxFirebase) throw new Error('Firebase is unavailable. Please reload and try again.'); return win.fluxFirebaseDb; };
  const stamp = () => win.fluxFirebase.firestore.FieldValue.serverTimestamp();

  async function loadTheme(code) { const record = await db().collection('themes').doc(name(code)).get(); return { theme: record.exists ? record.data().theme || record.data() : null }; }
  async function saveTheme(code, theme) { const key = name(code); if (!key) throw new Error('Choose a theme code first.'); await db().collection('themes').doc(key).set({ theme, updatedAt: stamp() }, { merge: true }); return { theme }; }
  async function getSettings() { const record = await db().collection('users').doc(account().uid).collection('settings').doc('main').get(); return { settings: record.exists ? record.data() : {} }; }
  async function putSettings(settings) { await db().collection('users').doc(account().uid).collection('settings').doc('main').set({ ...settings, updatedAt: stamp() }, { merge: true }); return { settings }; }

  async function saveMe(body) {
    const me = account(); const store = db(); const username = name(body?.username);
    if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new Error('Choose a username with 3–20 lowercase letters, numbers, or underscores.');
    const profile = body?.profile && typeof body.profile === 'object' ? body.profile : {};
    const userRef = store.collection('chat_users').doc(me.uid); const nameRef = store.collection('chat_usernames').doc(username); let saved;
    await store.runTransaction(async transaction => {
      const [current, claimed] = await Promise.all([transaction.get(userRef), transaction.get(nameRef)]);
      if (claimed.exists && claimed.data().uid !== me.uid) throw new Error('That @username is already taken.');
      const previous = String(current.data()?.username || '').toLowerCase();
      if (previous && previous !== username) transaction.delete(store.collection('chat_usernames').doc(previous));
      saved = { uid: me.uid, email: me.email || '', username, avatar: image(body?.avatar), profile: { banner: image(profile.banner), status: String(profile.status || '').slice(0, 80), pronouns: String(profile.pronouns || '').slice(0, 32), bio: String(profile.bio || '').slice(0, 180), color: /^#[a-f0-9]{6}$/i.test(profile.color || '') ? profile.color : '#22c55e' }, updatedAt: stamp() };
      transaction.set(nameRef, { uid: me.uid, username, updatedAt: stamp() }); transaction.set(userRef, saved, { merge: true });
    });
    return { me: { ...saved, updatedAt: Date.now() } };
  }
  async function getMe() {
    const me = account(); const store = db();
    const [profile, sent, received, rooms] = await Promise.all([store.collection('chat_users').doc(me.uid).get(), store.collection('friend_requests').where('from', '==', me.uid).get(), store.collection('friend_requests').where('to', '==', me.uid).get(), store.collection('chat_rooms').where('members', 'array-contains', me.uid).get()]);
    const fallback = { uid: me.uid, email: me.email || '', username: name(me.name) || 'gamer', avatar: '', profile: {} };
    return { me: profile.exists ? item(profile) : fallback, outgoing: sent.docs.map(item), incoming: received.docs.map(item), rooms: rooms.docs.map(item) };
  }
  async function findUser(value) { const claimed = await db().collection('chat_usernames').doc(name(value)).get(); if (!claimed.exists) return { users: [] }; const person = await db().collection('chat_users').doc(claimed.data().uid).get(); return { users: person.exists ? [{ uid: person.id, name: person.data().username, avatar: person.data().avatar || '' }] : [] }; }
  async function makeFriend(body) {
    const me = account(); const store = db(); const other = String(body?.uid || ''); if (!other || other === me.uid) throw new Error('Choose another Flux user.');
    const direct = store.collection('friend_requests').doc(me.uid + '_' + other), reverse = store.collection('friend_requests').doc(other + '_' + me.uid); let result = { status: 'pending' };
    await store.runTransaction(async transaction => { const [otherUser, existing, incoming] = await Promise.all([transaction.get(store.collection('chat_users').doc(other)), transaction.get(direct), transaction.get(reverse)]); if (!otherUser.exists) throw new Error('That Flux user was not found.'); if (existing.exists) { result = { status: existing.data().status, existing: true }; return; } if (incoming.exists && incoming.data().status === 'pending') { transaction.update(reverse, { status: 'accepted', updatedAt: stamp() }); result = { status: 'accepted' }; return; } transaction.set(direct, { from: me.uid, to: other, members: [me.uid, other], fromName: name(me.name) || 'gamer', toName: otherUser.data().username || 'gamer', status: 'pending', createdAt: stamp(), updatedAt: stamp() }); });
    return result;
  }
  async function respondFriend(id, method) { const me = account(); const ref = db().collection('friend_requests').doc(String(id)); const request = await ref.get(); if (!request.exists) throw new Error('That friend request no longer exists.'); if (method === 'DELETE') { await ref.delete(); return { ok: true }; } if (request.data().to !== me.uid) throw new Error('Only the recipient can accept this request.'); await ref.update({ status: 'accepted', updatedAt: stamp() }); return { ok: true }; }
  async function createRoom(body) {
    const me = account(); const store = db(); const members = [...new Set([me.uid, ...(Array.isArray(body?.members) ? body.members : [])])].filter(Boolean); const type = body?.type === 'group' ? 'group' : 'dm';
    if (members.length < 2 || members.length > 25) throw new Error('Choose between 1 and 24 friends for this chat.'); if (type === 'dm' && members.length !== 2) throw new Error('A direct message needs one friend.');
    const profiles = await Promise.all(members.map(uid => store.collection('chat_users').doc(uid).get())); if (profiles.some(profile => !profile.exists)) throw new Error('One of those Flux users was not found.');
    const roomId = type === 'dm' ? 'dm_' + members.sort().join('_') : 'grp_' + crypto.randomUUID().replaceAll('-', ''); const ref = store.collection('chat_rooms').doc(roomId); const previous = await ref.get(); const room = previous.exists ? item(previous) : { id: roomId, type, name: type === 'group' ? String(body?.name || '').trim().slice(0, 40) : '', members, names: Object.fromEntries(profiles.map(profile => [profile.id, profile.data().username || 'gamer'])), owner: me.uid, createdBy: me.uid };
    if (type === 'group' && !room.name) throw new Error('A group name is required.'); if (!previous.exists) await ref.set({ ...room, createdAt: stamp(), updatedAt: stamp() }); return { room };
  }
  async function chat(path, options = {}) { const method = String(options.method || 'GET').toUpperCase(), body = options.body || {}; if (path === '/me') return method === 'PUT' ? saveMe(body) : getMe(); if (path.startsWith('/users?name=')) return findUser(decodeURIComponent(path.split('=')[1] || '')); if (path === '/friends' && method === 'POST') return makeFriend(body); if (path.startsWith('/friends/') && (method === 'PUT' || method === 'DELETE')) return respondFriend(path.slice(9), method); if (path === '/rooms' && method === 'POST') return createRoom(body); throw new Error('That Firebase chat action is not available.'); }
  win.FLUX_DATA_PROVIDER = 'firebase'; win.fluxData = Object.freeze({ health: async () => ({ ok: true, provider: 'firebase' }), loadTheme, saveTheme, getSettings, putSettings, chat });
})(window);

import { createHash, randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
const hash = value => createHash('sha256').update(value).digest('hex');
// All collections below are server-only. Never grant browser access to bridgePrivate.
export function createStore(db, { increment = FieldValue.increment } = {}) {
  const root = db.collection('bridgePrivate');
  const userRef = uid => root.doc('user_' + uid);
  const recipientRef = id => root.doc('discord_' + id);
  const invites = uid => root.doc('invite_' + uid);
  const codes = code => root.doc('code_' + hash(code));
  const messageRef = thread => root.doc('thread_' + thread).collection('messages');
  const gameStats = root.doc('game_statistics').collection('games');
  return {
    async recordPlay(id) { await gameStats.doc(hash(id)).set({id, plays:increment(1)}, {merge:true}); },
    async hotGames() { return (await gameStats.orderBy('plays','desc').limit(20).get()).docs.map(doc => doc.data()); },
    async saveMessageProfile(channelId, messageId, profile) {
      await root.doc('profile_' + messageId).set({ channelId, profile });
    },
    async messageProfiles(channelId, messages) {
      if (!messages.length) return messages;
      const refs = messages.map(message => root.doc('profile_' + message.id));
      const docs = await db.getAll(...refs);
      return messages.map((message, index) => {
        const data = docs[index].data();
        return data?.channelId === channelId ? { ...message, profile: data.profile } : message;
      });
    },
    async invite(uid,code) {
      await db.runTransaction(async tx => {
        const previous = await tx.get(invites(uid));
        if (previous.exists) tx.delete(codes(previous.data().code));
        tx.set(invites(uid),{code}); tx.set(codes(code),{uid,expires:Date.now()+600000});
      });
    },
    async accept(code,discordId,name) {
      return db.runTransaction(async tx => {
        const invite = await tx.get(codes(code));
        if (!invite.exists || invite.data().expires < Date.now()) throw Error('That invitation is invalid or expired.');
        const uid = invite.data().uid;
        const [user,recipient] = await Promise.all([tx.get(userRef(uid)),tx.get(recipientRef(discordId))]);
        if (user.exists || recipient.exists) throw Error('A conversation is already connected. Disconnect it first.');
        const thread = randomBytes(16).toString('hex');
        tx.set(userRef(uid),{discordId,name,thread}); tx.set(recipientRef(discordId),{uid,thread});
        tx.delete(codes(code)); tx.delete(invites(uid)); return uid;
      });
    },
    async contact(uid) { return (await userRef(uid).get()).data() || null; },
    async recipient(id) { return (await recipientRef(id).get()).data() || null; },
    async unlink(uid) {
      await db.runTransaction(async tx => {
        const [contact,invite] = await Promise.all([tx.get(userRef(uid)),tx.get(invites(uid))]);
        if (contact.exists) tx.delete(recipientRef(contact.data().discordId));
        if (invite.exists) tx.delete(codes(invite.data().code));
        tx.delete(userRef(uid)); tx.delete(invites(uid));
      });
    },
    async sendPrivate(uid,contact,send) {
      const current = (await userRef(uid).get()).data();
      if (!current || current.thread !== contact.thread) throw Error('Contact disconnected.');
      await send();
    },
    async append(thread,id,data) { await messageRef(thread).doc(id).set(data); },
    async messages(thread) { return (await messageRef(thread).orderBy('timestamp','desc').limit(50).get()).docs.map(doc => ({id:doc.id,...doc.data()})).reverse(); },
    async saveAsset(id,data) { await root.doc('asset_' + id).set(data); },
    async asset(id) { return (await root.doc('asset_' + id).get()).data(); }
  };
}

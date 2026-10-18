'use strict';
const { Client, GatewayIntentBits, Events, PermissionsBitField } = require('discord.js');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const { createHash } = require('node:crypto');
const { ROOM, toDiscord, toFlux } = require('./format');
for (const key of ['DISCORD_BOT_TOKEN', 'DISCORD_CHANNEL_ID', 'FIREBASE_PROJECT_ID']) {
  if (!process.env[key]) throw new Error('Missing configuration: ' + key);
}
initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID });
const db = getFirestore();
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const startedAt = Timestamp.now();
let timer;
let stopping = false;
let incoming = Promise.resolve();
client.on(Events.MessageCreate, message => {
  if (stopping || message.channelId !== process.env.DISCORD_CHANNEL_ID) return;
  const data = toFlux(message);
  if (!data) return;
  incoming = incoming.then(async () => {
    // A deterministic ID prevents repeated gateway events from creating duplicates.
    const ref = db.collection('messages').doc('discord_' + message.id);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await ref.create({ ...data, timestamp: FieldValue.serverTimestamp() });
        return;
      } catch (error) {
        if (error.code === 6) return;
        if (attempt === 4) { console.error('Discord to Flux failed:', error.code); return; }
        await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
      }
    }
  }).catch(error => console.error('Incoming queue failed:', error.code));
});
client.once(Events.ClientReady, async () => {
  try {
    const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
    if (!channel || !channel.isTextBased() || !channel.guild || !channel.send) throw new Error('Choose a server text channel');
    const required = [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages];
    if (!channel.permissionsFor(client.user)?.has(required)) throw new Error('Bot needs View Channel and Send Messages');
    // One worker only. Persisted receipts suppress duplicates after listener/poll retries.
    async function poll() {
      try {
        const snapshot = await db.collection('messages').where('timestamp', '>=', startedAt).get();
        const docs = snapshot.docs.sort((a, b) => a.data().timestamp.toMillis() - b.data().timestamp.toMillis());
        for (const doc of docs) {
          const data = doc.data();
          const payload = toDiscord(data);
          if (!payload || data.discordBridgeMessageId) continue;
          const sent = await channel.send({ ...payload, nonce: createHash('sha256').update(doc.id).digest('hex').slice(0, 25), enforceNonce: true });
          await doc.ref.update({ discordBridgeMessageId: sent.id });
        }
      } catch (error) { console.error('Flux to Discord failed; retrying:', error.code || error.message); }
      if (!stopping) timer = setTimeout(poll, 2000);
    }
    console.log('Bridge ready: Flux global chat <-> Discord channel ' + channel.id);
    await poll();
  } catch (error) { console.error('Startup failed:', error.message); await stop(1); }
});
client.on(Events.Error, error => console.error('Discord client error:', error.code));
async function stop(code = 0) {
  stopping = true;
  clearTimeout(timer);
  await incoming;
  client.destroy();
  await db.terminate();
  process.exit(code);
}
process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
client.login(process.env.DISCORD_BOT_TOKEN).catch(error => { console.error('Discord login failed:', error.code); stop(1); });

import { Client, Events, GatewayIntentBits, Partials, WebhookClient } from 'discord.js';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createBridge } from './server.mjs';
import { createStore } from './store.mjs';
import { createDiscordTransport } from './discord-channels.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { gameList } = require('../data.js');

export async function start() {
  for (const key of ['DISCORD_BOT_TOKEN','DISCORD_GUILD_ID','FIREBASE_PROJECT_ID','BRIDGE_FIRESTORE_DATABASE','FLUX_SITE_ORIGIN']) if (!process.env[key]) throw Error('Missing ' + key);
  const app = initializeApp({credential:applicationDefault(),projectId:process.env.FIREBASE_PROJECT_ID});
  const db = getFirestore(app,process.env.BRIDGE_FIRESTORE_DATABASE); const store = createStore(db);
  const client = new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.DirectMessages,GatewayIntentBits.MessageContent],partials:[Partials.Channel]});
  await client.login(process.env.DISCORD_BOT_TOKEN);
  if (!client.isReady()) await new Promise(resolve => client.once(Events.ClientReady,resolve));
  const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
  await guild.members.fetchMe();
  let webhookUrls;
  try { webhookUrls = JSON.parse(process.env.DISCORD_WEBHOOK_URLS || '{}'); }
  catch { throw Error('DISCORD_WEBHOOK_URLS must be a JSON object mapping channel IDs to webhook URLs.'); }
  if (!webhookUrls || typeof webhookUrls !== 'object' || Array.isArray(webhookUrls)) throw Error('Invalid DISCORD_WEBHOOK_URLS configuration.');
  if (process.env.DISCORD_WEBHOOK_URL && process.env.DISCORD_CHANNEL_ID) webhookUrls[process.env.DISCORD_CHANNEL_ID] = process.env.DISCORD_WEBHOOK_URL;
  const webhooks = new Map();
  for (const [channelId, url] of Object.entries(webhookUrls)) {
    let webhook;
    try { webhook = new WebhookClient({ url }); }
    catch { throw Error('Invalid configured Discord webhook.'); }
    const remote = await client.fetchWebhook(webhook.id, webhook.token);
    if (remote.guildId !== guild.id || remote.channelId !== channelId) throw Error('Each webhook must belong to its configured channel in the Flux server.');
    webhooks.set(channelId, webhook);
  }
  console.log('Discord sender webhooks verified: ' + webhooks.size);
  const discord = createDiscordTransport({ guild, bot: client.user, webhooks });
  discord.dm = async (id, payload) => (await client.users.fetch(id)).send(payload);
  const mirrored = await discord.channels();
  if (!mirrored.length) throw Error('No channels are readable by ordinary members and Flux Bot. Check the server/channel permissions.');
  console.log('Discord channels ready: ' + mirrored.map(channel => channel.name + (channel.readOnly ? ' [read only]' : '')).join(', '));
  // Sequential DM processing prevents acceptance/unlink commands racing with incoming messages.
  let incoming = Promise.resolve();
  client.on(Events.MessageCreate, message => {
    if (message.guildId || message.author.bot) return;
    incoming = incoming.then(async () => {
      try {
        const text = message.content.trim();
        if (/^!flux [a-f0-9]{32}$/.test(text)) {
          await store.accept(text.slice(6),message.author.id,message.author.username);
          await message.reply('Connected to your Flux contact. Your next messages here are private replies to that contact. Send !unlink to disconnect.'); return;
        }
        const contact = await store.recipient(message.author.id);
        if (text === '!unlink') { if (contact) await store.unlink(contact.uid); await message.reply('Disconnected from Flux.'); return; }
        if (!contact) { await message.reply('To connect, ask your Flux contact for an invitation and send !flux CODE.'); return; }
        const content = [text,...message.attachments.map(a=>a.url)].filter(Boolean).join('\n');
        if (content) await store.append(contact.thread,message.id,{username:message.author.username,avatar:message.author.displayAvatarURL(),text:content,timestamp:message.createdAt.toISOString()});
      } catch(error) { await message.reply(error.message.includes('invitation') || error.message.includes('already connected') ? error.message : 'Could not process that message. Please try again.').catch(()=>{}); }
    }).catch(()=>{});
  });
  const creatorUids = (process.env.FLUX_CREATOR_UIDS || '').split(',').map(uid => uid.trim()).filter(Boolean);
  const server = createBridge({siteOrigin:process.env.FLUX_SITE_ORIGIN,additionalSiteOrigins:process.env.FLUX_LOCAL_ORIGIN ? [process.env.FLUX_LOCAL_ORIGIN] : [],publicUrl:process.env.BRIDGE_PUBLIC_URL,verifyToken:token=>getAuth().verifyIdToken(token,true),store,discord,ollamaUrl:process.env.OLLAMA_URL,ollamaModel:process.env.OLLAMA_MODEL,creatorUids,gameCatalog:gameList});
  const port = Number(process.env.PORT || 3032);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid PORT.');
  server.listen(port,'127.0.0.1',()=>console.log('Flux community service ready on 127.0.0.1:' + port));
  const stop = () => { server.close(async ()=>{ await incoming; client.destroy(); for (const webhook of webhooks.values()) webhook.destroy(); await db.terminate(); process.exit(0); }); };
  process.once('SIGINT',stop); process.once('SIGTERM',stop);
}

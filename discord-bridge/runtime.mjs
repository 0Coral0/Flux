import { Client, Events, GatewayIntentBits, Partials, WebhookClient, PermissionsBitField } from 'discord.js';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createBridge } from './server.mjs';
import { createStore } from './store.mjs';

export async function start() {
  for (const key of ['DISCORD_BOT_TOKEN','DISCORD_CHANNEL_ID','FIREBASE_PROJECT_ID','FLUX_SITE_ORIGIN']) if (!process.env[key]) throw Error('Missing ' + key);
  const app = initializeApp({credential:applicationDefault(),projectId:process.env.FIREBASE_PROJECT_ID});
  const db = getFirestore(app,process.env.BRIDGE_FIRESTORE_DATABASE || 'flux-community'); const store = createStore(db);
  const client = new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.DirectMessages,GatewayIntentBits.MessageContent],partials:[Partials.Channel]});
  const webhook = process.env.DISCORD_WEBHOOK_URL ? new WebhookClient({url:process.env.DISCORD_WEBHOOK_URL}) : null;
  await client.login(process.env.DISCORD_BOT_TOKEN);
  if (!client.isReady()) await new Promise(resolve => client.once(Events.ClientReady,resolve));
  const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
  if (!channel?.guild || !channel.isTextBased() || !channel.send) throw Error('Choose a server text channel.');
  if (!channel.permissionsFor(client.user)?.has([PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.ReadMessageHistory,PermissionsBitField.Flags.SendMessages])) throw Error('Grant View Channel, Read Message History and Send Messages.');
  if (webhook && (await client.fetchWebhook(webhook.id,webhook.token)).channelId !== channel.id) throw Error('Webhook must use the configured channel.');
  let cached = [], expires = 0, pending;
  const discord = {
    async history() {
      if (Date.now() < expires) return cached;
      if (pending) return pending;
      pending = channel.messages.fetch({limit:50}).then(messages => {
        cached = [...messages.values()].reverse().map(m => ({id:m.id,username:m.member?.displayName || m.author.username,avatar:m.author.displayAvatarURL(),text:[m.cleanContent,...m.attachments.map(a=>a.url)].filter(Boolean).join('\n'),timestamp:m.createdAt.toISOString(),banner:m.embeds.find(e=>e.image)?.image?.url || ''}));
        expires = Date.now()+4000; return cached;
      }).finally(()=>{pending=null;});
      return pending;
    },
    async send({text,username,avatar,banner}) {
      const embeds = banner ? [{image:{url:banner}}] : [];
      if (webhook) await webhook.send({content:text,username:username + ' (Flux)',...(avatar ? {avatarURL:avatar} : {}),embeds,allowedMentions:{parse:[]}});
      else await channel.send({content:'[Flux · ' + username + '] ' + text,embeds,allowedMentions:{parse:[]}});
      expires = 0;
    },
    async dm(id,payload) { return (await client.users.fetch(id)).send(payload); }
  };
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
  const server = createBridge({siteOrigin:process.env.FLUX_SITE_ORIGIN,publicUrl:process.env.BRIDGE_PUBLIC_URL,verifyToken:token=>getAuth().verifyIdToken(token,true),store,discord,ollamaUrl:process.env.OLLAMA_URL,ollamaModel:process.env.OLLAMA_MODEL});
  const port = Number(process.env.PORT || 3031);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid PORT.');
  server.listen(port,'127.0.0.1',()=>console.log('Flux community service ready on 127.0.0.1:' + port));
  const stop = () => { server.close(async ()=>{ await incoming; client.destroy(); webhook?.destroy(); await db.terminate(); process.exit(0); }); };
  process.once('SIGINT',stop); process.once('SIGTERM',stop);
}

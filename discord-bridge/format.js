'use strict';
const ROOM = 'global_general';
function toDiscord(data) {
  if (data.room !== ROOM || data.source === 'discord' || typeof data.text !== 'string' || !data.text.trim()) return null;
  const name = String(data.username || 'Gamer').replace(/[\\*_~`|>@\r\n]/g, '').slice(0, 80);
  return { content: ('[Flux] ' + name + ': ' + data.text).slice(0, 2000), allowedMentions: { parse: [] } };
}
function toFlux(message) {
  if (message.author.bot || message.webhookId) return null;
  const text = [message.cleanContent, ...Array.from(message.attachments.values(), a => a.url)].filter(Boolean).join('\n').slice(0, 8000);
  if (!text.trim()) return null;
  return {
    room: ROOM, source: 'discord', discordMessageId: message.id,
    username: '[Discord] ' + (message.member?.displayName || message.author.username).slice(0, 80),
    avatar: '', text,
    time: new Date(message.createdTimestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'
  };
}
module.exports = { ROOM, toDiscord, toFlux };

import { ChannelType, PermissionsBitField } from 'discord.js';

const P = PermissionsBitField.Flags;
const types = new Map([
  [ChannelType.GuildText, 'text'], [ChannelType.GuildAnnouncement, 'announcement'],
  [ChannelType.GuildForum, 'forum'], [ChannelType.GuildMedia, 'forum'],
  [ChannelType.GuildVoice, 'voice'], [ChannelType.GuildStageVoice, 'voice'],
  [ChannelType.PublicThread, 'thread'], [ChannelType.AnnouncementThread, 'thread'],
]);
const error = (status, message) => Object.assign(new Error(message), { status });

// Only ordinary-member channels are shared with website accounts. Bot/admin access
// alone must never cause a private staff channel or private thread to be mirrored.
export function describeChannel(channel, guild, bot) {
  const type = types.get(channel?.type);
  if (!type || channel.guildId !== guild.id) return null;
  const member = channel.permissionsFor(guild.roles.everyone);
  const worker = channel.permissionsFor(bot);
  if (!member?.has([P.ViewChannel, P.ReadMessageHistory]) || !worker?.has([P.ViewChannel, P.ReadMessageHistory])) return null;
  const thread = type === 'thread';
  const sendPermission = thread ? P.SendMessagesInThreads : P.SendMessages;
  const memberCanSend = member.has(sendPermission);
  const botCanSend = worker.has(sendPermission);
  const locked = thread && channel.locked;
  const forumNeedsTag = type === 'forum' && channel.flags?.has('RequireTag');
  const tags = type === 'forum' ? (channel.availableTags || []).filter(tag => !tag.moderated).map(tag => ({ id: tag.id, name: tag.name })) : [];
  const noUsableTag = forumNeedsTag && !tags.length;
  const category = thread ? channel.parent?.parent : channel.parent;
  return {
    id: channel.id, name: channel.name, type,
    parentId: thread ? channel.parentId : null,
    category: category?.name || '', categoryPosition: category?.rawPosition ?? -1,
    position: thread ? channel.parent?.rawPosition ?? 0 : channel.rawPosition ?? 0,
    announcement: !memberCanSend || type === 'announcement',
    readOnly: !memberCanSend || !botCanSend || Boolean(locked) || Boolean(noUsableTag),
    reason: !memberCanSend ? 'Announcements — only Discord staff can post.' : locked ? 'This conversation is locked.' : !botCanSend ? 'The bot cannot post in this channel.' : noUsableTag ? 'New posts require a staff-only tag.' : '',
    tags, requireTag: Boolean(forumNeedsTag), archived: Boolean(channel.archived),
  };
}

export function createDiscordTransport({ guild, bot, webhooks = new Map(), now = Date.now }) {
  const historyCache = new Map();
  let expires = 0, directory = [], refreshing;
  async function resolve(id) {
    if (!/^\d{15,22}$/.test(id || '')) throw error(404, 'Choose a Discord channel.');
    const channel = await guild.channels.fetch(id, { force: true }).catch(() => null);
    if (channel?.isThread()) await guild.channels.fetch(channel.parentId, { force: true });
    const info = describeChannel(channel, guild, bot);
    if (!info) throw error(404, 'This channel is unavailable.');
    return { channel, info };
  }
  async function list() {
    if (now() < expires) return directory;
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const channels = await guild.channels.fetch();
      const active = await guild.channels.fetchActiveThreads();
      const all = new Map([...channels, ...active.threads]);
      // Archived public posts remain discoverable in forum and text channels.
      // Any failed listing fails closed instead of retaining an outdated directory.
      for (const channel of channels.values()) {
        if (!channel?.threads || !describeChannel(channel, guild, bot)) continue;
        let before, hasMore;
        do {
          const page = await channel.threads.fetchArchived({ type: 'public', limit: 100, ...(before ? { before } : {}) });
          for (const [id, thread] of page.threads) all.set(id, thread);
          const oldest = [...page.threads.values()].at(-1)?.archiveTimestamp;
          hasMore = page.hasMore && oldest && oldest !== before;
          before = oldest;
        } while (hasMore);
      }
      directory = [...all.values()].map(channel => describeChannel(channel, guild, bot)).filter(Boolean)
        .sort((a, b) => a.categoryPosition - b.categoryPosition || a.position - b.position || Number(Boolean(a.parentId)) - Number(Boolean(b.parentId)) || a.name.localeCompare(b.name));
      expires = now() + 30000;
      return directory;
    })().finally(() => { refreshing = null; });
    return refreshing;
  }
  async function writable(id) {
    const result = await resolve(id);
    if (result.info.readOnly) throw error(403, result.info.reason || 'This is a read-only channel.');
    return result;
  }
  return {
    channels: list,
    async channel(id) { return (await resolve(id)).info; },
    async assertWritable(id) { return (await writable(id)).info; },
    async history(id) {
      const { channel, info } = await resolve(id);
      if (info.type === 'forum') return [];
      const cached = historyCache.get(id);
      if (cached && now() < cached.expires) return cached.messages;
      const messages = [...(await channel.messages.fetch({ limit: 50 })).values()].reverse().map(message => ({
        id: message.id, username: message.webhookId ? message.author.username : message.member?.displayName || message.author.username,
        avatar: message.author.displayAvatarURL(),
        text: [message.cleanContent, ...message.attachments.map(attachment => attachment.url)].filter(Boolean).join('\n'),
        timestamp: message.createdAt.toISOString(),
      }));
      historyCache.set(id, { expires: now() + 4000, messages });
      if (historyCache.size > 500) for (const [key, value] of historyCache) if (now() >= value.expires) historyCache.delete(key);
      return messages;
    },
    async send(id, { text, username, avatar, title, tagId }) {
      // Recheck member and bot permissions immediately before delivery, including
      // webhook delivery, which would otherwise bypass the caller's channel rules.
      const { channel, info } = await writable(id);
      const webhook = webhooks.get(info.parentId || id);
      if (info.type === 'forum') {
        if (typeof title !== 'string' || !title.trim() || title.trim().length > 100) throw error(400, 'Give your forum post a title of 1–100 characters.');
        if (tagId && !info.tags.some(tag => tag.id === tagId)) throw error(400, 'Choose an available forum tag.');
        if (info.requireTag && !tagId) throw error(400, 'Choose a tag for this post.');
        const post = await channel.threads.create({
          name: title.trim(), ...(tagId ? { appliedTags: [tagId] } : {}),
          message: { content: '[Flux · ' + username + '] ' + text, allowedMentions: { parse: [] } },
        });
        expires = 0;
        return { channelId: post.id, messageId: post.id };
      }
      const sent = webhook
        ? await webhook.send({ content: text, username: username + ' (Flux)', ...(avatar ? { avatarURL: avatar } : {}), ...(info.parentId ? { threadId: id } : {}), allowedMentions: { parse: [] } })
        : await channel.send({ content: '[Flux · ' + username + '] ' + text, allowedMentions: { parse: [] } });
      historyCache.delete(id);
      return { channelId: id, ...(sent?.id ? { messageId: sent.id } : {}) };
    },
  };
}

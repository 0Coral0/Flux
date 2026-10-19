import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChannelType, PermissionsBitField } from 'discord.js';
import { createDiscordTransport, describeChannel } from './discord-channels.mjs';
const P = PermissionsBitField.Flags;
const readable = [P.ViewChannel, P.ReadMessageHistory];
const writable = [...readable, P.SendMessages, P.SendMessagesInThreads];
const ids = ['100000000000000001', '100000000000000002', '100000000000000003'];

function fixture() {
  const ordinary = { id: 'everyone' }, bot = { id: 'bot' };
  const guild = { id: 'server', roles: { everyone: ordinary } };
  const channels = new Map(), messages = [], sends = [], webSends = [];
  const make = (id, { type = ChannelType.GuildText, member = writable, worker = writable, ...rest } = {}) => {
    const channel = {
      id, name: id, guildId: guild.id, type, rawPosition: 1,
      memberPermissions: member, botPermissions: worker,
      permissionsFor: subject => new PermissionsBitField(subject === ordinary ? channel.memberPermissions : channel.botPermissions),
      isThread: () => [ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread].includes(channel.type),
      messages: { fetch: async () => { messages.push(id); return new Map(); } },
      send: async payload => sends.push({ id, payload }), ...rest,
    };
    channels.set(id, channel); return channel;
  };
  guild.channels = {
    fetch: async id => id ? channels.get(id) : channels,
    fetchActiveThreads: async () => ({ threads: new Map([...channels].filter(([, channel]) => channel.isThread())) }),
  };
  const webhook = { send: async payload => webSends.push(payload) };
  const transport = createDiscordTransport({ guild, bot, webhooks: new Map([[ids[0], webhook]]) });
  return { guild, bot, make, transport, messages, sends, webSends };
}

test('ordinary-member permissions classify announcements while private channels and private threads stay hidden', () => {
  const h = fixture();
  const announce = h.make(ids[0], { member: readable });
  assert.equal(describeChannel(announce, h.guild, h.bot).announcement, true);
  assert.equal(describeChannel(announce, h.guild, h.bot).readOnly, true);
  const privateChannel = h.make(ids[1], { member: [] });
  assert.equal(describeChannel(privateChannel, h.guild, h.bot), null);
  const privateThread = h.make(ids[2], { type: ChannelType.PrivateThread });
  assert.equal(describeChannel(privateThread, h.guild, h.bot), null);
});

test('history access is required for ordinary members and bot access cannot expose another server', async () => {
  const h = fixture();
  h.make(ids[0], { member: [P.ViewChannel, P.SendMessages] });
  h.make(ids[1], { guildId: 'different-server' });
  await assert.rejects(h.transport.history(ids[0]), { status: 404 });
  await assert.rejects(h.transport.history(ids[1]), { status: 404 });
  await assert.rejects(h.transport.history('malformed'), { status: 404 });
  assert.equal(h.messages.length, 0);
});

test('read-only channels reject delivery even with a configured webhook', async () => {
  const h = fixture(); h.make(ids[0], { member: readable });
  await assert.rejects(h.transport.send(ids[0], { text: 'bypass', username: 'Alice' }), { status: 403 });
  assert.equal(h.webSends.length, 0); assert.equal(h.sends.length, 0);
});

test('each channel has separate history and revoked permissions invalidate cached access', async () => {
  const h = fixture(), first = h.make(ids[0]); h.make(ids[1]);
  await h.transport.history(ids[0]); await h.transport.history(ids[1]);
  await h.transport.history(ids[0]);
  assert.deepEqual(h.messages, [ids[0], ids[1]]);
  first.memberPermissions = [];
  await assert.rejects(h.transport.history(ids[0]), { status: 404 });
});

test('public-thread replies use thread permissions and the parent webhook routes to the correct thread', async () => {
  const h = fixture(), parent = h.make(ids[0], { member: readable });
  const thread = h.make(ids[1], { type: ChannelType.PublicThread, parentId: ids[0], parent, member: [...readable, P.SendMessagesInThreads] });
  assert.equal(describeChannel(thread, h.guild, h.bot).readOnly, false);
  await h.transport.send(ids[1], { text: 'reply', username: 'Alice', avatar: 'https://example.com/avatar.png', banner: 'https://example.com/banner.png' });
  assert.equal(h.webSends[0].threadId, ids[1]);
  assert.equal(h.webSends[0].avatarURL, 'https://example.com/avatar.png');
  assert.equal('embeds' in h.webSends[0], false);
  assert.deepEqual(h.webSends[0].allowedMentions, { parse: [] });
  thread.locked = true;
  await assert.rejects(h.transport.send(ids[1], { text: 'locked', username: 'Alice' }), { status: 403 });
});

test('forum posts validate titles and required tags and open the created conversation', async () => {
  const h = fixture(); let created;
  h.make(ids[0], {
    type: ChannelType.GuildForum, flags: { has: () => true },
    availableTags: [{ id: 'tag', name: 'Support' }, { id: 'staff', name: 'Staff', moderated: true }],
    threads: { create: async payload => { created = payload; return { id: ids[2] }; } },
  });
  const payload = { text: 'question', username: 'Alice', title: 'Help please', banner: 'https://example.com/banner.png' };
  await assert.rejects(h.transport.send(ids[0], payload), { status: 400 });
  await assert.rejects(h.transport.send(ids[0], { ...payload, tagId: 'staff' }), { status: 400 });
  await assert.rejects(h.transport.send(ids[0], { ...payload, title: '', tagId: 'tag' }), { status: 400 });
  assert.deepEqual(await h.transport.send(ids[0], { ...payload, tagId: 'tag' }), { channelId: ids[2], messageId: ids[2] });
  assert.equal(created.name, payload.title); assert.deepEqual(created.appliedTags, ['tag']);
  assert.equal('embeds' in created.message, false);
  assert.deepEqual(created.message.allowedMentions, { parse: [] });
});

test('channel discovery includes archived public forum posts and honors categories', async () => {
  const h = fixture(); const cursors = [];
  const parent = h.make(ids[0], { type: ChannelType.GuildForum, parent: { name: 'Chat', rawPosition: 2 } });
  const post = h.make(ids[1], { type: ChannelType.PublicThread, parentId: ids[0], parent, archived: true, archiveTimestamp: 42 });
  parent.threads = { fetchArchived: async options => { cursors.push(options.before); return { threads: new Map([[post.id, post]]), hasMore: false }; } };
  const channels = await h.transport.channels();
  assert.equal(channels.length, 2); assert.equal(channels[0].category, 'Chat');
  assert.equal(channels[1].archived, true); assert.deepEqual(cursors, [undefined]);
});

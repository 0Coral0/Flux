(() => {
  // Discord bridge integration is intentionally paused by integrations-config.js.
  if (window.FLUX_INTEGRATIONS?.discord === false) return;
  const get = id => document.getElementById(id);
  const feed = get('lounge-messages-feed'), status = get('backend-status-indicator');
  const controls = get('discord-controls'), note = get('discord-connection-note');
  const input = get('lounge-message-input'), sendButton = get('lounge-send-button');
  const list = get('discord-channel-list'), titleInput = get('discord-post-title'), tagInput = get('discord-post-tag');
  const base = () => (window.FLUX_DISCORD_BRIDGE_URL || '').replace(/\/$/, '');
  let timer, generation = 0, mode = 'public', sending = false;
  let channels = [], channelId = '', currentChannel = null, refreshingGeneration = null;
  function display(text) {
    const paragraph = document.createElement('p'); paragraph.className = 'discord-empty'; paragraph.textContent = text;
    feed.replaceChildren(paragraph);
  }
  async function request(path, body) {
    if (!base()) throw Error('Discord Chat is ready for the server connection.');
    if (!window.fluxGetToken) throw Error('Sign in from Profile first.');
    const token = await window.fluxGetToken();
    const response = await fetch(base() + path, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000),
    });
    const data = await response.json(); if (!response.ok) throw Error(data.error || 'Discord unavailable.'); return data;
  }
  function composer(enabled) { input.disabled = sendButton.disabled = !enabled; }
  function selectChannel(id) {
    const channel = channels.find(item => item.id === id); if (!channel) return;
    channelId = id;
    if (window.switchChatRoom) window.switchChatRoom('discord', null, channel.name);
    else window.fluxDiscord.start('public');
  }
  function renderChannelList() {
    list.replaceChildren();
    if (!channels.length) { list.textContent = 'No member-visible channels available.'; return; }
    let category;
    for (const parent of channels.filter(channel => !channel.parentId)) {
      if (category !== parent.category) {
        category = parent.category;
        const label = document.createElement('div'); label.className = 'discord-category'; label.textContent = category || 'Discord'; list.append(label);
      }
      for (const channel of [parent, ...channels.filter(item => item.parentId === parent.id)]) {
        const active = mode === 'public' && !controls.hidden && channelId === channel.id;
        const button = document.createElement('button'); button.type = 'button';
        button.className = 'lounge-nav-btn discord-channel' + (channel.parentId ? ' discord-thread' : '') + (active ? ' active' : '');
        const icon = channel.announcement ? '📣 ' : channel.type === 'forum' ? '▤ ' : channel.parentId ? '↳ ' : channel.type === 'voice' ? '🔊 ' : '# ';
        button.textContent = icon + channel.name; button.title = channel.name + (channel.readOnly ? ' — read only' : '');
        button.setAttribute('aria-label', channel.name + (channel.announcement ? ' announcements' : channel.type === 'forum' ? ' forum' : '') + (channel.readOnly ? ', read only' : ''));
        button.setAttribute('aria-pressed', String(active)); button.onclick = () => selectChannel(channel.id); list.append(button);
      }
    }
  }
  async function loadChannels(id = generation) {
    if (!base()) { list.textContent = 'Connect Discord to load channels.'; return []; }
    try {
      const data = await request('/api/chat/channels'); if (id !== generation) return [];
      channels = data.channels; renderChannelList(); return channels;
    } catch (error) {
      if (id === generation) { channels = []; list.textContent = error.message; } throw error;
    }
  }
  function channelDetails(channel) {
    currentChannel = channel; const forum = channel.type === 'forum';
    get('current-chat-title').textContent = channel.name;
    input.placeholder = channel.readOnly ? 'Read-only announcements' : forum ? 'Write the first message for your post…' : 'Message #' + channel.name + '…';
    titleInput.hidden = !forum; tagInput.hidden = !forum || !channel.tags?.length; titleInput.required = forum;
    const previousTag = tagInput.value; tagInput.replaceChildren();
    const blank = document.createElement('option'); blank.value = ''; blank.textContent = channel.requireTag ? 'Choose a tag (required)' : 'No tag'; tagInput.append(blank);
    for (const tag of channel.tags || []) {
      const option = document.createElement('option'); option.value = tag.id; option.textContent = tag.name; tagInput.append(option);
    }
    if (channel.tags?.some(tag => tag.id === previousTag)) tagInput.value = previousTag;
    sendButton.textContent = forum ? 'Create post' : 'Send';
    note.textContent = channel.reason || (forum ? 'Open a post below or start a new one.' : 'Messages are shared with #' + channel.name + ' on Discord.');
    composer(!channel.readOnly); renderChannelList();
  }
  function renderForum() {
    const posts = channels.filter(channel => channel.parentId === channelId);
    if (!posts.length) return display('No posts yet.');
    feed.replaceChildren();
    for (const post of posts) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'discord-forum-post';
      const name = document.createElement('strong'); name.textContent = post.name;
      const detail = document.createElement('span'); detail.textContent = post.readOnly ? 'Read only' : post.archived ? 'Archived · open conversation' : 'Open conversation';
      button.append(name, detail); button.onclick = () => selectChannel(post.id); feed.append(button);
    }
  }
  function render(messages) {
    if (!messages.length) return display(currentChannel?.readOnly ? 'No announcements yet.' : 'No messages yet. Say hello!');
    const scroll = !feed.children.length || feed.scrollHeight - feed.scrollTop - feed.clientHeight < 100;
    feed.replaceChildren();
    for (const message of messages) {
      const row = document.createElement('div'); row.className = 'chat-message-row';
      const avatar = document.createElement('button'); avatar.className = 'msg-user-avatar';
      if (/^https:\/\//i.test(message.avatar || '')) {
        const image = document.createElement('img'); image.src = message.avatar; image.alt = ''; image.referrerPolicy = 'no-referrer'; avatar.append(image);
      } else avatar.textContent = (message.username || 'D').slice(0, 1);
      const detail = document.createElement('div'); detail.className = 'msg-details';
      const heading = document.createElement('div'); heading.className = 'msg-header-line';
      const author = document.createElement('button'); author.className = 'msg-author-name'; author.textContent = message.username;
      const publicProfile = { ...message.profile, username: message.username, avatar: message.avatar };
      window.fluxProfiles?.bind(avatar, publicProfile); window.fluxProfiles?.bind(author, publicProfile);
      const time = document.createElement('time'); time.className = 'msg-time-stamp';
      const date = new Date(message.timestamp); time.textContent = Number.isNaN(+date) ? '' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const body = document.createElement('p'); body.className = 'msg-body-text'; body.textContent = message.text;
      heading.append(author, time); detail.append(heading, body);
      row.append(avatar, detail); feed.append(row);
    }
    if (scroll) feed.scrollTop = feed.scrollHeight;
  }
  async function refresh(id) {
    if (refreshingGeneration === id) return; refreshingGeneration = id;
    try {
      if (mode === 'public') {
        await loadChannels(id); if (generation !== id) return;
        if (!channels.some(channel => channel.id === channelId)) channelId = channels.find(channel => !channel.parentId)?.id || '';
        if (!channelId) { currentChannel = null; composer(false); display('No member-visible channels available.'); return; }
      }
      const data = await request('/api/chat/messages?mode=' + mode + (mode === 'public' ? '&channel=' + encodeURIComponent(channelId) : ''));
      if (generation !== id) return; status.textContent = 'Connected to Discord';
      if (mode === 'public') {
        channelDetails(data.channel); if (currentChannel.type === 'forum') renderForum(); else render(data.messages);
      } else {
        render(data.messages); composer(Boolean(data.contact));
        if (data.contact) delete note.dataset.invite;
        get('discord-pair').disabled = Boolean(data.contact);
        if (!note.dataset.invite) note.textContent = data.contact ? 'Private conversation with ' + data.contact : 'Invite a contact, then ask them to accept in the bot’s DMs.';
      }
    } catch (error) {
      if (generation === id) { status.textContent = error.message; display(error.message); composer(false); }
    } finally { if (refreshingGeneration === id) refreshingGeneration = null; }
  }
  get('discord-pair').onclick = async () => {
    const id = generation;
    try {
      const data = await request('/api/chat/invite', {}); if (id !== generation) return;
      note.dataset.invite = '1'; note.textContent = 'Share this privately with your contact. DM the bot: !flux ' + data.code + ' (expires in 10 minutes)';
    } catch (error) { if (id === generation) note.textContent = error.message; }
  };
  get('discord-unlink').onclick = async () => {
    const id = generation;
    try {
      await request('/api/chat/unlink', {}); if (id !== generation) return;
      delete note.dataset.invite; note.textContent = 'Contact disconnected.'; composer(false); refresh(id);
    } catch (error) { if (id === generation) note.textContent = error.message; }
  };
  window.fluxDiscord = {
    loadChannels: () => loadChannels().catch(() => {}), selectChannel,
    start(nextMode = 'public') {
      this.stop(); mode = nextMode; controls.hidden = false; currentChannel = null;
      get('discord-pair').hidden = get('discord-unlink').hidden = mode !== 'dm';
      get('discord-pair').disabled = get('discord-unlink').disabled = !base(); composer(false);
      note.textContent = mode === 'public' ? 'Loading Discord channels…' : 'Private Discord conversation'; input.maxLength = 1800;
      if (!base()) { status.textContent = 'Setup needed'; display('Discord Chat is ready for the server connection.'); this.loadChannels(); return; }
      const id = generation; refresh(id); timer = setInterval(() => refresh(id), 8000);
      if (mode === 'dm') this.loadChannels();
    },
    stop() {
      generation++; clearInterval(timer); timer = null; controls.hidden = true;
      delete note.dataset.invite; note.textContent = ''; titleInput.hidden = tagInput.hidden = true;
      sendButton.textContent = 'Send'; input.placeholder = 'Type a message…'; input.maxLength = 524288; composer(true);
    },
    async send(text, profile) {
      if (!base() || sending) return;
      if (mode === 'public' && (!currentChannel || currentChannel.readOnly)) { status.textContent = currentChannel?.reason || 'Choose a writable channel first.'; return; }
      const title = titleInput.value.trim();
      if (currentChannel?.type === 'forum' && !title) { status.textContent = 'Give your forum post a title.'; titleInput.focus(); return; }
      sending = true; const id = generation;
      const path = '/api/chat/messages?mode=' + mode + (mode === 'public' ? '&channel=' + encodeURIComponent(channelId) : '');
      try {
        const result = await request(path, { text, username: profile.name, avatar: profile.avatar, profile: { status: profile.status, pronouns: profile.pronouns, bio: profile.bio, color: profile.color }, ...(currentChannel?.type === 'forum' ? { title, tagId: tagInput.value } : {}) });
        if (id === generation) {
          if (input.value.trim() === text) input.value = ''; titleInput.value = '';
          if (result.channelId) channelId = result.channelId; await refresh(id);
        }
      } catch (error) { if (id === generation) status.textContent = error.message; }
      finally { sending = false; }
    },
  };
  window.addEventListener('flux-auth-changed', () => {
    channels = []; channelId = ''; currentChannel = null; list.replaceChildren();
    if (!controls.hidden) { feed.replaceChildren(); window.fluxDiscord.start(mode); }
    else { generation++; delete note.dataset.invite; note.textContent = ''; window.fluxDiscord.loadChannels(); }
  });
})();

(() => {
  const feed = document.getElementById('lounge-messages-feed');
  const status = document.getElementById('backend-status-indicator');
  const controls = document.getElementById('discord-controls');
  const note = document.getElementById('discord-connection-note');
  let timer, generation = 0, mode = 'public', sending = false;
  const base = () => (window.FLUX_DISCORD_BRIDGE_URL || '').replace(/\/$/, '');
  const display = text => { const p = document.createElement('p'); p.className = 'discord-empty'; p.textContent = text; feed.replaceChildren(p); };
  async function request(path, body) {
    if (!window.fluxGetToken) throw Error('Sign in from Profile first.');
    const token = await window.fluxGetToken();
    const response = await fetch(base() + path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token, ...(body ? {'Content-Type':'application/json'} : {}) }, ...(body ? {body:JSON.stringify(body)} : {}), signal: AbortSignal.timeout(20000) });
    const data = await response.json(); if (!response.ok) throw Error(data.error || 'Discord unavailable.'); return data;
  }
  function render(messages) {
    if (!messages.length) return display('No messages yet. Say hello!');
    const scroll = !feed.children.length || feed.scrollHeight - feed.scrollTop - feed.clientHeight < 100;
    feed.replaceChildren();
    for (const m of messages) {
      const row = document.createElement('div'); row.className = 'chat-message-row';
      const avatar = document.createElement('div'); avatar.className = 'msg-user-avatar';
      if (/^https:\/\//i.test(m.avatar || '')) { const image = document.createElement('img'); image.src = m.avatar; image.alt = ''; image.referrerPolicy = 'no-referrer'; avatar.append(image); }
      else avatar.textContent = (m.username || 'D').slice(0,1);
      const detail = document.createElement('div'); detail.className = 'msg-details';
      const heading = document.createElement('div'); heading.className = 'msg-header-line';
      const author = document.createElement('span'); author.className = 'msg-author-name'; author.textContent = m.username;
      const time = document.createElement('time'); time.className = 'msg-time-stamp';
      const date = new Date(m.timestamp); time.textContent = Number.isNaN(+date) ? '' : date.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
      const body = document.createElement('p'); body.className = 'msg-body-text'; body.textContent = m.text;
      heading.append(author,time); detail.append(heading,body);
      if (/^https:\/\//i.test(m.banner || '')) { const banner = document.createElement('img'); banner.src = m.banner; banner.alt = 'Profile banner'; banner.className = 'chat-profile-banner'; detail.append(banner); }
      row.append(avatar,detail); feed.append(row);
    }
    if (scroll) feed.scrollTop = feed.scrollHeight;
  }
  async function refresh(id) {
    try {
      const data = await request('/api/chat/messages?mode=' + mode);
      if (generation !== id) return;
      render(data.messages); status.textContent = 'Connected to Discord';
      if (mode === 'dm' && !note.dataset.invite) note.textContent = data.contact ? 'Private conversation with ' + data.contact : 'Invite a contact, then ask them to accept in the bot’s DMs.';
    } catch (error) { if (generation === id) { status.textContent = error.message; display(error.message); } }
  }
  document.getElementById('discord-pair').onclick = async () => {
    try { const data = await request('/api/chat/invite', {}); note.dataset.invite = '1'; note.textContent = 'Share this privately with your contact. DM the bot: !flux ' + data.code + ' (expires in 10 minutes)'; }
    catch (error) { note.textContent = error.message; }
  };
  document.getElementById('discord-unlink').onclick = async () => {
    try { await request('/api/chat/unlink', {}); delete note.dataset.invite; note.textContent = 'Contact disconnected.'; refresh(generation); }
    catch(error) { note.textContent = error.message; }
  };
  window.fluxDiscord = {
    start(nextMode = 'public') {
      this.stop(); mode = nextMode; controls.hidden = false; delete note.dataset.invite;
      document.getElementById('discord-pair').hidden = mode !== 'dm';
      document.getElementById('discord-unlink').hidden = mode !== 'dm';
      note.textContent = mode === 'public' ? 'Messages are shared with the connected Discord channel.' : 'Private Discord conversation';
      if (!base()) { status.textContent = 'Setup needed'; display('Discord Chat is ready for the server connection.'); return; }
      const id = generation; refresh(id); timer = setInterval(() => refresh(id), 8000);
    },
    stop() { generation++; clearInterval(timer); timer = null; controls.hidden = true; },
    async send(text, profile) {
      if (!base() || sending) return;
      sending = true; const id = generation; const currentMode = mode;
      try {
        await request('/api/chat/messages?mode=' + currentMode, {text,username:profile.name,avatar:profile.avatar,banner:profile.banner});
        if (id === generation) { const input = document.getElementById('lounge-message-input'); if (input.value.trim() === text) input.value = ''; await refresh(id); }
      } catch(error) { if (id === generation) status.textContent = error.message; }
      finally { sending = false; }
    }
  };
  window.addEventListener('flux-auth-changed', () => { if (timer) { feed.replaceChildren(); refresh(++generation); clearInterval(timer); const id = generation; timer = setInterval(() => refresh(id),8000); } });
})();

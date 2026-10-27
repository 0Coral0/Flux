(() => {
  const byId = id => document.getElementById(id);
  let state = null;
  let dialogOpener = null;
  const self = () => state?.me?.uid || '';
  const status = message => { const node = byId('chat-social-status'); if (node) node.textContent = message || ''; };
  const api = (...args) => {
    if (!window.fluxData?.chat) throw new Error('Chat is still loading.');
    return window.fluxData.chat(...args);
  };
  const friendRows = () => [...(state?.incoming || []), ...(state?.outgoing || [])]
    .filter(row => row.status === 'accepted')
    .map(row => ({ id: row.id, uid: row.from === self() ? row.to : row.from, name: row.from === self() ? row.toName : row.fromName }));
  const titleForRoom = room => room.type === 'group' ? room.name : Object.entries(room.names || {}).find(([uid]) => uid !== self())?.[1] || 'Direct message';

  function row(label, detail, actions = []) {
    const item = document.createElement('div'); item.className = 'chat-social-row';
    const text = document.createElement('span'); text.textContent = label;
    if (detail) { const small = document.createElement('small'); small.textContent = detail; text.append(small); }
    item.append(text);
    const validActions = Array.isArray(actions) ? actions.filter(Boolean) : [];
    if (validActions.length) {
      const controls = document.createElement('div'); controls.className = 'chat-social-actions';
      validActions.forEach(({ label: actionLabel, onClick, outline = true }) => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'action-btn' + (outline ? ' btn-outline' : ''); button.textContent = actionLabel; button.onclick = onClick; controls.append(button);
      });
      item.append(controls);
    }
    return item;
  }

  function openRoom(room) {
    if (!room?.id) return;
    window.openFluxChatRoom?.(room.id, titleForRoom(room));
    if (dialog.open) dialog.close();
  }

  function render() {
    const friends = byId('chat-social-friends'); const groups = byId('chat-social-groups'); const requests = byId('chat-social-requests');
    friends.replaceChildren(); groups.replaceChildren(); requests.replaceChildren();
    const dmByUser = new Map((state?.rooms || []).filter(room => room.type === 'dm').map(room => [Object.keys(room.names || {}).find(uid => uid !== self()), room]));
    const approved = friendRows();
    const incoming = (state?.incoming || []).filter(request => request.status === 'pending');
    const outgoing = (state?.outgoing || []).filter(request => request.status === 'pending');
    if (!incoming.length && !outgoing.length) requests.append(row('No pending requests', 'Requests from other people will appear here.'));
    incoming.forEach(request => requests.append(row('@' + request.fromName, 'Wants to be friends', [
      { label: 'Accept', outline: false, onClick: async () => {
        try { await api('/friends/' + encodeURIComponent(request.id), { method: 'PUT' }); await refresh(); status('You are now friends with @' + request.fromName + '.'); }
        catch (error) { status(error.message); }
      } },
      { label: 'Decline', onClick: async () => {
        try { await api('/friends/' + encodeURIComponent(request.id), { method: 'DELETE' }); await refresh(); status('Friend request declined.'); }
        catch (error) { status(error.message); }
      } }
    ])));
    outgoing.forEach(request => requests.append(row('@' + request.toName, 'Request sent', [
      { label: 'Cancel', onClick: async () => {
        try { await api('/friends/' + encodeURIComponent(request.id), { method: 'DELETE' }); await refresh(); status('Friend request cancelled.'); }
        catch (error) { status(error.message); }
      } }
    ])));
    if (!approved.length) friends.append(row('No friends yet', 'Add someone using their exact @username.'));
    approved.forEach(friend => friends.append(row('@' + friend.name, 'Friend', [{ label: dmByUser.get(friend.uid) ? 'Message' : 'Start DM', onClick: async () => {
      try {
        let room = dmByUser.get(friend.uid);
        if (!room) room = (await api('/rooms', { method: 'POST', body: { type: 'dm', members: [friend.uid] } })).room;
        await refresh(); openRoom(room);
      } catch (error) { status(error.message); }
    } }] )));
    const roomList = (state?.rooms || []).filter(room => room.type === 'group');
    if (!roomList.length) groups.append(row('No group chats yet', 'Create one with people you have already friended.'));
    roomList.forEach(room => groups.append(row(room.name, (room.members?.length || 1) + ' members', [{ label: 'Open', onClick: () => openRoom(room) }])));
    const chosen = byId('chat-group-members'); chosen.replaceChildren();
    approved.forEach(friend => { const label = document.createElement('label'); const box = document.createElement('input'); box.type = 'checkbox'; box.value = friend.uid; label.append(box, document.createTextNode('@' + friend.name)); chosen.append(label); });
  }

  async function refresh() {
    state = await api('/me'); render(); return state;
  }

  async function friendUser(profile) {
    if (!profile?.uid || profile.uid === self()) return;
    const result = await api('/friends', { method: 'POST', body: { uid: profile.uid } });
    await refresh();
    const name = profile.username || 'that user';
    if (result.status === 'accepted') status('You are now friends with @' + name + '.');
    else if (result.existing) status('A friend request with @' + name + ' is already pending.');
    else status('Friend request sent to @' + name + '.');
    return result;
  }

  const dialog = byId('chat-social-dialog');
  function openDialog(trigger) {
    dialogOpener = trigger || document.activeElement;
    status('');
    if (!dialog.open) dialog.showModal();
    refresh().catch(error => status(error.message));
  }

  function addHeaderButton() {
    const header = document.querySelector('.lounge-header-bar');
    if (!header || header.querySelector('.chat-social-toggle')) return;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'action-btn btn-outline chat-social-toggle';
    button.innerHTML = '<i class="fa-solid fa-user-group" aria-hidden="true"></i> Chats'; button.onclick = () => openDialog(button); header.append(button);
  }

  byId('chat-social-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { if (dialogOpener?.isConnected) dialogOpener.focus(); });
  byId('chat-refresh-social').onclick = () => refresh().then(() => status('Updated.')).catch(error => status(error.message));
  byId('chat-friend-form').addEventListener('submit', async event => {
    event.preventDefault(); const field = byId('chat-friend-username'); const username = field.value.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return status('Use a valid @username.');
    try { const data = await api('/users?name=' + encodeURIComponent(username)); const user = data.users?.[0]; if (!user) throw new Error('No Flux user has that username yet.'); await friendUser({ uid: user.uid, username: user.name }); field.value = ''; }
    catch (error) { status(error.message); }
  });
  byId('chat-new-group').onclick = () => { byId('chat-group-create').hidden = false; byId('chat-group-name').focus(); };
  byId('chat-create-group').onclick = async () => {
    const name = byId('chat-group-name').value.trim(); const members = [...byId('chat-group-members').querySelectorAll('input:checked')].map(box => box.value);
    if (!name) return status('Give the group a name.'); if (!members.length) return status('Choose at least one friend.');
    try { const result = await api('/rooms', { method: 'POST', body: { type: 'group', name, members } }); await refresh(); byId('chat-group-create').hidden = true; byId('chat-group-name').value = ''; openRoom(result.room); }
    catch (error) { status(error.message); }
  };
  window.fluxChatSocial = { friendUser, openDialog, refresh };
  window.addEventListener('flux-auth-changed', () => setTimeout(() => { addHeaderButton(); if (dialog.open) refresh().catch(() => {}); }, 0));
  window.addEventListener('load', addHeaderButton);
})();

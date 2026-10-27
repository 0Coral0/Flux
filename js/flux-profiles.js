(() => {
  const dialog = document.getElementById('member-profile-dialog');
  let opener;
  const text = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
  const imageAllowed = value => /^https?:\/\//i.test(value) || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
  function open(profile, trigger) {
    opener = trigger;
    const name = text(profile.username || profile.name, 80) || 'Gamer';
    document.getElementById('member-profile-name').textContent = name;
    const avatar = document.getElementById('member-profile-avatar');
    avatar.replaceChildren();
    const url = text(profile.avatar, 500000);
    if (imageAllowed(url)) {
      const image = document.createElement('img'); image.src = url; image.alt = ''; image.referrerPolicy = 'no-referrer'; avatar.append(image);
    } else avatar.textContent = name.slice(0, 1);
    for (const [key, max] of [['pronouns', 32], ['status', 80], ['bio', 180]]) {
      const element = document.getElementById('member-profile-' + key);
      element.textContent = text(profile[key], max); element.hidden = !element.textContent;
    }
    dialog.style.setProperty('--profile-accent', /^#[a-f0-9]{6}$/i.test(profile.color || '') ? profile.color : '#22c55e');
    dialog.style.setProperty('--member-banner', profile.banner ? `url("${text(profile.banner, 30000).replace(/["\\]/g, '\\$&')}")` : '');
    document.getElementById('member-profile-note').textContent = profile.bio || profile.status || profile.pronouns
      ? 'Profile details shared with this message.' : 'This person has shared their name and profile picture.';
    const actions = document.getElementById('member-profile-actions'); actions.replaceChildren();
    if (profile.uid && profile.uid !== window.fluxAuthState?.uid) {
      const add = document.createElement('button'); add.type = 'button'; add.className = 'action-btn';
      add.innerHTML = '<i class="fa-solid fa-user-plus" aria-hidden="true"></i> Add friend';
      add.onclick = async () => {
        add.disabled = true;
        try { await window.fluxChatSocial?.friendUser(profile); add.textContent = 'Friend request sent'; }
        catch (_) { add.disabled = false; }
      };
      actions.append(add);
    }
    if (!dialog.open) dialog.showModal();
  }
  document.getElementById('member-profile-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { if (opener?.isConnected) opener.focus(); });
  window.fluxProfiles = {
    bind(element, profile) {
      element.type = 'button'; element.classList.add('profile-trigger');
      element.setAttribute('aria-label', 'View ' + (text(profile.username || profile.name, 80) || 'Gamer') + '’s profile');
      element.setAttribute('aria-haspopup', 'dialog'); element.onclick = () => open(profile, element);
    },
  };
})();

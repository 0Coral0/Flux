(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.document) root.fluxDashboard = api.create(root);
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const idOf = game => game && (game.file || game.url || game.link);
  const catalogId = game => String(idOf(game) || '').replace(/\\/g, '/');
  const statDocumentId = id => 'game_' + encodeURIComponent(String(id || '').replace(/\\/g, '/')).replace(/%/g, '_');
  const recentGames = games => (Array.isArray(games) ? games : []).filter(game => game && game.name && idOf(game)).slice(-5).reverse();
  const newGames = (games, baseline) => {
    const previous = new Set((Array.isArray(baseline) ? baseline : []).map(id => String(id || '').replace(/\\/g, '/')));
    return (Array.isArray(games) ? games : []).filter(game => catalogId(game) && !previous.has(catalogId(game)));
  };
  function popularGames(games, counts) {
    const catalog = new Map((Array.isArray(games) ? games : []).map(game => [catalogId(game), game]));
    const seen = new Set();
    return (Array.isArray(counts) ? counts : []).filter(item => {
      const id = String(item?.id || '').replace(/\\/g, '/');
      if (!item || !catalog.has(id) || seen.has(id) || !Number.isSafeInteger(item.plays) || item.plays <= 0) return false;
      seen.add(id); return true;
    }).sort((a, b) => b.plays - a.plays).slice(0, 5).map(item => ({ game: catalog.get(String(item.id || '').replace(/\\/g, '/')), plays: item.plays }));
  }
  function loginLabel(state, profile) {
    if (state?.status === 'signed-in') return 'Logged in as: ' + ((profile && typeof profile.name === 'string' && profile.name.trim()) || state.name || 'Gamer');
    if (state?.status === 'signed-out') return 'Not signed in';
    if (state?.status === 'unavailable') return 'Accounts unavailable';
    return 'Checking account…';
  }
  function create(win) {
    const document = win.document;
    let games = [], openGame, getProfileData, hotRequest = null, hotUnsubscribe = null;
    let hotIds = new Set(), newIds = new Set();
    const lastRecorded = new Map();
    const el = id => document.getElementById(id);
    function bridgeUrl() { return String(win.FLUX_DISCORD_BRIDGE_URL || '').replace(/\/+$/, ''); }
    function updateLogin() {
      let profile = {};
      try { profile = getProfileData ? getProfileData() : {}; } catch (_) { /* profile is optional */ }
      const target = el('home-login-status');
      if (target) target.textContent = loginLabel(win.fluxAuthState, profile);
    }
    function imageFor(game) {
      const image = document.createElement('img');
      image.src = game.thumb || 'Fluxlogo.svg'; image.alt = ''; image.loading = 'lazy';
      image.addEventListener('error', () => { image.src = 'Fluxlogo.svg'; }, { once: true });
      return image;
    }
    function makeCard(game, label) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'home-game-card';
      button.setAttribute('aria-label', 'Play ' + game.name);
      button.addEventListener('click', () => openGame(idOf(game), game.name, game.description));
      const artwork = document.createElement('span'); artwork.className = 'home-game-art';
      const badge = document.createElement('span'); badge.className = 'home-game-badge'; badge.textContent = label;
      artwork.append(imageFor(game), badge);
      const title = document.createElement('span'); title.className = 'home-game-title'; title.textContent = game.name;
      button.append(artwork, title); return button;
    }
    function empty(target, text) {
      const message = document.createElement('p'); message.className = 'home-empty'; message.textContent = text;
      target.replaceChildren(message);
    }
    async function firebaseDb() {
      if (win.fluxFirebaseDb) return win.fluxFirebaseDb;
      if (win.fluxFirebaseReady && typeof win.fluxFirebaseReady.then === 'function') return win.fluxFirebaseReady;
      return null;
    }
    function renderRecent() {
      const target = el('home-recent-games'); if (!target) return;
      const items = recentGames(games);
      if (!items.length) return empty(target, 'New games will appear here.');
      target.replaceChildren(...items.map(game => makeCard(game, 'NEW')));
    }
    function renderQuickResume() {
      const target = el('quick-resume-container'); if (!target) return;
      let last; try { last = JSON.parse(win.localStorage.getItem('flux_last_played') || 'null'); } catch (_) { last = null; }
      const game = last && games.find(item => idOf(item) === last.url && item.name === last.name);
      if (!game) { target.replaceChildren(); return; }
      const card = document.createElement('div'); card.className = 'home-resume-toast';
      const play = document.createElement('button'); play.type = 'button'; play.className = 'home-resume-play';
      play.setAttribute('aria-label', 'Resume ' + game.name);
      play.addEventListener('click', () => openGame(idOf(game), game.name, game.description));
      const info = document.createElement('span'); info.className = 'home-resume-info';
      const caption = document.createElement('span'); caption.className = 'home-resume-caption'; caption.textContent = 'QUICK RESUME';
      const name = document.createElement('strong'); name.textContent = game.name;
      info.append(caption, name); play.append(imageFor(game), info);
      const dismiss = document.createElement('button'); dismiss.type = 'button'; dismiss.className = 'home-resume-dismiss';
      dismiss.setAttribute('aria-label', 'Dismiss quick resume'); dismiss.textContent = '×';
      dismiss.addEventListener('click', () => target.replaceChildren());
      card.append(play, dismiss); target.replaceChildren(card);
    }
    async function loadHot(force = false) {
      const target = el('home-hot-games'); if (!target) return;
      if (win.location && win.location.protocol === 'file:') return empty(target, 'Open Flux at http://127.0.0.1:3031/ to connect community plays.');
      if (hotRequest) return hotRequest;
      if (hotUnsubscribe && !force) return;
      hotRequest = (async () => {
        try {
          const db = await firebaseDb();
          if (!db) return empty(target, 'Community play counts are not connected yet.');
          const { collection, query, orderBy, limit, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
          if (hotUnsubscribe) hotUnsubscribe();
          hotUnsubscribe = onSnapshot(query(collection(db, 'game_statistics'), orderBy('plays', 'desc'), limit(20)), snapshot => {
            const items = popularGames(games, snapshot.docs.map(entry => entry.data()));
            hotIds = new Set(items.map(item => catalogId(item.game)));
            if (!items.length) empty(target, 'No community plays yet. Be the first to play!');
            else target.replaceChildren(...items.map(item => makeCard(item.game, item.plays.toLocaleString() + (item.plays === 1 ? ' PLAY' : ' PLAYS'))));
            win.refreshArchives?.();
          }, () => empty(target, 'Community play counts are temporarily unavailable.'));
        } catch (_) { empty(target, 'Community play counts are temporarily unavailable.'); }
        finally { hotRequest = null; }
      })();
      return hotRequest;
    }
    function recordPlay(id) {
      const gameId = String(id || '').replace(/\\/g, '/');
      if (!games.some(game => catalogId(game) === gameId)) return;
      const now = Date.now();
      if (now - (lastRecorded.get(gameId) || 0) < 30000) return;
      lastRecorded.set(gameId, now);
      (async () => {
        const db = await firebaseDb();
        if (!db) return;
        const { doc, runTransaction, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        const stats = doc(db, 'game_statistics', statDocumentId(gameId));
        await runTransaction(db, async transaction => {
          const previous = await transaction.get(stats);
          if (!previous.exists()) return transaction.set(stats, { id: gameId, plays: 1, updatedAt: serverTimestamp() });
          const data = previous.data();
          if (data.id !== gameId || !Number.isSafeInteger(data.plays) || data.plays < 0) throw Error('Invalid game statistic');
          return transaction.update(stats, { plays: data.plays + 1, updatedAt: serverTimestamp() });
        });
      })().catch(() => {});
    }
    function start(options) {
      games = Array.isArray(options.games) ? options.games : [];
      newIds = new Set(newGames(games, win.fluxGameCatalogBaseline).map(catalogId));
      openGame = options.openGame; getProfileData = options.getProfileData;
      const count = el('stat-count'); if (count) count.textContent = String(games.length);
      renderRecent(); renderQuickResume(); updateLogin();
      win.addEventListener('flux-auth-changed', updateLogin);
      win.addEventListener('flux-profile-changed', updateLogin);
      win.addEventListener('load', () => loadHot());
    }
    function badgeForGame(game) {
      const id = catalogId(game);
      return hotIds.has(id) ? 'HOT' : newIds.has(id) ? 'NEW' : '';
    }
    return { start, loadHot, recordPlay, renderQuickResume, badgeForGame };
  }
  return { create, recentGames, newGames, popularGames, loginLabel, statDocumentId };
});

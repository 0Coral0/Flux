(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FluxGameLinks = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const pathOf = game => String(game?.file || game?.url || game?.link || '').replaceAll('\\', '/');
  const slug = name => String(name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 86).replace(/-$/, '') || 'game';
  const hash = value => { let result = 2166136261; for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619); return (result >>> 0).toString(36); };
  function catalog(games) {
    const valid = (Array.isArray(games) ? games : []).filter(game => game?.name && pathOf(game));
    const counts = new Map(); valid.forEach(game => counts.set(slug(game.name), (counts.get(slug(game.name)) || 0) + 1));
    return valid.map(game => ({ id: slug(game.name) + (counts.get(slug(game.name)) > 1 ? '-' + hash(pathOf(game)) : ''), game }));
  }
  function resolve(games, value) { return catalog(games).find(entry => entry.id === value)?.game || null; }
  function build(base, games, game) {
    const entry = catalog(games).find(entry => pathOf(entry.game) === pathOf(game));
    if (!entry) return null;
    const url = new URL(base); url.search = ''; url.hash = ''; url.searchParams.set('game', entry.id); return url.href;
  }
  function create(win, options) {
    const doc = win.document, games = options.games, entries = catalog(games);
    const initialId = new URL(win.location.href).searchParams.get('game');
    const initialGame = resolve(games, initialId); let current = null, observer = null;
    const el = id => doc.getElementById(id);
    function onOpen(value) {
      current = entries.find(entry => pathOf(entry.game) === pathOf(value)) || null;
      el('theater-share').hidden = !current; el('theater-reviews').hidden = !current;
      if (!current) return;
      const url = build(win.location.href, games, current.game);
      win.history.replaceState(win.history.state, '', url);
      el('game-share-title').textContent = current.game.name;
      el('game-share-url').value = url;
      win.fluxReviews?.setGame(current);
    }
    function onClose() {
      current = null;
      const url = new URL(win.location.href); url.searchParams.delete('game');
      win.history.replaceState(win.history.state, '', url.href);
      el('game-share-dialog')?.close(); win.fluxReviews?.close();
      win.dispatchEvent(new win.Event('flux-player-closed'));
    }
    function start() {
      el('theater-share').addEventListener('click', () => { if (current) { el('game-share-status').textContent = ''; el('game-share-dialog').showModal(); } });
      el('game-share-close').addEventListener('click', () => el('game-share-dialog').close());
      el('game-share-copy').addEventListener('click', async () => {
        try { await win.navigator.clipboard.writeText(el('game-share-url').value); el('game-share-status').textContent = 'Link copied. Anyone with it can open this game.'; }
        catch (_) { el('game-share-url').focus(); el('game-share-url').select(); el('game-share-status').textContent = 'Select and copy the link above.'; }
      });
      function launch() {
        if (!initialGame) return;
        const loader = el('loader-overlay');
        if (loader && win.getComputedStyle(loader).display !== 'none') {
          if (!observer) { observer = new win.MutationObserver(launch); observer.observe(loader, { attributes: true, attributeFilter: ['style'] }); }
          return;
        }
        observer?.disconnect();
        win.showPage('archives'); options.openGame(pathOf(initialGame), initialGame.name, initialGame.description);
      }
      if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', launch, { once: true }); else launch();
    }
    return { start, onOpen, onClose, hasInitialGame: () => !!initialGame, current: () => current };
  }
  return { slug, pathOf, catalog, resolve, build, create };
});

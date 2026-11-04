(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FluxGames = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const url = game => String(game?.file || game?.url || game?.link || '').replaceAll('\\', '/');
  const valid = game => game && typeof game.name === 'string' && game.name.trim() && url(game);
  const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
  const alphabetical = games => (Array.isArray(games) ? games : []).filter(valid).slice().sort((a, b) => collator.compare(a.name, b.name));
  function recommendations(games, current = {}, count = 6, random = Math.random) {
    const seen = new Set(), currentUrl = url(current);
    const candidates = (Array.isArray(games) ? games : []).filter(game => {
      const id = url(game);
      if (!valid(game) || id === currentUrl || game.name === current.name || seen.has(id)) return false;
      seen.add(id); return true;
    });
    for (let index = candidates.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [candidates[index], candidates[other]] = [candidates[other], candidates[index]];
    }
    return candidates.slice(0, count);
  }
  function renderRecommendations(document, games, current, openGame) {
    const grid = document.getElementById('recommended-grid'); if (!grid) return;
    const cards = recommendations(games, current).map(game => {
      const card = document.createElement('button'); card.type = 'button'; card.className = 'rec-card';
      card.setAttribute('aria-label', 'Play ' + game.name); card.dataset.game = game.name;
      const image = document.createElement('img'); image.src = game.thumb || 'Fluxlogo.svg'; image.alt = ''; image.loading = 'lazy'; image.decoding = 'async';
      image.addEventListener('error', () => { image.src = 'Fluxlogo.svg'; }, { once: true });
      const name = document.createElement('div'); name.className = 'rec-card-name'; name.textContent = game.name;
      card.append(image, name); card.addEventListener('click', () => openGame(game.file || game.url || game.link, game.name, game.description));
      return card;
    });
    grid.replaceChildren(...cards);
  }
  return { alphabetical, recommendations, renderRecommendations };
});

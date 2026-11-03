(function (root, factory) {
  const api = factory(typeof module !== 'undefined' && module.exports ? require('./flux-theme-core.js') : root.FluxThemes);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root?.document) { root.fluxThemeShop = api.create(root); root.fluxThemeShop.start(); }
})(typeof window === 'undefined' ? null : window, function (themes) {
  'use strict';
  function create(win) {
    const doc = win.document, el = id => doc.getElementById(id), dialog = el('theme-publish-dialog');
    let items = [], cursor = null, hasMore = false, loaded = false, pending = null, loadingError = false;
    let draft = null, generation = 0, publishing = false;
    const node = (tag, className, text) => { const value = doc.createElement(tag); if (className) value.className = className; if (text !== undefined) value.textContent = text; return value; };
    function notice(id, message = '', error = false) { const target = el(id); target.textContent = message; target.dataset.error = String(error); }
    function cache(code, theme) {
      try { const saved = JSON.parse(win.localStorage.getItem('flux_saved_themes') || '{}'); saved[code] = theme; win.localStorage.setItem('flux_saved_themes', JSON.stringify(saved)); } catch (_) { /* The applied colors still work without local storage. */ }
    }
    async function readCode(value) {
      const code = themes.normalizeCode(value), preset = themes.original(code);
      if (preset) return { code, theme: themes.normalizeTheme(preset) };
      let remoteError = false;
      try {
        if (!win.fluxData) throw new Error('Themes are still loading.');
        const response = await win.fluxData.loadTheme(code), theme = themes.normalizeTheme(response.theme);
        if (theme) return { code, theme };
      } catch (_) { remoteError = true; }
      try {
        const theme = themes.normalizeTheme(JSON.parse(win.localStorage.getItem('flux_saved_themes') || '{}')[code]);
        if (theme) return { code, theme };
      } catch (_) { /* A malformed local cache should not break the shop. */ }
      throw new Error(remoteError ? "Couldn't reach saved themes. Try again, or use your current colors." : 'No theme found for that code. Check it, or use your current colors.');
    }
    function preview(theme, badge) {
      const result = node('div', 'theme-card-preview'); result.setAttribute('aria-hidden', 'true');
      for (const [key, variable] of [['accent','accent'], ['bg','bg'], ['cardBg','card'], ['borderColor','border'], ['textColor','text']]) result.style.setProperty('--theme-' + variable, theme[key]);
      result.append(node('span', 'theme-card-badge', badge));
      const rail = node('div', 'theme-card-rail'); rail.append(node('b', '', '>F'), node('i'), node('i'), node('i'));
      const canvas = node('div', 'theme-card-canvas'), blocks = node('div'); blocks.append(node('i'), node('i'), node('i'));
      canvas.append(node('strong', '', 'Make it yours.'), node('span'), blocks); result.append(rail, canvas); return result;
    }
    function apply(item) {
      if (!win.applySavedTheme(item.theme)) throw new Error('This theme could not be applied. Please try another code.');
      cache(item.code, item.theme); notice('theme-shop-status', `${item.name || 'Theme'} applied. Your colors are saved on this device.`);
    }
    async function copy(code, button) {
      try {
        if (!win.navigator?.clipboard) throw new Error('Clipboard unavailable.');
        await win.navigator.clipboard.writeText(code); button.textContent = 'Copied!';
        win.setTimeout(() => { button.textContent = code; }, 1400);
      } catch (_) { notice('theme-shop-status', 'Theme code: ' + code); }
    }
    function card(item, isOriginal = false) {
      const result = node('article', 'theme-shop-card');
      result.append(preview(item.theme, isOriginal ? 'Flux original' : 'Community theme'));
      const body = node('div', 'theme-card-body'), footer = node('div', 'theme-card-footer');
      body.append(node('h4', '', item.name), node('p', 'theme-card-author', isOriginal ? 'A Flux original' : 'Shared by ' + item.sharedBy));
      const codeButton = node('button', 'theme-card-code', item.code); codeButton.type = 'button'; codeButton.title = 'Copy code: ' + item.code;
      codeButton.setAttribute('aria-label', 'Copy theme code ' + item.code); codeButton.addEventListener('click', () => copy(item.code, codeButton));
      const use = node('button', 'theme-card-apply', 'Use theme'); use.type = 'button'; use.dataset.applyTheme = item.code; use.setAttribute('aria-label', 'Use ' + item.name + ' theme');
      const arrow = node('i', 'fa-solid fa-arrow-right'); arrow.setAttribute('aria-hidden', 'true'); use.append(arrow);
      use.addEventListener('click', () => { try { apply(item); } catch (error) { notice('theme-shop-status', error.message, true); } });
      footer.append(codeButton, use); body.append(footer); result.append(body); return result;
    }
    function empty(title, description) {
      const result = node('div', 'theme-shop-empty'); result.append(node('strong', '', title), node('span', '', description)); return result;
    }
    function render() {
      const search = el('theme-shop-search').value.trim().toLowerCase();
      const matches = items.filter(item => [item.name, item.code, item.sharedBy].join(' ').toLowerCase().includes(search));
      el('theme-community-grid').replaceChildren(...(matches.length ? matches.map(item => card(item)) : [loadingError && !items.length
        ? empty("Couldn't load shared themes.", 'Try Refresh in a moment. Flux originals and saved local codes are still available.')
        : search ? empty('No matching themes yet.', 'Try another name or code, or load more themes.')
          : empty('Your colors could be the first.', 'Share a theme code and give the community a new favorite.')]));
      el('theme-shop-more').hidden = !hasMore;
    }
    async function load(force = false, more = false) {
      if (pending) return pending;
      if (loaded && !force && !more) return;
      el('theme-shop-refresh').disabled = true; el('theme-shop-more').disabled = true;
      if (!items.length) el('theme-community-grid').replaceChildren(empty('Finding shared colors…', 'A little inspiration is on its way.'));
      pending = (async () => {
        await Promise.resolve();
        let timeout;
        try {
          if (!win.fluxData) throw new Error('Theme sharing is still loading.');
          const result = await Promise.race([win.fluxData.listPublishedThemes({ after: more ? cursor : null }), new Promise((_, reject) => { timeout = win.setTimeout(() => reject(new Error('Themes took too long to load.')), 12000); })]);
          const incoming = (result.themes || []).filter(item => themes.normalizeTheme(item.theme));
          const merged = new Map((more ? items : []).map(item => [item.code, item]));
          for (const item of incoming) merged.set(item.code, item);
          items = [...merged.values()]; cursor = result.cursor; hasMore = result.hasMore; loaded = true; loadingError = false; render();
        } catch (_) { loadingError = true; render(); }
        finally { if (timeout) win.clearTimeout(timeout); pending = null; el('theme-shop-refresh').disabled = false; el('theme-shop-more').disabled = false; }
      })();
      return pending;
    }
    function updateAuth() {
      const signedIn = win.fluxAuthState?.status === 'signed-in';
      el('theme-publish-identity').textContent = signedIn ? 'Shared as ' + (win.getProfileData?.().name || win.fluxAuthState.name || 'Flux member') : 'Sign in to share. Everyone can browse and use themes.';
      if (!publishing) el('theme-publish-submit').textContent = signedIn ? 'Publish theme' : 'Sign in to share';
    }
    function showDraft(value, label) {
      draft = value; el('theme-publish-code').value = value.code;
      const swatch = el('theme-publish-swatch'); swatch.replaceChildren(preview(value.theme, label)); swatch.hidden = false;
      notice('theme-publish-status', 'Colors are ready. Add a name, then publish your theme.');
    }
    function currentColors() {
      const theme = themes.normalizeTheme(win.getCurrentTheme());
      if (!theme) throw new Error('Choose valid colors in Settings first.');
      let code = el('theme-publish-code').value.trim();
      if (!code || themes.original(code.toLowerCase())) code = 'theme-' + (win.crypto?.randomUUID?.().replaceAll('-', '').slice(0, 10) || Date.now().toString(36));
      code = themes.normalizeCode(code); generation++; showDraft({ code, theme }, 'Your current colors');
    }
    async function lookup() {
      const version = ++generation, code = themes.normalizeCode(el('theme-publish-code').value);
      notice('theme-publish-status', 'Finding your colors…');
      const result = await readCode(code);
      if (version !== generation || el('theme-publish-code').value.trim().toLowerCase() !== code) return null;
      showDraft(result, 'Theme preview'); return result;
    }
    function open(useCurrent = false) {
      if (publishing) { notice('theme-shop-status', 'Your theme is still publishing. Please wait a moment.'); return; }
      if (dialog.open) return;
      generation++; draft = null; el('theme-publish-form').reset(); el('theme-publish-swatch').hidden = true;
      notice('theme-publish-status'); updateAuth(); dialog.showModal();
      if (useCurrent) { try { currentColors(); } catch (error) { notice('theme-publish-status', error.message, true); } }
      (useCurrent ? el('theme-publish-name') : el('theme-publish-code')).focus();
    }
    async function publish(event) {
      event.preventDefault(); if (publishing) return;
      if (win.fluxAuthState?.status !== 'signed-in') { dialog.close(); win.showPage('account'); el('flux-auth-email')?.focus(); return; }
      let code, title;
      try { code = themes.normalizeCode(el('theme-publish-code').value); title = themes.normalizeName(el('theme-publish-name').value); }
      catch (error) { notice('theme-publish-status', error.message, true); return; }
      publishing = true;
      for (const id of ['theme-publish-submit','theme-publish-preview','theme-publish-current','theme-publish-code','theme-publish-name']) el(id).disabled = true;
      el('theme-publish-submit').textContent = 'Publishing…';
      try {
        if (!draft || draft.code !== code) await lookup();
        if (!draft || draft.code !== code) throw new Error('The code changed. Preview your theme again.');
        const result = await win.fluxData.publishTheme(code, title, draft.theme);
        cache(code, result.theme); items = [result, ...items.filter(item => item.code !== code)]; loadingError = false; render();
        dialog.close(); notice('theme-shop-status', `${title} is shared. Anyone can use the code ${code}.`);
      } catch (error) { notice('theme-publish-status', error.message || 'Theme sharing is unavailable right now. Please try again.', true); }
      finally {
        publishing = false;
        for (const id of ['theme-publish-submit','theme-publish-preview','theme-publish-current','theme-publish-code','theme-publish-name']) el(id).disabled = false;
        updateAuth();
      }
    }
    function start() {
      if (!dialog) return;
      el('theme-originals-grid').replaceChildren(...themes.presets.map(preset => card({ code: 'flux-' + preset.id, name: preset.name, theme: themes.normalizeTheme(preset) }, true)));
      el('theme-shop-share').addEventListener('click', () => open());
      el('theme-shop-create').addEventListener('click', () => open(true));
      el('theme-publish-close').addEventListener('click', () => dialog.close());
      el('theme-publish-code').addEventListener('input', () => { generation++; draft = null; el('theme-publish-swatch').hidden = true; notice('theme-publish-status'); });
      el('theme-publish-current').addEventListener('click', () => { try { currentColors(); } catch (error) { notice('theme-publish-status', error.message, true); } });
      el('theme-publish-preview').addEventListener('click', () => lookup().catch(error => notice('theme-publish-status', error.message, true)));
      el('theme-publish-form').addEventListener('submit', publish);
      el('theme-shop-code-form').addEventListener('submit', async event => {
        event.preventDefault(); const button = el('theme-shop-code-form').querySelector('button'); button.disabled = true;
        try { const item = await readCode(el('theme-shop-code').value); apply({ ...item, name: 'Theme ' + item.code }); }
        catch (error) { notice('theme-shop-status', error.message, true); }
        finally { button.disabled = false; }
      });
      el('theme-shop-refresh').addEventListener('click', () => load(true));
      el('theme-shop-more').addEventListener('click', () => load(false, true));
      el('theme-shop-search').addEventListener('input', render);
      win.addEventListener('flux-auth-changed', updateAuth); updateAuth();
    }
    return { start, load, open, readCode };
  }
  return { create };
});

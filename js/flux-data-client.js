(function (win) {
  'use strict';

  // Keep this public endpoint in one place. Firebase still provides sign-in;
  // this Worker verifies its ID tokens before writing any private data.
  const baseUrl = 'https://flux-data-api.coralsemail0.workers.dev';

  async function request(path, options, needsAuth) {
    const headers = new Headers((options && options.headers) || {});
    headers.set('Content-Type', 'application/json');
    if (needsAuth) {
      if (typeof win.fluxGetToken !== 'function') throw new Error('Sign in from Profile to sync this.');
      headers.set('Authorization', 'Bearer ' + await win.fluxGetToken());
    }
    const response = await fetch(baseUrl + path, { ...options, headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Flux data service could not complete that request.');
    return body;
  }

  const code = value => encodeURIComponent(String(value || '').trim().toLowerCase());
  win.FLUX_DATA_API_URL = baseUrl;
  win.fluxData = Object.freeze({
    health: () => request('/api/data/health'),
    loadTheme: themeCode => request('/api/themes/' + code(themeCode)),
    saveTheme: (themeCode, theme) => request('/api/themes/' + code(themeCode), { method: 'PUT', body: JSON.stringify({ theme }) }, true),
    getSettings: () => request('/api/users/me/settings', undefined, true),
    putSettings: settings => request('/api/users/me/settings', { method: 'PUT', body: JSON.stringify({ settings }) }, true),
    chat: (path, options = {}) => request('/api/chat' + path, { ...options, body: options.body === undefined ? undefined : JSON.stringify(options.body) }, true)
  });
})(window);

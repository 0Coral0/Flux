(() => {
  // Browser proxy integration is intentionally paused by integrations-config.js.
  if (window.FLUX_INTEGRATIONS?.browser === false) return;
  const panel = document.getElementById('view-browser');
  const frame = document.getElementById('flux-browser-frame');
  const setup = document.getElementById('flux-browser-setup');
  const tools = document.getElementById('flux-browser-tools');
  const external = document.getElementById('flux-browser-external');
  let loadedOrigin = null;
  let refreshing = false;

  function openBrowser() {
    if (!panel.classList.contains('active')) return;
    const local = location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname);
    const configured = window.FLUX_BROWSER_ORIGIN || (local ? 'http://127.0.0.1:3040' : null);
    try {
      if (!configured) throw new Error('The browser service is not configured.');
      const target = new URL(configured);
      if (target.origin === location.origin || target.username || target.password) throw new Error('Use a separate proxy origin.');
      if (target.protocol !== 'https:' && !(local && target.origin === 'http://127.0.0.1:3040')) throw new Error('The hosted proxy requires HTTPS.');
      const origin = target.origin;
      target.pathname = '/';
      target.search = '';
      target.hash = '';
      external.href = target.href;
      if (loadedOrigin !== origin) {
        target.search = '?embed=1';
        frame.src = target.href;
        loadedOrigin = origin;
      }
      frame.hidden = false;
      setup.hidden = true;
      tools.hidden = false;
    } catch {
      if (loadedOrigin) frame.src = 'about:blank';
      loadedOrigin = null;
      frame.hidden = true;
      setup.hidden = false;
      tools.hidden = true;
    }
  }

  // Read the publisher's single JSON-string assignment without executing fetched code.
  // This lets an open Flux tab notice a new Quick Tunnel after the site redeploys.
  async function refreshBrowserOrigin() {
    if (refreshing || !panel.classList.contains('active') || document.hidden || location.protocol === 'file:') return;
    refreshing = true;
    try {
      const response = await fetch('js/browser-config.js', { cache: 'no-store' });
      if (!response.ok) return;
      const source = await response.text();
      if (source.length > 8192) return;
      const match = source.match(/^\s*window\.FLUX_BROWSER_ORIGIN\s*=\s*(null|"(?:[^"\\]|\\.)*")\s*;\s*$/m);
      if (!match) return;
      const origin = JSON.parse(match[1]);
      if (origin !== null && typeof origin !== 'string') return;
      window.FLUX_BROWSER_ORIGIN = origin;
      openBrowser();
    } catch { /* Keep the last working address if the site is temporarily unavailable. */ }
    finally { refreshing = false; }
  }

  function activate() {
    openBrowser();
    refreshBrowserOrigin();
  }
  new MutationObserver(activate).observe(panel, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', activate);
  setInterval(refreshBrowserOrigin, 30000);
  activate();
})();

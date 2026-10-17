(() => {
  const panel = document.getElementById('view-browser');
  const frame = document.getElementById('flux-browser-frame');
  const setup = document.getElementById('flux-browser-setup');
  let loaded = false;
  function openBrowser() {
    if (loaded || !panel.classList.contains('active')) return;
    const local = location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname);
    const configured = window.FLUX_BROWSER_ORIGIN || (local ? 'http://127.0.0.1:3040' : null);
    if (!configured) { frame.hidden = true; setup.hidden = false; return; }
    try {
      const target = new URL(configured);
      if (target.origin === location.origin || target.username || target.password) throw new Error('Use a separate proxy origin.');
      if (target.protocol !== 'https:' && !(local && target.origin === 'http://127.0.0.1:3040')) throw new Error('The hosted proxy requires HTTPS.');
      target.pathname = '/';
      target.search = '?embed=1';
      target.hash = '';
      frame.src = target.href;
      loaded = true;
    } catch { frame.hidden = true; setup.hidden = false; }
  }
  new MutationObserver(openBrowser).observe(panel, { attributes: true, attributeFilter: ['class'] });
  openBrowser();
})();

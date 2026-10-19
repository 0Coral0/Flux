(function (win) {
  'use strict';
  const document = win.document;
  const form = document.getElementById('flux-auth-form');
  const status = document.getElementById('flux-auth-status');
  if (!form || !status) return;

  function showUnavailable() {
    if (win.fluxAuthReady) return;
    status.textContent = win.location.protocol === 'file:'
      ? 'Open Flux at http://127.0.0.1:3031/ to sign in and use community features.'
      : 'Accounts could not connect. Check your internet connection or browser settings, then reload Flux.';
    win.fluxAuthState = { status: 'unavailable' };
    win.dispatchEvent(new Event('flux-auth-changed'));
  }

  // Keep credentials on the page if Firebase fails to load; the module's
  // submit listener still runs normally when the service is ready.
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!win.fluxAuthReady) showUnavailable();
  });
  for (const id of ['flux-auth-register', 'flux-auth-logout']) {
    const button = document.getElementById(id);
    if (button) button.addEventListener('click', () => { if (!win.fluxAuthReady) showUnavailable(); });
  }
  if (win.location.protocol === 'file:') showUnavailable();
  else win.setTimeout(showUnavailable, 10000);
})(window);

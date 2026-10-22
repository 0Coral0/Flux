/*
 * Optional online integrations are paused for this build.
 * Set an entry to true to restore its existing implementation; no files need
 * to be restored or copied back into the project.
 */
window.FLUX_INTEGRATIONS = Object.freeze({
  browser: false,
  discord: false,
  ai: false,
  globalChat: true,
});

// Keep the paused pages out of the SPA without removing their markup. Global
// Chat is local Firebase functionality, not the paused Discord integration.
for (const id of ['btn-browser', 'view-browser', 'btn-ai', 'view-ai']) {
  document.getElementById(id)?.setAttribute('hidden', '');
}

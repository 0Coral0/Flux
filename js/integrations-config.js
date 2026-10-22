/*
 * Optional online integrations are paused for this build.
 * Set an entry to true to restore its existing implementation; no files need
 * to be restored or copied back into the project.
 */
window.FLUX_INTEGRATIONS = Object.freeze({
  browser: false,
  discord: false,
  ai: false,
});

// Keep the paused pages out of the SPA without removing their markup.
for (const id of ['btn-browser', 'view-browser', 'btn-chat', 'view-chat', 'btn-ai', 'view-ai']) {
  document.getElementById(id)?.setAttribute('hidden', '');
}

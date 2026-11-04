(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.FluxBackgrounds = api;
    if (root.document) {
      root.fluxBackgrounds = api.create(root);
      if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', () => root.fluxBackgrounds.start(), { once: true });
      else root.fluxBackgrounds.start();
    }
  }
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const storageKey = 'flux_background_preferences_v1', maxBytes = 10 * 1024 * 1024;
  function imageUrl(value, base) {
    if (!String(value || '').trim()) return '';
    const url = new URL(String(value).trim(), base);
    if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.origin === new URL(base).origin))) throw new Error('Use a direct HTTPS image link.');
    if (url.href.length > 3000) throw new Error('That image link is too long.');
    return url.href;
  }
  function normalize(value, base) {
    const saved = value && typeof value === 'object' ? value : {};
    let url = ''; try { url = imageUrl(saved.url, base); } catch (_) {}
    const fileKey = /^bg-[a-z0-9-]{1,80}$/.test(saved.fileKey || '') ? saved.fileKey : '';
    const number = (value, fallback, maximum) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(maximum, Number(value))) : fallback;
    return { kind: saved.kind === 'url' && url ? 'url' : saved.kind === 'upload' && fileKey ? 'upload' : 'none', url, fileKey,
      fileName: String(saved.fileName || '').slice(0, 120), tint: number(saved.tint ?? 55, 55, 90), blur: number(saved.blur ?? 0, 0, 12), fit: saved.fit === 'contain' ? 'contain' : 'cover' };
  }
  async function validateFile(file) {
    if (!file || file.size <= 0 || file.size > maxBytes) throw new Error('Choose an image smaller than 10 MB.');
    const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer()), ascii = String.fromCharCode(...bytes);
    const valid = (bytes[0] === 0x89 && ascii.slice(1, 4) === 'PNG') || (bytes[0] === 0xff && bytes[1] === 0xd8) || /^GIF8[79]a/.test(ascii) || (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') || (ascii.slice(4, 8) === 'ftyp' && /avif|avis/.test(ascii));
    if (!valid) throw new Error('Choose a PNG, JPG, WebP, GIF, or AVIF image.');
    return file;
  }
  function mediaStore(win) {
    let opening;
    function open() {
      if (!win.indexedDB) return Promise.reject(new Error('Image uploads are unavailable in this browser. Try an image link instead.'));
      if (!opening) opening = new Promise((resolve, reject) => {
        const request = win.indexedDB.open('flux-personal-media', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('backgrounds');
        request.onsuccess = () => resolve(request.result); request.onerror = () => { opening = null; reject(new Error('Could not open image storage. Try an image link instead.')); };
      });
      return opening;
    }
    async function action(mode, fn) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('backgrounds', mode), request = fn(transaction.objectStore('backgrounds'));
        transaction.oncomplete = () => resolve(request.result); transaction.onerror = transaction.onabort = () => reject(new Error('Could not save the image. Your browser storage may be full.'));
      });
    }
    return { get: key => action('readonly', store => store.get(key)), put: (key, value) => action('readwrite', store => store.put(value, key)), remove: key => action('readwrite', store => store.delete(key)) };
  }
  function create(win, options = {}) {
    const doc = win.document, el = id => doc.getElementById(id), media = options.media || mediaStore(win);
    const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)');
    let preferences; try { preferences = normalize(JSON.parse(win.localStorage.getItem(storageKey) || '{}'), win.location.href); } catch (_) { preferences = normalize({}, win.location.href); }
    let generation = 0, activeKey = '', blobUrl = '', pending = null, busy = false;
    const status = text => { if (el('background-status')) el('background-status').textContent = text; };
    const blocked = () => win.fluxPerformance?.isEnabled() || reduced?.matches;
    function clear() {
      if (pending) { const cancelled = pending; pending = null; cancelled.image.onload = cancelled.image.onerror = null; cancelled.image.src = ''; cancelled.reject(new Error('Image loading was interrupted.')); }
      el('site-background-image').removeAttribute('src'); el('site-background').hidden = true;
      if (blobUrl) win.URL.revokeObjectURL(blobUrl); blobUrl = ''; activeKey = '';
    }
    function controls() {
      if (!el('background-url')) return;
      el('background-url').value = preferences.kind === 'url' ? preferences.url : '';
      el('background-tint').value = preferences.tint; el('background-blur').value = preferences.blur; el('background-fit').value = preferences.fit;
      el('background-tint-value').textContent = preferences.tint + '%'; el('background-blur-value').textContent = preferences.blur + 'px';
      el('background-current').textContent = preferences.kind === 'upload' ? preferences.fileName : preferences.kind === 'url' ? 'Image link' : 'Theme background';
    }
    function styles() {
      const layer = el('site-background'); layer.style.setProperty('--wallpaper-tint', String(preferences.tint / 100)); layer.style.setProperty('--wallpaper-blur', preferences.blur + 'px');
      el('site-background-image').style.objectFit = preferences.fit;
    }
    function loadImage(source) {
      return new Promise((resolve, reject) => { const image = new win.Image(); pending = { image, reject }; image.onload = () => { if (pending?.image === image) pending = null; resolve(); }; image.onerror = () => { if (pending?.image === image) pending = null; reject(new Error('Could not load that image. Use a direct image link or upload a file.')); }; image.src = source; });
    }
    async function apply() {
      const token = ++generation; styles(); controls();
      if (preferences.kind === 'none' || blocked()) { clear(); status(preferences.kind === 'none' ? 'Your theme background is active.' : 'Background saved. Lite Mode or reduced motion is pausing image backgrounds.'); return; }
      const key = preferences.kind === 'url' ? preferences.url : preferences.fileKey;
      if (activeKey === key) return;
      clear(); status('Loading your background…'); let nextUrl = '';
      try {
        let actual = preferences.kind === 'url' ? preferences.url : '';
        if (preferences.kind === 'upload') {
          const saved = await media.get(preferences.fileKey); if (!saved?.blob) throw new Error('That uploaded image is no longer on this device. Please choose it again.');
          if (token !== generation) return;
          nextUrl = win.URL.createObjectURL(saved.blob); actual = nextUrl;
        }
        await loadImage(actual);
        if (token !== generation || blocked()) { if (nextUrl) win.URL.revokeObjectURL(nextUrl); return; }
        blobUrl = nextUrl; activeKey = key; el('site-background-image').src = actual; el('site-background').hidden = false; status('Background saved on this device.');
      } catch (error) { if (nextUrl) win.URL.revokeObjectURL(nextUrl); if (token === generation) status(error.message); }
    }
    function persist(value) {
      const next = normalize(value, win.location.href);
      win.localStorage.setItem(storageKey, JSON.stringify(next)); preferences = next; apply();
    }
    async function upload(file) {
      if (busy) return; busy = true; status('Saving image…'); let key;
      try {
        await validateFile(file);
        if (win.createImageBitmap) { const bitmap = await win.createImageBitmap(file); bitmap.close(); }
        key = 'bg-' + win.crypto.randomUUID(); await media.put(key, { blob: file, name: file.name });
        const previous = preferences.fileKey; persist({ ...preferences, kind: 'upload', fileKey: key, fileName: file.name, url: '' });
        if (previous && previous !== key) media.remove(previous).catch(() => {});
      } catch (error) { if (key) media.remove(key).catch(() => {}); status(error.message || 'Could not save that image.'); }
      finally { busy = false; if (el('background-file')) el('background-file').value = ''; }
    }
    function start() {
      el('background-url-form')?.addEventListener('submit', async event => {
        event.preventDefault(); if (busy) return; busy = true; status('Checking image link…');
        try {
          const url = imageUrl(el('background-url').value, win.location.href); if (!url) throw new Error('Paste a direct image link first.');
          await loadImage(url); const previous = preferences.fileKey; persist({ ...preferences, kind: 'url', url, fileKey: '', fileName: '' }); if (previous) media.remove(previous).catch(() => {});
        } catch (error) { status(error.message); } finally { busy = false; }
      });
      el('background-upload')?.addEventListener('click', () => el('background-file').click());
      el('background-file')?.addEventListener('change', event => { if (event.target.files[0]) upload(event.target.files[0]); });
      el('background-clear')?.addEventListener('click', () => { try { const previous = preferences.fileKey; persist({ ...preferences, kind: 'none', url: '', fileKey: '', fileName: '' }); if (previous) media.remove(previous).catch(() => {}); } catch (_) { status('Could not save your background preference.'); } });
      for (const [id, field] of [['background-tint', 'tint'], ['background-blur', 'blur'], ['background-fit', 'fit']]) el(id)?.addEventListener('input', event => { try { persist({ ...preferences, [field]: event.target.value }); } catch (_) { status('Could not save your background preference.'); } });
      win.addEventListener('flux-performance-changed', apply); reduced?.addEventListener?.('change', apply);
      win.addEventListener('storage', event => { if (event.key !== storageKey) return; try { preferences = normalize(JSON.parse(event.newValue || '{}'), win.location.href); apply(); } catch (_) {} });
      win.addEventListener('pagehide', clear); win.addEventListener('pageshow', event => { if (event.persisted) apply(); }); apply();
    }
    return { start, upload, getPreferences: () => ({ ...preferences }) };
  }
  return { imageUrl, normalize, validateFile, create, maxBytes };
});

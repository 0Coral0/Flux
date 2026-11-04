(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.FluxThemeMedia = api; root.fluxThemeMedia = api.create(root); }
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const chunkSize = 512 * 1024, maxBytes = 10 * 1024 * 1024;
  function contentType(bytes) {
    const text = String.fromCharCode(...bytes.slice(0, 32));
    if (bytes[0] === 0x89 && text.slice(1, 4) === 'PNG') return 'image/png';
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
    if (/^GIF8[79]a/.test(text)) return 'image/gif';
    if (text.startsWith('RIFF') && text.slice(8, 12) === 'WEBP') return 'image/webp';
    if (text.slice(4, 8) === 'ftyp' && /avif|avis/.test(text)) return 'image/avif';
    throw new Error('Choose a PNG, JPG, WebP, GIF, or AVIF background.');
  }
  function manifest(value) {
    return value && value.ready === true && ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'].includes(value.contentType) &&
      Number.isInteger(value.size) && value.size > 0 && value.size <= maxBytes && Number.isInteger(value.chunkCount) && value.chunkCount === Math.ceil(value.size / chunkSize) &&
      /^[a-f0-9]{64}$/.test(value.sha256 || '') ? value : null;
  }
  function create(win) {
    const store = () => { if (!win.fluxFirebaseDb || !win.fluxFirebase) throw new Error('Background sharing is temporarily unavailable.'); return win.fluxFirebaseDb; };
    const uid = () => { const value = win.fluxAuthState?.uid; if (!value) throw new Error('Sign in to share a background.'); return value; };
    const digest = async bytes => Array.from(new Uint8Array(await win.crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
    const chunkId = index => String(index).padStart(2, '0');
    let cached = null;
    async function poster(blob) {
      if (!win.createImageBitmap) return '';
      let bitmap;
      try {
        bitmap = await win.createImageBitmap(blob);
        const canvas = win.document.createElement('canvas');
        canvas.width = 256; canvas.height = 144;
        const context = canvas.getContext('2d'), scale = Math.max(canvas.width / bitmap.width, canvas.height / bitmap.height);
        context.drawImage(bitmap, (canvas.width - bitmap.width * scale) / 2, (canvas.height - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
        for (const quality of [.6, .4, .2]) { const result = canvas.toDataURL('image/webp', quality); if (result.length <= 24000 && /^data:image\/(webp|jpeg);base64,/.test(result)) return result; }
      } catch (_) { /* A missing thumbnail never prevents sharing the original image. */ }
      finally { bitmap?.close(); }
      return '';
    }
    async function upload(blob, progress = () => {}) {
      const owner = uid(), db = store();
      if (!blob || blob.size <= 0 || blob.size > maxBytes) throw new Error('Share an image up to 10 MB.');
      const bytes = new Uint8Array(await blob.arrayBuffer()), type = contentType(bytes), hash = await digest(bytes);
      if (uid() !== owner) throw new Error('Your account changed. Please publish again.');
      const id = win.crypto.randomUUID().replaceAll('-', ''), ref = db.collection('theme_backgrounds').doc(id);
      const count = Math.ceil(bytes.length / chunkSize), preview = await poster(blob);
      await ref.set({ ownerUid: owner, contentType: type, size: bytes.length, chunkCount: count, sha256: hash, ready: false, createdAt: win.fluxFirebase.firestore.FieldValue.serverTimestamp() });
      try {
        for (let offset = 0; offset < count; offset += 4) {
          if (uid() !== owner) throw new Error('Your account changed. Please publish again.');
          const batch = db.batch();
          for (let index = offset; index < Math.min(count, offset + 4); index++) batch.set(ref.collection('chunks').doc(chunkId(index)), {
            index, bytes: win.fluxFirebase.firestore.Blob.fromUint8Array(bytes.slice(index * chunkSize, Math.min(bytes.length, (index + 1) * chunkSize)))
          });
          await batch.commit(); progress(Math.round(Math.min(count, offset + 4) / count * 100));
        }
        await ref.update({ ready: true });
      } catch (error) {
        if (win.fluxAuthState?.uid === owner) {
          try { const batch = db.batch(); for (let index = 0; index < count; index++) batch.delete(ref.collection('chunks').doc(chunkId(index))); batch.delete(ref); await batch.commit(); } catch (_) {}
        }
        throw error;
      }
      cached = { id, blob: new win.Blob([bytes], { type }) };
      return { assetId: id, ...(preview ? { preview } : {}) };
    }
    async function load(id) {
      if (!/^[a-f0-9]{32}$/.test(id || '')) throw new Error('That shared background is invalid.');
      if (cached?.id === id) return cached.blob;
      const ref = store().collection('theme_backgrounds').doc(id), record = await ref.get(), data = record.exists ? manifest(record.data()) : null;
      if (!data) throw new Error('That shared background is unavailable. Your current background was kept.');
      const chunks = [];
      for (let offset = 0; offset < data.chunkCount; offset += 4) {
        const page = await Promise.all(Array.from({ length: Math.min(4, data.chunkCount - offset) }, (_, index) => ref.collection('chunks').doc(chunkId(offset + index)).get()));
        for (const [position, snapshot] of page.entries()) {
          const index = offset + position, chunk = snapshot.exists ? snapshot.data() : null, bytes = chunk?.bytes?.toUint8Array?.();
          if (chunk?.index !== index || !(bytes instanceof Uint8Array) || bytes.length !== Math.min(chunkSize, data.size - index * chunkSize)) throw new Error('That shared background is incomplete. Please try another theme.');
          chunks.push(bytes);
        }
      }
      const bytes = new Uint8Array(data.size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      if (await digest(bytes) !== data.sha256 || contentType(bytes) !== data.contentType) throw new Error('That shared background could not be verified. Your current background was kept.');
      cached = { id, blob: new win.Blob([bytes], { type: data.contentType }) }; return cached.blob;
    }
    return { upload, load };
  }
  return { create, manifest, contentType, chunkSize, maxBytes };
});

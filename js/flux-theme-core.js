(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FluxThemes = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const fields = Object.freeze(['accent', 'bg', 'cardBg', 'borderColor', 'textColor']);
  const presets = Object.freeze([
    { id: 'emerald', name: 'Emerald', accent: '#22c55e', bg: '#070709', cardBg: '#14141c', borderColor: '#22222e', textColor: '#f4f4f5' },
    { id: 'ocean', name: 'Ocean', accent: '#38bdf8', bg: '#070b12', cardBg: '#0e1726', borderColor: '#223247', textColor: '#f0f7ff' },
    { id: 'violet', name: 'Violet', accent: '#a78bfa', bg: '#0b0913', cardBg: '#161124', borderColor: '#302642', textColor: '#f6f2ff' },
    { id: 'rose', name: 'Rose', accent: '#fb7185', bg: '#10090d', cardBg: '#201218', borderColor: '#3b2430', textColor: '#fff1f5' },
    { id: 'amber', name: 'Amber', accent: '#fbbf24', bg: '#100d07', cardBg: '#1d180f', borderColor: '#382e1b', textColor: '#fff8e8' }
  ].map(Object.freeze));
  const hex = value => typeof value === 'string' && /^#[a-f0-9]{6}$/i.test(value);
  const withDefaults = value => Object.fromEntries(fields.map(key => [key, hex(value?.[key]) ? value[key].toLowerCase() : presets[0][key]]));
  function normalizeTheme(value) {
    if (!value || typeof value !== 'object' || !hex(value.accent) || !hex(value.bg)) return null;
    if (fields.some(key => value[key] !== undefined && !hex(value[key]))) return null;
    return withDefaults(value);
  }
  const rgb = color => [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
  const mix = (base, color, amount) => '#' + rgb(base).map((channel, index) =>
    Math.round(channel + (rgb(color)[index] - channel) * amount).toString(16).padStart(2, '0')).join('');
  function luminance(color) {
    const [r, g, b] = rgb(color).map(channel => {
      const value = channel / 255;
      return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    });
    return r * .2126 + g * .7152 + b * .0722;
  }
  function tokens(value) {
    const theme = withDefaults(value);
    return {
      '--accent': theme.accent, '--accent-rgb': rgb(theme.accent).join(', '),
      '--bg': theme.bg, '--surface-card': theme.cardBg, '--border': theme.borderColor, '--text': theme.textColor,
      '--surface': mix(theme.bg, theme.cardBg, .7),
      '--surface-hover': mix(theme.cardBg, theme.textColor, .07),
      '--border-active': mix(theme.borderColor, theme.textColor, .2),
      '--text-dim': mix(theme.cardBg, theme.textColor, .68),
      '--on-accent': luminance(theme.accent) > .179 ? '#000000' : '#ffffff',
      'color-scheme': luminance(theme.bg) > .4 ? 'light' : 'dark'
    };
  }
  function applyTo(target, value) {
    for (const [property, color] of Object.entries(tokens(value))) target.style.setProperty(property, color);
  }
  function normalizeCode(value) {
    const code = String(value || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(code)) throw new Error('Use a code with 1–40 letters, numbers, dashes, or underscores.');
    return code;
  }
  function normalizeName(value) {
    const name = String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
    if (name.length < 2 || name.length > 48) throw new Error('Give your theme a name with 2–48 characters.');
    return name;
  }
  const original = code => presets.find(theme => 'flux-' + theme.id === code);
  function listing(code, data) {
    try {
      const normalizedCode = normalizeCode(code);
      if (normalizedCode !== code || !data?.publishedAt || typeof data.ownerUid !== 'string' || !data.ownerUid) return null;
      const theme = normalizeTheme(data.theme);
      if (!theme) return null;
      return { code, name: normalizeName(data.shopName), theme, ownerUid: data.ownerUid,
        sharedBy: String(data.sharedBy || 'Flux member').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 40) || 'Flux member',
        publishedAt: typeof data.publishedAt.toMillis === 'function' ? data.publishedAt.toMillis() : 0 };
    } catch (_) { return null; }
  }
  return Object.freeze({ fields, presets, withDefaults, normalizeTheme, tokens, applyTo, normalizeCode, normalizeName, original, listing });
});

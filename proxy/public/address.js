export function resolveAddress(input) {
  const value = input.trim();
  if (!value) return null;
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS addresses are supported.');
    if (url.username || url.password) throw new Error('Addresses containing credentials are not supported.');
    return url.href;
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^[^\s/:]+:\d+(?:\/|$)/.test(value)) {
    throw new Error('Only HTTP and HTTPS addresses are supported.');
  }
  if (!/\s/.test(value) && /^(?:[\w-]+\.)+[\w-]+(?::\d+)?(?:[/?#]|$)/i.test(value)) {
    return new URL(`https://${value}`).href;
  }
  return `https://duckduckgo.com/?q=${encodeURIComponent(value)}`;
}

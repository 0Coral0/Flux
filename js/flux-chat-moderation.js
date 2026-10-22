(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.fluxChatModeration = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  // These are intentionally specific terms and phrases, not ordinary profanity.
  // Site owners can add more literal words or phrases by defining
  // window.FLUX_CHAT_BLOCKED_PHRASES before this script loads.
  const defaultBlockedPhrases = [
    'kill yourself',
    'kys',
    'go die',
    'i will kill you',
    'i am going to kill you',
    'i will hurt you',
    'nigger',
    'nigga',
    'faggot',
    'tranny',
    'retard',
    'spic',
    'kike',
    'chink',
    'nazi',
    'nazis',
    'nazism',
    'hitler',
    'heil hitler',
    'white power',
    'kkk',
    'ku klux klan',
    'holocaust',
    'genocide',
    'school shooting',
    'terrorist attack'
  ];

  function normalize(value) {
    return String(value || '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function configuredPhrases() {
    const custom = Array.isArray(root.FLUX_CHAT_BLOCKED_PHRASES) ? root.FLUX_CHAT_BLOCKED_PHRASES : [];
    return [...defaultBlockedPhrases, ...custom]
      .map(normalize)
      .filter(Boolean);
  }

  function check(value) {
    const text = normalize(value);
    const paddedText = ` ${text} `;
    const blockedPhrase = configuredPhrases().find(phrase => paddedText.includes(` ${phrase} `));
    return blockedPhrase
      ? { allowed: false, blockedPhrase }
      : { allowed: true };
  }

  return Object.freeze({
    defaultBlockedPhrases: Object.freeze([...defaultBlockedPhrases]),
    normalize,
    check
  });
});

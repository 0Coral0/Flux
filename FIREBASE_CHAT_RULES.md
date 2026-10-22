# Flux global-chat Firestore rules

Replace the existing broad `messages` rule (`allow read, write: if true;`) with the block below, inside `match /databases/{database}/documents`.

This keeps Global Chat publicly readable and lets guests send ordinary messages, but protects the owner badge: only a Firebase-authenticated account on the owner list may create a message with `owner: true`. It also rejects the built-in harmful-language phrases on the server, so a direct Firestore request cannot bypass the page’s moderation check.

```rules
function isFluxOwner() {
  return request.auth != null
    && (
      request.auth.token.email == 'z.werner1@lodiusd.org'
      || request.auth.token.email == 'xboxmaster83412@gmail.com'
      || request.auth.token.email == 'coralsemail0@gmail.com'
    );
}

function hasBlockedChatText(text) {
  return text.matches('(?i).*\\b(kill[[:space:]]+yourself|kys|go[[:space:]]+die|i[[:space:]]+will[[:space:]]+kill[[:space:]]+you|i[[:space:]]+am[[:space:]]+going[[:space:]]+to[[:space:]]+kill[[:space:]]+you|i[[:space:]]+will[[:space:]]+hurt[[:space:]]+you|nigger|nigga|faggot|tranny|retard|spic|kike|chink|nazi|nazis|nazism|hitler|heil[[:space:]]+hitler|white[[:space:]]+power|kkk|ku[[:space:]]+klux[[:space:]]+klan|holocaust|genocide|school[[:space:]]+shooting|terrorist[[:space:]]+attack)\\b.*');
}

match /messages/{docId} {
  allow read: if true;

  allow create: if request.resource.data.keys().hasAll([
        'username', 'avatar', 'profile', 'text', 'time', 'room', 'timestamp', 'owner'
      ])
      && request.resource.data.keys().hasOnly([
        'username', 'avatar', 'profile', 'text', 'time', 'room', 'timestamp', 'owner'
      ])
      && request.resource.data.username is string
      && request.resource.data.username.size() > 0
      && request.resource.data.username.size() <= 40
      && request.resource.data.avatar is string
      && request.resource.data.avatar.size() <= 2000
      && request.resource.data.profile is map
      && request.resource.data.text is string
      && request.resource.data.text.size() > 0
      && request.resource.data.text.size() <= 500
      && request.resource.data.time is string
      && request.resource.data.time.size() <= 24
      && request.resource.data.room == 'global_general'
      && request.resource.data.timestamp == request.time
      && request.resource.data.owner is bool
      && (request.resource.data.owner == false || isFluxOwner())
      && !hasBlockedChatText(request.resource.data.text);

  allow update, delete: if false;
}
```

To add more server-enforced phrases, append them to the `hasBlockedChatText` regular expression and add the same phrase to `defaultBlockedPhrases` in `js/flux-chat-moderation.js`. Firestore Rules use RE2-style regular expressions; test the rule in the Firebase Rules Playground before publishing.

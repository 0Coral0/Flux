# Full Flux Firestore rules

> Organized under `docs/firebase` as part of the project documentation.

This is the merged version of the rules you pasted: it keeps your existing requests, themes, memorials, Hot games, and legacy Global Chat, then adds Firebase-backed Flux profiles, friends, DMs, and groups. Replace the entire Rules editor contents with this ruleset, then click **Publish**. Flux no longer needs the Cloudflare data Worker for site features.

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() {
      return request.auth != null;
    }

    function isFluxOwner() {
      return signedIn() && (
        request.auth.token.email == 'z.werner1@lodiusd.org' ||
        request.auth.token.email == 'xboxmaster83412@gmail.com' ||
        request.auth.token.email == 'coralsemail0@gmail.com'
      );
    }

    function staffDoc() {
      return get(/databases/$(database)/documents/flux_staff/$(request.auth.token.email));
    }

    function isFluxAdmin() {
      return signedIn() && (isFluxOwner() ||
        (exists(/databases/$(database)/documents/flux_staff/$(request.auth.token.email)) &&
          staffDoc().data.role == 'admin'));
    }

    function isFluxStaff() {
      return signedIn() && (isFluxAdmin() ||
        (exists(/databases/$(database)/documents/flux_staff/$(request.auth.token.email)) &&
          staffDoc().data.role == 'mod'));
    }

    function hasBlockedChatText(text) {
      return text.matches('(?i).*\\b(kill[[:space:]]+yourself|kys|go[[:space:]]+die|i[[:space:]]+will[[:space:]]+kill[[:space:]]+you|i[[:space:]]+am[[:space:]]+going[[:space:]]+to[[:space:]]+kill[[:space:]]+you|i[[:space:]]+will[[:space:]]+hurt[[:space:]]+you|nigger|nigga|faggot|tranny|retard|spic|kike|chink|nazi|nazis|nazism|hitler|heil[[:space:]]+hitler|white[[:space:]]+power|kkk|ku[[:space:]]+klux[[:space:]]+klan|holocaust|genocide|school[[:space:]]+shooting|terrorist[[:space:]]+attack)\\b.*');
    }

    function isRoomMember(roomId) {
      return get(/databases/$(database)/documents/flux_social_rooms/$(roomId)).data.type == 'global' ||
        request.auth.uid in get(/databases/$(database)/documents/flux_social_rooms/$(roomId)).data.members;
    }

    function isActiveBan() {
      return exists(/databases/$(database)/documents/flux_bans/$(request.auth.uid)) &&
        (get(/databases/$(database)/documents/flux_bans/$(request.auth.uid)).data.expiresAt == null ||
          get(/databases/$(database)/documents/flux_bans/$(request.auth.uid)).data.expiresAt > request.time);
    }

    function validBanLength() {
      return isFluxOwner() ||
        (isFluxAdmin() && request.resource.data.expiresAt != null &&
          request.resource.data.expiresAt <= request.time + duration.value(30, 'd')) ||
        (!isFluxAdmin() && isFluxStaff() && request.resource.data.expiresAt != null &&
          request.resource.data.expiresAt <= request.time + duration.value(1, 'd'));
    }

    // Flux Chat Pro's Global Chat. Older messages remain readable.
    match /messages/{docId} {
      allow read: if true;
      allow create: if signedIn() && !isActiveBan()
        && request.resource.data.keys().hasAll(['uid', 'username', 'avatar', 'profile', 'text', 'time', 'room', 'timestamp', 'owner', 'role', 'mentions'])
        && request.resource.data.keys().hasOnly(['uid', 'username', 'avatar', 'profile', 'text', 'time', 'room', 'timestamp', 'owner', 'role', 'mentions', 'replyTo'])
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.username is string
        && request.resource.data.username.size() > 0
        && request.resource.data.username.size() <= 40
        && request.resource.data.avatar is string
        && request.resource.data.avatar.size() <= 40000
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
        && request.resource.data.role is string
        && (request.resource.data.role == '' ||
          (request.resource.data.role == 'owner' && isFluxOwner()) ||
          (request.resource.data.role == 'admin' && isFluxAdmin() && !isFluxOwner()) ||
          (request.resource.data.role == 'mod' && isFluxStaff() && !isFluxAdmin()))
        && request.resource.data.mentions is list
        && request.resource.data.mentions.size() <= 10
        && (!('replyTo' in request.resource.data) || request.resource.data.replyTo is map)
        && !hasBlockedChatText(request.resource.data.text);
      allow update: if false;
      allow delete: if signedIn() && (resource.data.uid == request.auth.uid || isFluxStaff());
    }

    match /profiles/{docId} {
      allow read, write: if true;
    }

    match /users/{userId} {
      allow read, write: if signedIn() && request.auth.uid == userId;
      match /settings/{document=**} { allow read, write: if signedIn() && request.auth.uid == userId; }
      match /themePresets/{document=**} { allow read, write: if signedIn() && request.auth.uid == userId; }
      match /tabCloakPresets/{document=**} { allow read, write: if signedIn() && request.auth.uid == userId; }
    }

    // Theme bundles contain colors and optional public backgrounds/homepage layouts.
    function validSharedBackground(value) {
      return value is map && (
        (value.keys().hasOnly(['kind']) && value.kind == 'none') ||
        (value.keys().hasAll(['kind', 'tint', 'blur', 'fit'])
          && value.tint is number && value.tint >= 0 && value.tint <= 90
          && value.blur is number && value.blur >= 0 && value.blur <= 12
          && value.fit in ['cover', 'contain']
          && (!('preview' in value) || (value.preview is string && value.preview.size() <= 24000
            && value.preview.matches('^data:image/(webp|jpeg);base64,[a-zA-Z0-9+/]+={0,2}$')))
          && (
            (value.kind == 'url' && value.keys().hasAll(['url'])
              && value.keys().hasOnly(['kind', 'url', 'tint', 'blur', 'fit', 'preview'])
              && value.url is string && value.url.size() <= 3000 && value.url.matches('^https://[^/@:?#]+(:[0-9]+)?(/.*)?([?].*)?(#.*)?$')) ||
            (value.kind == 'asset' && value.keys().hasAll(['assetId'])
              && value.keys().hasOnly(['kind', 'assetId', 'tint', 'blur', 'fit', 'preview'])
              && value.assetId is string && value.assetId.matches('^[a-f0-9]{32}$')
              && get(/databases/$(database)/documents/theme_backgrounds/$(value.assetId)).data.ready == true)
          )
        )
      );
    }
    function validSharedHomepage(value) {
      return value is map && value.keys().hasAll(['order', 'hidden', 'columns', 'hero'])
        && value.keys().hasOnly(['order', 'hidden', 'columns', 'hero'])
        && value.order is list && value.order.size() == 4 && value.order.toSet().size() == 4
        && value.order.hasOnly(['welcome', 'stats', 'recent', 'hot'])
        && value.hidden is list && value.hidden.size() <= 4 && value.hidden.toSet().size() == value.hidden.size()
        && value.hidden.hasOnly(['welcome', 'stats', 'recent', 'hot'])
        && value.columns in ['auto', '3', '4', '5', '6'] && value.hero in ['full', 'compact'];
    }
    match /themes/{themeId} {
      function color(value) { return value is string && value.matches('^#[a-fA-F0-9]{6}$'); }
      function validTheme() {
        let data = request.resource.data;
        return data.keys().hasAll(['theme', 'ownerUid', 'updatedAt'])
          && data.keys().hasOnly(['theme', 'ownerUid', 'updatedAt', 'shopName', 'sharedBy', 'publishedAt'])
          && data.ownerUid == request.auth.uid && data.updatedAt == request.time
          && data.theme is map
          && data.theme.keys().hasAll(['accent', 'bg', 'cardBg', 'borderColor', 'textColor'])
          && data.theme.keys().hasOnly(['accent', 'bg', 'cardBg', 'borderColor', 'textColor', 'background', 'homepage'])
          && color(data.theme.accent) && color(data.theme.bg) && color(data.theme.cardBg)
          && color(data.theme.borderColor) && color(data.theme.textColor)
          && (!('background' in data.theme) || validSharedBackground(data.theme.background))
          && (!('homepage' in data.theme) || validSharedHomepage(data.theme.homepage));
      }
      function validPublication() {
        let data = request.resource.data;
        return !data.keys().hasAny(['shopName', 'sharedBy', 'publishedAt']) || (
          data.keys().hasAll(['shopName', 'sharedBy', 'publishedAt'])
          && data.shopName is string && data.shopName.size() >= 2 && data.shopName.size() <= 48
          && data.sharedBy is string && data.sharedBy.size() > 0 && data.sharedBy.size() <= 40
          && data.publishedAt is timestamp
        );
      }
      function writableCode() {
        return themeId.matches('^[a-z0-9][a-z0-9_-]{0,39}$')
          && !themeId.matches('^flux-(emerald|ocean|violet|rose|amber)$');
      }
      allow read: if true;
      allow create: if signedIn() && !isActiveBan() && writableCode() && validTheme() && validPublication()
        && (!('publishedAt' in request.resource.data) || request.resource.data.publishedAt == request.time);
      allow update: if signedIn() && !isActiveBan() && writableCode()
        && resource.data.get('ownerUid', request.auth.uid) == request.auth.uid
        && validTheme() && validPublication()
        && (!('publishedAt' in request.resource.data)
          || request.resource.data.publishedAt == request.time
          || request.resource.data.publishedAt == resource.data.get('publishedAt', null));
      allow delete: if signedIn() && (resource.data.get('ownerUid', '') == request.auth.uid || isFluxAdmin());
    }
    match /theme_backgrounds/{assetId} {
      function validAsset() {
        let data = request.resource.data;
        return assetId.matches('^[a-f0-9]{32}$')
          && data.keys().hasAll(['ownerUid', 'contentType', 'size', 'chunkCount', 'sha256', 'ready', 'createdAt'])
          && data.keys().hasOnly(['ownerUid', 'contentType', 'size', 'chunkCount', 'sha256', 'ready', 'createdAt'])
          && data.ownerUid == request.auth.uid && data.ready == false && data.createdAt == request.time
          && data.contentType in ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']
          && data.size is int && data.size > 0 && data.size <= 10485760
          && data.chunkCount is int && data.chunkCount >= 1 && data.chunkCount <= 20
          && data.size > (data.chunkCount - 1) * 524288 && data.size <= data.chunkCount * 524288
          && data.sha256 is string && data.sha256.matches('^[a-f0-9]{64}$');
      }
      allow get: if resource.data.ready || (signedIn() && resource.data.ownerUid == request.auth.uid);
      allow create: if signedIn() && !isActiveBan() && validAsset();
      allow update: if signedIn() && !isActiveBan() && resource.data.ownerUid == request.auth.uid
        && !resource.data.ready && request.resource.data.ready == true
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['ready']);
      // Published bytes remain stable when another creator reuses a background.
      allow delete: if isFluxAdmin() || (signedIn() && resource.data.ownerUid == request.auth.uid && !resource.data.ready);
      match /chunks/{chunkId} {
        function asset() { return get(/databases/$(database)/documents/theme_backgrounds/$(assetId)).data; }
        function writer() { return signedIn() && asset().ownerUid == request.auth.uid && !asset().ready; }
        allow get: if asset().ready || (signedIn() && asset().ownerUid == request.auth.uid);
        allow create: if writer() && !isActiveBan()
          && request.resource.data.keys().hasAll(['index', 'bytes']) && request.resource.data.keys().hasOnly(['index', 'bytes'])
          && request.resource.data.index is int && request.resource.data.index >= 0 && request.resource.data.index < asset().chunkCount
          && chunkId.matches('^[01][0-9]$') && int(chunkId) == request.resource.data.index
          && request.resource.data.bytes is bytes && request.resource.data.bytes.size() > 0 && request.resource.data.bytes.size() <= 524288
          && request.resource.data.bytes.size() == (request.resource.data.index == asset().chunkCount - 1 ? asset().size - request.resource.data.index * 524288 : 524288);
        allow delete: if writer() || isFluxAdmin();
      }
    }

    match /memorial_entries/{entryId} {
      allow read, create: if true;
      allow delete: if isFluxAdmin();
    }

    match /game_requests/{requestId} {
      allow read: if true;
      allow create: if request.resource.data.keys().hasOnly(['name','link','note','requester','up','down','status','createdAt'])
        && request.resource.data.name is string && request.resource.data.name.size() > 0 && request.resource.data.name.size() <= 80
        && request.resource.data.link is string && request.resource.data.link.size() <= 300
        && request.resource.data.note is string && request.resource.data.note.size() <= 300
        && request.resource.data.requester is string && request.resource.data.requester.size() <= 40
        && request.resource.data.up == 0 && request.resource.data.down == 0
        && request.resource.data.status == 'pending' && request.resource.data.createdAt == request.time;
      allow update: if (
          request.resource.data.diff(resource.data).affectedKeys().hasOnly(['up','down'])
          && request.resource.data.up >= 0 && request.resource.data.down >= 0
          && request.resource.data.up - resource.data.up <= 1 && request.resource.data.up - resource.data.up >= -1
          && request.resource.data.down - resource.data.down <= 1 && request.resource.data.down - resource.data.down >= -1
        ) || isFluxAdmin();
      allow delete: if isFluxAdmin();
    }

    match /game_statistics/{gameId} {
      allow read: if true;
      allow create: if gameId.matches('^game_[A-Za-z0-9_.-]+$')
        && request.resource.data.keys().hasOnly(['id', 'plays', 'updatedAt'])
        && request.resource.data.id is string && request.resource.data.id.size() > 0 && request.resource.data.id.size() <= 500
        && request.resource.data.plays == 1 && request.resource.data.updatedAt == request.time;
      allow update: if request.resource.data.diff(resource.data).affectedKeys().hasOnly(['plays', 'updatedAt'])
        && request.resource.data.id == resource.data.id && resource.data.plays is int && resource.data.plays >= 0
        && request.resource.data.plays == resource.data.plays + 1 && request.resource.data.updatedAt == request.time;
      allow delete: if false;
    }

    // Flux Chat Pro: direct messages, group chats, friends, and user search.
    function isChatProRoomMember(roomId) {
      return signedIn() && request.auth.uid in
        get(/databases/$(database)/documents/chat_rooms/$(roomId)).data.members;
    }

    function validChatProRole() {
      return request.resource.data.role == '' ||
        (request.resource.data.role == 'owner' && isFluxOwner()) ||
        (request.resource.data.role == 'admin' && isFluxAdmin() && !isFluxOwner()) ||
        (request.resource.data.role == 'mod' && isFluxStaff() && !isFluxAdmin());
    }

    function validChatProMessage(roomId) {
      return signedIn() && !isActiveBan()
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.room == roomId
        && request.resource.data.username is string && request.resource.data.username.size() > 0 && request.resource.data.username.size() <= 40
        && request.resource.data.avatar is string && request.resource.data.avatar.size() <= 40000
        && request.resource.data.profile is map
        && request.resource.data.text is string && request.resource.data.text.size() > 0 && request.resource.data.text.size() <= 500
        && request.resource.data.time is string && request.resource.data.time.size() <= 24
        && request.resource.data.timestamp == request.time
        && request.resource.data.owner is bool
        && (request.resource.data.owner == false || isFluxOwner())
        && request.resource.data.role is string && validChatProRole()
        && request.resource.data.mentions is list && request.resource.data.mentions.size() <= 10
        && (!('replyTo' in request.resource.data) || request.resource.data.replyTo is map)
        && !hasBlockedChatText(request.resource.data.text);
    }

    match /chat_rooms/{roomId} {
      allow read: if signedIn() && request.auth.uid in resource.data.members;
      allow create: if signedIn() && !isActiveBan()
        && request.resource.data.type in ['dm', 'group']
        && request.auth.uid in request.resource.data.members
        && request.resource.data.members.size() >= 2 && request.resource.data.members.size() <= 25;
      // A member can refresh a room's title/last activity or remove only themself.
      allow update: if signedIn() && request.auth.uid in resource.data.members && (
        request.resource.data.members == resource.data.members ||
        (request.auth.uid in resource.data.members && !(request.auth.uid in request.resource.data.members))
      );
      allow delete: if signedIn() && (resource.data.owner == request.auth.uid || isFluxStaff());

      match /messages/{messageId} {
        allow read: if isChatProRoomMember(roomId);
        allow create: if isChatProRoomMember(roomId) && validChatProMessage(roomId);
        allow update: if false;
        allow delete: if signedIn() && (resource.data.uid == request.auth.uid || isFluxStaff());
      }
    }

    // Firebase-backed Flux profiles. `chat_usernames` is a separate claimed-name
    // record so that one @username cannot be silently used by two accounts.
    function validChatUser() {
      return signedIn()
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.username is string
        && request.resource.data.username.matches('^[a-z0-9_]{3,20}$')
        && request.resource.data.avatar is string && request.resource.data.avatar.size() <= 40000
        && request.resource.data.profile is map;
    }

    function hasMyUsernameClaim() {
      return existsAfter(/databases/$(database)/documents/chat_usernames/$(request.resource.data.username))
        && getAfter(/databases/$(database)/documents/chat_usernames/$(request.resource.data.username)).data.uid == request.auth.uid;
    }

    match /chat_users/{userId} {
      allow read: if signedIn();
      allow create, update: if signedIn() && request.auth.uid == userId
        && validChatUser() && hasMyUsernameClaim();
      allow delete: if signedIn() && request.auth.uid == userId;
    }

    match /chat_usernames/{username} {
      allow read: if signedIn();
      allow create, update: if signedIn()
        && username.matches('^[a-z0-9_]{3,20}$')
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.username == username
        && existsAfter(/databases/$(database)/documents/chat_users/$(request.auth.uid))
        && getAfter(/databases/$(database)/documents/chat_users/$(request.auth.uid)).data.username == username;
      allow delete: if signedIn() && resource.data.uid == request.auth.uid
        && (!existsAfter(/databases/$(database)/documents/chat_users/$(request.auth.uid))
          || getAfter(/databases/$(database)/documents/chat_users/$(request.auth.uid)).data.username != username);
    }

    match /friend_requests/{requestId} {
      allow read: if signedIn() && (resource.data.from == request.auth.uid || resource.data.to == request.auth.uid);
      allow create: if signedIn() && !isActiveBan()
        && request.resource.data.from == request.auth.uid
        && request.resource.data.to is string && request.resource.data.to != request.auth.uid
        && request.resource.data.status == 'pending'
        && requestId == request.resource.data.from + '_' + request.resource.data.to;
      allow update: if signedIn() && resource.data.to == request.auth.uid
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status'])
        && request.resource.data.status == 'accepted';
      allow delete: if signedIn() && (resource.data.from == request.auth.uid || resource.data.to == request.auth.uid);
    }

    // Flux Social profiles, staff, bans, friends, rooms, messages, and reports.
    match /flux_social_profiles/{userId} {
      allow read: if signedIn();
      allow create, update: if signedIn() && request.auth.uid == userId
        && request.resource.data.name is string && request.resource.data.name.size() <= 40
        && request.resource.data.avatar is string && request.resource.data.avatar.size() <= 40000
        && request.resource.data.bio is string && request.resource.data.bio.size() <= 180;
      allow delete: if request.auth.uid == userId || isFluxOwner();
    }

    match /flux_staff/{email} {
      allow read: if signedIn() && (email == request.auth.token.email || isFluxOwner());
      allow create, update, delete: if isFluxOwner();
    }

    match /flux_bans/{userId} {
      allow read: if signedIn() && (request.auth.uid == userId || isFluxStaff());
      allow create, update: if isFluxStaff()
        && request.resource.data.issuedBy == request.auth.uid
        && validBanLength();
      allow delete: if isFluxAdmin();
    }

    match /flux_friend_requests/{requestId} {
      allow read: if signedIn() && request.auth.uid in resource.data.members;
      allow create: if signedIn() && !isActiveBan()
        && request.resource.data.from == request.auth.uid
        && request.resource.data.members.size() == 2 && request.auth.uid in request.resource.data.members
        && request.resource.data.status == 'pending';
      allow update: if signedIn() && request.auth.uid == resource.data.to
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status'])
        && request.resource.data.status in ['accepted', 'declined'];
      allow delete: if signedIn() && request.auth.uid in resource.data.members;
    }

    match /flux_social_rooms/{roomId} {
      allow read: if signedIn();
      allow create: if signedIn() && !isActiveBan() && (
        (roomId == 'global' && request.resource.data.type == 'global') ||
        (request.resource.data.type in ['dm', 'group'] && request.auth.uid in request.resource.data.members
          && request.resource.data.members.size() >= 2 && request.resource.data.members.size() <= 20)
      );
      allow update, delete: if signedIn() && (
        (resource.data.type in ['dm', 'group'] && request.auth.uid == resource.data.createdBy) || isFluxOwner()
      );

      match /messages/{messageId} {
        allow read: if signedIn() && isRoomMember(roomId);
        allow create: if signedIn() && isRoomMember(roomId) && !isActiveBan()
          && request.resource.data.authorId == request.auth.uid
          && request.resource.data.text is string && request.resource.data.text.size() > 0 && request.resource.data.text.size() <= 500
          && request.resource.data.avatar is string && request.resource.data.avatar.size() <= 40000;
        allow update: if signedIn() && isRoomMember(roomId)
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['reactions']);
        allow delete: if isFluxStaff();
      }
    }

    match /flux_chat_reports/{reportId} {
      allow create: if signedIn() && !isActiveBan()
        && request.resource.data.reporterId == request.auth.uid
        && request.resource.data.reason is string && request.resource.data.reason.size() > 0 && request.resource.data.reason.size() <= 500;
      allow read, update: if isFluxStaff();
      allow delete: if isFluxAdmin();
    }
    // Game reviews: one public review per signed-in account and catalog game.
    function reviewGameName(gameId) {
      return {
        '1': '1',
        '2048': '2048',
        'grindcraft': 'Grindcraft',
        'a-dance-of-fire-and-ice': 'A Dance Of Fire And Ice',
        '10-minutes-till-dawn': '10 Minutes Till Dawn',
        '12-mini-battles': '12 Mini Battles',
        'adventure-capitalist': 'Adventure Capitalist',
        'babel-tower': 'Babel Tower',
        'bacon-may-die': 'Bacon May Die',
        'big-ice-tower-tiny-square': 'Big Ice Tower Tiny Square',
        'big-neon-tower-tiny-square': 'Big Neon Tower Tiny Square',
        'big-tower-tiny-square-2': 'Big Tower Tiny Square 2',
        'volley-random': 'Volley Random',
        'vex-x3m': 'Vex X3M',
        'basket-random': 'Basket Random',
        'boxing-random': 'Boxing Random',
        'bob-the-robber-5': 'Bob The Robber 5',
        'bob-the-robber-2': 'Bob The Robber 2',
        'cluster-rush': 'Cluster Rush',
        'circloo-2': 'Circloo 2',
        'cookie-clicker': 'Cookie Clicker',
        'crossy-road': 'Crossy Road',
        'ultrakill': 'ULTRAKILL',
        'tag': 'TAG',
        'half-life': 'Half Life',
        'cs-go-clicker': 'Cs:Go Clicker',
        'minecraft-1-9-4': 'Minecraft 1.9.4',
        'block-the-pig': 'Block The Pig',
        'deadly-descent': 'Deadly Descent',
        'doge-miner': 'Doge Miner',
        'doge-miner-2': 'Doge Miner 2',
        'drift-boss': 'Drift Boss',
        'granny': 'Granny',
        'gun-spin': 'Gun Spin',
        'idle-dice': 'Idle Dice',
        'dreadhead-parkour': 'DreadHead Parkour',
        'we-become-what-we-behold': 'We Become What We Behold',
        'vex3': 'Vex3',
        'ragdoll-archers': 'Ragdoll Archers',
        'rooftop-snipers': 'Rooftop Snipers',
        'rooftop-snipers-2': 'Rooftop Snipers 2',
        'motox3m-2': 'MotoX3m 2',
        'motox3m-3': 'MotoX3m 3',
        'motox3m': 'MotoX3m',
        'mr-mine': 'Mr.Mine',
        'run-3': 'Run 3',
        'baldi-s-basics': 'Baldi\'s Basics',
        'capybara-clicker': 'Capybara Clicker',
        'minecraft-1-11-2': 'Minecraft 1.11.2',
        'minecraft-1-12-2': 'Minecraft 1.12.2',
        'just-one-boss': 'Just One Boss',
        'five-nights-at-freddy-s-1': 'Five Nights At Freddy\'s 1',
        'five-nights-at-freddy-s-2': 'Five Nights At Freddy\'s 2',
        'five-nights-at-freddy-s-3': 'Five Nights At Freddy\'s 3',
        'five-nights-at-freddy-s-4': 'Five Nights At Freddy\'s 4',
        'five-nights-at-winstons': 'Five Nights At Winstons',
        'bad-monday-simulator': 'Bad Monday Simulator',
        'bad-time-simulator': 'Bad Time Simulator',
        'sort-the-court': 'Sort The Court',
        'the-man-from-the-window': 'The Man From The Window',
        'five-nights-at-epsteins': 'Five Nights At Epsteins',
        'agar-io': 'Agar.io',
        'hollow-knight': 'Hollow Knight',
        '1v1-lol': '1v1.lol',
        'geometry-dash': 'Geometry Dash',
        'escape-road': 'Escape Road',
        'escape-road-2': 'Escape Road 2',
        'duck-life-2': 'Duck Life 2',
        'duck-life-3': 'Duck Life 3',
        'there-is-no-game': 'There Is No Game',
        'uno': 'UNO',
        'friday-night-funkin': 'Friday Night Funkin',
        'don-t-you-lecture-me-with-your-30-dollar-website': 'Don\'t You Lecture Me With Your 30 Dollar Website',
        'retro-bowl': 'Retro Bowl',
        'retro-ping-pong': 'Retro Ping Pong',
        'space-waves': 'Space Waves',
        'idle-breakout': 'Idle Breakout',
        'revolution-idle': 'Revolution Idle',
        'another-generic-code-studio': 'Another Generic Code Studio',
        'gladihoppers': 'Gladihoppers',
        'poly-track': 'Poly Track',
        'fluidism': 'Fluidism',
        'fruit-ninja': 'Fruit Ninja',
        'escape-road-3': 'Escape Road 3',
        'granny-2': 'Granny 2',
        'handulum': 'Handulum'
      }.get(gameId, '');
    }
    function validGameReview(data, gameId, userId) {
      let profilePath = /databases/$(database)/documents/chat_users/$(userId);
      let author = exists(profilePath) ? get(profilePath).data.username : 'Flux member';
      return data.keys().hasAll(['uid', 'gameId', 'gameName', 'authorName', 'rating', 'text', 'createdAt', 'updatedAt'])
        && data.keys().hasOnly(['uid', 'gameId', 'gameName', 'authorName', 'rating', 'text', 'createdAt', 'updatedAt'])
        && data.uid == userId && data.gameId == gameId
        && reviewGameName(gameId) != '' && data.gameName == reviewGameName(gameId)
        && data.authorName is string && data.authorName.size() <= 40 && data.authorName == author
        && data.rating is int && data.rating >= 1 && data.rating <= 5
        && data.text is string && data.text.size() <= 1200 && !hasBlockedChatText(data.text)
        && data.createdAt is timestamp && data.updatedAt == request.time;
    }
    match /game_reviews/{gameId}/reviews/{userId} {
      allow read: if true;
      allow create: if signedIn() && request.auth.uid == userId && !isActiveBan()
        && validGameReview(request.resource.data, gameId, userId)
        && request.resource.data.createdAt == request.time;
      allow update: if signedIn() && request.auth.uid == userId && !isActiveBan()
        && validGameReview(request.resource.data, gameId, userId)
        && request.resource.data.createdAt == resource.data.createdAt;
      allow delete: if signedIn() && (request.auth.uid == userId || isFluxStaff());
    }
    match /game_review_reports/{reportId} {
      allow create, update: if signedIn() && !isActiveBan()
        && request.resource.data.keys().hasAll(['gameId', 'authorUid', 'reporterUid', 'reason', 'createdAt'])
        && request.resource.data.keys().hasOnly(['gameId', 'authorUid', 'reporterUid', 'reason', 'createdAt'])
        && request.resource.data.reporterUid == request.auth.uid
        && request.resource.data.gameId is string && request.resource.data.authorUid is string
        && request.resource.data.authorUid != request.auth.uid
        && reportId == request.resource.data.gameId + '_' + request.resource.data.authorUid + '_' + request.auth.uid
        && exists(/databases/$(database)/documents/game_reviews/$(request.resource.data.gameId)/reviews/$(request.resource.data.authorUid))
        && request.resource.data.reason is string && request.resource.data.reason.size() > 0 && request.resource.data.reason.size() <= 500
        && request.resource.data.createdAt == request.time;
      allow read: if isFluxStaff();
      allow delete: if isFluxAdmin();
    }

  }
}
```

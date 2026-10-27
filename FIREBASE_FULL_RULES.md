# Full Flux Firestore rules

This is the merged version of the rules you pasted: it keeps your existing requests, themes, memorials, Hot games, and legacy Global Chat, then adds Flux Social. Replace the entire Rules editor contents with this ruleset, then click **Publish**.

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

    match /themes/{themeId} {
      allow read: if true;
      allow write: if signedIn();
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

    match /chat_users/{userId} {
      allow read: if signedIn();
      allow create, update: if signedIn() && request.auth.uid == userId
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.name is string && request.resource.data.name.size() > 0 && request.resource.data.name.size() <= 40
        && request.resource.data.avatar is string && request.resource.data.avatar.size() <= 40000;
      allow delete: if signedIn() && request.auth.uid == userId;
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
  }
}
```

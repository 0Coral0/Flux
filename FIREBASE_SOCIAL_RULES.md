# Flux Social Firestore rules

Paste the following **inside** the existing `match /databases/{database}/documents { ... }` block in Firebase Console. Keep the rest of your existing Flux rules (games, themes, requests, etc.) underneath it. Publish the rules before trying Social features.

```rules
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

function isRoomMember(roomId) {
  return get(/databases/$(database)/documents/flux_social_rooms/$(roomId)).data.type == 'global' ||
    request.auth.uid in get(/databases/$(database)/documents/flux_social_rooms/$(roomId)).data.members;
}

function isActiveBan() {
  return exists(/databases/$(database)/documents/flux_bans/$(request.auth.uid)) &&
    (get(/databases/$(database)/documents/flux_bans/$(request.auth.uid)).data.expiresAt == null ||
      get(/databases/$(database)/documents/flux_bans/$(request.auth.uid)).data.expiresAt > request.time);
}

function canIssueBan() {
  return isFluxOwner() || isFluxAdmin() || isFluxStaff();
}

function validBanLength() {
  return (isFluxOwner()) ||
    (isFluxAdmin() && request.resource.data.expiresAt != null &&
      request.resource.data.expiresAt <= request.time + duration.value(30, 'd')) ||
    (!isFluxAdmin() && isFluxStaff() && request.resource.data.expiresAt != null &&
      request.resource.data.expiresAt <= request.time + duration.value(1, 'd'));
}

match /flux_social_profiles/{userId} {
  allow read: if signedIn();
  allow create, update: if signedIn() && request.auth.uid == userId
    && request.resource.data.name is string
    && request.resource.data.name.size() <= 40
    && request.resource.data.avatar is string
    && request.resource.data.avatar.size() <= 40000
    && request.resource.data.bio is string
    && request.resource.data.bio.size() <= 180;
  allow delete: if request.auth.uid == userId || isFluxOwner();
}

// Role records are keyed by lower-case account email, e.g. flux_staff/person@example.com.
match /flux_staff/{email} {
  allow read: if signedIn() && (email == request.auth.token.email || isFluxOwner());
  allow create, update, delete: if isFluxOwner();
}

match /flux_bans/{userId} {
  allow read: if signedIn() && (request.auth.uid == userId || isFluxStaff());
  allow create, update: if canIssueBan() && validBanLength();
  allow delete: if isFluxAdmin();
}

match /flux_friend_requests/{requestId} {
  allow read: if signedIn() && request.auth.uid in resource.data.members;
  allow create: if signedIn() && !isActiveBan()
    && request.resource.data.from == request.auth.uid
    && request.resource.data.members.size() == 2
    && request.auth.uid in request.resource.data.members
    && request.resource.data.status == 'pending';
  allow update: if signedIn() && request.auth.uid == resource.data.to
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status'])
    && request.resource.data.status in ['accepted', 'declined'];
  allow delete: if signedIn() && request.auth.uid in resource.data.members;
}

match /flux_social_rooms/{roomId} {
  // Room details carry no message text. This lets clients find the rooms they
  // belong to; message access below remains private.
  allow read: if signedIn();
  allow create: if signedIn() && !isActiveBan() && (
    (roomId == 'global' && request.resource.data.type == 'global') ||
    (request.resource.data.type in ['dm', 'group'] &&
      request.auth.uid in request.resource.data.members &&
      request.resource.data.members.size() >= 2 &&
      request.resource.data.members.size() <= 20)
  );
  allow update, delete: if signedIn() && (
    (resource.data.type in ['dm', 'group'] && request.auth.uid == resource.data.createdBy) ||
    isFluxOwner()
  );

  match /messages/{messageId} {
    allow read: if signedIn() && isRoomMember(roomId);
    allow create: if signedIn() && isRoomMember(roomId) && !isActiveBan()
      && request.resource.data.authorId == request.auth.uid
      && request.resource.data.text is string
      && request.resource.data.text.size() > 0
      && request.resource.data.text.size() <= 500
      && request.resource.data.avatar is string
      && request.resource.data.avatar.size() <= 40000;
    // Reactions are the only client-editable part of an existing message.
    allow update: if signedIn() && isRoomMember(roomId)
      && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['reactions']);
    allow delete: if isFluxStaff();
  }
}

match /flux_chat_reports/{reportId} {
  allow create: if signedIn() && !isActiveBan()
    && request.resource.data.reporterId == request.auth.uid
    && request.resource.data.reason is string
    && request.resource.data.reason.size() > 0
    && request.resource.data.reason.size() <= 500;
  allow read, update: if isFluxStaff();
  allow delete: if isFluxAdmin();
}
```

The first signed-in player can create the empty global-room record. If you prefer, an owner can open Flux Social once to create it before players use chat.

# Firebase Hot games rules

Add this block inside `match /databases/{database}/documents` in the shared Firestore rules. It lets everyone read the five Hot games and add one play to a real game-stat document, while refusing deletes or edits to a game's identity.

```rules
match /game_statistics/{gameId} {
  allow read: if true;

  allow create: if gameId.matches('^game_[A-Za-z0-9_.-]+$')
    && request.resource.data.keys().hasOnly(['id', 'plays', 'updatedAt'])
    && request.resource.data.id is string
    && request.resource.data.id.size() > 0
    && request.resource.data.id.size() <= 500
    && request.resource.data.plays == 1
    && request.resource.data.updatedAt == request.time;

  allow update: if request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['plays', 'updatedAt'])
    && request.resource.data.id == resource.data.id
    && resource.data.plays is int
    && resource.data.plays >= 0
    && request.resource.data.plays == resource.data.plays + 1
    && request.resource.data.updatedAt == request.time;

  allow delete: if false;
}
```

Publish the merged rules in Firebase Console. Flux only displays stat documents whose `id` belongs to its current game catalog, and records at most one play per game per device every 30 seconds.

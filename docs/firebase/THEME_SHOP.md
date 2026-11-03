# Flux Theme Shop

The shop reads and publishes the existing `themes` collection. It adds no separate service or collection. Guests can browse, apply, and copy codes; signed-in users can publish and update codes they own. Flux originals use reserved `flux-*` codes and are bundled with the site.

## Sharing

1. Open **Theme Shop → Share a theme**.
2. Enter a saved code and preview it, or select **Use my current colors instead** to generate a new code.
3. Enter a name, then publish. The saved document includes all five colors, the publisher's UID, a public display name, and a publication timestamp. Emails and credentials are not included.

Existing `{accent, bg}` codes still load. Saving or publishing upgrades them to the full color format. Legacy codes without ownership can be claimed by the first signed-in user who next saves or publishes them; codes with an owner reject changes by another account. If a legacy code must belong to a specific person, assign its `ownerUid` administratively before enabling publishing.

## Firebase rules

The `/themes/{themeId}` block in [FIREBASE_FULL_RULES.md](FIREBASE_FULL_RULES.md) includes ownership and field validation. Deploy that updated block with the rest of the existing rules before releasing community publishing. Editing this repository does not update deployed Firebase rules. The older `allow write: if signedIn()` rule does not enforce code ownership on the server; client transactions are not a replacement for rules.

The shop orders by `publishedAt`, so unpublished saved codes stay out of the catalog. This uses the normal single-field index and cursor pagination; it does not need a compound index. Keep indexing enabled for `publishedAt`.

Sources: [Firebase field validation](https://firebase.google.com/docs/firestore/security/rules-fields), [query ordering](https://firebase.google.com/docs/firestore/query-data/order-limit-data).

## Verification

The local tests use a fake Firestore adapter to exercise publishing, ownership, legacy migration, and pagination without creating production listings. Validate the rule block in the Firebase Rules Playground or Emulator Suite before deploying it, including unsigned writes, owner updates, ownership transfer attempts, malformed colors, and legacy claims.

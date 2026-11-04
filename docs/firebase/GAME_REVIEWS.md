# Game reviews

Reviews use the existing Firebase project `aggw-themes`. The review rules were published on November 4, 2026, and the published source was verified against the locally tested candidate. All pre-existing live rules were preserved; only the review helpers and matches were appended.

`game_reviews/{gameId}/reviews/{uid}` contains one public review per game and account. The game ID is the same catalog slug used by direct game links. Rating summaries use Firestore count and average aggregation queries. Review pages load twelve items at a time.

An account can create, update, or delete its own review. Staff can remove reviews. Rules validate the catalog game and title, verified chat username (or `Flux member` fallback), integer rating from 1–5, text up to 1,200 characters, allowed fields, and server timestamps. Existing active chat bans also prevent review publishing. Guests can read reviews, including rating summaries.

Reports go to `game_review_reports/{gameId}_{authorUid}_{reporterUid}`. A reporter can report an existing review by another account and replace their own reason. Reports are private to staff; admins can delete them. Staff can inspect these reports in the Firebase console. No public test reviews were posted during development.

## Rules maintenance

[game-reviews.rules](game-reviews.rules) is a fragment to insert inside the existing `/databases/{database}/documents` match. It uses the existing `signedIn`, `isActiveBan`, `hasBlockedChatText`, `isFluxStaff`, and `isFluxAdmin` helpers. The full setup guide also includes this fragment. Do not deploy a fragment alone or overwrite unrelated live rules from an outdated guide.

When adding or renaming catalog games, update the `reviewGameName` map in the fragment and full guide, test, and publish the amended live rules. Keep existing slugs stable when renaming a game if preserving old links and reviews is required.

## Validation

The official Firestore emulator passed 25 checks for public reads, account ownership, creation and editing, deletion, verified author names, malformed ratings and content, bans, reports, and fallback author names. Start an isolated emulator on `127.0.0.1:3039` using project `demo-flux-reviews` and the complete candidate rules, then run:

```sh
node scripts/test-review-rules.cjs
```

This script is restricted to that local demo endpoint and never writes to production. App logic tests run with `npm test`.

## Personalization storage

Homepage preferences use `flux_home_preferences_v1` locally and `homepage` in the account's existing settings document. Wallpaper preferences use `flux_background_preferences_v1`; uploaded original image bytes stay in IndexedDB (`flux-personal-media/backgrounds`). Wallpaper uploads do not publish files to Firebase or other users. Animated bytes are retained without canvas re-encoding. Lite Mode and reduced motion detach the wallpaper source and revoke temporary URLs.

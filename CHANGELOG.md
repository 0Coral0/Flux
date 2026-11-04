# Changelog

## 3.4.0 — 2026-11-04

- Added direct game links and a Share button below the player.
- Added image backgrounds from links and uploads, including animated images, with tint, blur, and fit controls. Backgrounds stay on the device and pause in Lite Mode or reduced motion.
- Added homepage customization: move and hide sections, adjust game columns, and choose a compact welcome banner. Signed-in accounts can sync the layout.
- Extended Theme Shop codes to include optional backgrounds and homepage layouts. Shared uploads retain their animation, with small still previews for browsing.
- Added shared star ratings and game reviews, with editing, deletion, and reporting. Guests can read reviews.

Review rules were published to the existing Firebase project on November 4, 2026. See [review setup and validation](docs/firebase/GAME_REVIEWS.md).

## 3.3.0 — 2026-11-03

- Unified themes across Flux and its submission and takedown pages.
- Refined navigation and made the vertical sidebar the default for new visitors.
- Moved community and support links to footer icons.
- Removed Browser, Assistant, Movies, and Credits from navigation.
- Added first-visit onboarding for colors, layout, sign-in, and guest access.
- Added Theme Shop with named community palettes, theme codes, and five bundled originals.
- Added alphabetical game sorting and six randomized recommendations per open or refresh.
- Moved player controls beneath the game and improved the mobile player.
- Removed Duck Life 4 from the catalog.
- Reduced background rendering, paused effects during games, and improved startup and game browsing.
- Added Lite Mode in Settings to reduce effects, pause particles, and skip startup animations.
- Reformatted release history into grouped notes.

Theme Shop's Firestore ownership and background-sharing rules were deployed on November 4, 2026. The [Firebase setup guide](docs/firebase/THEME_SHOP.md) documents the format and maintenance steps.

Older release notes are maintained in `changelogData.js` and the site's changelog.

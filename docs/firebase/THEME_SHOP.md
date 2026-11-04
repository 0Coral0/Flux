# Flux Theme Shop

The shop reads and publishes the existing `themes` collection. Guests can browse, apply, and copy codes; signed-in users can publish and update codes they own. Flux originals use reserved `flux-*` codes and are bundled with the site. Themes can include backgrounds and homepage layouts as well as colors.

## Sharing

1. Open **Theme Shop → Share a theme**.
2. Enter a saved code and preview it, or select **Use my current look instead** to generate a new code.
3. Choose whether to include the background and homepage layout. Background sharing includes tint, blur, and image fit. Homepage sharing includes section order, hidden sections, game columns, and banner size. Account details, history, navigation, and Lite Mode preferences are not included.
4. Enter a name, then publish. The form explains that included backgrounds become public. Uploaded images stay local until the user chooses to publish a theme containing them. Emails, credentials, local file paths, and original upload filenames are not published.

Applying a theme downloads its included background and saves it locally. Animated image bytes are retained exactly; a small still preview is used in the shop. Lite Mode and reduced motion continue to pause image backgrounds. A color-only theme leaves the visitor's background and homepage layout as they were. Updating colors on an existing code preserves its shared background and layout.

Existing `{accent, bg}` codes still load. Saving or publishing upgrades them to the full color format. Legacy codes without ownership can be claimed by the first signed-in user who next saves or publishes them; codes with an owner reject changes by another account. If a legacy code must belong to a specific person, assign its `ownerUid` administratively before enabling publishing.

## Firebase rules

The rules in [theme-shop.rules](theme-shop.rules) and [FIREBASE_FULL_RULES.md](FIREBASE_FULL_RULES.md) include ownership, bundle validation, and background media access. They were deployed to `aggw-themes` on November 4, 2026. Existing unrelated live rules were preserved, including game reviews. Changes to rule files require a separate Firebase deployment.

`theme.background` is optional: `{kind:'url', url, tint, blur, fit}` or `{kind:'asset', assetId, tint, blur, fit}`. A small `preview` data image is optional; `{kind:'none'}` explicitly restores a theme background. Only credential-free HTTPS links are shareable. Legacy color-only codes still load.

`theme.homepage` is optional: `{order, hidden, columns, hero}`. Values are allowlisted and do not include account data or the local/cloud sync timestamp.

## Uploaded media

Uploads use `theme_backgrounds/{assetId}` metadata and its `chunks/{00..19}` documents. Files are limited to 10 MiB, stored as original bytes in chunks no larger than 512 KiB, and written/read four at a time. Catalog entries contain only the media ID and a still preview of at most 24,000 characters; the full image loads only when applying a theme. This uses the project's existing Firestore service without adding a hosting provider or billing-plan dependency.

Draft media is readable only by its creator. A ready asset and its chunks are publicly readable and immutable so that reusing an image in another theme does not break existing codes. Failed uploads attempt to remove their unpublished chunks. A SHA-256 digest, byte counts, MIME signature, and chunk sequence are verified before applying a downloaded image. A missing or corrupt image leaves the existing background in place. Ready assets remain available if their original theme is renamed or updated; admins can remove inappropriate assets in Firebase, and should remove associated chunks when doing so.

The shop orders by `publishedAt`, so unpublished saved codes stay out of the catalog. This uses the normal single-field index and cursor pagination; it does not need a compound index. Keep indexing enabled for `publishedAt`.

Sources: [Firebase field validation](https://firebase.google.com/docs/firestore/security/rules-fields), [query ordering](https://firebase.google.com/docs/firestore/query-data/order-limit-data).

## Verification

Adapter tests cover publication choices, legacy codes, preservation of shared extras, exact animated-byte reconstruction, corrupted media, failed-upload cleanup, and Lite Mode. The official Firestore emulator passed 34 theme rules checks, including draft privacy, immutable public assets, ownership, guest writes, malformed layouts, unsafe links, and reuse by another creator. Browser checks published only to the isolated demo emulator, then applied the resulting code as a separate guest. No test themes or media were published to the live shop.

With the complete candidate rules loaded in an emulator on `127.0.0.1:3039` for project `demo-flux-reviews`, run `node scripts/test-theme-shop-rules.cjs`. Normal app tests run with `npm test`.

# Flux AdSense setup

The Home and Games banner placements are wired for manual AdSense display ads.
Live ads are **disabled** in `js/ads-config.js`. Localhost always shows mockups;
Vercel never loads the ad provider. The publisher ID is configured; ad unit slot IDs are still pending.
The only configured advertising host is `flux-o8vp.onrender.com`; Netlify is not enabled.
The static ownership meta tag is in `index.html`, and the supplied seller record is in root `ads.txt`.

## Account and site review

1. [Create your AdSense account](https://adsense.google.com/start/). Complete the account, identity, payment, and terms steps yourself in Google.
2. Add `https://flux-o8vp.onrender.com/` in AdSense's **Sites** area. Keep `hosts` limited to this Render address; do not include Netlify, Vercel, or test deployments.
3. Send the public publisher ID (`ca-pub-…`) and Google's verification snippet. We will publish the supplied static verification meta tag and `ads.txt` entry; then request site review in AdSense. Do not enable live ads while review is pending.
4. Configure AdSense **Privacy & messaging** and the site's privacy disclosures before activation. The Flux advertisement preference controls whether the provider loads; it does not replace advertising consent. Google's certified CMP handles the applicable regional consent choices.
5. After approval, create two responsive **Display** ad units under **Ads → By ad unit**, named Home banner and Games banner. Send their code or numeric slot IDs. Keep **Auto ads off** so ads stay in Flux's chosen spaces.
6. Fill in the real publisher ID, exact approved production hostnames, and both slot IDs in `js/ads-config.js`, then set `enabled: true` and deploy.

Only public IDs/code belong in the repository. Do not share Google passwords,
identity documents, payment information, or sign-in codes in chat or source files.

## Runtime behavior

- Missing configuration or `enabled: false` preserves the existing preview boxes.
- Only HTTPS on explicitly listed Render/Netlify hosts can request real ads.
- A banner initializes only when it has layout space and is visible. Hidden pages do not request ads. Each placement initializes at most once per document; navigation does not refresh existing ads.
- **Settings → Appearance → Show advertisements** saves a separate device preference. Turning off an already loaded provider reloads the page before suppressing ad code. Storage-blocked browsers use a `flux-ads=off` URL fallback.
- No timed ad refreshes, popups, or ads inside the game player are added.

References: [Connect and verify your site](https://support.google.com/adsense/answer/7584263?hl=en),
[get ad unit code](https://support.google.com/adsense/answer/9274019?hl=en),
[responsive banner parameters](https://support.google.com/adsense/answer/9183460?hl=en),
[consent requirements](https://support.google.com/adsense/answer/13554116?hl=en).

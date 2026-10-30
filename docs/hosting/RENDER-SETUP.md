# Flux on Render: wake on request

> Organized under `docs/hosting` as part of the project documentation.

This file prepares the **Discord bridge** for Render's Free web-service plan. It intentionally does **not** send keep-awake pings. Render can put the bridge to sleep after 15 minutes without an incoming request; the next Flux request wakes it, which can take around a minute. Discord reconnects when the service starts again.

## What this hosts

- Discord Chat and Discord DMs
- Hot game counters
- Firebase-authenticated Flux bridge APIs

It does not host Ollama. Leave `OLLAMA_MODEL` empty on Render until Flux AI is redesigned to use a hosted model. The browser proxy is intentionally not included: an Internet-facing proxy needs an isolated origin and outbound firewall controls that a free Render web service does not provide.

## Create the service

1. Put this Flux repository on GitHub, then create a free Render account and choose **New → Blueprint**. Select the repository; Render reads `render.yaml` and finds the bridge.
2. Before clicking Create, fill the requested private environment values in Render's secret fields. Do not commit them to GitHub or send them in chat:
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_GUILD_ID`
   - `FIREBASE_SERVICE_ACCOUNT_JSON` — paste the complete contents of the existing Firebase service-account JSON file
   - `DISCORD_WEBHOOK_URLS` — paste the existing JSON mapping if Flux uses webhooks
   - `FLUX_CREATOR_UIDS` — optional, for the creator recognition setting
3. Deploy. Render will give the service a URL like `https://flux-community-bridge.onrender.com`.
4. In the Render environment settings, set both public values to their exact final HTTPS origins:
   - `BRIDGE_PUBLIC_URL=https://YOUR-BRIDGE.onrender.com`
   - `FLUX_SITE_ORIGIN=https://YOUR-FLUX-SITE.vercel.app`
5. Redeploy, then visit `https://YOUR-BRIDGE.onrender.com/healthz`. It should return `{ "ready": true }`.
6. Change only the public URL in `js/discord-config.js` to the Render bridge URL, then deploy the static Flux site to Vercel. Add that Vercel hostname to Firebase Authentication's authorized domains.

## No always-on pings

There is no monitor, scheduled job, or hidden keep-awake signal in this setup. The bridge sleeps normally when unused. The first Chat, Hot-games, or other bridge request after it sleeps may take up to about a minute while Render starts it again.

## Before publishing

Confirm the Vercel address and the Render bridge URL, then test sign-in, a Discord message, Hot games, and a cold wake from a separate browser. Do not publish the website or give third parties access until those tests work.

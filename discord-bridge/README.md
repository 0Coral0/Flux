# Flux community service: Discord + Ollama

This worker serves the **Discord Chat**, **Discord DM**, and **Assistant** pages in Flux. It runs alongside the existing Wisp proxy on the VM, on a separate port. It does not replace the proxy. The former Firestore global-chat relay is superseded by this dedicated Discord interface; Global Chat remains Flux-only.

## What to set up

1. **Discord application:** at https://discord.com/developers/applications create the Flux bot. Give it a permanent bot avatar/banner you like, enable **Message Content Intent**, and invite it with the bot scope. Grant **View Channel**, **Read Message History**, **Send Messages**, and **Embed Links** in the channel to bridge. That channel's last 50 messages will be visible to signed-in Flux users, so use a channel intended for that audience.
2. **Channel webhook:** create a webhook in that same channel (Discord channel settings → Integrations). Its name and avatar are overridden for each Flux message. Profile banners appear as image cards beneath messages. Discord's global bot banner/avatar are shared account settings; they are not changed on every message. Without the webhook, messages use the fixed bot identity with a sender label.
3. **Firebase sign-in:** in project `aggw-themes`, enable Authentication → Email/Password and add the Flux site's domain to authorized domains. Flux's Profile page now has sign-in/create-account controls. The server verifies Firebase ID tokens, including revocation checks; tokens and account identifiers are never accepted from request bodies.
4. **Private storage:** create a separate Firestore Standard database named **`flux-community`** in that project. Deploy the included `firestore.rules` to **that database only** (deny all browser reads/writes). Do not replace the existing default database's rules. This isolates invitation codes, contact mappings and DM history from the old global chat's rules. Create a private server service account with the required Firestore read/write access and Firebase Authentication permission to check token revocation. Keep its JSON key outside the repository, with restricted file permissions.
5. **VM worker:** install Node.js 22.12+ and copy this `discord-bridge` folder to the VM. Run `npm ci`, copy `.env.example` to `.env`, and fill it in. `GOOGLE_APPLICATION_CREDENTIALS` is the absolute path to the private service-account JSON. `FLUX_SITE_ORIGIN` is the exact website origin, for example `https://flux.example`, without a path. `BRIDGE_PUBLIC_URL` is the HTTPS address you give this worker. Keep `.env` private.
6. **HTTPS routing:** expose this worker's `127.0.0.1:3031` through your reverse proxy or tunnel, including `/api/` and `/media/`. Allow POST bodies up to 1.1 MB and an AI response timeout of at least 130 seconds. Add edge rate limits for `/api/` and `/media/`; the service also applies per-account send and AI limits. Keep the Wisp proxy's existing address and service unchanged. Run one community worker under a process manager/systemd and start it with `npm start`.
7. **Website address:** set `window.FLUX_DISCORD_BRIDGE_URL` in `js/discord-config.js` to the worker's public HTTPS address, then publish the website. No bot token, webhook URL, or service-account key belongs in website files. The worker folder is excluded from the static Vercel upload.

## Ollama on the VM

Gemini is not required. Install Ollama from its official site on the VM and pull a local model that fits its RAM/GPU, then set `OLLAMA_MODEL` to the exact installed model name. For an initial small-model trial, the official FAQ uses `llama3.2`; review its download size/license before pulling it. Keep `OLLAMA_URL=http://127.0.0.1:11434`; the browser calls this service, which calls Ollama locally. Do not publicly expose Ollama's port. Set `OLLAMA_NO_CLOUD=1` if you want local-only operation.

The local model has no per-request provider API charge, but the VM's compute/storage still cost whatever your host charges. CPU inference works but may be slow or compete with the browser proxy. I have not inspected the VM's hardware, so performance is unverified. If necessary, move Ollama to a more capable machine and use a private network connection. This implementation limits requests to 512 output tokens and one active model request per worker. Leave `OLLAMA_MODEL` blank to keep Assistant unavailable until ready. No cloud fallback is configured.

References: https://docs.ollama.com/faq and https://docs.ollama.com/api/chat

## How private Discord conversations work

Sign in on Flux → Chat → Discord DM → **Invite Discord contact**. Privately share the generated code and the bot's Discord profile with your intended contact. They DM the bot `!flux CODE` within ten minutes to consent. Codes are random, single-use and replaced by a new invite. They must be able to DM the bot (Discord privacy/server settings may block DMs).

Once accepted, Flux messages reach that contact from the **Flux bot**, clearly labelled with the Flux sender name. The contact's replies to the bot appear only in that signed-in Flux account's DM view. `!unlink` in Discord or **Disconnect contact** in Flux ends the mapping. Each Flux account and Discord recipient can have one active private pairing at a time, so replies cannot be mixed between senders. Disconnect before pairing another contact; new pairings have separate histories. This is not a collection of separate Discord accounts. User display names are chosen profiles, not proof of Discord identity.

DMs are private from other website users through the authenticated service, not end-to-end encrypted. The bot/server operator and Discord process their content. Old histories remain in the private database after disconnect and are not shown to new pairings. The operator should set an appropriate retention policy; uploaded profile media are public via their unlisted media URLs and should not contain private information. Expired invitation records and obsolete profile media need periodic cleanup.

## Verification before going live

- `npm test` checks request authentication, private history isolation, invitation lifecycle, per-account limits, profile validation, and the Ollama request contract. These tests use fake Discord/model transports and an in-memory database transaction adapter.
- Sign in with two different Flux accounts. Send a unique message in Discord Chat and reply in Discord. Confirm sender avatars and banners. Verify the selected Discord channel only is shown.
- Pair account A to a consenting Discord contact; send both ways. Account B must see no private messages. Reuse an accepted code and an expired code; both must fail. Disconnect and verify future Discord replies do not reach Flux.
- Send an Assistant prompt and check the VM's memory/CPU and response time. Keep Ollama loopback-only.
- Test the game Fullscreen button in a browser: only the player should fill the display. Escape returns to the site. Check profile and banner crops on a phone-sized screen too.

New messages and the last 50 shared-channel messages are supported. Edits/deletions in the shared channel appear on the next poll; private messages are captured while the worker is connected. Private edits, deletions, reactions, and downtime recovery are not implemented. Message sends are not exactly-once: retrying after an uncertain failure may duplicate a send. Keep this as a draft until real credentials and live Discord/Firebase/VM checks have passed.

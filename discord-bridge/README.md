# Flux ↔ Discord bridge

Bridges Flux's existing Firestore `messages` collection (`global_general`) with one Discord server text channel. DMs are excluded. Sender names are labelled. Bot/webhook messages are ignored, Discord mentions are disabled, and attachment URLs from Discord appear as links in Flux. Flux messages longer than 2,000 characters are truncated for Discord.

## Setup

1. Install Node.js 22.12 or newer on an always-on computer or worker host.
2. Create a bot at https://discord.com/developers/applications. Under Bot, enable **Message Content Intent**. Invite the bot with the bot scope and **View Channel** and **Send Messages** permissions to the selected server channel.
3. Create a Firebase service account for Flux's existing project `aggw-themes` with permission to read/write Firestore. Store its JSON key outside the repository and website.
4. In this folder, copy `.env.example` to `.env`. Set the bot token, Discord channel ID (enable Developer Mode in Discord to copy it), and absolute service-account path.
5. Run `npm install`, `npm test`, then `npm start`. Keep exactly one bridge process running.

Never put the bot token or service-account JSON in frontend JavaScript, GitHub, or the public website. Server credentials use Firebase Application Default Credentials:
https://firebase.google.com/docs/admin/setup
Discord gateway intent documentation:
https://discord.com/developers/docs/events/gateway#gateway-intents

## Behavior and verification

Open Flux Chat in Firebase Live Sync mode. Send a unique message in Global Chat and check Discord; reply in the configured Discord channel and check Flux. Other channels and Flux DMs should stay separate. Restart the process and confirm old messages do not flood Discord.

This initial version bridges new messages while running; it skips Flux history and messages sent while the process is stopped. It does not sync edits, deletions, reactions, or uploaded files from Flux. Local-storage fallback messages cannot be bridged. Polling every two seconds reads messages created since startup, so restart periodically for a small community; use a cursor/queue before scaling to high volume.

Receipts and Discord nonces reduce duplicate sends during retries, but this is not an exactly-once delivery system. A crash between sending and saving a receipt may duplicate a message. Run a single worker. Incoming Discord writes retry five times; failures are logged and need manual recovery.

The bridge uses server credentials and bypasses Firestore browser rules. Keep existing browser rules restrictive and validate client messages: the bridge does not authenticate Flux's locally chosen display names. Discord usernames are labels, not linked Flux accounts.

This is a standalone worker: do not deploy it as a Vercel request handler or add its secrets to the browser app. Flux's existing chat UI already reads the required message fields, so no website changes are needed.

# Host Flux away from the school network

This setup keeps the **website** and the long-running **Flux bridge** online even when your PC is off:

- Deploy the static Flux site to Vercel.
- Run the Discord, Firebase, Hot games, and Flux AI bridge on an Oracle Cloud Always Free Ubuntu VM.

Vercel is great for the website files, but it cannot keep Flux's Discord bot connected because that bot is a permanent process. Do not put bot tokens, webhook URLs, or Firebase service-account keys in Vercel or in the website repository.

## Before starting

You need an Oracle Cloud account, a free VM in your home region, and a hostname such as `bridge.example.com` pointing at the VM. Oracle may ask for phone/card verification when the account is created. Do that part yourself; never paste those details, your bot token, or service-account JSON into chat.

You also need the existing private `discord-bridge/.env` values and a Firebase service-account JSON file. Copy both to the VM, outside Git. Keep Ollama loopback-only; it must never be exposed to the internet.

## On the VM

Install Docker Engine and Caddy using their official installation instructions, then clone Flux. In the Flux folder:

1. Put the Firebase service-account JSON at `/srv/flux/secrets/flux-firebase-service-account.json` and restrict its permissions to the VM administrator.
2. Copy `discord-bridge/.env.example` to `discord-bridge/.env`, then fill the existing private values. Use these public-address values:

   ```dotenv
   FLUX_SITE_ORIGIN=https://YOUR-VERCEL-SITE.vercel.app
   BRIDGE_PUBLIC_URL=https://bridge.example.com
   BRIDGE_BIND_HOST=0.0.0.0
   TRUST_PROXY_CLIENT_IP=true
   ```

   Keep `OLLAMA_URL=http://127.0.0.1:11434`. Leave `OLLAMA_MODEL` blank if you have not installed a model on the VM yet; Chat and Hot games still work, while Assistant clearly reports that it is not configured.
3. Create a Git-ignored `deployment.env` next to `docker-compose.bridge.yml`:

   ```dotenv
   FLUX_FIREBASE_SERVICE_ACCOUNT_PATH=/srv/flux/secrets/flux-firebase-service-account.json
   ```

4. Copy `Caddyfile.example` into Caddy's configuration, replacing `bridge.example.com` with your hostname. Permit inbound TCP 80 and 443 in Oracle's network/security rules. Keep port 3032 closed to the internet.
5. Start the bridge:

   ```sh
   docker compose --env-file deployment.env -f docker-compose.bridge.yml up -d --build
   ```

6. Check its local health endpoint from the VM:

   ```sh
   curl http://127.0.0.1:3032/healthz
   ```

   It should return `{"ready":true}`. Then check `https://bridge.example.com/healthz` in a browser.

## Connect the website

After the HTTPS bridge works, set the non-secret public bridge address in `js/discord-config.js`:

```js
window.FLUX_DISCORD_BRIDGE_URL = 'https://bridge.example.com';
```

Deploy the static site to Vercel only after that address is ready. Add the Vercel site hostname to Firebase Authentication's authorized domains. The bridge's `FLUX_SITE_ORIGIN` must exactly match the Vercel site's `https://...` origin.

## Ollama choice

The Oracle free VM can run Ollama, but model speed depends on which Always Free VM capacity you receive and can be slow without a GPU. Start with a small model such as `llama3.2` only after confirming enough VM memory. If you want faster Assistant replies, choose a hosted AI provider later; that is a separate design change because it needs a provider account and private API key.

## Safety checklist

- Never expose port 3032 or 11434 publicly.
- Never commit `.env`, `deployment.env`, bot tokens, webhooks, or service-account JSON.
- Keep the Docker port bound to `127.0.0.1` exactly as supplied.
- Caddy must overwrite `X-Flux-Client-IP`; that is why the bridge only trusts it when `TRUST_PROXY_CLIENT_IP=true`.
- Test sign-in, Hot games, Discord chat, and Assistant from the Vercel address before relying on it at school.

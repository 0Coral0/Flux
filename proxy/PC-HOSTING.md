# PC-hosted Flux proxy

Run **Start Public Flux Proxy.cmd** from the Flux repository folder. Leave its window open while using the public browser. The PC must stay on, awake, and connected to the Internet.

The launcher starts the local Flux preview and an email-protected Cloudflare Quick Tunnel. It reads the temporary HTTPS address, starts the proxy backend with the correct origin, and updates `js/browser-config.js`. If Cloudflare exits, the launcher reconnects and repeats this process. The tunnel itself retries temporary network interruptions before exiting.

The Cloudflare executable is downloaded from Cloudflare's official GitHub release when missing and saved under the ignored `proxy/.tools/` directory. No Windows service or startup task is installed.

## Access

Open the printed proxy address directly and complete Cloudflare's email verification. Only the addresses listed in `proxy/tunnel-settings.local.json` are allowed. This settings file is local and ignored by Git. If you need to recreate it, copy `tunnel-settings.example.json` to that filename and set your allowed email addresses.

Some browsers block sign-in inside an embedded frame. Complete sign-in at the proxy address first. If the embedded browser still cannot authenticate, use the direct proxy address in its own tab.

## Updating the deployed Flux site

With `autoPublish` enabled in the local settings, the launcher commits **only** `js/browser-config.js` and pushes `main` to the Flux GitHub repository. This assumes the initial Browser integration has already been committed and pushed. Other staged files are excluded from the address commit; all existing commits on main are included in the push. It does not force-push or merge remote changes automatically.

When `useDeployKey` is enabled, the launcher uses the repository-specific SSH key at `proxy/.tools/flux-tunnel-key` and the verified GitHub host keys at `proxy/.tools/known_hosts`. The private key stays on this PC and is ignored by Git. Revoke it under the Flux repository's GitHub **Settings → Deploy keys** if the PC or key is compromised.

When GitHub receives a new address commit, a connected Vercel Git deployment needs to finish before the new address appears on the live Flux site. Refresh Flux afterward. If publishing fails, the launcher keeps the proxy running and displays the error; sign in or resolve the Git issue and push main manually. Reopen the launcher to resume automated publishing after a fix.

## Stopping and restarting

Press **Ctrl+C** in the launcher to stop sharing. Starting it again creates a new address. If the launcher was interrupted abruptly and reports that it is already running, first check whether its earlier window is still open. It cleans up a stale lock automatically when the previous launcher process no longer exists.

Quick Tunnels are intended for testing, have no uptime guarantee, and their addresses change on recreation. They are not permanent hosting. See [Cloudflare's Quick Tunnel documentation](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

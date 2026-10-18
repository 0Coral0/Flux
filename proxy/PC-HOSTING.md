# PC-hosted Flux proxy

On Debian Linux ARM64, use Node.js 22 or later and install the Linux ARM64 `cloudflared` executable at `/usr/local/bin/cloudflared`. From the `proxy` directory, run `node tunnel-launcher.mjs` only when you are ready to start a public tunnel. Leave the terminal open while using the public browser. The computer must stay on, awake, and connected to the Internet.

The launcher starts the local Flux preview and a Cloudflare Quick Tunnel protected by proxy-side access-code authentication. It reads the temporary HTTPS address, starts the proxy backend with the correct origin, and updates `js/browser-config.js`. If Cloudflare exits, the launcher reconnects and repeats this process. The tunnel itself retries temporary network interruptions before exiting.

The launcher checks that `/usr/local/bin/cloudflared` is executable. It does not download a binary or install a service or startup task.

## Access

Copy `tunnel-settings.example.json` to `tunnel-settings.local.json` if needed, then enter your own long, random private `accessCode` (at least 16 characters). The example placeholder is rejected. Keep `autoPublish` and `useDeployKey` false for manual publishing. Restrict the file with `chmod 600 tunnel-settings.local.json`; it is ignored by Git and must never be committed. Open the printed proxy address directly and sign in with your private access code.

Some browsers block sign-in inside an embedded frame. Complete sign-in at the proxy address first. If the embedded browser still cannot authenticate, use the direct proxy address in its own tab.

## Updating the deployed Flux site

With `autoPublish` enabled in the local settings, the launcher commits **only** `js/browser-config.js` and pushes `main` to the Flux GitHub repository. This assumes the initial Browser integration has already been committed and pushed. Other staged files are excluded from the address commit; all existing commits on main are included in the push. It does not force-push or merge remote changes automatically.

When `useDeployKey` is enabled, the launcher uses the repository-specific SSH key at `proxy/.tools/flux-tunnel-key` and the verified GitHub host keys at `proxy/.tools/known_hosts`. The private key stays on this PC and is ignored by Git. Revoke it under the Flux repository's GitHub **Settings → Deploy keys** if the PC or key is compromised.

When GitHub receives a new address commit, a connected Vercel Git deployment needs to finish before the new address appears on the live Flux site. Refresh Flux afterward. If publishing fails, the launcher keeps the proxy running and displays the error; sign in or resolve the Git issue and push main manually. Reopen the launcher to resume automated publishing after a fix.

## Stopping and restarting

### Debian systemd user service

The unit in `systemd/flux-tunnel.service` is configured for `~/Flux/proxy` and `/usr/bin/node`. Install it in `~/.config/systemd/user/`, run `systemctl --user daemon-reload`, then `systemctl --user enable --now flux-tunnel.service`. Stop any manually launched copy first. The service supervises the existing launcher, which owns the preview, backend and cloudflared; do not enable a separate cloudflared service for the same proxy.

The service restarts after exits with a 10-second delay, uses a nonblocking file lock plus the launcher's PID lock to prevent duplicate launchers, and stops the whole process group before restarting. A preview failure stops the launcher so systemd can recover it. Tunnel and backend failures are retried by the launcher. Service mode requires `autoPublish: false`. Private settings stay in the ignored local JSON file, outside the unit; new service files use a restrictive umask.

Use `systemctl --user status flux-tunnel.service` for status, `journalctl --user -u flux-tunnel.service -f` for logs, and `systemctl --user stop flux-tunnel.service` to stop sharing. Use `systemctl --user disable --now flux-tunnel.service` to stop sharing and disable startup. The current public URL is in `.runtime/current-address.txt` once the backend is ready; it changes when a Quick Tunnel is recreated. Logs use the host journal's retention policy and may not survive a Linux reboot if its journal is volatile.

Startup is tied to the Linux environment's user manager and `default.target`. Lingering is already enabled on this Chromebook. This does not start the Linux VM at ChromeOS boot or keep it running through shutdown, logout or Chromebook sleep. Open Terminal to start Linux after reboot; network interruptions may require tunnel reconnection and a new address. This Chromebook is not an always-on host.

Press **Ctrl+C** in the launcher to stop sharing. Starting it again creates a new address. If the launcher was interrupted abruptly and reports that it is already running, first check whether its earlier window is still open. It cleans up a stale lock automatically when the previous launcher process no longer exists.

Quick Tunnels are intended for testing, have no uptime guarantee, and their addresses change on recreation. They are not permanent hosting. See [Cloudflare's Quick Tunnel documentation](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

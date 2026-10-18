# PC-hosted Flux proxy

On Debian Linux ARM64, use Node.js 22 or later and install the Linux ARM64 `cloudflared` executable at `/usr/local/bin/cloudflared`. From the `proxy` directory, run `node tunnel-launcher.mjs` only when you are ready to start a public tunnel. Leave the terminal open while using the public browser. The computer must stay on, awake, and connected to the Internet.

The launcher starts the local Flux preview and a Cloudflare Quick Tunnel. The systemd service makes the browser available publicly without signing in. It reads the temporary HTTPS address, starts the proxy backend with the correct origin, and updates `js/browser-config.js`. If Cloudflare exits, the launcher reconnects and repeats this process. The tunnel itself retries temporary network interruptions before exiting.

The launcher checks that `/usr/local/bin/cloudflared` is executable. It does not download a binary or install a service or startup task.

## Access

The systemd service enables anonymous public access, so anyone who can reach the tunnel can use the Chromebook's internet connection. Public mode does not require an access code. Manual launches default to private mode; set `publicAccess` to `true` in `tunnel-settings.local.json` to enable anonymous access there too. To use private mode, leave `publicAccess` false, remove `FLUX_PUBLIC_ACCESS=1` from the installed service, and set a long, random `accessCode` of at least 16 characters in the local settings. The local settings are ignored by Git and must never be committed; restrict them with `chmod 600 tunnel-settings.local.json`.

Public mode limits each reported client IP to four simultaneous connections and 30 connection attempts per minute, with at most 32 connections and 1,200 attempts per minute overall. Each connection permits at most 24 streams. Client IPs can be shared or inaccurate, so these are best-effort limits. A connection ends after two hours or about 512 MiB. Destination checks block direct IPs, local/private addresses, UDP, and ports other than 80 and 443; addresses are checked again immediately before connecting. The proxy accepts traffic over the Chromebook's own internet connection, and these controls cannot prevent all abuse or excessive traffic. Use network egress firewall rules and a separate, unprivileged hosting environment as additional safeguards.

In private mode, embedded sign-in uses a secure partitioned cookie. Browsers that do not support it may need the direct proxy address in a separate tab; the Flux Browser page provides a link.

## Updating the deployed Flux site

The systemd service enables automatic publishing. For a manually started launcher, set `autoPublish` to `true` in the local settings to enable it. Set it to `false` for manual updates. The automatic publisher fetches the latest GitHub `main`, creates a commit changing **only** `js/browser-config.js`, and pushes that commit without force. It uses a separate temporary Git index, so local staged files, local commits and the checked-out branch are not included. It accepts only the `0Coral0/Flux` GitHub repository and a valid Quick Tunnel address. This assumes the initial Browser integration has already been deployed.

When `useDeployKey` is enabled, the launcher uses the repository-specific SSH key at `proxy/.tools/flux-tunnel-key` and the verified GitHub host keys at `proxy/.tools/known_hosts`. The private key stays on this PC and is ignored by Git. Revoke it under the Flux repository's GitHub **Settings → Deploy keys** if the PC or key is compromised.

The Chromebook needs non-interactive GitHub write access to this repository; for GitHub CLI, sign in and run `gh auth setup-git` before starting the service. Branch protection can also prevent updates. When GitHub receives an address commit, the connected Vercel deployment needs to finish before it appears on the live site; an open Browser panel checks for the updated address every 30 seconds. If publishing fails, the proxy keeps running and retries every 30 seconds. Check the service logs and fix GitHub access if it continues failing.

## Stopping and restarting

### Debian systemd user service

The unit in `systemd/flux-tunnel.service` is configured for `~/Flux/proxy` and `/usr/bin/node`. Install or update it in `~/.config/systemd/user/`, run `systemctl --user daemon-reload`, then `systemctl --user enable --now flux-tunnel.service` (or restart the service if it was already running). Stop any manually launched copy first. The service supervises the existing launcher, which owns the preview, backend and cloudflared; do not enable a separate cloudflared service for the same proxy.

The service restarts after exits with a 10-second delay, uses a nonblocking file lock plus the launcher's PID lock to prevent duplicate launchers, and stops the whole process group before restarting. A preview failure stops the launcher so systemd can recover it. Tunnel and backend failures are retried by the launcher. The service sets `FLUX_AUTO_PUBLISH=1` and `FLUX_PUBLIC_ACCESS=1`, enabling address updates and anonymous access even if the corresponding local settings are false. To turn either off, remove its environment setting from the installed unit, set the local setting to false, and restart the service. Private settings stay in the ignored local JSON file, outside the unit; new service files use a restrictive umask.

Use `systemctl --user status flux-tunnel.service` for status, `journalctl --user -u flux-tunnel.service -f` for logs, and `systemctl --user stop flux-tunnel.service` to stop sharing. Use `systemctl --user disable --now flux-tunnel.service` to stop sharing and disable startup. The current public URL is in `.runtime/current-address.txt` once the backend is ready; it changes when a Quick Tunnel is recreated. Logs use the host journal's retention policy and may not survive a Linux reboot if its journal is volatile.

Startup is tied to the Linux environment's user manager and `default.target`. Lingering is already enabled on this Chromebook. This does not start the Linux VM at ChromeOS boot or keep it running through shutdown, logout or Chromebook sleep. Open Terminal to start Linux after reboot; network interruptions may require tunnel reconnection and a new address. This Chromebook is not an always-on host.

Press **Ctrl+C** in the launcher to stop sharing. Starting it again creates a new address. If the launcher was interrupted abruptly and reports that it is already running, first check whether its earlier window is still open. It cleans up a stale lock automatically when the previous launcher process no longer exists.

Quick Tunnels are intended for testing, have no uptime guarantee, and their addresses change on recreation. They are not permanent hosting. See [Cloudflare's Quick Tunnel documentation](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

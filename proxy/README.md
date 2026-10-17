# Flux Browser — standalone module

This proxy service is integrated into Flux through its Browser sidebar item. The embedded view shows only tabs, navigation, the address bar, and webpage content. Its default colors and typography were taken from the `index.html` and CSS in `C:\Users\Zack\Documents\GitHub\Flux`. Flux has other selectable themes, so this currently matches its default dark/green theme rather than automatically following every theme selection.

## Integrated Flux launch

Run `Start Flux Browser.cmd` in the Flux repository root. It starts Flux at **http://127.0.0.1:3031/** and its isolated proxy at **http://127.0.0.1:3040/**. Select **Browser** from Flux's sidebar (or the mobile More menu). Keep the launcher running while browsing.

For the hosted site, deploy the proxy service on a separate HTTPS origin using the hosting architecture below, then set `window.FLUX_BROWSER_ORIGIN` in `js/browser-config.js` to that origin. Until then, hosted Flux shows a setup message. Local Flux uses port 3040 automatically. `npm start` still starts the standalone service on 3030; the integrated launcher uses 3040 to avoid clashing with the earlier standalone preview.

The integration files are `css/browser.css`, `js/browser-config.js`, `js/browser.js`, and a small addition in `index.html`. Compact mode is `?embed=1`, implemented by `public/embed.js` and `public/embed.css`.

## Try it on your computer

1. Install [Node.js](https://nodejs.org/) 22 or newer if it is not already installed.
2. Open a terminal in this folder and run:

   ```powershell
   npm ci
   npm start
   ```

3. Open **http://127.0.0.1:3030/**. Keep the terminal open while using the browser. To stop it, press `Ctrl+C` in that terminal. On Windows, `Start Browser.cmd` is a shortcut that installs dependencies on first run and starts the service.

Enter a website address or search terms. Use the plus button for another tab; each tab keeps its own page while this browser window remains open. The back, forward, and reload controls operate within the active tab. `Ctrl+L` focuses the address bar. Search terms are sent to DuckDuckGo. The browser does not promise anonymity, and sites may use cookies or block proxy traffic.

The service binds to `127.0.0.1` only. Other people cannot use this local instance through your computer's public network address. You can change the port with the `PORT` environment variable; when using the local instance, visit `http://127.0.0.1:<PORT>/`.

## Hosted integration details

The browser must run on a **separate HTTPS origin** with a Node service capable of handling WebSockets. Keep the proxy origin separate from Flux's origin, ideally on a different registrable domain with no shared Flux cookies, since visited third-party pages are processed on the browser origin. Do not copy the service worker or proxied pages into Flux's own origin. This is particularly important for a site that has accounts or private data.

Your repository currently contains a Vercel static-site configuration. A separate, protected Node service is the recommended integration route because it gives the proxy a dedicated origin and network controls. Vercel now has [WebSocket support in public beta](https://vercel.com/changelog/websocket-support-is-now-in-public-beta), but this package has not been adapted or tested as a Vercel Function; that support alone does not provide the isolation, authentication, and egress controls described below. A static HTML host alone cannot run the Wisp service.

After the separate service is deployed, the reference snippets below describe the integration already added to Flux; do not add duplicate navigation entries or panels. Replace the example address with your actual browser origin. Nothing in this package performs these edits.

Add a button inside Flux's existing `.nav-list`:

```html
<button class="nav-item" id="btn-browser" onclick="showPage('browser')">
  <i class="fa-solid fa-globe"></i> Browser
</button>
```

Add this view alongside Flux's other `view-*` containers inside `<main>`:

```html
<div id="view-browser" class="container">
  <iframe
    title="Flux Browser"
    src="https://YOUR-DEDICATED-BROWSER-DOMAIN/"
    loading="lazy"
    referrerpolicy="no-referrer"
    style="width:100%; min-height:850px; border:0; border-radius:12px;"
  ></iframe>
</div>
```

Those IDs match the existing `showPage()` function in the supplied Flux source. Adjust the height for your layout. If authentication or third-party-cookie restrictions prevent an embedded sign-in, open the browser origin in a separate tab instead, or use an access gateway that supports the intended embedding flow. If Flux has a content security policy, allow that dedicated origin in Flux's `frame-src`. On the proxy host, restrict `frame-ancestors` to the proxy origin and the intended Flux origin. Test embedding in the actual target browsers before releasing it.

### Hosting architecture

1. Install this package with `npm ci` on a Node host that can make outbound TCP connections to public web servers. Start it with `PORT=3030` and `PUBLIC_ORIGIN=https://YOUR-DEDICATED-BROWSER-DOMAIN`. It still listens on loopback.
2. Put a TLS reverse proxy or access gateway in front of it. Forward ordinary HTTP requests **and WebSocket upgrades** at `/wisp/`. Preserve the public Host header. The WebSocket origin must match `PUBLIC_ORIGIN` exactly. Terminate HTTPS at the gateway and keep the Node listener private.
3. Require authentication at the gateway for the entire origin, including the WebSocket upgrade, and apply appropriate connection/request limits. Confirm authentication works for service-worker files and WebSocket connections as well as the page. Do not expose the local Node listener directly.
4. Apply an outbound firewall that permits only the required public Internet destinations and ports, and denies loopback, private, link-local, metadata, and other non-public ranges for IPv4 and IPv6. Test the firewall on the actual host. The Wisp filters in `server.mjs` are an extra layer, not a substitute for network isolation.
5. Allow only your Flux origin to embed the browser, verify HTTPS, then test navigation, tabs, login flows, and representative websites. The embedded browser and the proxy server may retain site data; use appropriate retention and access policies for your deployment.

For an Nginx-based gateway, a starting point is below. It deliberately refers to certificate and password files you must provision yourself; it is not a ready-to-run deployment by itself. Set `PUBLIC_ORIGIN` to the same HTTPS origin before starting Node. Replace both example domains and the certificate/password paths.

```nginx
# Inside the http {} block:
map $http_upgrade $connection_upgrade { default upgrade; '' close; }

server {
    listen 443 ssl;
    server_name browser.example.net;
    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/private-key.pem;

    # Protect every path, including the WebSocket upgrade.
    auth_basic "Flux Browser";
    auth_basic_user_file /path/to/htpasswd;
    add_header Content-Security-Policy "frame-ancestors 'self' https://flux.example.com" always;

    location / {
        proxy_pass http://127.0.0.1:3030;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 3600s;
    }
}
```

Set up TLS, credentials, rate limits, firewall rules, and a process manager using your hosting provider's guidance. HTTP Basic is shown only as an example access gate: embedded authentication behavior varies across browsers, and a dedicated identity-aware gateway may be a better fit.

## How it works and limitations

- `public/` is the browser UI. `public/sw.js` is the Scramjet service worker; `public/engine.js` initializes the controller and libcurl transport. The service worker needs HTTPS, except on localhost.
- `server.mjs` serves the UI and pinned engine assets and handles Wisp WebSocket upgrades. Scramjet rewrites pages and resources; the transport sends requests through Wisp. The service is not a general-purpose VPN.
- The local defaults block direct IP destinations, private and loopback addresses, UDP, and ports other than 80/443, and check the WebSocket `Origin`. These limits can make some sites or custom ports unavailable. Production requires the separate controls above.
- Scramjet 2 is experimental. Some websites, sign-in flows, video, downloads, or anti-bot systems may not work. Tabs and their history are in memory and reset on reload; proxied site cookies may remain in browser storage. Browser history buttons use the active frame's navigation history.
- Flux's custom themes do not automatically cross into an iframe on another origin. To customize the module, adjust the variables at the top of `public/style.css` on the separate browser service.
- The engine dependencies include AGPL-licensed packages and Wisp's LGPL license. Review the licenses and corresponding source/distribution obligations before publishing. See the [Scramjet repository](https://github.com/MercuryWorkshop/scramjet), [libcurl transport](https://github.com/MercuryWorkshop/libcurl-transport), and [Wisp implementation](https://github.com/MercuryWorkshop/wisp-js).

## Files and checks

- `public/index.html`, `style.css`, `app.js`: interface and tab/navigation controls.
- `public/engine.js`, `sw.js`, `address.js`: proxy engine, worker, and input handling.
- `server.mjs`: standalone Node service and WebSocket gateway.
- `package.json`, `package-lock.json`: pinned dependencies.
- `tests/`: run with `npm test` after `npm ci`. The checks cover address parsing, serving files, WebSocket origin checks, and rejection of a direct loopback destination.

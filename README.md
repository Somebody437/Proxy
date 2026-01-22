# Pages Proxy Browser (static)

A small static "browser emulator" you can host on GitHub Pages.

Features
- URL bar to enter a site URL.
- Fetches the page HTML through a CORS proxy service and rewrites resource URLs to route through that proxy.
- Renders the fetched page inside an iframe (using `srcdoc`) and intercepts clicks/forms so navigation happens through the proxy and updates the URL bar.
- Configurable proxy base (defaults to AllOrigins `https://api.allorigins.win/raw?url=`).

Important limitations
- This is a static frontend only — you must use a CORS-capable proxy service. By default the app uses AllOrigins: `https://api.allorigins.win/raw?url=`.
- Not all sites will work:
  - Sites that block embedding with CSP/X-Frame-Options are handled by stripping some meta tags, but not all server-side protections can be bypassed.
  - Sites that rely on same-origin cookies, authentication, or complex XHR/fetch behavior may not behave correctly.
  - Dynamic apps that fetch resources via JS (relative XHR requests) may still fail because the JS inside the page might call relative URLs that are not automatically rewritten.
- This tool is intended for testing and development only. Be careful when loading arbitrary third-party pages and scripts.

If you want higher fidelity (proxying every request including XHR/CONNECT and preserving cookies), host a forward proxy (or a serverless proxy) and set the proxy base here to that service.

Usage
1. Publish this repository's `index.html` to GitHub Pages (or copy files into your Pages repo root).
2. Open the page, enter a URL and click "Go".
3. To use your own proxy, change the Proxy field (for example `https://your-proxy.example.com/fetch?url=`) and reload.

Security note
- Pages you load will run their scripts in an iframe inside your page. The iframe is sandboxed (scripts/forms allowed) to reduce some risk, but do not load untrusted sites with sensitive credentials.

# Pages Proxy Browser + Proxy Server

This repository contains two parts:

1. A static frontend (host on GitHub Pages) — a simple "browser" with a URL bar that fetches pages through a proxy and renders them inside an iframe.
2. A Node.js proxy server (can be deployed to Render/Vercel/Heroku/Docker) — fetches remote resources, strips/rewrites restrictive headers (CSP / X-Frame-Options) and returns the content with CORS headers so the Pages frontend can load it.

Warning / security
- This proxy forwards arbitrary URLs. Deploy only for testing or on private infrastructure. If you deploy publicly, add authentication, rate limiting, and usage controls.
- Pages you load will execute scripts inside the iframe. Do not load sensitive pages or pages that require browser-stored secrets.
- This project is for development/testing purposes only.

Quick overview
- Frontend: index.html, styles.css, script.js — host these on GitHub Pages.
- Proxy server: server/server.js, server/package.json, server/Dockerfile — deploy this to a public URL like `https://your-proxy.example.com`. The frontend will call `https://your-proxy.example.com/fetch?url=<encoded>`.

How it works
- Frontend: you enter a URL → it requests the proxy like `/fetch?url=https%3A%2F%2Fexample.com`.
- Proxy: fetches the remote page, removes headers that would block embedding, returns body and content-type. Proxy sets CORS headers (Access-Control-Allow-Origin: *).
- Frontend: receives HTML, rewrites resource URLs (images, scripts, styles, srcset, inline CSS) to route through the proxy, injects a small script to route in-page navigation back to the parent (so clicking links uses the proxy), and renders via iframe.srcdoc.

Local development
1. Start proxy:
   - cd server
   - npm install
   - npm start
   Proxy runs on port 3000 by default.

2. Open `index.html` in a static server (or push to GitHub Pages). For local dev you can use:
   - npx http-server . (or python -m http.server)
   - Change the Proxy box to: `http://localhost:3000/fetch?url=` (or edit script.js DEFAULT_PROXY)

Deploying the proxy
- Render / Heroku / Vercel: Use `server/server.js` (Node 18+). Add environment variables, and ensure the host exposes port from `process.env.PORT`.
- Docker: `docker build -t pages-proxy ./server` then run.

If you want hardened production:
- Add an API key check (require a header or token).
- Add express-rate-limit or a firewall.
- Add logging and response size limits.
- Validate and restrict allowed target hosts.

If you'd like, I can provide a deployment-ready manifest for Render / Vercel / a GitHub Actions workflow to deploy the server automatically.

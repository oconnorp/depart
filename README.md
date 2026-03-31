# Depart

An **Ionic Angular PWA** that helps plan a morning school commute in the Bay Area: when to leave home, whether **BART**, **SF Muni**, or **driving** looks best, and how current traffic and real-time departures line up with your arrival deadlines.

The commute logic is based on the Scriptable widget in `jamclean2.js` (see `reference/jamclean2.js` for a copy). API keys can be handled in two ways:

- **Development / simple hosting:** keys in the **Setup** tab (stored in the browser’s `localStorage`) and proxied by `ng serve` or `server/proxy.mjs`.
- **Firebase (recommended for hiding keys):** keys live only in **Firebase Cloud Functions** environment variables; the production PWA omits keys from the bundle (`environment.serverInjectedApiKeys: true` in `environment.prod.ts`). See **Firebase deployment** below.

**First-time / end-user steps:** see **[USER_GUIDE.md](USER_GUIDE.md)** (addresses, keys, Save, and why the Commute tab needs the proxy).

## Prerequisites

- **Node.js** **24** recommended (see [`.nvmrc`](.nvmrc); use `nvm install` / `nvm use` if you use nvm). The **Firebase Cloud Function** uses the **nodejs24** runtime. Minimum **20** is acceptable for local Angular/Ionic tooling if you are not deploying Functions.
- **npm**
- API credentials as needed for the modes you enable:
  - **Google Maps Platform**: API key with **Routes API** and **Geocoding API** enabled (for drive time and optional address → coordinates).
  - **BART**: [BART API](https://api.bart.gov) key (public registration).
  - **511.org**: [511 SF Bay](https://511.org/) developer key for transit stop monitoring (Muni).

## Install

```bash
npm install
```

## Development

The dev server uses `proxy.conf.json` so browser requests to `/api/bart`, `/api/511`, `/api/google-routes`, and `/api/maps-geocode` are forwarded to the real APIs (avoiding CORS issues).

```bash
npm start
```

Then open the URL shown in the terminal (usually `http://localhost:4200`).

1. Open the **Setup** tab and enter locations, modes, and keys.
2. Open **Commute** to see live recommendations.

## Production build and local hosting

Build the optimized PWA into `www/`:

```bash
npm run build
```

Serve the static app **and** the same API proxies with the included Node server (required for transit/drive API calls in the browser):

```bash
npm run serve:prod
```

By default this listens on **port 8080**. Override with:

```bash
PORT=3000 npm run serve:prod
```

Open `http://localhost:8080` (or your machine’s LAN IP from other devices on the same network).

If you use a **production** build with `serverInjectedApiKeys: true` (the default in `environment.prod.ts`) but run **`serve:prod`** without Firebase, the app will **not** send API keys from the browser — you must either set `serverInjectedApiKeys: false` in `environment.prod.ts` for that setup, or deploy with Firebase Functions (below) so the server injects keys.

## Firebase deployment (API keys on the server)

Use [Firebase Hosting](https://firebase.google.com/docs/hosting) + [Cloud Functions](https://firebase.google.com/docs/functions) so `/api/*` is handled by the same proxy logic as locally, but **BART**, **511**, and **Google** keys are read from **Secret Manager** via the function (never shipped in the PWA).

**Step-by-step:** **[docs/FIREBASE_DEPLOY.md](docs/FIREBASE_DEPLOY.md)** (`firebase functions:secrets:set`, deploy, and avoiding duplicate plain env vars on Cloud Run).

Quick version:

1. `firebase login` and link the project (copy `.firebaserc.example` → `.firebaserc` with your project id, or `firebase use --add`).
2. `cd functions && npm install && cd ..`
3. Create secrets: `GOOGLE_MAPS_API_KEY`, `BART_API_KEY`, `API_511_KEY` with `firebase functions:secrets:set` (see the doc).
4. `npm run build` then `firebase deploy --only hosting,functions` (or `npm run deploy:firebase`).
5. Do **not** set those same names as plain **Environment variables** on the Cloud Run service if you use secrets — that causes a deploy error (see the doc).

Hosting rewrites `/api/**` to the `api` function (see `firebase.json`). Restrict Google Maps keys by **HTTP referrer** to your Firebase Hosting domain.

## Installing as a PWA

- **HTTPS**: For “Add to Home Screen” and the service worker, deploy behind HTTPS (or use `localhost` for testing).
- After deployment, open the site in mobile Safari or Chrome and use the browser’s install / add-to-home-screen option.

The Angular service worker is enabled in **production** builds only (`ng build`).

## Project layout (short)

| Path | Purpose |
|------|--------|
| `src/app/tab1/` | Commute dashboard |
| `src/app/tab2/` | Setup / settings |
| `src/app/core/commute-engine.ts` | Pure commute comparison logic |
| `src/app/services/` | BART, Muni (511), Google Routes, settings, orchestration |
| `proxy.conf.json` | Dev-only reverse proxy to external APIs |
| `server/proxy.mjs` | Production static server + same proxy routes |
| `functions/index.js` | Firebase Cloud Function: proxies `/api/*` and injects server env keys |
| `firebase.json` | Hosting + rewrite `/api/**` → function `api` |
| `public/manifest.webmanifest` | PWA manifest |
| `ngsw-config.json` | Service worker asset caching |

## Security notes

- Do not commit real API keys. Use **Setup** in the app, **Firebase Function env vars**, or a secret manager — never commit keys to git.
- With the Firebase setup, **production** builds do not embed transit/Maps keys in JavaScript; the client calls `/api/...` on your domain and the function adds credentials.
- Restrict Google API keys by HTTP referrer or IP in Google Cloud Console.

## Scripts reference

| Script | Command |
|--------|---------|
| Start dev (with proxy) | `npm start` |
| Production build | `npm run build` |
| Serve `www/` + API proxy | `npm run serve:prod` |
| Unit tests | `npm test` |
| Lint | `npm run lint` |
| Build + Firebase deploy | `npm run deploy:firebase` |

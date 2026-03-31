# Deploy Depart to Firebase (Hosting + Functions)

Use this when you already have a Firebase project and want the PWA on Hosting with API keys stored only on the server (Cloud Function `api`).

**Node.js:** Use **Node 24** locally (see the repo [`.nvmrc`](../.nvmrc)) so it matches the **nodejs24** runtime in [`firebase.json`](../firebase.json) and [`functions/package.json`](../functions/package.json). Install dependencies with the same Node version you use to deploy.

## 1. Link this repo to your Firebase project

From the **project root** (where `firebase.json` lives):

```bash
firebase login
```

Create `.firebaserc` (you can copy `.firebaserc.example`):

```json
{
  "projects": {
    "default": "YOUR_FIREBASE_PROJECT_ID"
  }
}
```

Replace `YOUR_FIREBASE_PROJECT_ID` with the ID shown in [Firebase Console](https://console.firebase.google.com/) → Project settings.

Or run:

```bash
firebase use --add
```

and pick your project (this creates/updates `.firebaserc`).

## 2. Install Cloud Functions dependencies

```bash
cd functions
npm install
cd ..
```

## 3. Build the Angular app

Production build outputs to `www/` (what Hosting serves):

```bash
npm run build
```

## 4. Deploy Hosting and Functions

```bash
firebase deploy --only hosting,functions
```

Or use the shortcut from the project root:

```bash
npm run deploy:firebase
```

First deploy may ask you to **upgrade to the Blaze (pay-as-you-go) plan** if the project is on Spark — Cloud Functions that call external APIs (BART, 511, Google) need it.

After deploy, your site is on a URL like `https://YOUR_PROJECT_ID.web.app` (and `.firebaseapp.com`).

---

## 5. Set API keys for the `api` function (Secret Manager only)

[`functions/index.js`](../functions/index.js) uses **`defineSecret()`** from `firebase-functions/params`. At deploy time, Firebase wires **Google Secret Manager** secrets into the Cloud Run service. The secret **names** must be:

| Secret name | Used for |
|-------------|----------|
| `GOOGLE_MAPS_API_KEY` | Routes API, Geocoding |
| `BART_API_KEY` | BART API |
| `API_511_KEY` | 511.org transit API |

### Do **not** duplicate these as plain environment variables

If you previously followed older docs and set **`GOOGLE_MAPS_API_KEY`** (or the others) under **Runtime environment variables** / **Environment variables** on the Cloud Run service **and** you also use secrets with the same names, deploy fails with:

`Secret environment variable overlaps non secret environment variable: GOOGLE_MAPS_API_KEY`

**Fix:** Open **[Cloud Run](https://console.cloud.google.com/run)** → select the **`api`** service → **Edit & deploy new revision** → **Variables & secrets**. Under **Environment variables**, **remove** `GOOGLE_MAPS_API_KEY`, `BART_API_KEY`, and `API_511_KEY` if they appear as plain (non-secret) variables. Redeploy with `firebase deploy --only functions`. The function still receives those names at runtime from Secret Manager bindings added by Firebase when you use `defineSecret` + `secrets: [...]` in code.

### Create or update secrets (Firebase CLI)

From the project root (same names as the table above):

```bash
echo -n 'YOUR_GOOGLE_KEY' | firebase functions:secrets:set GOOGLE_MAPS_API_KEY
echo -n 'YOUR_BART_KEY' | firebase functions:secrets:set BART_API_KEY
echo -n 'YOUR_511_KEY' | firebase functions:secrets:set API_511_KEY
```

Deploy prompts you to confirm if a secret should be available to the function; accept so new revisions can read them.

### `functions/.env` does **not** apply in production

A **`functions/.env`** file is **not** uploaded with `firebase deploy`. Use `.env` only for local tooling (e.g. emulator) if you add `dotenv` yourself.

### After secrets are set

- Open your Hosting URL; **Setup** should hide API key fields (production uses `serverInjectedApiKeys: true`).
- Restrict your **Google** key in Google Cloud Console → APIs & Services → Credentials (HTTP referrers: `https://YOUR_PROJECT_ID.web.app/*`, etc.).

---

## 6. Redeploy after code changes

```bash
npm run build
firebase deploy --only hosting,functions
```

After changing **secrets**, run `firebase deploy --only functions` so a new revision picks them up (or use the deploy flow that uploads the function).

---

## Troubleshooting

| Issue | What to check |
|--------|----------------|
| Deploy fails on Spark plan | Enable **Blaze** billing for Functions. |
| `403` on `/api/...` | Function must allow unauthenticated invocation for a public PWA; this repo sets `invoker: 'public'`. In Cloud Run, confirm **Authentication** allows unauthenticated if needed. |
| `500` + “not set on the server” | Create secrets with `firebase functions:secrets:set` using those exact names, then redeploy. |
| Deploy: “Secret … overlaps non secret … `GOOGLE_MAPS_API_KEY`” (or BART / 511) | Remove the **plain** env vars with those names from Cloud Run (**Variables & secrets** → **Environment variables**). Use Secret Manager only — section 5 above. |
| CORS errors | Same-origin Hosting + rewrite should avoid CORS; ensure you open the **Hosting** URL, not the raw `cloudfunctions.net` URL for normal use. |

# Depart — User instructions

Follow these steps the first time you use the app, and whenever you change home, school, or commute options.

## 1. Run the app the right way (developers)

Live data uses **BART**, **511**, and **Google** APIs. Your browser cannot call them directly (CORS), so the dev server must include the proxy:

- From the project folder run: **`npm start`**
- Open the URL shown (usually `http://localhost:4200`)

If you open the built files as `file://` or skip the proxy, the Commute tab will stay empty or show errors.

For a shared install: build with `npm run build`, then run `npm run serve:prod` and use that URL (port **8080** by default).

## 2. Open Setup

Tap the **Setup** tab (gear icon at the bottom).

## 3. Locations

You need **coordinates** for home and school:

- **Option A — Geocode (easiest):** Paste **Google Maps API key** in the API keys section first. Enter **Home address** and tap **Geocode**. Repeat for **School address**.
- **Option B — Manual:** Type **Home lat / Home lng** and **School lat / School lng** (decimal degrees, e.g. `37.7511`, `-122.4149`).

Typing only street addresses **without** Geocode or lat/lng is not enough — the app uses coordinates for routing.

## 4. Choose how you commute

Turn on any combination of:

- **BART** — train departures and transfer time  
- **SF Muni bus** — next buses at your stop (511)  
- **Drive / car** — driving time with traffic (Google Routes)

## 5. API keys (only for the modes you use)

| If you enable… | You need… |
|----------------|-----------|
| **Drive** | Google Maps API key (Routes API + traffic) |
| **BART** | BART API key ([bart.gov](https://www.bart.gov/schedules/developers/api)) |
| **SF Muni** | 511.org API key ([511.org](https://511.org/) developer / open data) |
| **Geocode** (addresses → coordinates) | Same Google key with **Geocoding API** enabled in Google Cloud |

Paste keys in the **API keys** section at the bottom of Setup. Avoid leading or trailing spaces when pasting (the app trims them on save, but a bad paste can still cause issues until you save again).

## 6. Save

Tap **Save settings**.

- If something is missing, a message at the bottom explains what to fix.
- After a successful save, the app switches to the **Commute** tab and loads data.

## 7. Commute tab

You should see:

- **Best option** — suggested latest leave-by time when data is available  
- Sections for **transit** and/or **drive**, depending on what you enabled  

Pull down on the Commute screen to **refresh**. The app also refreshes about once a minute while you stay on that tab.

### If the Commute tab looks empty

1. Confirm you tapped **Save settings** on Setup (not only typed in fields).  
2. Confirm you used **`npm start`** (dev) or **`npm run serve:prod`** (after build), not opening HTML files directly.  
3. Check that **lat/lng** are set (Geocode or manual).  
4. Check that each enabled mode has its **API key** filled in.  
5. Switch away from **Commute** and back — the tab reloads settings every time you open it.

## 8. Privacy

Settings and keys are stored in your browser’s **local storage** on that device only. They are not sent to a Depart server (there isn’t one in this project).

If you deploy with **Firebase** (see `README.md`), transit and Google Maps keys are **not** stored in the PWA; they live only in **Cloud Functions** environment variables. The Setup screen hides the API key fields in that production build.

## 9. Firebase (keys on the server)

For a family deployment where you do **not** want keys in the browser at all, use Firebase Hosting + Cloud Functions as described in [`README.md`](README.md). After deploy, users only configure locations and commute options; BART/511/Google credentials are added by the `api` function on each request.

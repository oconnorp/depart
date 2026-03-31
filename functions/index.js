/**
 * Firebase Cloud Function: proxies /api/* to BART, 511, Google Routes, Geocoding.
 *
 * Keys are loaded via defineSecret() → Secret Manager. Do **not** set the same names
 * as plain "Environment variables" on the Cloud Run service (deploy will fail with
 * "Secret environment variable overlaps non secret environment variable").
 *
 * Local dev: `server/proxy.mjs` can use process.env with the same names.
 */

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const express = require("express");

const app = express();

const bartApiKey = defineSecret("BART_API_KEY");
const api511Key = defineSecret("API_511_KEY");
const googleMapsApiKey = defineSecret("GOOGLE_MAPS_API_KEY");

app.use(express.json({ limit: "1mb" }));

/** Strip mount prefix when the full path is preserved (varies by host / proxy). */
function stripPrefix(pathname, prefix) {
  if (pathname.startsWith(prefix)) {
    const rest = pathname.slice(prefix.length);
    return rest.startsWith("/") ? rest : `/${rest}` || "/";
  }
  return pathname;
}

/**
 * BART keys are strict: Secret Manager values often include trailing newlines (echo without -n),
 * UTF-8 BOM, or curly/smart quotes from the console UI — all of which break BART while 511/Google
 * may still work. Strip those here.
 */
function normalizeBartApiKey(raw) {
  let s = String(raw ?? "")
    .replace(/^\uFEFF/, "")
    .trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  s = s.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, "-");
  return s.trim();
}

/**
 * Build upstream URL from Express req. Prefer parsing req.url over req.query so
 * cmd/orig/json are not dropped when query parsing is empty (seen on some CF deployments).
 * @returns {URL | null} null if the secret is missing or empty after trim
 */
function bartUpstreamUrl(req) {
  const key = normalizeBartApiKey(bartApiKey.value());
  if (!key) {
    return null;
  }
  const incoming = new URL(req.url, "http://dummy");
  let pathname = stripPrefix(incoming.pathname, "/api/bart");
  const qs = new URLSearchParams(incoming.searchParams);
  qs.set("key", key);
  const search = qs.toString();
  return new URL(pathname + (search ? `?${search}` : ""), "https://api.bart.gov");
}

/** @returns {URL | null} */
function api511UpstreamUrl(req) {
  const key = String(api511Key.value() ?? "").trim();
  if (!key) {
    return null;
  }
  const incoming = new URL(req.url, "http://dummy");
  let pathname = stripPrefix(incoming.pathname, "/api/511");
  const qs = new URLSearchParams(incoming.searchParams);
  qs.set("api_key", key);
  const search = qs.toString();
  return new URL(pathname + (search ? `?${search}` : ""), "https://api.511.org");
}

app.use("/api/bart", async (req, res) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return res.status(405).send("Method Not Allowed");
    }
    const u = bartUpstreamUrl(req);
    if (!u) {
      return res
        .status(500)
        .json({ error: "BART_API_KEY is not set on the server" });
    }
    const r = await fetch(u.toString());
    const text = await r.text();
    res
      .status(r.status)
      .type(r.headers.get("content-type") || "application/json")
      .send(text);
  } catch (e) {
    console.error(e);
    res.status(500).send(String(e.message));
  }
});

app.use("/api/511", async (req, res) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return res.status(405).send("Method Not Allowed");
    }
    const u = api511UpstreamUrl(req);
    if (!u) {
      return res
        .status(500)
        .json({ error: "API_511_KEY is not set on the server" });
    }
    const r = await fetch(u.toString());
    const text = await r.text();
    res
      .status(r.status)
      .type(r.headers.get("content-type") || "application/json")
      .send(text);
  } catch (e) {
    console.error(e);
    res.status(500).send(String(e.message));
  }
});

app.use("/api/google-routes", async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }
    const keyGoogle = String(googleMapsApiKey.value() ?? "").trim();
    if (!keyGoogle) {
      return res
        .status(500)
        .json({ error: "GOOGLE_MAPS_API_KEY is not set on the server" });
    }
    let path = req.url.split("?")[0];
    path = stripPrefix(path, "/api/google-routes");
    const url = `https://routes.googleapis.com${path}`;
    const headers = {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": keyGoogle,
      "X-Goog-FieldMask": req.headers["x-goog-fieldmask"] || "routes.duration",
    };
    const r = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(req.body),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    console.error(e);
    res.status(500).send(String(e.message));
  }
});

app.use("/api/maps-geocode", async (req, res) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return res.status(405).send("Method Not Allowed");
    }

    const keyGoogle = String(googleMapsApiKey.value() ?? "").trim();
    if (!keyGoogle) {
      return res
        .status(500)
        .json({ error: "GOOGLE_MAPS_API_KEY is not set on the server" });
    }
    const incoming = new URL(req.url, "http://dummy");
    let pathname = stripPrefix(incoming.pathname, "/api/maps-geocode");
    const u = new URL(
      `https://maps.googleapis.com${pathname}${incoming.search}`,
    );
    u.searchParams.set("key", keyGoogle);
    const r = await fetch(u.toString());
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    console.error(e);
    res.status(500).send(String(e.message));
  }
});

exports.api = onRequest(
  {
    cors: true,
    invoker: "public",
    memory: "256MiB",
    region: "us-central1",
    secrets: [bartApiKey, api511Key, googleMapsApiKey],
  },
  app,
);

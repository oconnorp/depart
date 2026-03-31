/**
 * Serves the built PWA from ../www and proxies transit/Google APIs to avoid browser CORS.
 * Usage: npm run build && npm run serve:prod
 */
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const www = path.join(root, 'www');

const app = express();
const port = process.env.PORT || 8080;

app.use(
  '/api/bart',
  createProxyMiddleware({
    target: 'https://api.bart.gov',
    changeOrigin: true,
    pathRewrite: { '^/api/bart': '' },
  }),
);
app.use(
  '/api/511',
  createProxyMiddleware({
    target: 'https://api.511.org',
    changeOrigin: true,
    pathRewrite: { '^/api/511': '' },
  }),
);
app.use(
  '/api/google-routes',
  createProxyMiddleware({
    target: 'https://routes.googleapis.com',
    changeOrigin: true,
    pathRewrite: { '^/api/google-routes': '' },
  }),
);
app.use(
  '/api/maps-geocode',
  createProxyMiddleware({
    target: 'https://maps.googleapis.com',
    changeOrigin: true,
    pathRewrite: { '^/api/maps-geocode': '' },
  }),
);

app.use(express.static(www));
// Express 5 / path-to-regexp v8 rejects bare '*'. Fall through to SPA shell when no file matched.
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(www, 'index.html'));
});

app.listen(port, () => {
  console.log(`Depart PWA: http://localhost:${port}`);
});

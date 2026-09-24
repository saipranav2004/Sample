import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Two upstreams sit behind this app:
 *
 *  1. `/api/*`            -> the Go NHI Discovery API (JWT, bearer token from the browser).
 *  2. `/secret-scanner/*` -> the external Secret Scanner API.
 *
 * The Secret Scanner requires an `X-Dashboard-Key` header. Per its integration
 * guide that key must never reach browser JavaScript, so it is injected here,
 * in the Node-side dev server, from `SCANNER_DASHBOARD_KEY`. In production
 * nginx does the same job (nginx/nginx.conf.template) - the client only ever
 * knows the public path.
 */

/* The directory this file lives in, not `process.cwd()`.
   `.env` sits next to this file. Reading it from the working directory meant
   that starting Vite from anywhere else - the repository root with
   `--config frontend/vite.config.js`, an IDE run configuration, a monorepo
   script - silently loaded no `.env` at all, and the scanner key was never
   attached even though it was plainly in the file. */
const ROOT = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  /* '' as the prefix loads every variable, not only `VITE_` ones, from both the
     `.env` files and the process environment. That is what lets the server-only
     `SCANNER_*` names be read here without being exposed to the browser: only
     `VITE_`-prefixed variables are ever shipped to client code. */
  const env = loadEnv(mode, ROOT, '');
  const scannerUpstream = (env.SCANNER_UPSTREAM || 'https://js-dev.adapid.link').trim();
  /* Trimmed: a key pasted with a trailing space or newline is a different key,
     and the scanner answers it with the same 401 as no key at all. */
  const scannerKey = (env.SCANNER_DASHBOARD_KEY || '').trim();

  return {
    envDir: ROOT,
    plugins: [react(), tailwindcss(), scannerDiagnostics({ env, scannerUpstream, scannerKey })],
    server: {
      port: 3000,
      proxy: {
        '/secret-scanner': {
          target: scannerUpstream,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/secret-scanner/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              /* Give up on a scanner that does not answer before the browser
                 does (its client times out at 20s), so the page gets a real
                 504 and this terminal says why. A timer of our own, because
                 the proxy's timeout option only starts once a connection is
                 open - and "cannot even connect" is the failure that needs
                 catching. */
              const timer = setTimeout(() => {
                const error = new Error('no response within 15s');
                error.code = 'ETIMEDOUT';
                proxyReq.destroy(error);
              }, 15_000);
              proxyReq.on('response', () => clearTimeout(timer));
              proxyReq.on('close', () => clearTimeout(timer));

              /* Set, not appended: a client-supplied header is replaced, so
                 nobody can reach the scanner through this proxy with a key of
                 their own choosing. Removed when no key is configured, for the
                 same reason. */
              if (scannerKey) proxyReq.setHeader('X-Dashboard-Key', scannerKey);
              else proxyReq.removeHeader('X-Dashboard-Key');
            });
            proxy.on('proxyRes', (proxyRes, req) => {
              /* Whether a key was attached - yes or no, never the value.
                 A 401 from the scanner means either "no key configured" or
                 "key configured and rejected", and those have different fixes.
                 This header is how the screen tells them apart. */
              proxyRes.headers['x-scanner-key-attached'] = scannerKey ? 'yes' : 'no';
              if (proxyRes.statusCode >= 400) {
                console.warn(
                  `[scanner proxy] ${req.method} ${req.url} -> ${proxyRes.statusCode}` +
                    (proxyRes.statusCode === 401
                      ? scannerKey
                        ? ' (a key was attached and the scanner rejected it - check its value)'
                        : ' (no SCANNER_DASHBOARD_KEY configured)'
                      : ''),
                );
              }
            });
            proxy.on('error', (error, req, res) => {
              const reason = error.code || error.message;
              console.error(
                `[scanner proxy] ${req?.method} ${req?.url} could not reach ${scannerUpstream}: ${reason}` +
                  (/TIMEDOUT|ECONNRESET|socket hang up/i.test(reason)
                    ? ' - the scanner did not answer. It is down or not reachable from this machine; the key is not the problem.'
                    : ''),
              );
              /* Answer the browser ourselves, as nginx does in production: a
                 504 with the key-attached flag, so the screen can say which
                 side failed. */
              if (res && !res.headersSent && typeof res.writeHead === 'function') {
                res.writeHead(504, {
                  'Content-Type': 'application/json',
                  'X-Scanner-Key-Attached': scannerKey ? 'yes' : 'no',
                });
                res.end(JSON.stringify({ error: 'SCANNER_UNREACHABLE', message: `The Secret Scanner did not respond (${reason}).` }));
              }
            });
          },
        },
        '/api': {
          target: env.API_UPSTREAM || 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
    build: { outDir: 'dist', sourcemap: false },
  };
});

/**
 * One line at start-up saying whether the scanner key was found.
 *
 * "The key is in my env but nothing loads" is otherwise undiagnosable from the
 * browser: the request fails the same way whether the key is missing, empty,
 * in a file Vite did not read, or rejected upstream. Prints presence and
 * length only - never the value.
 */
function scannerDiagnostics({ env, scannerUpstream, scannerKey }) {
  return {
    name: 'scanner-proxy-diagnostics',
    apply: 'serve',
    configureServer(server) {
      const { logger } = server.config;
      const line = `[scanner proxy] upstream ${scannerUpstream}; `;
      if (scannerKey) logger.info(`${line}SCANNER_DASHBOARD_KEY is set (${scannerKey.length} characters)`);
      else logger.warn(`${line}SCANNER_DASHBOARD_KEY is NOT set - Exposed credentials will show "not configured"`);
      /* A VITE_-prefixed copy of the key is the one mistake this app cannot
         recover from quietly: Vite ships every VITE_ variable to the browser,
         which publishes the key to anyone who opens developer tools. */
      if (env.VITE_SCANNER_DASHBOARD_KEY) {
        logger.warn(
          '[scanner proxy] VITE_SCANNER_DASHBOARD_KEY is set. Remove it: VITE_ variables are sent to the browser. Use SCANNER_DASHBOARD_KEY instead.',
        );
      }
    },
  };
}

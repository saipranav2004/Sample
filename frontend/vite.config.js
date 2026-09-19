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
 * in the Node-side dev server, from `SCANNER_DASHBOARD_KEY`. The same
 * responsibility has to be taken over by a real backend route or reverse proxy
 * in production — the client only ever knows the public path.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const scannerUpstream = env.SCANNER_UPSTREAM || 'https://js-dev.adapid.link';
  const scannerKey = env.SCANNER_DASHBOARD_KEY || '';

  return {
    plugins: [react(), tailwindcss()],
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
              if (scannerKey) proxyReq.setHeader('X-Dashboard-Key', scannerKey);
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

import axios from 'axios';
import { attachInterceptors } from './http';

/**
 * Secret Scanner API.
 *
 * The browser talks to a same-origin path only. Whatever serves that path is
 * responsible for attaching the `X-Dashboard-Key` header — the Vite dev proxy
 * does it locally, a backend route or reverse proxy must do it in production.
 * The key is deliberately absent from this file and from the client bundle.
 */
const scannerClient = axios.create({
  baseURL: import.meta.env.VITE_SCANNER_BASE_PATH || '/secret-scanner',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

attachInterceptors(scannerClient);

export default scannerClient;

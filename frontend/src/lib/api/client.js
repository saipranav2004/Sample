import axios from 'axios';
import { attachInterceptors, TOKEN_KEY, USER_KEY } from './http';

/**
 * Core NHI Discovery API (Go service). Base URL is empty in development so
 * requests hit the Vite proxy and stay same-origin.
 */
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * A 401 means the JWT is gone or expired. Clear it and let the router react;
 * a hard redirect here would throw away in-flight UI state.
 */
let unauthorizedHandler = null;
export function onSessionExpired(handler) {
  unauthorizedHandler = handler;
}

attachInterceptors(client, {
  onUnauthorized: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    unauthorizedHandler?.();
  },
});

export default client;

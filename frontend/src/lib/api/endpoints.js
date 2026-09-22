import scannerClient from './scannerClient';
import * as demo from '../demo/api';

/**
 * ── No backend for this build ────────────────────────────────────────────────
 * Every Go-API endpoint below delegates to `lib/demo/api.js`, which serves one
 * deterministic estate (`lib/demo/estate.js`) to all of the screens. The
 * signatures, arguments and return shapes are unchanged, so no component knows
 * the difference and no component had to change.
 *
 * The Secret Scanner is the exception and stays live: that service exists and
 * is reached through the proxy, which attaches `X-Dashboard-Key` server-side.
 * Those four functions still talk to it.
 *
 * To restore the real API: delete the delegations and restore the `client`
 * calls kept in git history for each one. This file is the only file involved.
 */

/* ── Auth ────────────────────────────────────────────────────────────────── */

export const login = ({ email, password }, signal) => demo.login({ email, password }, signal);
export const fetchProfile = (signal) => demo.fetchProfile(signal);

/* ── Dashboard ───────────────────────────────────────────────────────────── */

export const fetchSummary = (query, signal) => demo.fetchSummary(query, signal);
export const fetchMyResources = (query, signal) => demo.fetchMyResources(query, signal);

/* ── Identities ──────────────────────────────────────────────────────────── */

export const fetchIdentities = (query, signal) => demo.fetchIdentities(query, signal);
export const fetchLineage = (query, signal) => demo.fetchLineage(query, signal);
export const fetchConsumers = (query, signal) => demo.fetchConsumers(query, signal);

/* ── Secrets & credentials ───────────────────────────────────────────────── */

export const fetchSecrets = (query, signal) => demo.fetchSecrets(query, signal);
export const fetchCredentials = (query, signal) => demo.fetchCredentials(query, signal);

/* ── Scans & activity ────────────────────────────────────────────────────── */

export const fetchScans = (query, signal) => demo.fetchScans(query, signal);
export const fetchEvents = (query, signal) => demo.fetchEvents(query, signal);

/* ── Exact counts ────────────────────────────────────────────────────────── */

export const countIdentities = (query, signal) => demo.countIdentities(query, signal);
export const countCredentials = (query, signal) => demo.countCredentials(query, signal);

/* ── Secret Scanner (code exposure) ──────────────────────────────────────── */
/* Contracts per API_Integration_Guide: this service is NOT enveloped like the
   Go API, so these responses are read directly.                             */

export async function fetchFindings(signal) {
  const res = await scannerClient.get('/api/findings', { signal });
  const body = res?.data ?? {};
  const findings = Array.isArray(body.findings) ? body.findings : [];
  return { findings, count: Number.isFinite(body.count) ? body.count : findings.length };
}

export async function fetchAllowlist(signal) {
  const res = await scannerClient.get('/api/allowlist', { signal });
  const body = res?.data ?? {};
  return Array.isArray(body.entries) ? body.entries : [];
}

/** All four identifying fields are required by the service. */
export async function dismissFinding({ clientId, filePath, detector, redacted, reason }) {
  const res = await scannerClient.post('/api/allowlist', {
    client_id: clientId,
    file_path: filePath,
    detector,
    redacted,
    ...(reason ? { reason } : {}),
  });
  return res?.data ?? {};
}

export async function restoreFinding({ clientId, filePath, detector, redacted }) {
  const res = await scannerClient.delete('/api/allowlist', {
    data: {
      client_id: clientId,
      file_path: filePath,
      detector,
      redacted,
    },
  });
  return res?.data ?? {};
}

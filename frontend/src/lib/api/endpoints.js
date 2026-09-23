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

/* ── Identities ──────────────────────────────────────────────────────────── */

export const fetchIdentities = (query, signal) => demo.fetchIdentities(query, signal);
export const fetchLineage = (query, signal) => demo.fetchLineage(query, signal);
export const fetchConsumers = (query, signal) => demo.fetchConsumers(query, signal);

/* ── Credentials ─────────────────────────────────────────────────────────── */

export const fetchCredentials = (query, signal) => demo.fetchCredentials(query, signal);

/* ── Scans & activity ────────────────────────────────────────────────────── */

export const fetchScans = (query, signal) => demo.fetchScans(query, signal);
export const fetchEvents = (query, signal) => demo.fetchEvents(query, signal);

/* ── Integrations ────────────────────────────────────────────────────────── */

export const fetchIntegrations = (signal) => demo.fetchIntegrations(signal);
export const fetchIntegrationHealth = (platform, signal) => demo.fetchIntegrationHealth(platform, signal);

/* ── Exact counts ────────────────────────────────────────────────────────── */

export const countIdentities = (query, signal) => demo.countIdentities(query, signal);
export const countCredentials = (query, signal) => demo.countCredentials(query, signal);

/* ── Secret Scanner (code exposure) ──────────────────────────────────────── */
/* Contracts per API_Integration_Guide_Updated_3: this service is NOT enveloped
   like the Go API, so these responses are read directly. One API covers both
   CodeCommit and GitHub; every finding carries `platform`.
   The dashboard key never appears here. `scannerClient` talks to a relative
   path that the Vite dev proxy (locally) or nginx (in production) rewrites,
   attaching `X-Dashboard-Key` server-side from SCANNER_DASHBOARD_KEY - which
   is the pattern the guide requires: browser -> our own server -> their API. */

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

/**
 * Endpoint 5. Starts the optional full commit-by-commit history walk.
 *
 * Opt-in on the service's side because it does not scale automatically to a
 * repository with a long history: the default onboarding scan only reads files
 * as they exist now, so a secret that was committed and later deleted is
 * invisible to it. 202 means accepted, not finished - poll endpoint 6.
 *
 * `repository` has to be in the shape the client's own platform uses: a bare
 * name for CodeCommit, `owner/repo` for GitHub. Which platform a client is on
 * comes from the service's records, not from anything sent here, so the
 * request carries no platform field.
 */
export async function startDeepScan({ clientId, repository }) {
  const res = await scannerClient.post('/api/deep-scan', {
    client_id: clientId,
    repository,
  });
  return res?.data ?? {};
}

/**
 * Endpoint 6. The state of one repository's deep scan.
 *
 * `not_started` | `running` | `complete` | `failed`. There is no push
 * notification, so the caller polls - see `DEEP_SCAN_POLL_MS`.
 */
export async function fetchDeepScanStatus({ clientId, repository }, signal) {
  const res = await scannerClient.get('/api/deep-scan-status', {
    params: { client_id: clientId, repository },
    signal,
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

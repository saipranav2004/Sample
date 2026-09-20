import client from './client';
import scannerClient from './scannerClient';
import { unwrap, unwrapList } from './http';

/** Strip empty values so we never send `?search=&scan_id=` to Oracle. */
function params(input = {}) {
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === '' || value === null || value === undefined) continue;
    out[key] = value;
  }
  return out;
}

/* ── Auth ────────────────────────────────────────────────────────────────── */

export async function login({ email, password }, signal) {
  const res = await client.post('/api/auth/login', { email, password }, { signal });
  return unwrap(res).data; // { token, user, expires_in }
}

export async function fetchProfile(signal) {
  const res = await client.get('/api/auth/me', { signal });
  return unwrap(res).data;
}

/* ── Dashboard ───────────────────────────────────────────────────────────── */

export async function fetchSummary({ scanId } = {}, signal) {
  const res = await client.get('/api/dashboard/summary', {
    params: params({ scan_id: scanId }),
    signal,
  });
  return unwrap(res).data;
}

export async function fetchMyResources({ scanId, page = 1, pageSize = 20 } = {}, signal) {
  const res = await client.get('/api/dashboard/my-resources', {
    params: params({ scan_id: scanId, page, page_size: pageSize }),
    signal,
  });
  return unwrapList(res);
}

/* ── Identities ──────────────────────────────────────────────────────────── */

export async function fetchIdentities(query = {}, signal) {
  const {
    scanId,
    page = 1,
    pageSize = 25,
    search,
    classification,
    identityType,
    ownerName,
    ownerType,
    isSecret,
    hasCredentials,
    withoutMfa,
    isFederated,
    isAdmin,
    isStale,
    isInactive,
  } = query;

  const res = await client.get('/api/identities', {
    params: params({
      scan_id: scanId,
      page,
      page_size: pageSize,
      search,
      classification,
      identity_type: identityType,
      owner_name: ownerName,
      owner_type: ownerType,
      is_secret: isSecret,
      has_credentials: hasCredentials,
      without_mfa: withoutMfa,
      is_federated: isFederated,
      is_admin: isAdmin,
      is_stale: isStale,
      is_inactive: isInactive,
    }),
    signal,
  });
  return unwrapList(res);
}

export async function fetchLineage({ arn, scanId, page = 1, pageSize = 50 }, signal) {
  const res = await client.get('/api/identities/lineage', {
    params: params({ arn, scan_id: scanId, page, page_size: pageSize }),
    signal,
  });
  return unwrapList(res);
}

export async function fetchConsumers({ arn, scanId, page = 1, pageSize = 25 }, signal) {
  const res = await client.get('/api/identities/consumers', {
    params: params({ arn, scan_id: scanId, page, page_size: pageSize }),
    signal,
  });
  return unwrapList(res);
}

/* ── Secrets & credentials ───────────────────────────────────────────────── */

export async function fetchSecrets({ scanId, page = 1, pageSize = 25, search } = {}, signal) {
  const res = await client.get('/api/secrets', {
    params: params({ scan_id: scanId, page, page_size: pageSize, search }),
    signal,
  });
  return unwrapList(res);
}

export async function fetchCredentials(
  { scanId, page = 1, pageSize = 25, search, type, severity } = {},
  signal,
) {
  const res = await client.get('/api/credentials', {
    params: params({ scan_id: scanId, page, page_size: pageSize, search, type, severity }),
    signal,
  });
  return unwrapList(res);
}

/* ── Scans & activity ────────────────────────────────────────────────────── */

export async function fetchScans({ page = 1, pageSize = 50 } = {}, signal) {
  const res = await client.get('/api/scans', {
    params: params({ page, page_size: pageSize }),
    signal,
  });
  return unwrapList(res);
}

export async function fetchEvents(
  { identityArn, scanId, page = 1, pageSize = 25 } = {},
  signal,
) {
  const res = await client.get('/api/events', {
    params: params({ identity_arn: identityArn, scan_id: scanId, page, page_size: pageSize }),
    signal,
  });
  return unwrapList(res);
}

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

/* ── Exact counts ────────────────────────────────────────────────────────────
   Several screens need a total the summary endpoint does not carry (e.g.
   credentials at HIGH severity, secret-backed identities that are also admin).
   Rather than derive it from the loaded page and present it as a global
   figure, ask the list endpoint for one row and read `total_count` off the
   envelope. Cheap, exact, and it cannot drift from the list it labels.       */

export async function countIdentities(query = {}, signal) {
  const { total } = await fetchIdentities({ ...query, page: 1, pageSize: 1 }, signal);
  return total;
}

export async function countCredentials(query = {}, signal) {
  const { total } = await fetchCredentials({ ...query, page: 1, pageSize: 1 }, signal);
  return total;
}

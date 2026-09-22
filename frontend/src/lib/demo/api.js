/**
 * The demonstration API.
 *
 * Every function here has the same name, arguments and return shape as its
 * counterpart in `lib/api/endpoints.js`, so `endpoints.js` delegates to this
 * module and **no screen changes at all**. When a real backend arrives, the
 * delegation is removed and the axios calls come back - one file, one diff.
 *
 * Two properties are deliberate:
 *
 *   COUNTED, NOT WRITTEN   Nothing returns a hand-written total. Every figure
 *                          is `.length` of the same filtered array the screen
 *                          linking to it will load, so the dashboard and the
 *                          list behind it cannot disagree.
 *   SAME TRANSPORT         Requests go through `demoRequest`, so they are
 *                          asynchronous, cancellable and take time. The
 *                          skeletons, empty states and error states on these
 *                          screens are the real ones, exercised as they will
 *                          be in production.
 *
 * The Secret Scanner (code exposure) is NOT here. That service exists and is
 * reached through the proxy, so those endpoints stay live.
 */

import { demoRequest, hashSeed, intBetween, rng } from './runtime';
import { estate, ESTATE_META, OPERATOR } from './estate';

/** The list envelope every screen expects from `unwrapList`. */
function paginate(rows, page = 1, pageSize = 25) {
  const size = Math.max(1, Number(pageSize) || 25);
  const current = Math.max(1, Number(page) || 1);
  const start = (current - 1) * size;
  return {
    rows: rows.slice(start, start + size),
    total: rows.length,
    page: current,
    pageSize: size,
  };
}

const lower = (value) => String(value ?? '').toLowerCase();
const isTrue = (value) => value === true || value === 'true';

/* ── Auth ─────────────────────────────────────────────────────────────────── */


/**
 * The pair the sign-in screen pre-fills.
 *
 * Exported so the screen and the check that validates it read the same
 * constant - a hard-coded string in two places is a bug waiting for one of
 * them to be edited.
 *
 * The username is the operator's email local part rather than `OPERATOR.user`,
 * because the pre-filled value was specified as `das.admin` and the account
 * name has since changed. `login()` accepts either, so renaming the account
 * again will not break this form.
 */
export const DEMO_CREDENTIALS = { email: OPERATOR.email.split('@')[0], password: 'Das123' };

const SESSION_USER = {
  id: 'user-das-admin',
  username: OPERATOR.user,
  email: OPERATOR.email,
  name: OPERATOR.name,
  role: OPERATOR.role,
};

export function login({ email, password } = {}, signal) {
  return demoRequest(
    () => {
      /* The sign-in screen pre-fills the demonstration credentials, so the
         only way to reach this branch is to clear them and type something
         else. Rejecting that is better than accepting anything, which would
         make the password field look decorative. */
      /* Three spellings of the same operator are accepted: the account name,
         the email, and the email's local part - which is the one the sign-in
         screen pre-fills and was asked for by name. Narrowing this to
         `OPERATOR.user` alone would have broken the pre-filled form the moment
         the account was renamed to `cirm@admin`. */
      const identifier = lower(email);
      const expected = [
        lower(OPERATOR.user),
        lower(OPERATOR.email),
        lower(OPERATOR.email.split('@')[0]),
      ];
      if (!expected.includes(identifier) || password !== DEMO_CREDENTIALS.password) {
        const error = new Error('That username and password do not match an account.');
        error.status = 401;
        throw error;
      }
      return { token: `demo.${hashSeed(identifier).toString(36)}`, user: SESSION_USER, expires_in: 43_200 };
    },
    { signal, latency: [420, 700] },
  );
}

export function fetchProfile(signal) {
  return demoRequest(() => SESSION_USER, { signal, latency: [120, 240] });
}

/* ── Dashboard ────────────────────────────────────────────────────────────── */

export function fetchSummary(_query, signal) {
  return demoRequest(
    () => {
      const { identities, credentials } = estate();

      const humans = identities.filter((row) => row.classification === 'HUMAN');
      const nhis = identities.filter((row) => row.classification !== 'HUMAN');

      const classificationBreakdown = {};
      for (const row of identities) {
        classificationBreakdown[row.classification] = (classificationBreakdown[row.classification] ?? 0) + 1;
      }

      const credentialsBreakdown = {};
      for (const row of credentials) {
        credentialsBreakdown[row.type] = (credentialsBreakdown[row.type] ?? 0) + 1;
      }

      return {
        scan_id: 'scan-2026-09-22',
        generated_at: new Date().toISOString(),

        total_identities: identities.length,
        total_humans: humans.length,
        total_nhis: nhis.length,
        total_credentials: credentials.length,

        classification_breakdown: classificationBreakdown,
        credentials_breakdown: credentialsBreakdown,

        /* The seven posture signals. Each is the length of the array its link
           opens, so the number and the list are the same fact. */
        total_humans_without_mfa: humans.filter((row) => !row.mfa_enabled).length,
        total_admin: identities.filter((row) => row.is_admin).length,
        total_orphaned: identities.filter((row) => row.owner_type === 'ORPHANED').length,
        total_stale_90plus: identities.filter((row) => row.last_active_days > 90).length,
        total_inactive_30plus: identities.filter((row) => row.last_active_days > 30 && row.last_active_days <= 90).length,
        total_secrets: identities.filter((row) => row.is_secret).length,
        total_federated: identities.filter((row) => row.is_federated).length,

        /* NHI-specific figures, because this dashboard is about machines. */
        total_nhi_admin: nhis.filter((row) => row.is_admin).length,
        total_nhi_stale: nhis.filter((row) => row.last_active_days > 90).length,
        total_nhi_orphaned: nhis.filter((row) => row.owner_type === 'ORPHANED').length,
        total_nhi_with_keys: nhis.filter((row) => row.access_key_count > 0).length,
        total_accounts: estate().accounts.length,
      };
    },
    { signal, latency: [220, 420] },
  );
}

export function fetchMyResources({ page = 1, pageSize = 20 } = {}, signal) {
  return demoRequest(
    () => {
      /* "Mine" is what is assigned to the operator, which the estate records
         explicitly. Riskiest first, because that is the order somebody works
         their own queue in. */
      const rows = estate()
        .identities.filter((row) => row.assigned_to === OPERATOR.user)
        .sort(
          (a, b) =>
            Number(b.is_admin) - Number(a.is_admin) ||
            b.last_active_days - a.last_active_days ||
            a.name.localeCompare(b.name),
        );
      return paginate(rows, page, pageSize);
    },
    { signal, latency: [200, 380] },
  );
}

/* ── Identities ───────────────────────────────────────────────────────────── */

export function fetchIdentities(query = {}, signal) {
  return demoRequest(
    () => {
      const {
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

      const needle = lower(search).trim();
      const rows = estate().identities.filter((row) => {
        if (classification && row.classification !== classification) return false;
        if (identityType && row.identity_type !== identityType) return false;
        if (ownerName && row.owner_name !== ownerName) return false;
        if (ownerType && row.owner_type !== ownerType) return false;
        if (isTrue(isSecret) && !row.is_secret) return false;
        if (isTrue(hasCredentials) && row.credential_count === 0) return false;
        /* Only humans have MFA to be missing, which is what the dashboard
           signal counts against - so the filter has to agree with it. */
        if (isTrue(withoutMfa) && !(row.classification === 'HUMAN' && !row.mfa_enabled)) return false;
        if (isTrue(isFederated) && !row.is_federated) return false;
        if (isTrue(isAdmin) && !row.is_admin) return false;
        if (isTrue(isStale) && !(row.last_active_days > 90)) return false;
        if (isTrue(isInactive) && !(row.last_active_days > 30 && row.last_active_days <= 90)) return false;
        if (!needle) return true;
        return [row.name, row.arn, row.owner_name, row.account_name, row.classification, row.trust_service]
          .filter(Boolean)
          .some((field) => lower(field).includes(needle));
      });

      /* Riskiest first, which is the order somebody wants without asking. */
      rows.sort(
        (a, b) =>
          Number(b.is_admin) - Number(a.is_admin) ||
          b.last_active_days - a.last_active_days ||
          a.name.localeCompare(b.name),
      );

      return paginate(rows, page, pageSize);
    },
    { signal, latency: [220, 440] },
  );
}

export function fetchLineage({ arn, page = 1, pageSize = 50 } = {}, signal) {
  return demoRequest(
    () => {
      const { edges, byArn } = estate();
      const rows = [];

      /* The drawer's table is keyed on the OTHER end of the relationship,
         whichever direction it runs in - it is a "Target" column, and
         `direction` says whether this identity reaches it or is reached by it.
         The first version returned `caller_*` for both directions, so the
         Target column rendered a dash on every row while the relationship and
         direction beside it were correct. */
      for (const edge of edges) {
        if (edge.target_arn === arn) {
          rows.push({
            id: `in-${edge.caller_arn}-${edge.target_arn}`,
            direction: 'INBOUND',
            target_name: edge.caller_name,
            target_arn: edge.caller_arn,
            target_type: edge.caller_type,
            rel_type: edge.rel_type,
            via: edge.via ?? null,
            is_external: edge.is_external,
            first_assumed: edge.first_assumed,
            last_assumed: edge.last_assumed,
            assume_count: edge.assume_count,
          });
        }
        if (edge.caller_arn === arn) {
          const target = byArn.get(edge.target_arn);
          rows.push({
            id: `out-${edge.target_arn}`,
            direction: 'OUTBOUND',
            target_name: target?.name ?? edge.target_arn,
            target_arn: edge.target_arn,
            target_type: target?.identity_type ?? 'IAM_ROLE',
            rel_type: edge.rel_type,
            via: edge.via ?? null,
            is_external: Boolean(target?.is_external),
            first_assumed: edge.first_assumed,
            last_assumed: edge.last_assumed,
            assume_count: edge.assume_count,
          });
        }
      }

      rows.sort((a, b) => Date.parse(b.last_assumed) - Date.parse(a.last_assumed));
      return paginate(rows, page, pageSize);
    },
    { signal, latency: [200, 360] },
  );
}

export function fetchConsumers({ arn, page = 1, pageSize = 25 } = {}, signal) {
  return demoRequest(
    () => {
      const { consumersOf } = estate();
      const rows = (consumersOf.get(arn) ?? []).map((edge) => ({
        id: `consumer-${edge.caller_arn}`,
        caller_arn: edge.caller_arn,
        caller_name: edge.caller_name,
        caller_type: edge.caller_type,
        rel_type: edge.rel_type,
        is_external: edge.is_external,
        first_assumed: edge.first_assumed,
        last_assumed: edge.last_assumed,
        /* The consumers table has its own two columns the lineage table does
           not: where the caller came from and how often. */
        session_count: edge.assume_count,
        source_ip: edge.source_ip,
      }));
      rows.sort((a, b) => b.session_count - a.session_count);
      return paginate(rows, page, pageSize);
    },
    { signal, latency: [180, 340] },
  );
}

/* ── Secrets & credentials ────────────────────────────────────────────────── */

export function fetchSecrets({ page = 1, pageSize = 25, search } = {}, signal) {
  return demoRequest(
    () => {
      const needle = lower(search).trim();
      const rows = estate().secrets.filter((row) => {
        if (!needle) return true;
        return [row.name, row.secret_name, row.arn, row.owner_name, row.account_name]
          .filter(Boolean)
          .some((field) => lower(field).includes(needle));
      });
      rows.sort((a, b) => Number(b.is_admin) - Number(a.is_admin) || a.name.localeCompare(b.name));
      return paginate(rows, page, pageSize);
    },
    { signal, latency: [200, 380] },
  );
}

export function fetchCredentials({ page = 1, pageSize = 25, search, type, severity } = {}, signal) {
  return demoRequest(
    () => {
      const needle = lower(search).trim();
      const rows = estate().credentials.filter((row) => {
        if (type && row.type !== type) return false;
        if (severity && row.severity !== severity) return false;
        if (!needle) return true;
        return [row.cred_id, row.identity_name, row.identity_arn, row.account_name, row.last_used_service]
          .filter(Boolean)
          .some((field) => lower(field).includes(needle));
      });

      const rank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      rows.sort((a, b) => rank[a.severity] - rank[b.severity] || b.age_days - a.age_days);
      return paginate(rows, page, pageSize);
    },
    { signal, latency: [220, 420] },
  );
}

/* ── Scans & activity ─────────────────────────────────────────────────────── */

/**
 * Kept because other code imports it, but the scan picker and the scans screen
 * are commented out for this build - there is one discovery run here and
 * nothing to choose between.
 */
export function fetchScans({ page = 1, pageSize = 50 } = {}, signal) {
  return demoRequest(
    () => {
      const { identities, credentials, secrets, events, accounts } = estate();

      /* The scans screen and the scan picker are commented out of this build,
         but the dashboard's trend is a history of discovery runs and a single
         row would draw nothing. So this is fourteen daily runs converging on
         the estate as it stands: the newest run's totals are the estate's
         actual totals, and the older ones walk back from them. That keeps the
         trend honest - the last point on the chart is the number printed in
         the tile above it. */
      const own = rng(hashSeed('scan-history'));
      const finalCounts = {
        identities: identities.length,
        events: events.length,
        secrets: secrets.length,
        credentials: credentials.length,
      };

      const rows = [];
      for (let back = 13; back >= 0; back -= 1) {
        const drift = back === 0 ? 0 : back;
        const started = new Date(ESTATE_META.NOW - back * ESTATE_META.DAY - 27 * 60_000);
        rows.push({
          id: `scan-${started.toISOString().slice(0, 10)}`,
          scan_id: `scan-${started.toISOString().slice(0, 10)}`,
          status: 'COMPLETED',
          scan_start: started.toISOString(),
          scan_end: new Date(started.getTime() + intBetween(own, 19, 34) * 60_000).toISOString(),
          target_name: 'deep-algorithms-org',
          account_id: accounts[0].id,
          accounts_scanned: accounts.length,
          /* Growth, not noise: an estate gains machine identities over time. */
          total_identities: finalCounts.identities - drift * intBetween(own, 1, 2),
          total_events: finalCounts.events - drift * intBetween(own, 6, 24),
          total_secrets: finalCounts.secrets - drift * intBetween(own, 1, 2),
          total_credentials: finalCounts.credentials - drift * intBetween(own, 1, 3),
          triggered_by: back % 7 === 0 ? OPERATOR.name : 'Scheduled discovery',
        });
      }

      rows.sort((a, b) => Date.parse(b.scan_start) - Date.parse(a.scan_start));
      return paginate(rows, page, pageSize);
    },
    { signal, latency: [140, 260] },
  );
}

export function fetchEvents({ identityArn, page = 1, pageSize = 25 } = {}, signal) {
  return demoRequest(
    () => {
      const rows = identityArn
        ? estate().events.filter((row) => row.identity_arn === identityArn)
        : estate().events;
      return paginate(rows, page, pageSize);
    },
    { signal, latency: [200, 400] },
  );
}

/* ── Exact counts ─────────────────────────────────────────────────────────── */

export async function countIdentities(query = {}, signal) {
  const { total } = await fetchIdentities({ ...query, page: 1, pageSize: 1 }, signal);
  return total;
}

export async function countCredentials(query = {}, signal) {
  const { total } = await fetchCredentials({ ...query, page: 1, pageSize: 1 }, signal);
  return total;
}



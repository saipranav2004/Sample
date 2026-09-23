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
 * The one password the demo account accepts.
 *
 * Exported so the login check reads the same constant a docs page or a QA
 * script would - a hard-coded string in two places is a bug waiting for one
 * of them to be edited. The login form itself no longer pre-fills anything:
 * an operator types the username and password below.
 */
export const DEMO_PASSWORD = 'admin@123';

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
      /* Two spellings of the same operator are accepted: the account name
         (`cirm@admin`) and the email address (`das.admin@gmail.com`). Both
         are real, typeable strings - not a placeholder pre-filled into the
         form - so the password field is a real control rather than
         decoration. */
      const identifier = lower(email);
      const expected = [lower(OPERATOR.user), lower(OPERATOR.email)];
      if (!expected.includes(identifier) || password !== DEMO_PASSWORD) {
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

      /* What each identity IS, as opposed to what it is classified as. An
         actor category answers "is this compute, a pipeline, an agent"; a
         classification answers "is this a machine, and what sort of machine".
         Both are useful and they are not the same cut. */
      const actorCategoryBreakdown = {};
      for (const row of identities) {
        actorCategoryBreakdown[row.actor_category] = (actorCategoryBreakdown[row.actor_category] ?? 0) + 1;
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
        actor_category_breakdown: actorCategoryBreakdown,
        credentials_breakdown: credentialsBreakdown,

        /* The seven posture signals. Each is the length of the array its link
           opens, so the number and the list are the same fact. */
        total_humans_without_mfa: humans.filter((row) => !row.mfa_enabled).length,
        total_admin: identities.filter((row) => row.is_admin).length,
        total_orphaned: identities.filter((row) => row.owner_type === 'ORPHANED').length,
        total_stale_90plus: identities.filter((row) => row.last_active_days > 90).length,
        total_inactive_30plus: identities.filter((row) => row.last_active_days > 30 && row.last_active_days <= 90).length,
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

/* ── Identities ───────────────────────────────────────────────────────────── */

export function fetchIdentities(query = {}, signal) {
  return demoRequest(
    () => {
      const {
        page = 1,
        pageSize = 25,
        search,
        classification,
        actorCategory,
        identityType,
        ownerName,
        ownerType,
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
        if (actorCategory && row.actor_category !== actorCategory) return false;
        if (identityType && row.identity_type !== identityType) return false;
        if (ownerName && row.owner_name !== ownerName) return false;
        if (ownerType && row.owner_type !== ownerType) return false;
        if (isTrue(hasCredentials) && row.credential_count === 0) return false;
        /* Only humans have MFA to be missing, which is what the dashboard
           signal counts against - so the filter has to agree with it. */
        if (isTrue(withoutMfa) && !(row.classification === 'HUMAN' && !row.mfa_enabled)) return false;
        if (isTrue(isFederated) && !row.is_federated) return false;
        if (isTrue(isAdmin) && !row.is_admin) return false;
        if (isTrue(isStale) && !(row.last_active_days > 90)) return false;
        if (isTrue(isInactive) && !(row.last_active_days > 30 && row.last_active_days <= 90)) return false;
        if (!needle) return true;
        /* The actor's own id is searchable too: somebody arriving from a
           CloudTrail line or an EC2 console tab has the instance id, not the
           role name. */
        return [
          row.name,
          row.arn,
          row.actor_id,
          row.identity_type,
          row.owner_name,
          row.account_name,
          row.classification,
          row.trust_service,
        ]
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
            target_type: target?.identity_type ?? 'UNKNOWN',
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

/* ── Credentials ──────────────────────────────────────────────────────────── */

export function fetchCredentials({ page = 1, pageSize = 25, search, type, severity } = {}, signal) {
  return demoRequest(
    () => {
      const needle = lower(search).trim();
      const rows = estate().credentials.filter((row) => {
        if (type && row.type !== type) return false;
        if (severity && row.severity !== severity) return false;
        if (!needle) return true;
        return [
          row.cred_id,
          row.identity_name,
          row.identity_arn,
          row.account_name,
          row.last_used_service,
          row.store,
          row.store_name,
        ]
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
      const { identities, credentials, events, accounts } = estate();

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



/* ── Integrations ─────────────────────────────────────────────────────────── */

/**
 * Connector state.
 *
 * The one genuinely new surface in this build with no counterpart on the Go
 * API, so it is shaped the way the endpoint would be: one row per platform the
 * tenant has connected, plus the tenant-level values the AWS setup screen has
 * to display (our own account id, and the external id issued for this tenant).
 *
 * Coverage is counted, not written: `accountsConnected` is derived from the
 * estate's own account list, so the number on this screen and the number of
 * accounts the identities actually come from are the same fact.
 */
const CONNECTED_PLATFORMS = [
  {
    key: 'aws',
    status: 'attention',
    /* Not 'connected': five of the six accounts have the role. A screen that
       only ever draws the healthy state is a screen nobody has seen fail, and
       partial coverage is the commonest real state of this connector. */
    detail: 'Reading five of six accounts. One member account has no discovery role deployed yet.',
    roleName: 'DeepAlgorithmsNhiDiscovery',
    configurable: true,
  },
  /* Source control is onboarded by the credential scanner rather than here, so
     these two are stated as connected - the Exposed credentials screen is
     visibly reading them - but they carry no Configure control, because there
     is nothing on this side to configure. Leaving them off the screen instead
     would contradict a screen two clicks away that is full of their findings. */
  {
    key: 'github',
    status: 'connected',
    detail: 'Repository history feeding the credential scanner. Onboarded by the scanner service, not from this screen.',
    configurable: false,
    managedBy: 'the credential scanner',
  },
  {
    key: 'codecommit',
    status: 'connected',
    detail: 'The same scanner against repositories inside the AWS account.',
    configurable: false,
    managedBy: 'the credential scanner',
  },
];

export function fetchIntegrations(signal) {
  return demoRequest(
    () => {
      const accounts = estate().accounts;
      return {
        tenant: {
          /* The console's own AWS account id, which is what a customer's trust
             policy has to name. Not the customer's - that is the one thing a
             setup screen must never get the wrong way round. */
          consoleAccountId: '905418327764',
          /* Per tenant, never shared. This is what closes the confused-deputy
             hole: our account id alone in a trust policy would let any
             principal inside our account assume the customer's role. */
          externalId: 'da-nhi-7f3c1a94-2b6e-4d52-9c18-a0e5f7d31b46',
          regions: [...new Set(estate().identities.map((row) => row.region))].sort(),
        },
        coverage: {
          accountsTotal: accounts.length,
          /* Five of six, which is why the AWS row reads "attention" on its
             coverage check rather than a clean pass. */
          accountsConnected: accounts.length - 1,
          unconnected: accounts.slice(-1).map((account) => ({ id: account.id, name: account.name })),
        },
        rows: CONNECTED_PLATFORMS.map((row) => ({
          ...row,
          lastSyncedAt: new Date(ESTATE_META.NOW - intBetween(rng(hashSeed(row.key)), 4, 190) * 60_000).toISOString(),
        })),
      };
    },
    { signal, latency: [200, 380] },
  );
}

/**
 * The verification results for one platform.
 *
 * Shaped as one row per check rather than one overall verdict, because "the
 * connector is unhealthy" is not actionable and "organisation policies are not
 * readable, so the graph over-reports" is.
 */
const AWS_CHECK_RESULTS = {
  assume: { state: 'pass', note: 'Assumed in 240ms, session capped at one hour.' },
  'external-id': { state: 'pass', note: 'The condition is present and the id matches the one issued for this tenant.' },
  'iam-read': { state: 'pass', note: 'Authorization details returned for all six accounts that have the role.' },
  cloudtrail: {
    state: 'warn',
    note: 'A multi-region trail is logging, but it was created 41 days ago - so no identity has more than 41 days of history and the oldest baselines are still learning.',
  },
  organisation: {
    state: 'fail',
    note: 'organizations:ListPolicies returned AccessDenied. Service control policies cannot be read, so the access graph draws edges the organisation may already deny.',
  },
  accounts: {
    state: 'warn',
    note: 'The role resolves in five of six accounts. sandbox-04 has no role deployed, so nothing in it is discovered at all.',
  },
};

export function fetchIntegrationHealth(platformKey, signal) {
  return demoRequest(
    () => {
      if (platformKey !== 'aws') {
        /* One check, honestly: a platform this build does not verify should say
           so rather than draw six green rows it has not run. */
        return {
          platform: platformKey,
          verifiedAt: new Date(ESTATE_META.NOW - 6 * 60_000).toISOString(),
          checks: [],
          unverified: true,
        };
      }
      return {
        platform: 'aws',
        verifiedAt: new Date(ESTATE_META.NOW - 11 * 60_000).toISOString(),
        unverified: false,
        checks: AWS_CHECK_RESULTS,
      };
    },
    { signal, latency: [260, 520] },
  );
}

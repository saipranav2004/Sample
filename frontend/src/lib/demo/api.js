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
import { ESTATE_META, OPERATOR } from './estate';
import { effectiveEstate } from './effective';
import * as users from './users';
import { currentUserRow, sessionUser, verifySignIn } from './users';
import {
  CONSOLE_ACCOUNT_ID,
  TENANT_EXTERNAL_ID,
  accountChecks,
  accountCoverage,
  awsCheckResults,
  connectPlatform as linkPlatform,
  connectorHistory,
  disconnectPlatform as unlinkPlatform,
  platformConnections,
  declinedGroups,
  discoveryStatus,
  lastVerifiedAt,
  removeAwsAccount as removeAccount,
  runDiscoveryNow as startDiscovery,
  runHealthChecks as rerunChecks,
  setGroupDeclined as setDeclined,
  connectAwsAccount as connectAccount,
  connectorRows,
  coveredAccounts,
  organisationAccounts,
  uncoveredAccounts,
} from './integrations';

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


export function login({ email, password } = {}, signal) {
  return demoRequest(
    () => {
      /* Each account signs in with its username, so the
         password field is a real control rather than decoration. The login
         form pre-fills nothing. */
      const { token, user } = verifySignIn(email, password);
      return { token, user, expires_in: 43_200 };
    },
    { signal, latency: [420, 700] },
  );
}

export function fetchProfile(signal) {
  return demoRequest(
    () => {
      /* Read from the directory on every call, so a role a super admin
         changed, or an account they deactivated, takes effect on the next
         load rather than at the next sign-in. */
      const row = currentUserRow();
      if (!row || row.status === 'deactivated') {
        const error = new Error('Your session has ended. Sign in again.');
        error.status = 401;
        throw error;
      }
      return sessionUser(row);
    },
    { signal, latency: [120, 240] },
  );
}

/* ── Dashboard ────────────────────────────────────────────────────────────── */

export function fetchSummary(_query, signal) {
  return demoRequest(
    () => {
      const { identities, credentials } = effectiveEstate();

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
        total_accounts: effectiveEstate().accounts.length,
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
      const rows = effectiveEstate().identities.filter((row) => {
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

/** One identity, as `GET /api/identities/:id` would return it. */
export function fetchIdentity(id, signal) {
  return demoRequest(
    () => {
      const row = effectiveEstate().identities.find((identity) => identity.id === id);
      if (!row) {
        const error = new Error('No identity with that id. A later discovery run may have removed it.');
        error.status = 404;
        throw error;
      }
      return row;
    },
    { signal, latency: [180, 360] },
  );
}

export function fetchLineage({ arn, page = 1, pageSize = 50 } = {}, signal) {
  return demoRequest(
    () => {
      const { edges, byArn } = effectiveEstate();
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
      const { consumersOf } = effectiveEstate();
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
      const rows = effectiveEstate().credentials.filter((row) => {
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
      const { identities, credentials, events, accounts } = effectiveEstate();

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
        ? effectiveEstate().events.filter((row) => row.identity_arn === identityArn)
        : effectiveEstate().events;
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

/* Connector state lives in `./integrations`, because the Alerts screen raises
   alerts from the same checks this screen shows. */

export function fetchIntegrations(signal) {
  return demoRequest(
    () => {
      const org = organisationAccounts();
      return {
        tenant: {
          /* The console's own AWS account id, which is what a customer's trust
             policy has to name. Not the customer's - that is the one thing a
             setup screen must never get the wrong way round. */
          consoleAccountId: CONSOLE_ACCOUNT_ID,
          /* Per tenant, never shared. This is what closes the confused-deputy
             hole: our account id alone in a trust policy would let any
             principal inside our account assume the customer's role. */
          externalId: TENANT_EXTERNAL_ID,
          regions: [...new Set(effectiveEstate().identities.map((row) => row.region))].sort(),
        },
        /* Counted, not written: the covered accounts are the estate's own, so
           this number and the accounts the identities come from agree. */
        coverage: {
          accountsTotal: org.length,
          accountsConnected: coveredAccounts().length,
          unconnected: uncoveredAccounts().map((account) => ({ id: account.id, name: account.name })),
        },
        accounts: accountCoverage().map((account) => ({ ...account, checks: accountChecks(account) })),
        discovery: discoveryStatus(),
        template: { declined: declinedGroups() },
        history: connectorHistory(),
        rows: connectorRows(),
      };
    },
    { signal, latency: [200, 380] },
  );
}

export function connectPlatform(input) {
  return demoRequest(() => linkPlatform(input), { latency: [300, 500] });
}

export function disconnectPlatform(key) {
  return demoRequest(() => unlinkPlatform(key), { latency: [300, 500] });
}

/** A connected platform's stored settings: config and secret hints, never secrets. */
export function fetchPlatformConnection(key, signal) {
  return demoRequest(() => platformConnections()[key] ?? null, { signal, latency: [150, 300] });
}

export function runDiscoveryNow() {
  return demoRequest(() => startDiscovery(), { latency: [300, 500] });
}

export function runHealthChecks() {
  return demoRequest(() => rerunChecks(), { latency: [1200, 1800] });
}

export function setTemplateGroup({ key, declined, label }) {
  return demoRequest(() => setDeclined(key, declined, label), { latency: [200, 350] });
}

export function removeAwsAccount(accountId) {
  return demoRequest(() => removeAccount(accountId), { latency: [400, 700] });
}

export function connectAwsAccount(input) {
  return demoRequest(() => connectAccount(input), { latency: [1400, 2200] });
}

export function fetchIntegrationHealth(platformKey, signal) {
  return demoRequest(
    () => {
      if (platformKey !== 'aws') {
        /* A platform this build does not verify says so, rather than drawing
           six green rows it has not run. */
        return {
          platform: platformKey,
          verifiedAt: new Date(ESTATE_META.NOW - 6 * 60_000).toISOString(),
          checks: [],
          unverified: true,
        };
      }
      return { platform: 'aws', verifiedAt: lastVerifiedAt(), unverified: false, checks: awsCheckResults() };
    },
    { signal, latency: [260, 520] },
  );
}

/* ── Alerts ───────────────────────────────────────────────────────────────── */

/**
 * The alert queue, as `GET /api/alerts` would return it.
 *
 * `alerts` are the ones raised from the estate, triage applied. `triage` is
 * the raw store, which the page needs for the exposure alerts it raises itself
 * from the live scanner feed. `policy` and `people` are who alerts can go to.
 */
export async function fetchAlerts(signal) {
  /* Loaded on demand: alerts read the genome model, and a static import here
     would put it in the first-load bundle of every screen. */
  const alerts = await import('./alerts');
  return demoRequest(
    () => ({
      alerts: alerts.estateAlerts(),
      triage: alerts.alertTriageStore(),
      policy: alerts.escalationPolicy(),
      people: alerts.alertPeople(),
    }),
    { signal, latency: [260, 480] },
  );
}

/** `PATCH /api/alerts` - one action applied to one or more alerts. */
export async function updateAlerts(input) {
  const alerts = await import('./alerts');
  return demoRequest(() => ({ changed: alerts.applyAlertAction(input) }), { latency: [180, 320] });
}

/* ── Posture ──────────────────────────────────────────────────────────────── */

/* Loaded on demand, like alerts: posture reads the access graph and the
   genome model, which no other first screen needs. */
export async function fetchPostureOverview(query, signal) {
  const posture = await import('./posture');
  return posture.fetchPostureOverview(query, signal);
}

export async function fetchPostureIdentity(id, signal) {
  const posture = await import('./posture');
  return posture.fetchPostureIdentity(id, signal);
}

export async function remediatePosture(input) {
  const posture = await import('./posture');
  return posture.remediatePosture(input);
}

export async function remediatePostureMany(input) {
  const posture = await import('./posture');
  return posture.remediatePostureMany(input);
}

export async function rollBackPosture(input) {
  const posture = await import('./posture');
  return posture.rollBackPosture(input);
}

/* ── Users ────────────────────────────────────────────────────────────────── */

/** The console's users, as `GET /api/users` would return them. Super admin only. */
export function fetchUsers(signal) {
  return demoRequest(
    () => {
      const me = users.assertCan('users.manage');
      return { users: users.directory(), activity: users.directoryActivity(), me: me.id };
    },
    { signal, latency: [220, 420] },
  );
}

export function inviteUser(input) {
  return demoRequest(() => users.inviteUser(input), { latency: [350, 600] });
}

export function updateUser(id, patch) {
  return demoRequest(() => users.updateUser(id, patch), { latency: [300, 520] });
}

export function revokeInvite(id) {
  return demoRequest(() => users.revokeInvite(id), { latency: [300, 520] });
}

export function resendInvite(id) {
  return demoRequest(() => users.resendInvite(id), { latency: [300, 520] });
}

/** Public: resolves an invitation link for the accept screen. */
export function lookupInvite(token, signal) {
  return demoRequest(() => users.lookupInvite(token), { signal, latency: [240, 420] });
}

/** Public: sets the invitee's password and activates the account. */
export function acceptInvite(input) {
  return demoRequest(() => users.acceptInvite(input), { latency: [500, 800] });
}

/**
 * Connector state for the demonstration estate.
 *
 * Its own module because two screens read it: Integrations shows it, and
 * Alerts raises alerts from the checks that fail. Both importing it from here
 * means the two cannot tell different stories about the same connector.
 *
 * ── Coverage, and why the organisation has seven accounts ───────────────────
 * The estate's six accounts all have the discovery role - they have to, since
 * every one of them has identities on the Identities screen. The seventh is a
 * log-archive account, the kind AWS Control Tower creates in every landing
 * zone, which has no role deployed. Because nothing was discovered in it, it
 * appears nowhere else in the console - which is exactly what "not covered"
 * means, and the one screen that says so is the one that can fix it.
 * An earlier version declared one of the six discovered accounts unconnected
 * while the Identities screen listed identities in it.
 */

import { estate, ESTATE_META } from './estate';
import { hashSeed, intBetween, OVERLAY_KEYS, readOverlay, rng, writeOverlay } from './runtime';
import { assertCan } from './users';

const UNCOVERED_ACCOUNTS = [{ id: '271905338142', name: 'log-archive', env: 'production' }];

/**
 * Accounts connected from the Connect wizard. Their role has been verified,
 * but discovery has not run in them yet, so they are covered without having
 * contributed a single identity - and the screen says exactly that.
 */
function wizardAccounts() {
  const rows = readOverlay(OVERLAY_KEYS.awsAccounts, []);
  return Array.isArray(rows) ? rows : [];
}

export function organisationAccounts() {
  const known = [...estate().accounts, ...UNCOVERED_ACCOUNTS];
  const ids = new Set(known.map((account) => account.id));
  return [...known, ...wizardAccounts().filter((account) => !ids.has(account.id))];
}

/** Accounts where the discovery role exists: the estate's, plus any connected since. */
export function coveredAccounts() {
  const connected = new Set(wizardAccounts().map((account) => account.id));
  return organisationAccounts().filter(
    (account) => estate().accounts.some((row) => row.id === account.id) || connected.has(account.id),
  );
}

export function uncoveredAccounts() {
  const covered = new Set(coveredAccounts().map((account) => account.id));
  return organisationAccounts().filter((account) => !covered.has(account.id));
}

export const CONSOLE_ACCOUNT_ID = '905418327764';
export const TENANT_EXTERNAL_ID = 'da-nhi-7f3c1a94-2b6e-4d52-9c18-a0e5f7d31b46';
export const DISCOVERY_ROLE_NAME = 'DeepAlgorithmsNhiDiscovery';

const DAY = ESTATE_META.DAY;
const MINUTE = 60_000;

/* ── Discovery runs ───────────────────────────────────────────────────────── */

/** How long a manual run takes in the demo. Long enough to see it running. */
export const DISCOVERY_RUN_MS = 6_000;

/* Scheduled discovery: every 24 hours, about 22 minutes end to end. The runs
   are placed relative to "now" like every other time in the demo, so alert
   ages, response clocks and "last read" read the same whatever the hour. The
   schedule is therefore stated as an interval, not a clock time that would
   drift from one visit to the next. */
const RUN_LENGTH = 22 * MINUTE;

/** Start times of the last 14 completed scheduled runs, oldest first. */
function scheduledRunStarts() {
  const latest = ESTATE_META.NOW - 27 * MINUTE;
  const starts = [];
  for (let back = 13; back >= 0; back -= 1) starts.push(latest - back * DAY);
  return starts;
}

/**
 * When each of the last 14 scheduled runs raised its alerts, oldest first -
 * part-way through the run, never before it started. Alerts carry these
 * times and the Integrations screen reports the same runs, so "last read"
 * and "raised at" cannot disagree.
 */
export function discoveryRuns() {
  return scheduledRunStarts().map((start) => start + 18 * MINUTE);
}

/**
 * Connector settings and history kept by the demo: the permission groups the
 * template leaves out, when checks last ran, manual discovery runs, and the
 * change log. Seeded with the history that explains the estate as it stands -
 * the StackSet was pointed at the workload OUs, which is why the Security
 * OU's log-archive account has no role.
 */
function seedHistory() {
  const at = (days, minutes = 0) => new Date(ESTATE_META.NOW - days * DAY - minutes * MINUTE).toISOString();
  return [
    { at: at(209, 40), actor: 'Admin', kind: 'deployed', text: 'Deployed the discovery role with a StackSet to the Workloads, Platform and Sandbox OUs: 6 accounts.' },
    { at: at(209, 12), actor: 'Admin', kind: 'verified', text: 'Verified the connector. The Security OU (log-archive) was left out of the StackSet targets.' },
    { at: at(64), actor: 'Admin', kind: 'settings', text: 'Kept every optional permission group in the template.' },
  ];
}

function readConnector() {
  const raw = readOverlay(OVERLAY_KEYS.awsConnector, null);
  const store = {
    declined: Array.isArray(raw?.declined) ? raw.declined : [],
    verifiedAt: typeof raw?.verifiedAt === 'string' ? raw.verifiedAt : null,
    runs: Array.isArray(raw?.runs) ? raw.runs : [],
    history: Array.isArray(raw?.history) ? raw.history : seedHistory(),
  };
  /* A run survives a reload: one still marked running past its duration
     finished while nobody was looking. */
  store.runs = store.runs.map((run) =>
    run.status === 'running' && Date.now() - Date.parse(run.startedAt) >= DISCOVERY_RUN_MS
      ? finishRun(run)
      : run,
  );
  return store;
}

function writeConnector(store) {
  writeOverlay(OVERLAY_KEYS.awsConnector, store);
}

function logConnector(store, actor, kind, text) {
  store.history = [{ at: new Date().toISOString(), actor: actor.name, kind, text }, ...store.history].slice(0, 100);
}

function finishRun(run) {
  const finishedAt = new Date(Date.parse(run.startedAt) + DISCOVERY_RUN_MS).toISOString();
  return { ...run, status: 'complete', finishedAt };
}

/** When the scheduled runs happen, the last run of any kind, and the next scheduled one. */
export function discoveryStatus(now = Date.now()) {
  const starts = scheduledRunStarts();
  let lastStart = starts[starts.length - 1];
  /* The page can stay open past 02:00 UTC: a scheduled run that has started
     since is shown running, and one that has finished becomes the last run. */
  while (lastStart + DAY + RUN_LENGTH <= now) lastStart += DAY;
  const scheduledRunning = now >= lastStart + DAY ? { startedAt: new Date(lastStart + DAY).toISOString(), by: 'Schedule' } : null;
  const lastScheduledEnd = lastStart + RUN_LENGTH;
  const { runs } = readConnector();
  const latestManual =
    runs
      .filter((run) => run.status === 'complete')
      .sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))[0] ?? null;
  const manualIsLatest = latestManual && Date.parse(latestManual.finishedAt) > lastScheduledEnd;
  const manualRunning = runs.find((run) => run.status === 'running') ?? null;
  let next = lastStart + DAY;
  while (next <= now) next += DAY;
  const { identities, credentials } = estate();
  return {
    cadence: 'daily',
    intervalHours: 24,
    lastRunAt: new Date(manualIsLatest ? Date.parse(latestManual.finishedAt) : lastScheduledEnd).toISOString(),
    lastRunTrigger: manualIsLatest ? 'manual' : 'scheduled',
    lastRunBy: manualIsLatest ? latestManual.by : null,
    nextRunAt: new Date(next).toISOString(),
    running: manualRunning ? { startedAt: manualRunning.startedAt, by: manualRunning.by } : scheduledRunning,
    totals: { accounts: coveredAccounts().length, identities: identities.length, credentials: credentials.length },
  };
}

/** When the last scheduled run started. Each account is read part-way through it. */
function lastScheduledStart() {
  return scheduledRunStarts().at(-1);
}

/**
 * Start a discovery run now. It reads every covered account again; accounts
 * connected since the last run are discovered by it.
 */
export function runDiscoveryNow() {
  const actor = assertCan('integrations.operate');
  const store = readConnector();
  if (store.runs.some((run) => run.status === 'running') || discoveryStatus().running) {
    throw new Error('A discovery run is already in progress.');
  }
  const run = { id: `run-${Date.now().toString(36)}`, startedAt: new Date().toISOString(), status: 'running', by: actor.name };
  store.runs = [run, ...store.runs].slice(0, 20);
  logConnector(store, actor, 'discovery', 'Started a discovery run across every connected account.');
  writeConnector(store);
  /* Finish it in the background and announce it, so every screen watching
     the demo store refreshes without a reload. */
  setTimeout(() => {
    const later = readConnector();
    const done = later.runs.find((entry) => entry.id === run.id);
    if (!done) return;
    const { identities, credentials } = estate();
    later.history = [
      {
        at: done.finishedAt ?? new Date().toISOString(),
        actor: 'Discovery',
        kind: 'discovery',
        text: `Run finished: ${coveredAccounts().length} accounts read, ${identities.length} identities and ${credentials.length} credentials, no changes since the last run.`,
      },
      ...later.history,
    ].slice(0, 100);
    writeConnector(later);
  }, DISCOVERY_RUN_MS + 50);
  return run;
}

/* ── Template settings ────────────────────────────────────────────────────── */

/** The optional permission groups the template currently leaves out. */
export function declinedGroups() {
  return readConnector().declined;
}

/**
 * Keep or leave out an optional permission group in the generated template.
 * The deployed role is not changed by this: it keeps what it was granted
 * until the template is deployed again, which the screen says.
 */
export function setGroupDeclined(groupKey, declined, groupLabel = groupKey) {
  const actor = assertCan('integrations.manage');
  const store = readConnector();
  const set = new Set(store.declined);
  if (declined) set.add(groupKey);
  else set.delete(groupKey);
  store.declined = [...set];
  logConnector(
    store,
    actor,
    'settings',
    declined ? `Left ${groupLabel} out of the template.` : `Put ${groupLabel} back into the template.`,
  );
  writeConnector(store);
  return store.declined;
}

/* ── Health ───────────────────────────────────────────────────────────────── */

/** When the checks last ran: the seeded time, or the last re-run. */
export function lastVerifiedAt() {
  return readConnector().verifiedAt ?? new Date(ESTATE_META.NOW - 11 * MINUTE).toISOString();
}

/** Re-run the checks. Results are worked out from the connector as it is now. */
export function runHealthChecks() {
  const actor = assertCan('integrations.operate');
  const store = readConnector();
  store.verifiedAt = new Date().toISOString();
  const results = awsCheckResults();
  const failing = Object.values(results).filter((result) => result.state !== 'pass').length;
  logConnector(store, actor, 'verified', failing === 0 ? 'Re-ran the checks: all passing.' : `Re-ran the checks: ${failing} need attention.`);
  writeConnector(store);
  return { verifiedAt: store.verifiedAt, checks: results };
}

export function connectorHistory() {
  return readConnector().history;
}

/**
 * The account-level checks, per account. They pass wherever the role is
 * deployed - that is what the connect step verified - and cannot run where
 * it is not.
 */
export function accountChecks(account) {
  if (account.state === 'missing') return null;
  const next = rng(hashSeed(`checks-${account.id}`));
  return {
    assume: { state: 'pass', note: `Assumed in ${intBetween(next, 140, 380)}ms.` },
    'external-id': { state: 'pass', note: 'Refused without the external id.' },
    'iam-read': { state: 'pass', note: 'Authorization details returned.' },
    events: {
      state: account.state === 'pending' ? 'unknown' : 'pass',
      note: account.state === 'pending' ? 'Runs with the first discovery.' : 'LookupEvents answers in every region in range.',
    },
  };
}

/* ── Accounts ─────────────────────────────────────────────────────────────── */

/** Remove an account connected from this console. Seeded accounts cannot be. */
export function removeAwsAccount(accountId) {
  const actor = assertCan('integrations.manage');
  const rows = wizardAccounts();
  const row = rows.find((account) => account.id === accountId);
  if (!row) {
    throw new Error('Only accounts connected from this console can be removed here. Removing one with discovered data needs the backend to delete its records.');
  }
  writeOverlay(OVERLAY_KEYS.awsAccounts, rows.filter((account) => account.id !== accountId));
  const store = readConnector();
  logConnector(store, actor, 'removed', `Removed ${row.name} (${row.id}). Delete the ${DISCOVERY_ROLE_NAME} role in that account to revoke access completely.`);
  writeConnector(store);
  return row;
}

export const CONNECTED_PLATFORMS = [
  {
    key: 'aws',
    /* Worked out from coverage in `connectorRows`: 'attention' while any
       account in the organisation has no role. Partial coverage is the
       commonest real state of this connector. */
    status: null,
    detail: null,
    roleName: DISCOVERY_ROLE_NAME,
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

/* ── Other platforms ─────────────────────────────────────────────────────── */

/* The platforms the connect flow knows. Kept here as keys only - their forms
   and rules live with the screen - so the data layer refuses anything else. */
const CONNECTABLE = ['gitlab', 'okta', 'entra', 'vault', 'datadog', 'splunk', 'jira', 'servicenow'];

function platformStore() {
  const raw = readOverlay(OVERLAY_KEYS.platforms, {});
  return raw && typeof raw === 'object' ? raw : {};
}

export function platformConnections() {
  return platformStore();
}

/** Last four characters of a secret, for "which token is this" - never more. */
function hint(value) {
  const text = String(value ?? '');
  return text.length <= 4 ? '••••' : `••••${text.slice(-4)}`;
}

/**
 * Connect a platform. Settings are stored; secrets are not - only a hint of
 * each, so the screen can say which token is in use. A real backend would
 * keep the secret in its own store; this demo has nowhere safe to put one.
 */
export function connectPlatform({ key, config = {}, secrets = {}, display = '' }) {
  const actor = assertCan('integrations.manage');
  if (!CONNECTABLE.includes(key)) throw new Error('That platform cannot be connected here.');
  const store = platformStore();
  if (store[key]) throw new Error('That platform is already connected. Disconnect it first to change its settings.');
  if (Object.values(secrets).some((value) => !String(value ?? '').trim())) throw new Error('Every secret field is required.');
  store[key] = {
    key,
    config,
    hints: Object.fromEntries(Object.entries(secrets).map(([field, value]) => [field, hint(value)])),
    display: String(display).slice(0, 120),
    connectedAt: new Date().toISOString(),
    connectedBy: actor.name,
  };
  writeOverlay(OVERLAY_KEYS.platforms, store);
  return store[key];
}

export function disconnectPlatform(key) {
  assertCan('integrations.manage');
  const store = platformStore();
  if (!store[key]) throw new Error('That platform is not connected.');
  const { [key]: removed, ...rest } = store;
  writeOverlay(OVERLAY_KEYS.platforms, rest);
  return removed;
}

export function connectorRows() {
  const covered = coveredAccounts().length;
  const total = organisationAccounts().length;
  const missing = uncoveredAccounts();
  const platforms = Object.values(platformStore()).map((entry) => ({
    key: entry.key,
    /* Connected and tested, but nothing has been read yet: the sync that
       would fill the screens it feeds needs the backend connector. */
    status: 'syncing',
    detail: `Connected to ${entry.display || entry.key}. Awaiting the first sync.`,
    configurable: false,
    manageable: true,
    connectedAt: entry.connectedAt,
    connectedBy: entry.connectedBy,
    lastSyncedAt: null,
  }));
  return [...CONNECTED_PLATFORMS.map((row) => ({
    ...row,
    status: row.key === 'aws' ? (missing.length > 0 ? 'attention' : 'connected') : row.status,
    detail:
      row.key === 'aws'
        ? missing.length > 0
          ? `Reading ${covered} of ${total} accounts. ${listNames(missing)} ${missing.length === 1 ? 'has' : 'have'} no discovery role deployed yet.`
          : `Reading all ${total} accounts in the organisation.`
        : row.detail,
    /* AWS is read by the discovery run, so its "last read" is that run's.
       The scanner-fed connectors keep their own clock. */
    lastSyncedAt:
      row.key === 'aws'
        ? discoveryStatus().lastRunAt
        : new Date(ESTATE_META.NOW - intBetween(rng(hashSeed(row.key)), 4, 190) * 60_000).toISOString(),
  })), ...platforms];
}

function listNames(accounts) {
  return accounts.map((account) => account.name).join(', ');
}

/**
 * One row per organisation account, for the Accounts view of the AWS setup.
 * Counts come from the estate, so an account's row and the Identities screen
 * filtered to that account agree.
 */
export function accountCoverage() {
  const { identities, credentials } = estate();
  const connected = new Map(wizardAccounts().map((account) => [account.id, account]));
  const estateIds = new Set(estate().accounts.map((account) => account.id));
  const status = discoveryStatus();
  const lastRun = Date.parse(status.lastRunAt);
  const lastScheduled = lastScheduledStart();
  return organisationAccounts().map((account) => {
    const own = identities.filter((row) => row.account_id === account.id);
    const ownArns = new Set(own.map((row) => row.arn));
    const wizard = connected.get(account.id);
    /* An account connected from the wizard is covered at once but awaits
       discovery until a run finishes after it was connected. */
    const discovered = wizard && lastRun > Date.parse(wizard.connectedAt);
    const state = estateIds.has(account.id) || discovered ? 'collecting' : wizard ? 'pending' : 'missing';
    /* Each account is read during the run, a little after it starts. A manual
       run newer than the scheduled one moves every covered account on. */
    const scheduledRead = lastScheduled + intBetween(rng(hashSeed(`read-${account.id}`)), 120, 1200) * 1000;
    const lastReadAt = state === 'collecting' ? Math.max(scheduledRead, status.lastRunTrigger === 'manual' ? lastRun : 0) : null;
    return {
      id: account.id,
      name: account.name,
      env: account.env,
      state,
      identities: own.length,
      credentials: credentials.filter((row) => ownArns.has(row.identity_arn)).length,
      regions: new Set(own.map((row) => row.region)).size,
      lastReadAt: lastReadAt ? new Date(lastReadAt).toISOString() : null,
      connectedAt: wizard?.connectedAt ?? null,
      connectedBy: wizard?.connectedBy ?? null,
      removable: Boolean(wizard),
    };
  });
}

const ACCOUNT_ID = /^\d{12}$/;
const ROLE_ARN = /^arn:aws:iam::(\d{12}):role\/(?:[\w+=,.@-]+\/)*([\w+=,.@-]+)$/;
const ENVIRONMENTS = ['production', 'staging', 'development'];

/**
 * Connect one AWS account: the wizard's verify step.
 *
 * The checks a real connector runs, in the order it runs them, and each one
 * fails the way the real one would - a role ARN from a different account, a
 * role with another name, an account that is already connected. Only the
 * STS call itself is simulated, because there is no backend to make it.
 */
export function connectAwsAccount({ accountId, name, env, roleArn }) {
  const actor = assertCan('integrations.manage');
  const id = String(accountId ?? '').trim();
  const arn = String(roleArn ?? '').trim();
  if (!ACCOUNT_ID.test(id)) throw new Error('An AWS account id is exactly 12 digits.');
  if (coveredAccounts().some((account) => account.id === id)) {
    throw new Error(`Account ${id} is already connected.`);
  }
  const known = organisationAccounts().find((account) => account.id === id);
  const label = known?.name ?? String(name ?? '').trim();
  if (!label) throw new Error('Give the account a name, the way it appears in your organisation.');
  const environment = known?.env ?? env;
  if (!ENVIRONMENTS.includes(environment)) throw new Error('Choose the environment the account belongs to.');

  const match = ROLE_ARN.exec(arn);
  if (!match) throw new Error('That is not an IAM role ARN. It looks like arn:aws:iam::123456789012:role/RoleName.');
  if (match[1] !== id) {
    throw new Error(`That role is in account ${match[1]}, not ${id}. Deploy the role in the account you are connecting.`);
  }
  if (match[2] !== DISCOVERY_ROLE_NAME) {
    throw new Error(`The role is named ${match[2]}. The templates create ${DISCOVERY_ROLE_NAME}, and the trust policy was issued for that name.`);
  }

  const row = {
    id,
    name: label,
    env: environment,
    roleArn: arn,
    connectedAt: new Date().toISOString(),
    connectedBy: actor.name,
  };
  writeOverlay(OVERLAY_KEYS.awsAccounts, [...wizardAccounts(), row]);
  const store = readConnector();
  logConnector(store, actor, 'connected', `Connected ${label} (${id}) and verified its role.`);
  writeConnector(store);
  return {
    account: row,
    checks: [
      { key: 'assume', label: 'sts:AssumeRole with your external id', note: 'Assumed; session capped at one hour.' },
      { key: 'external-id', label: 'External id condition present', note: 'The trust policy requires the id issued to this tenant.' },
      { key: 'iam-read', label: 'iam:GetAccountAuthorizationDetails', note: 'Read access confirmed. Discovery runs in this account on the next cycle.' },
    ],
  };
}

/**
 * The AWS verification results.
 *
 * One row per check rather than one overall verdict, because "the connector is
 * unhealthy" is not actionable and "organisation policies are not readable, so
 * the graph over-reports" is. `alert` is the sentence the Alerts screen uses
 * when a check is not passing - phrased as the problem, where the check's own
 * label is phrased as the condition being tested.
 */
export function awsCheckResults() {
  const covered = coveredAccounts().length;
  const total = organisationAccounts().length;
  const regions = new Set(estate().identities.map((row) => row.region)).size;
  const uncovered = uncoveredAccounts();
  const missing = listNames(uncovered);
  return {
    assume: { state: 'pass', note: 'Assumed in 240ms, session capped at one hour.' },
    'external-id': {
      state: 'pass',
      note: 'The condition is present and the id matches the one issued for this tenant.',
    },
    'iam-read': {
      state: 'pass',
      note: `Authorization details returned for all ${covered} accounts that have the role.`,
    },
    cloudtrail: {
      state: 'warn',
      note: `LookupEvents answers in all ${regions} regions in range, so the last 90 days are covered. No organisation trail is logging, so nothing older survives: an identity idle for longer than 90 days cannot be told apart from one that was never used.`,
      alert: 'No organisation CloudTrail trail: behaviour history stops at 90 days',
    },
    organisation: {
      state: 'fail',
      note: 'organizations:ListPolicies returned AccessDenied. Service control policies cannot be read, so the access graph draws edges the organisation may already deny.',
      alert: 'Service control policies cannot be read: the access graph may over-report',
    },
    accounts:
      uncovered.length > 0
        ? {
            state: 'warn',
            note: `The role resolves in ${covered} of ${total} accounts. ${missing} ${uncovered.length === 1 ? 'has' : 'have'} no role deployed, so nothing in ${uncovered.length === 1 ? 'it' : 'them'} is discovered at all.`,
            alert: `${missing} ${uncovered.length === 1 ? 'has' : 'have'} no discovery role: nothing in ${uncovered.length === 1 ? 'it' : 'them'} is discovered`,
          }
        : { state: 'pass', note: `The role resolves in all ${total} accounts in the organisation.` },
  };
}

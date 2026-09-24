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

export function connectorRows() {
  const covered = coveredAccounts().length;
  const total = organisationAccounts().length;
  const missing = uncoveredAccounts();
  return CONNECTED_PLATFORMS.map((row) => ({
    ...row,
    status: row.key === 'aws' ? (missing.length > 0 ? 'attention' : 'connected') : row.status,
    detail:
      row.key === 'aws'
        ? missing.length > 0
          ? `Reading ${covered} of ${total} accounts. ${listNames(missing)} ${missing.length === 1 ? 'has' : 'have'} no discovery role deployed yet.`
          : `Reading all ${total} accounts in the organisation.`
        : row.detail,
    lastSyncedAt: new Date(ESTATE_META.NOW - intBetween(rng(hashSeed(row.key)), 4, 190) * 60_000).toISOString(),
  }));
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
  return organisationAccounts().map((account) => {
    const own = identities.filter((row) => row.account_id === account.id);
    const ownArns = new Set(own.map((row) => row.arn));
    const wizard = connected.get(account.id);
    const state = estateIds.has(account.id) ? 'collecting' : wizard ? 'pending' : 'missing';
    return {
      id: account.id,
      name: account.name,
      env: account.env,
      state,
      identities: own.length,
      credentials: credentials.filter((row) => ownArns.has(row.identity_arn)).length,
      regions: new Set(own.map((row) => row.region)).size,
      lastReadAt:
        state === 'collecting'
          ? new Date(ESTATE_META.NOW - intBetween(rng(hashSeed(`read-${account.id}`)), 6, 95) * 60_000).toISOString()
          : null,
      connectedAt: wizard?.connectedAt ?? null,
      connectedBy: wizard?.connectedBy ?? null,
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
  return {
    account: row,
    checks: [
      { key: 'assume', label: 'sts:AssumeRole with your external id', note: 'Assumed; session capped at one hour.' },
      { key: 'external-id', label: 'External id condition present', note: 'The trust policy requires the id issued to this tenant.' },
      { key: 'iam-read', label: 'iam:GetAccountAuthorizationDetails', note: 'Read access confirmed. Discovery runs in this account on the next cycle.' },
    ],
  };
}

/** When the AWS checks last ran. Alerts raised from them carry this time. */
export const AWS_VERIFIED_AT = new Date(ESTATE_META.NOW - 11 * 60_000).toISOString();

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

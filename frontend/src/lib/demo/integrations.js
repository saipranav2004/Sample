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
import { hashSeed, intBetween, rng } from './runtime';

const UNCOVERED_ACCOUNTS = [{ id: '271905338142', name: 'log-archive', env: 'production' }];

export function organisationAccounts() {
  return [...estate().accounts, ...UNCOVERED_ACCOUNTS];
}

export function uncoveredAccounts() {
  return UNCOVERED_ACCOUNTS;
}

export const CONSOLE_ACCOUNT_ID = '905418327764';
export const TENANT_EXTERNAL_ID = 'da-nhi-7f3c1a94-2b6e-4d52-9c18-a0e5f7d31b46';
export const DISCOVERY_ROLE_NAME = 'DeepAlgorithmsNhiDiscovery';

export const CONNECTED_PLATFORMS = [
  {
    key: 'aws',
    status: 'attention',
    /* Not 'connected': one account in the organisation has no role. A screen
       that only ever draws the healthy state is a screen nobody has seen fail,
       and partial coverage is the commonest real state of this connector. */
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
  const covered = estate().accounts.length;
  const total = organisationAccounts().length;
  return CONNECTED_PLATFORMS.map((row) => ({
    ...row,
    detail:
      row.key === 'aws'
        ? `Reading ${covered} of ${total} accounts. ${uncoveredAccounts()
            .map((account) => account.name)
            .join(', ')} has no discovery role deployed yet.`
        : row.detail,
    lastSyncedAt: new Date(ESTATE_META.NOW - intBetween(rng(hashSeed(row.key)), 4, 190) * 60_000).toISOString(),
  }));
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
  const covered = estate().accounts.length;
  const total = organisationAccounts().length;
  const regions = new Set(estate().identities.map((row) => row.region)).size;
  const missing = uncoveredAccounts()
    .map((account) => account.name)
    .join(', ');
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
    accounts: {
      state: 'warn',
      note: `The role resolves in ${covered} of ${total} accounts. ${missing} has no role deployed, so nothing in it is discovered at all.`,
      alert: `${missing} has no discovery role: nothing in it is discovered`,
    },
  };
}

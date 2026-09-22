/**
 * The demonstration estate.
 *
 * ── What this is ────────────────────────────────────────────────────────────
 * One deterministic AWS estate - accounts, identities, credentials, secret
 * store entries, CloudTrail events and assume-role relationships - generated
 * once and read by every screen through `lib/demo/api.js`.
 *
 * ── Why it is one file rather than one per screen ───────────────────────────
 * Because the screens have to agree. If the identity explorer invented its own
 * rows and the credential inventory invented different ones, then an identity
 * would own credentials that do not exist, an event would name a principal
 * that is not in the list, and the dashboard's totals would contradict the
 * lists they link into. Every figure on every screen here is counted from this
 * estate, so the numbers cannot drift: the dashboard's "admin-level access"
 * count is the length of the same filtered array the link behind it opens.
 *
 * ── Shape of it ─────────────────────────────────────────────────────────────
 * Non-human identities are the subject of this product, so they are the bulk
 * of the estate rather than a slice of it: of `TOTAL_IDENTITIES`, humans are a
 * deliberate minority, present because an NHI's owner, creator and consumer
 * are humans and a graph of only machines explains nothing.
 *
 * Everything is seeded, so a reload produces identical data. Figures that
 * shuffle on refresh look broken and nobody can point at a row twice.
 */

import { hashSeed, intBetween, pick, rng, sample } from './runtime';

/** Held under 250 on purpose: a demonstration estate a person can read. */
const TOTAL_IDENTITIES = 228;
const HUMAN_SHARE = 0.17;

/** How many identities are on the operator's own plate. */
const ASSIGNED_TO_OPERATOR = 24;

const DAY = 86_400_000;

/**
 * "Now", to the minute.
 *
 * Every age, last-active and event time below is an offset back from this, and
 * the offsets are seeded so they never change. The anchor itself has to be the
 * real clock rather than a literal: pinned to a fixed instant, the relative
 * formatters compare a generated timestamp against the actual time and render
 * "in 1 hour" for an event that was meant to be an hour old. Flooring to the
 * minute keeps it stable for the life of the page, so nothing reshuffles
 * between renders.
 */
const NOW = Math.floor(Date.now() / 60_000) * 60_000;

const iso = (msAgo) => new Date(NOW - msAgo).toISOString();
const daysAgo = (days) => iso(days * DAY);

/* ── Accounts ─────────────────────────────────────────────────────────────── */

const ACCOUNTS = [
  { id: '460134481056', name: 'prod-platform', env: 'production' },
  { id: '118822604417', name: 'data-platform', env: 'production' },
  { id: '337902445518', name: 'shared-services', env: 'production' },
  { id: '742015993388', name: 'payments-prod', env: 'production' },
  { id: '905617234470', name: 'staging', env: 'staging' },
  { id: '583110927644', name: 'sandbox', env: 'development' },
];

const REGIONS = ['us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-south-1'];

/* ── People ───────────────────────────────────────────────────────────────── */

/**
 * Owners and creators. Kept small and reused, because in a real estate a
 * handful of platform engineers create most of the machine identities - and
 * that concentration is itself something the screens should show.
 */
const PEOPLE = [
  { user: 'priya.raghavan', name: 'Priya Raghavan', team: 'Platform Engineering' },
  { user: 'daniel.okafor', name: 'Daniel Okafor', team: 'Platform Engineering' },
  { user: 'mei.lin.chen', name: 'Mei-Lin Chen', team: 'Data Engineering' },
  { user: 'arjun.desai', name: 'Arjun Desai', team: 'Payments' },
  { user: 'helena.brandt', name: 'Helena Brandt', team: 'Security Engineering' },
  { user: 'tomas.varga', name: 'Tomas Varga', team: 'SRE' },
  { user: 'grace.abiodun', name: 'Grace Abiodun', team: 'SRE' },
  { user: 'yusuf.karim', name: 'Yusuf Karim', team: 'Checkout' },
  { user: 'nadia.petrov', name: 'Nadia Petrov', team: 'Data Engineering' },
  { user: 'liam.donnelly', name: 'Liam Donnelly', team: 'Identity' },
  { user: 'sofia.marchetti', name: 'Sofia Marchetti', team: 'Compliance' },
  { user: 'kenji.watanabe', name: 'Kenji Watanabe', team: 'Machine Learning' },
  { user: 'ruth.mensah', name: 'Ruth Mensah', team: 'Checkout' },
  { user: 'oscar.lindqvist', name: 'Oscar Lindqvist', team: 'Platform Engineering' },
  { user: 'ananya.iyer', name: 'Ananya Iyer', team: 'Machine Learning' },
  { user: 'marcus.oyelaran', name: 'Marcus Oyelaran', team: 'Security Engineering' },
];

/** The signed-in operator. Their own resources are a screen of their own. */
export const OPERATOR = {
  user: 'cirm@admin',
  name: 'Admin',
  email: 'das.admin@deepalgorithms.io',
  // team: 'Security Engineering',
  role: 'Security administrator',
};

/* ── Naming ───────────────────────────────────────────────────────────────── */

/**
 * Name stems per classification. Real machine-identity names describe the job
 * they do, so these are built from a workload and a function rather than from
 * a word list - `svc-ledger-writer` reads like something somebody deployed,
 * `nhi-042` does not.
 */
const WORKLOADS = [
  'payments',
  'ledger',
  'checkout',
  'invoicing',
  'settlement',
  'catalogue',
  'inventory',
  'fulfilment',
  'pricing',
  'entitlements',
  'notifications',
  'search',
  'recommendations',
  'reporting',
  'audit',
  'billing',
  'onboarding',
  'kyc',
  'fraud',
  'risk',
  'telemetry',
  'feature-flags',
  'sessions',
  'identity',
];

const SERVICE_FUNCTIONS = ['api', 'worker', 'writer', 'reader', 'sync', 'reconciler', 'gateway', 'processor'];
const CICD_TOOLS = ['gha', 'codebuild', 'codepipeline', 'jenkins', 'argocd', 'terraform'];
const CICD_FUNCTIONS = ['deploy', 'release', 'plan', 'apply', 'build', 'migrate'];
const AGENT_KINDS = ['cost-optimiser', 'log-triage', 'support-copilot', 'schema-advisor', 'incident-summariser', 'query-planner'];
const SAAS_VENDORS = [
  'datadog',
  'snyk',
  'okta',
  'pagerduty',
  'snowflake',
  'segment',
  'fivetran',
  'looker',
  'vanta',
  'sentry',
  'databricks',
  'atlassian',
];
const EPHEMERAL_HOSTS = ['eks-pod', 'lambda-exec', 'batch-job', 'fargate-task', 'glue-job', 'emr-step'];

const IDENTITY_TYPES = {
  HUMAN: 'IAM_USER',
  NHI_SERVICE: 'IAM_ROLE',
  NHI_AGENT: 'IAM_ROLE',
  NHI_CICD: 'IAM_ROLE',
  NHI_SAAS: 'IAM_ROLE',
  NHI_EPHEMERAL: 'IAM_ROLE',
  DUAL_IDENTITY: 'IAM_USER',
  UNCLASSIFIED: 'IAM_ROLE',
};

/**
 * How the estate is composed. NHI classifications carry the weight because
 * they are what this product is for; humans exist to be the owners.
 */
const MIX = [
  { classification: 'NHI_SERVICE', weight: 0.3 },
  { classification: 'NHI_CICD', weight: 0.16 },
  { classification: 'NHI_EPHEMERAL', weight: 0.14 },
  { classification: 'NHI_SAAS', weight: 0.11 },
  { classification: 'NHI_AGENT', weight: 0.07 },
  { classification: 'DUAL_IDENTITY', weight: 0.03 },
  { classification: 'UNCLASSIFIED', weight: 0.02 },
];

const OWNER_TYPES = ['TAG_OWNER', 'CLOUDTRAIL_CREATOR', 'TEAM_TAG', 'ORPHANED'];

const AWS_SERVICES = [
  's3.amazonaws.com',
  'dynamodb.amazonaws.com',
  'secretsmanager.amazonaws.com',
  'sts.amazonaws.com',
  'kms.amazonaws.com',
  'lambda.amazonaws.com',
  'rds.amazonaws.com',
  'sqs.amazonaws.com',
  'ecr.amazonaws.com',
  'ssm.amazonaws.com',
  'cloudwatch.amazonaws.com',
  'iam.amazonaws.com',
];

const EVENT_NAMES = {
  's3.amazonaws.com': ['GetObject', 'PutObject', 'ListBucket', 'DeleteObject', 'GetBucketPolicy'],
  'dynamodb.amazonaws.com': ['Query', 'PutItem', 'GetItem', 'Scan', 'UpdateItem'],
  'secretsmanager.amazonaws.com': ['GetSecretValue', 'DescribeSecret', 'PutSecretValue', 'ListSecrets'],
  'sts.amazonaws.com': ['AssumeRole', 'AssumeRoleWithWebIdentity', 'GetCallerIdentity'],
  'kms.amazonaws.com': ['Decrypt', 'Encrypt', 'GenerateDataKey', 'DescribeKey'],
  'lambda.amazonaws.com': ['Invoke', 'UpdateFunctionCode', 'GetFunction', 'CreateFunction'],
  'rds.amazonaws.com': ['DescribeDBInstances', 'CreateDBSnapshot', 'ModifyDBInstance'],
  'sqs.amazonaws.com': ['SendMessage', 'ReceiveMessage', 'DeleteMessage', 'GetQueueAttributes'],
  'ecr.amazonaws.com': ['GetAuthorizationToken', 'BatchGetImage', 'PutImage', 'DescribeRepositories'],
  'ssm.amazonaws.com': ['GetParameter', 'GetParameters', 'PutParameter', 'SendCommand'],
  'cloudwatch.amazonaws.com': ['PutMetricData', 'GetMetricStatistics', 'DescribeAlarms'],
  'iam.amazonaws.com': ['CreateAccessKey', 'AttachRolePolicy', 'PassRole', 'CreatePolicyVersion', 'ListRoles'],
};

const WRITE_EVENTS = new Set([
  'PutObject',
  'DeleteObject',
  'PutItem',
  'UpdateItem',
  'PutSecretValue',
  'Encrypt',
  'GenerateDataKey',
  'Invoke',
  'UpdateFunctionCode',
  'CreateFunction',
  'CreateDBSnapshot',
  'ModifyDBInstance',
  'SendMessage',
  'DeleteMessage',
  'PutImage',
  'PutParameter',
  'SendCommand',
  'PutMetricData',
  'CreateAccessKey',
  'AttachRolePolicy',
  'PassRole',
  'CreatePolicyVersion',
]);

const POLICY_NAMES = [
  'AmazonS3ReadOnlyAccess',
  'AmazonDynamoDBFullAccess',
  'SecretsManagerReadWrite',
  'AWSLambdaBasicExecutionRole',
  'AmazonEC2ContainerRegistryPowerUser',
  'CloudWatchAgentServerPolicy',
  'AmazonSQSFullAccess',
  'AWSKeyManagementServicePowerUser',
  'AdministratorAccess',
  'PowerUserAccess',
];

const CREDENTIAL_TYPES = ['ACCESS_KEY', 'SECRET_MANAGER', 'SSM_PARAMETER', 'OIDC_TRUST', 'SERVICE_TOKEN'];

/* ── Generation ───────────────────────────────────────────────────────────── */

let cache = null;

function nameFor(next, classification, used) {
  const attempt = () => {
    const workload = pick(next, WORKLOADS);
    switch (classification) {
      case 'NHI_SERVICE':
        return `svc-${workload}-${pick(next, SERVICE_FUNCTIONS)}`;
      case 'NHI_CICD':
        return `${pick(next, CICD_TOOLS)}-${pick(next, CICD_FUNCTIONS)}-${workload}`;
      case 'NHI_AGENT':
        return `agent-${pick(next, AGENT_KINDS)}`;
      case 'NHI_SAAS':
        return `${pick(next, SAAS_VENDORS)}-integration`;
      case 'NHI_EPHEMERAL':
        return `${pick(next, EPHEMERAL_HOSTS)}-${workload}`;
      case 'DUAL_IDENTITY':
        return `${workload}-shared-ops`;
      default:
        return `role-${workload}-${intBetween(next, 100, 999)}`;
    }
  };

  for (let i = 0; i < 40; i += 1) {
    const candidate = attempt();
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  /* Exhausted the combinations for this classification: suffix it rather than
     return a duplicate, because two identities with one name is the kind of
     detail that makes a demonstration fall apart under questioning. */
  let suffix = 2;
  let candidate = `${attempt()}-${suffix}`;
  while (used.has(candidate)) {
    suffix += 1;
    candidate = `${attempt()}-${suffix}`;
  }
  used.add(candidate);
  return candidate;
}

function buildIdentities() {
  const next = rng(0x5f1d);
  const used = new Set();
  const identities = [];

  const humanCount = Math.round(TOTAL_IDENTITIES * HUMAN_SHARE);
  const machineCount = TOTAL_IDENTITIES - humanCount;

  /* Humans first, so machine identities can be owned by one of them. */
  for (let i = 0; i < humanCount; i += 1) {
    const person = PEOPLE[i % PEOPLE.length];
    const suffix = i >= PEOPLE.length ? `.${Math.floor(i / PEOPLE.length) + 1}` : '';
    const account = pick(next, ACCOUNTS);
    const name = `${person.user}${suffix}`;
    used.add(name);
    const ownHuman = rng(hashSeed(`idle:${account.id}:${name}`));
    const lastActiveDays = Math.round(140 * ownHuman() ** 3);
    const mfa = next() > 0.22;

    identities.push({
      id: `id-${account.id}-${name}`,
      arn: `arn:aws:iam::${account.id}:user/${name}`,
      name,
      classification: 'HUMAN',
      identity_type: 'IAM_USER',
      account_id: account.id,
      account_name: account.name,
      env: account.env,
      region: pick(next, REGIONS),
      person: person.user,
      owner_name: person.name,
      owner_type: 'TAG_OWNER',
      primary_owner: person.name,
      created_by_name: 'Identity (SSO provisioning)',
      team: person.team,
      is_admin: next() > 0.82,
      is_secret: false,
      is_federated: next() > 0.35,
      mfa_enabled: mfa,
      console_access: true,
      console_last_signin: daysAgo(Math.min(lastActiveDays, intBetween(next, 0, 40))),
      password_age_days: intBetween(next, 12, 420),
      last_active: daysAgo(lastActiveDays),
      last_active_days: lastActiveDays,
      created_at: daysAgo(intBetween(next, 180, 1500)),
      discovered_at: daysAgo(intBetween(next, 2, 60)),
      trust_type: 'PASSWORD',
      trust_service: null,
      is_external: false,
    });
  }

  /* Then the machines, apportioned by the mix. */
  const plan = [];
  for (const slot of MIX) plan.push(...Array(Math.round(machineCount * slot.weight)).fill(slot.classification));
  while (plan.length < machineCount) plan.push('NHI_SERVICE');
  plan.length = machineCount;

  const humans = identities.filter((row) => row.classification === 'HUMAN');

  for (const classification of plan) {
    const account = pick(next, ACCOUNTS);
    const name = nameFor(next, classification, used);
    const ownerType = pick(next, OWNER_TYPES);
    const orphaned = ownerType === 'ORPHANED';
    const creator = pick(next, humans);
    const owner = orphaned ? null : pick(next, PEOPLE);

    /* Ephemeral identities are young and busy; SaaS integrations are old and
       quiet; CI/CD runs in bursts. The age and activity profile is what makes
       "stale" and "inactive" mean anything on the dashboard. */
    const profile =
      classification === 'NHI_EPHEMERAL'
        ? { age: [1, 45], idle: [0, 6] }
        : classification === 'NHI_SAAS'
          ? { age: [200, 1400], idle: [0, 210] }
          : classification === 'NHI_CICD'
            ? { age: [60, 900], idle: [0, 120] }
            : classification === 'NHI_AGENT'
              ? { age: [20, 300], idle: [0, 30] }
              : { age: [90, 1300], idle: [0, 260] };

    /* Skewed toward recent, not uniform. A uniform draw over the idle range
       left 48% of the estate stale, which reads as an abandoned account rather
       than a working one: the point of the "stale for 90+ days" signal is that
       it picks out a minority worth acting on. The exponent biases most
       identities to recent activity and leaves a long tail. */
    const own2 = rng(hashSeed(`idle:${account.id}:${name}`));
    const lastActiveDays = Math.round(
      profile.idle[0] + (profile.idle[1] - profile.idle[0]) * own2() ** 3,
    );
    const isSecret = classification === 'NHI_SAAS' ? next() > 0.3 : next() > 0.72;
    const federated = classification === 'NHI_CICD' || classification === 'NHI_SAAS' ? next() > 0.25 : next() > 0.85;

    identities.push({
      id: `id-${account.id}-${name}`,
      arn: `arn:aws:iam::${account.id}:role/${name}`,
      name,
      classification,
      identity_type: IDENTITY_TYPES[classification],
      account_id: account.id,
      account_name: account.name,
      env: account.env,
      region: pick(next, REGIONS),
      person: owner?.user ?? null,
      owner_name: owner?.name ?? null,
      owner_type: ownerType,
      primary_owner: owner?.name ?? null,
      created_by_name: creator.owner_name,
      created_by_arn: creator.arn,
      team: owner?.team ?? null,
      is_admin: classification === 'DUAL_IDENTITY' ? next() > 0.5 : next() > 0.88,
      is_secret: isSecret,
      is_federated: federated,
      mfa_enabled: classification === 'DUAL_IDENTITY' ? next() > 0.6 : false,
      console_access: classification === 'DUAL_IDENTITY',
      console_last_signin: classification === 'DUAL_IDENTITY' ? daysAgo(intBetween(next, 1, 90)) : null,
      password_age_days: classification === 'DUAL_IDENTITY' ? intBetween(next, 30, 500) : null,
      last_active: daysAgo(lastActiveDays),
      last_active_days: lastActiveDays,
      created_at: daysAgo(intBetween(next, profile.age[0], profile.age[1])),
      discovered_at: daysAgo(intBetween(next, 2, 60)),
      trust_type: federated ? (classification === 'NHI_CICD' ? 'OIDC' : 'SAML') : 'ASSUME_ROLE',
      trust_service:
        classification === 'NHI_CICD'
          ? 'token.actions.githubusercontent.com'
          : classification === 'NHI_SAAS'
            ? `${name.split('-')[0]}.com`
            : classification === 'NHI_EPHEMERAL'
              ? `${name.split('-')[0]}.amazonaws.com`
              : null,
      is_external: classification === 'NHI_SAAS',
    });
  }

  /* Per-identity detail that depends on the identity itself, seeded from its
     name so it is stable whatever order the rows are read in. */
  for (const identity of identities) {
    const own = rng(hashSeed(identity.arn));
    const policyPool = identity.is_admin
      ? ['AdministratorAccess', ...sample(own, POLICY_NAMES.slice(0, 8), 2)]
      : sample(own, POLICY_NAMES.slice(0, 8), intBetween(own, 1, 4));
    identity.attached_policies = policyPool;
    identity.groups =
      identity.classification === 'HUMAN'
        ? sample(own, ['engineering', 'oncall', 'data-readers', 'deployers', 'break-glass'], intBetween(own, 1, 3))
        : [];
    identity.matched_rules =
      identity.classification === 'HUMAN'
        ? ['console-access', 'password-last-used']
        : [
            identity.trust_service ? 'trust-policy-principal' : 'no-console-access',
            identity.is_secret ? 'secret-store-reference' : 'access-key-present',
            'naming-convention',
          ];
    identity.evidence =
      identity.classification === 'HUMAN'
        ? `Console sign-in recorded ${identity.console_last_signin ? 'within the retention window' : 'never'}; password last rotated ${identity.password_age_days} days ago.`
        : `No console sign-in in CloudTrail. ${
            identity.trust_service
              ? `Trust policy names ${identity.trust_service}.`
              : 'Assumed by another principal in the same account.'
          } ${identity.is_secret ? 'Credentials held in Secrets Manager.' : 'Long-lived access key present.'}`;
  }

  return identities;
}

/**
 * An access key id of the right shape.
 *
 * Real ones are twenty characters: the `AKIA` prefix and sixteen more from an
 * uppercase base-32 alphabet. The first version produced `AKIA` plus twelve
 * digits, which is the wrong length and the wrong alphabet - close enough to
 * look right in isolation and wrong to anybody who works with them daily.
 */
const KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function accessKeyId(arn, index) {
  const own = rng(hashSeed(`akid:${arn}:${index}`));
  let body = '';
  for (let i = 0; i < 16; i += 1) body += KEY_ALPHABET[Math.floor(own() * KEY_ALPHABET.length)];
  return `AKIA${body}`;
}

function buildCredentials(identities) {
  const credentials = [];
  let serial = 1;

  for (const identity of identities) {
    const own = rng(hashSeed(`cred:${identity.arn}`));
    /* Humans hold at most one key; machines hold what their trust model
       implies, and a federated identity often holds none at all - which is the
       point of federating it. */
    const count =
      identity.classification === 'HUMAN'
        ? own() > 0.55
          ? 1
          : 0
        : identity.is_federated
          ? own() > 0.7
            ? 1
            : 0
          : intBetween(own, 1, 3);

    for (let i = 0; i < count; i += 1) {
      const type = identity.is_secret
        ? pick(own, ['SECRET_MANAGER', 'SSM_PARAMETER'])
        : identity.is_federated
          ? 'OIDC_TRUST'
          : pick(own, CREDENTIAL_TYPES);

      const ageDays = intBetween(own, 5, 1400);
      const lastUsedDays = Math.min(ageDays, identity.last_active_days + intBetween(own, 0, 20));
      const rotates = type === 'SECRET_MANAGER' || type === 'SSM_PARAMETER';
      const expiresInDays = rotates ? intBetween(own, -30, 120) : type === 'SERVICE_TOKEN' ? intBetween(own, -60, 200) : null;

      /* Severity follows the facts rather than a dice roll: an unrotated key
         on an administrator is the worst thing in the inventory, and a
         short-lived federated trust is the best. */
      const stale = lastUsedDays > 90;
      const ancient = ageDays > 365;
      const severity =
        identity.is_admin && type === 'ACCESS_KEY' && ancient
          ? 'CRITICAL'
          : type === 'ACCESS_KEY' && (ancient || stale)
            ? 'HIGH'
            : expiresInDays !== null && expiresInDays < 0
              ? 'HIGH'
              : stale
                ? 'MEDIUM'
                : 'LOW';

      credentials.push({
        id: `cred-${serial}`,
        cred_id:
          type === 'ACCESS_KEY'
            ? accessKeyId(identity.arn, i)
            : `${identity.name}/${type === 'SECRET_MANAGER' ? 'secret' : type === 'SSM_PARAMETER' ? 'parameter' : 'token'}-${i + 1}`,
        type,
        identity_arn: identity.arn,
        identity_name: identity.name,
        identity_type: identity.identity_type,
        identity_classification: identity.classification,
        account_id: identity.account_id,
        account_name: identity.account_name,
        severity,
        status: expiresInDays !== null && expiresInDays < 0 ? 'EXPIRED' : lastUsedDays > 90 ? 'UNUSED' : 'ACTIVE',
        created_at: daysAgo(ageDays),
        age_days: ageDays,
        expires_at: expiresInDays === null ? null : daysAgo(-expiresInDays),
        last_used_date: daysAgo(lastUsedDays),
        last_used_days: lastUsedDays,
        last_used_service: pick(own, AWS_SERVICES),
        description:
          type === 'ACCESS_KEY'
            ? `Long-lived access key, ${ageDays} days old${stale ? `, unused for ${lastUsedDays} days` : ''}.`
            : type === 'SECRET_MANAGER'
              ? 'Credential material stored in Secrets Manager with a rotation schedule.'
              : type === 'SSM_PARAMETER'
                ? 'SecureString parameter read at start-up by the workload.'
                : type === 'OIDC_TRUST'
                  ? `Short-lived credential issued through ${identity.trust_service ?? 'the federated trust'}.`
                  : 'Service token issued to a third party integration.',
      });
      serial += 1;
    }
  }

  return credentials;
}

function buildRelationships(identities) {
  const edges = [];
  const machines = identities.filter((row) => row.classification !== 'HUMAN');

  for (const identity of machines) {
    const own = rng(hashSeed(`rel:${identity.arn}`));
    /* Who assumes this role. A CI/CD role is assumed by its provider, a
       service role by another service role in the same account, and a SaaS
       role by an external principal. */
    const callerCount = intBetween(own, 1, 3);
    const candidates =
      identity.classification === 'NHI_CICD' || identity.classification === 'NHI_SAAS'
        ? []
        : sample(
            own,
            identities.filter((row) => row.arn !== identity.arn && row.account_id === identity.account_id),
            callerCount,
          );

    if (identity.trust_service) {
      edges.push({
        target_arn: identity.arn,
        caller_arn: identity.trust_service,
        caller_name: identity.trust_service,
        caller_type: 'EXTERNAL_PRINCIPAL',
        rel_type: identity.trust_type === 'OIDC' ? 'ASSUME_ROLE_WITH_WEB_IDENTITY' : 'ASSUME_ROLE_SAML',
        /* What the trust was exercised through. The drawer has a "Via" column
           for exactly this, and it was empty on every row. */
        via:
          identity.trust_type === 'OIDC'
            ? `${identity.trust_service}:sub`
            : `${identity.trust_service} SAML assertion`,
        is_external: true,
        /* An external caller comes from a public address; an internal one from
           the VPC. The consumers table prints this, and a machine identity
           assumed from a routable address is a different fact from one
           assumed inside the network. */
        source_ip: `${intBetween(own, 13, 209)}.${intBetween(own, 1, 254)}.${intBetween(own, 1, 254)}.${intBetween(own, 1, 254)}`,
        first_assumed: daysAgo(intBetween(own, 60, 700)),
        last_assumed: daysAgo(Math.max(0, identity.last_active_days - intBetween(own, 0, 3))),
        assume_count: intBetween(own, 40, 9000),
      });
    }

    for (const caller of candidates) {
      edges.push({
        target_arn: identity.arn,
        caller_arn: caller.arn,
        caller_name: caller.name,
        caller_type: caller.classification === 'HUMAN' ? 'IAM_USER' : 'IAM_ROLE',
        rel_type: 'ASSUME_ROLE',
        via: `sts:AssumeRole from ${caller.name}`,
        is_external: false,
        source_ip: `10.${intBetween(own, 0, 60)}.${intBetween(own, 0, 254)}.${intBetween(own, 1, 254)}`,
        first_assumed: daysAgo(intBetween(own, 30, 600)),
        last_assumed: daysAgo(Math.max(0, identity.last_active_days + intBetween(own, 0, 10))),
        assume_count: intBetween(own, 5, 4000),
      });
    }
  }

  /* Consumer counts, so the identity list can show reach without a lookup. */
  const consumersOf = new Map();
  for (const edge of edges) {
    if (!consumersOf.has(edge.target_arn)) consumersOf.set(edge.target_arn, []);
    consumersOf.get(edge.target_arn).push(edge);
  }
  for (const identity of identities) {
    identity.consumer_count = (consumersOf.get(identity.arn) ?? []).length;
  }

  return { edges, consumersOf };
}

function buildEvents(identities) {
  const events = [];
  let serial = 1;

  for (const identity of identities) {
    const own = rng(hashSeed(`ev:${identity.arn}`));
    /* Volume follows the identity's job: an ephemeral pod fires constantly, a
       quarterly compliance integration barely at all. Zero is a legitimate
       answer, and it is what makes a stale identity visible. */
    const base =
      identity.classification === 'NHI_EPHEMERAL'
        ? intBetween(own, 400, 4200)
        : identity.classification === 'NHI_SERVICE'
          ? intBetween(own, 60, 2600)
          : identity.classification === 'NHI_CICD'
            ? intBetween(own, 10, 700)
            : identity.classification === 'NHI_AGENT'
              ? intBetween(own, 30, 900)
              : identity.classification === 'HUMAN'
                ? intBetween(own, 0, 180)
                : intBetween(own, 0, 240);

    identity.total_events = identity.last_active_days > 90 ? 0 : base;

    /* A sample of the actual calls, for the activity screen and the drawer. */
    const sampleSize = identity.total_events === 0 ? 0 : intBetween(own, 3, 9);
    for (let i = 0; i < sampleSize; i += 1) {
      const service = pick(own, AWS_SERVICES);
      const eventName = pick(own, EVENT_NAMES[service]);
      const minutesAgo = identity.last_active_days * 1440 + intBetween(own, 0, 2400);
      events.push({
        id: `ev-${serial}`,
        event_name: eventName,
        event_source: service,
        event_time: iso(minutesAgo * 60_000),
        identity_arn: identity.arn,
        identity_name: identity.name,
        identity_classification: identity.classification,
        account_id: identity.account_id,
        account_name: identity.account_name,
        read_only: !WRITE_EVENTS.has(eventName),
        region: identity.region,
        source_ip:
          identity.classification === 'NHI_SAAS'
            ? `${intBetween(own, 12, 210)}.${intBetween(own, 1, 254)}.${intBetween(own, 1, 254)}.${intBetween(own, 1, 254)}`
            : `10.${intBetween(own, 0, 60)}.${intBetween(own, 0, 254)}.${intBetween(own, 1, 254)}`,
        user_agent:
          identity.classification === 'NHI_CICD'
            ? 'aws-cli/2.17.9 Python/3.12 Linux/6.1 exec-env/GitHubActions'
            : identity.classification === 'NHI_SAAS'
              ? `${identity.name.split('-')[0]}-integration/1.0`
              : identity.classification === 'HUMAN'
                ? 'aws-sdk-js/2.1600.0 promise console'
                : 'aws-sdk-go/1.55.5 (go1.22.5; linux; amd64)',
        target: `${service.split('.')[0]}:${pick(own, WORKLOADS)}`,
      });
      serial += 1;
    }
  }

  events.sort((a, b) => Date.parse(b.event_time) - Date.parse(a.event_time));
  return events;
}

function buildSecretEntries(identities, credentials) {
  const byArn = new Map(identities.map((row) => [row.arn, row]));
  return credentials
    .filter((credential) => credential.type === 'SECRET_MANAGER' || credential.type === 'SSM_PARAMETER')
    .map((credential) => {
      const identity = byArn.get(credential.identity_arn);
      const own = rng(hashSeed(`sec:${credential.id}`));
      return {
        id: `secret-${credential.id}`,
        secret_arn:
          credential.type === 'SECRET_MANAGER'
            ? `arn:aws:secretsmanager:${identity.region}:${identity.account_id}:secret:${identity.name}-${String(hashSeed(credential.id)).slice(0, 6)}`
            : `arn:aws:ssm:${identity.region}:${identity.account_id}:parameter/${identity.env}/${identity.name}`,
        secret_name: credential.type === 'SECRET_MANAGER' ? `${identity.env}/${identity.name}` : `/${identity.env}/${identity.name}`,
        store: credential.type === 'SECRET_MANAGER' ? 'Secrets Manager' : 'Parameter Store',
        rotation_enabled: own() > 0.42,
        rotation_days: own() > 0.42 ? pick(own, [30, 60, 90]) : null,
        last_rotated: credential.created_at,
        credential_id: credential.id,
        ...identity,
      };
    });
}

/** The whole estate, built once. */
export function estate() {
  if (cache) return cache;

  const identities = buildIdentities();
  const credentials = buildCredentials(identities);
  const { edges, consumersOf } = buildRelationships(identities);
  const events = buildEvents(identities);

  /* Credential counts back onto the identity, so the list and the drawer agree
     with the inventory without either querying the other. */
  const credentialsOf = new Map();
  for (const credential of credentials) {
    if (!credentialsOf.has(credential.identity_arn)) credentialsOf.set(credential.identity_arn, []);
    credentialsOf.get(credential.identity_arn).push(credential);
  }
  for (const identity of identities) {
    const own = credentialsOf.get(identity.arn) ?? [];
    /* The credentials themselves, not a count.
       The drawer renders `owned_credentials` as a table and guards it with
       `Array.isArray`, so a number failed the guard silently and every
       identity reported "Credentials 0" while the register listed 310 of
       them. `credential_count` carries the figure for the places that only
       need the number. */
    identity.owned_credentials = own;
    identity.credential_count = own.length;
    identity.access_key_count = own.filter((row) => row.type === 'ACCESS_KEY').length;
    identity.access_key_age_days = own
      .filter((row) => row.type === 'ACCESS_KEY')
      .reduce((max, row) => Math.max(max, row.age_days), 0);
  }

  /* What "assigned to me" means.
     It used to be inferred from the operator's team, which stopped working
     the moment the operator became `Admin` with no team: the screen went
     empty. Inference was the wrong model anyway - the nav section is called
     "Assigned to me", and an assignment is a fact somebody records, not
     something derived from an org chart.
     So a deterministic subset carries an explicit assignment, weighted toward
     the identities an administrator would actually be handed: the
     administrator-equivalent ones, the unowned ones and the stale ones. */
  const assignable = [...identities].sort((a, b) => {
    const weight = (row) =>
      (row.is_admin ? 4 : 0) +
      (row.owner_type === 'ORPHANED' ? 3 : 0) +
      (row.last_active_days > 90 ? 2 : 0) +
      (row.is_secret ? 1 : 0);
    return weight(b) - weight(a) || a.name.localeCompare(b.name);
  });
  for (const [index, identity] of assignable.entries()) {
    if (index >= ASSIGNED_TO_OPERATOR) break;
    identity.assigned_to = OPERATOR.user;
    identity.assigned_to_name = OPERATOR.name;
    identity.assigned_at = daysAgo(intBetween(rng(hashSeed(`assign:${identity.arn}`)), 1, 45));
  }

  const secrets = buildSecretEntries(identities, credentials);

  cache = {
    accounts: ACCOUNTS,
    people: PEOPLE,
    identities,
    credentials,
    credentialsOf,
    edges,
    consumersOf,
    events,
    secrets,
    byArn: new Map(identities.map((row) => [row.arn, row])),
  };
  return cache;
}

export const ESTATE_META = { TOTAL_IDENTITIES, NOW, DAY, daysAgo, iso };

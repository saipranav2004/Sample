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
import { actorTypeMeta } from '../domain';

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
  { user: 'rohan.mehta', name: 'Rohan Mehta', team: 'Platform Engineering' },
  { user: 'meera.krishnan', name: 'Meera Krishnan', team: 'Data Engineering' },
  { user: 'arjun.desai', name: 'Arjun Desai', team: 'Payments' },
  { user: 'kavya.reddy', name: 'Kavya Reddy', team: 'Security Engineering' },
  { user: 'vikram.singh', name: 'Vikram Singh', team: 'SRE' },
  { user: 'neha.gupta', name: 'Neha Gupta', team: 'SRE' },
  { user: 'imran.khan', name: 'Imran Khan', team: 'Checkout' },
  { user: 'divya.menon', name: 'Divya Menon', team: 'Data Engineering' },
  { user: 'karthik.rao', name: 'Karthik Rao', team: 'Identity' },
  { user: 'sneha.kulkarni', name: 'Sneha Kulkarni', team: 'Compliance' },
  { user: 'aditya.verma', name: 'Aditya Verma', team: 'Machine Learning' },
  { user: 'pooja.bhat', name: 'Pooja Bhat', team: 'Checkout' },
  { user: 'siddharth.jain', name: 'Siddharth Jain', team: 'Platform Engineering' },
  { user: 'ananya.iyer', name: 'Ananya Iyer', team: 'Machine Learning' },
  { user: 'rahul.sharma', name: 'Rahul Sharma', team: 'Security Engineering' },
];

/** The signed-in operator. Their own resources are a screen of their own. */
export const OPERATOR = {
  user: 'cirm@admin',
  name: 'Admin',
  email: 'das.admin@gmail.com',
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

/** Candidate actor types per classification, in the proportions they occur. */
const ACTOR_POOL = {
  NHI_SERVICE: [
    'AWS::Lambda::Function',
    'AWS::Lambda::Function',
    'AWS::ECS::Task',
    'AWS::EC2::Instance',
    'AWS::ApiGateway::Integration',
    'AWS::AppRunner::Service',
    'AWS::StepFunctions::StateMachine',
  ],
  NHI_AGENT: [
    'AWS::Bedrock::Agent',
    'AWS::Bedrock::KnowledgeBase',
    'AWS::SageMaker::Endpoint',
    'AWS::SageMaker::NotebookInstance',
  ],
  NHI_CICD: [
    'AWS::CodeBuild::Project',
    'AWS::CodePipeline::Pipeline',
    'GitHub::Actions::WorkflowRun',
    'GitLab::CI::Job',
    'Terraform::Run',
  ],
  NHI_SAAS: ['External::SaaSVendor'],
  UNCLASSIFIED: ['UNKNOWN'],
};

/**
 * Ephemeral actors take their type from their own name.
 *
 * The name stems already say what the workload is - `eks-pod-...`,
 * `glue-job-...` - so deriving the type from the stem keeps the name and the
 * type from contradicting each other, which a random draw would let happen.
 */
const EPHEMERAL_ACTOR_TYPES = {
  'eks-pod': 'AWS::EKS::Pod',
  'lambda-exec': 'AWS::Lambda::Function',
  'batch-job': 'AWS::Batch::Job',
  'fargate-task': 'AWS::ECS::FargateTask',
  'glue-job': 'AWS::Glue::JobRun',
  'emr-step': 'AWS::EMR::Step',
};

function actorTypeFor(next, classification, name) {
  if (classification === 'NHI_EPHEMERAL') {
    const stem = Object.keys(EPHEMERAL_ACTOR_TYPES).find((key) => name.startsWith(key));
    return stem ? EPHEMERAL_ACTOR_TYPES[stem] : 'AWS::Lambda::Function';
  }
  /* A dual identity is the documented exception: a human account that is also
     used as a service account, so the user IS the actor. */
  if (classification === 'DUAL_IDENTITY') return 'AWS::IAM::User';
  const pool = ACTOR_POOL[classification];
  return pool ? pick(next, pool) : 'UNKNOWN';
}

/**
 * The actor's own resource id, in the shape its service uses.
 *
 * Not the role name. An EC2 instance is `i-0a1b2c3d4e5f6a7b8`; the role it
 * assumes has a name somebody chose. Showing the role name as the actor's id
 * is how two instances on one role end up looking like one thing.
 */
function actorIdFor(actorType, name, seed) {
  const own = rng(hashSeed(`actor:${name}`));
  const hex = (length) => {
    let out = '';
    for (let i = 0; i < length; i += 1) out += '0123456789abcdef'[Math.floor(own() * 16)];
    return out;
  };
  switch (actorType) {
    case 'AWS::EC2::Instance':
      return `i-0${hex(16)}`;
    case 'AWS::ECS::Task':
    case 'AWS::ECS::FargateTask':
      return `task/${hex(32)}`;
    case 'AWS::EKS::Pod':
      return `${name}-${hex(5)}`;
    case 'AWS::Batch::Job':
      return `${hex(8)}-${hex(4)}-${hex(4)}`;
    case 'AWS::Glue::JobRun':
      return `jr_${hex(24)}`;
    case 'AWS::EMR::Step':
      return `s-${hex(13).toUpperCase()}`;
    case 'GitHub::Actions::WorkflowRun':
    case 'GitLab::CI::Job':
      return `${name}@${seed}`;
    default:
      return name;
  }
}

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

/**
 * What counts as a credential.
 *
 * `ASSUMED_ROLE` leads the list because it is the correction: an IAM role is
 * a credential an actor assumes, not an identity of its own, so every
 * non-human actor in this estate contributes one row here for the role it
 * holds. It is not drawn from this pool at random - it is generated once per
 * actor, deterministically, because the relationship is one-to-one.
 */
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
  const accountsByPerson = new Map();

  /* Humans first, so machine identities can be owned by one of them. */
  for (let i = 0; i < humanCount; i += 1) {
    const person = PEOPLE[i % PEOPLE.length];
    /* A person with IAM users in several accounts keeps the same username in
       each - the usual sprawl, and what a real estate looks like - rather
       than a numbered copy of themselves. Their accounts are distinct: if the
       draw lands on one they already have, the next account over is used,
       without another draw, so the rest of the seeded sequence is unchanged. */
    const held = accountsByPerson.get(person.user) ?? new Set();
    let accountIndex = ACCOUNTS.indexOf(pick(next, ACCOUNTS));
    while (held.has(ACCOUNTS[accountIndex].id)) accountIndex = (accountIndex + 1) % ACCOUNTS.length;
    const account = ACCOUNTS[accountIndex];
    held.add(account.id);
    accountsByPerson.set(person.user, held);
    const name = person.user;
    used.add(name);
    const ownHuman = rng(hashSeed(`idle:${account.id}:${name}`));
    const lastActiveDays = Math.round(140 * ownHuman() ** 3);
    const mfa = next() > 0.22;

    identities.push({
      id: `id-${account.id}-${name}`,
      arn: `arn:aws:iam::${account.id}:user/${name}`,
      name,
      classification: 'HUMAN',
      /* A person is the actor. The IAM user is both the actor and the
         credential holder here, which is why `principal_type` and the actor
         agree for a human and diverge for everything else. */
      identity_type: 'AWS::IAM::User',
      actor_category: 'HUMAN',
      actor_id: name,
      discovery_api: 'iam:ListUsers',
      principal_type: 'IAM_USER',
      principal_arn: `arn:aws:iam::${account.id}:user/${name}`,
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
    /* The actor first, then the role it assumes - in that order, because the
       actor is the identity and the role is what it holds. */
    const actorType = actorTypeFor(next, classification, name);
    const actorMeta = actorTypeMeta(actorType);
    const ownerType = pick(next, OWNER_TYPES);
    const orphaned = ownerType === 'ORPHANED';
    const creator = pick(next, humans);
    const drawnOwner = pick(next, PEOPLE);
    /* Where the owner came from decides who it is: an owner resolved from
       the CloudTrail creator IS the creator. The draw stays, so the rest of
       the seeded sequence is unchanged. */
    const owner = orphaned
      ? null
      : ownerType === 'CLOUDTRAIL_CREATOR'
        ? PEOPLE.find((person) => person.user === creator.person) ?? drawnOwner
        : drawnOwner;

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

    /* A dual identity is an IAM user acting as a service account, so its
       principal is a user rather than a role - the one case where the actor
       and the credential really are the same object. */
    const isUserPrincipal = classification === 'DUAL_IDENTITY';
    const principalArn = isUserPrincipal
      ? `arn:aws:iam::${account.id}:user/${name}`
      : `arn:aws:iam::${account.id}:role/${name}`;

    identities.push({
      id: `id-${account.id}-${name}`,
      /* Still the principal ARN, because that is what AWS evaluates
         authorization against and what CloudTrail records - so it stays the
         join key across events, credentials and the graph. The actor is
         described by the four fields under it. */
      arn: principalArn,
      name,
      classification,
      identity_type: actorType,
      actor_category: actorMeta.category,
      actor_id: actorIdFor(actorType, name, account.id),
      discovery_api: actorMeta.discoveryApi,
      /* What the actor holds. An IAM role is a credential, not an identity -
         it appears in the credential inventory as an ASSUMED_ROLE row. */
      principal_type: isUserPrincipal ? 'IAM_USER' : 'IAM_ROLE',
      principal_arn: principalArn,
      bound_via: actorMeta.boundVia,
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
      /* An IAM user signs in with a password; only a role is assumed. */
      trust_type: isUserPrincipal ? 'PASSWORD' : federated ? (classification === 'NHI_CICD' ? 'OIDC' : 'SAML') : 'ASSUME_ROLE',
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
  }

  return identities;
}

/**
 * Why an identity was classified the way it was - the rules that matched and
 * the evidence behind them. Written from what the identity actually holds,
 * after its credentials are known: it used to be written first, from a flag,
 * so a role with no key read "Long-lived access key present" and a shared
 * user with console sign-ins read "No console sign-in in CloudTrail".
 * Exported so the estate as it stands after fixes can restate it.
 */
export function classificationEvidence(identity) {
  const keys = (identity.owned_credentials ?? []).filter((credential) => credential.type === 'ACCESS_KEY');
  const keyText = keys.length
    ? `${keys.length} long-lived access ${keys.length === 1 ? 'key' : 'keys'} held through IAM user ${keys[0].iam_user}.`
    : 'No long-lived access key.';
  if (identity.classification === 'HUMAN') {
    return {
      matched_rules: ['console-access', 'password-last-used'],
      evidence: `Console sign-in recorded ${identity.console_last_signin ? 'within the retention window' : 'never'}; password last rotated ${identity.password_age_days} days ago.`,
    };
  }
  if (identity.classification === 'DUAL_IDENTITY') {
    return {
      matched_rules: ['console-access', keys.length ? 'access-key-present' : 'programmatic-api-calls', 'shared-credential-pattern'],
      evidence: `Console sign-ins and API calls from a workload share this IAM user's credentials. ${keyText}`,
    };
  }
  return {
    matched_rules: [
      identity.trust_service ? 'trust-policy-principal' : 'no-console-access',
      identity.is_secret ? 'secret-store-reference' : keys.length ? 'access-key-present' : 'role-session-only',
      'naming-convention',
    ],
    evidence: `No console sign-in in CloudTrail. ${
      identity.trust_service
        ? `Trust policy names ${identity.trust_service}.`
        : SERVICE_PRINCIPALS[identity.identity_type]
          ? `Its role is assumed by ${SERVICE_PRINCIPALS[identity.identity_type]}.`
          : identity.is_external
            ? 'Its role is assumed from an account outside the organisation.'
            : 'Its role is assumed by other principals in the same account.'
    } ${identity.is_secret ? 'Credentials held in Secrets Manager.' : keyText}`,
  };
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

    /* The role the actor assumes, as a credential row.
       This is where the IAM roles that used to be listed as identities live
       now. An actor holds exactly one principal, so this is one row per
       non-human actor - and its age and last use are the actor's, because a
       role's own age says nothing about whether anybody is using it.
       Skipped for humans and dual identities: their principal is an IAM user,
       which is the documented exception where the actor and the credential are
       the same object, so a separate row would double-count it. */
    if (identity.principal_type === 'IAM_ROLE') {
      const roleStale = identity.last_active_days > 90;
      credentials.push({
        id: `cred-${serial}`,
        cred_id: identity.name,
        type: 'ASSUMED_ROLE',
        identity_arn: identity.arn,
        identity_name: identity.name,
        identity_type: identity.identity_type,
        identity_classification: identity.classification,
        account_id: identity.account_id,
        account_name: identity.account_name,
        /* An administrator-equivalent role nothing has assumed for months is
           the worst row in this inventory: full permissions, nobody watching,
           and no rotation event that would ever draw attention to it. */
        severity: identity.is_admin && roleStale ? 'CRITICAL' : identity.is_admin ? 'HIGH' : roleStale ? 'MEDIUM' : 'LOW',
        status: roleStale ? 'UNUSED' : 'ACTIVE',
        created_at: identity.created_at,
        age_days: Math.max(1, Math.round((NOW - Date.parse(identity.created_at)) / DAY)),
        /* A role does not expire. Stating null rather than a date keeps the
           Credentials screen from implying a rotation deadline that does not
           exist for this type. */
        expires_at: null,
        last_used_date: identity.last_active,
        last_used_days: identity.last_active_days,
        last_used_service: 'sts.amazonaws.com',
        description: `IAM role assumed by ${actorTypeMeta(identity.identity_type).label} ${identity.actor_id}. Resolved from ${identity.bound_via}.`,
      });
      serial += 1;
    }

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
        /* An access key always belongs to an IAM user - a role cannot hold
           one. For a person or a dual identity that user is the identity
           itself; a workload that authenticates with a key does so through a
           separate IAM user created for it, named here so a command can act
           on it. */
        ...(type === 'ACCESS_KEY'
          ? {
              iam_user: identity.principal_type === 'IAM_USER' ? identity.name : `${identity.name}-key-user`,
              iam_user_arn: `arn:aws:iam::${identity.account_id}:user/${
                identity.principal_type === 'IAM_USER' ? identity.name : `${identity.name}-key-user`
              }`,
            }
          : {}),
        description:
          type === 'ACCESS_KEY'
            ? `Long-lived access key of IAM user ${
                identity.principal_type === 'IAM_USER' ? identity.name : `${identity.name}-key-user`
              }, ${ageDays} days old${stale ? `, unused for ${lastUsedDays} days` : ''}.`
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

/* The AWS service that assumes a workload's role. For a Lambda function,
   an ECS task or an App Runner service it is AWS itself that calls
   sts:AssumeRole, through the service principal named in the role's trust
   policy - CloudTrail records that principal, with the service name as the
   source address. */
const SERVICE_PRINCIPALS = {
  'AWS::EC2::Instance': 'ec2.amazonaws.com',
  'AWS::Lambda::Function': 'lambda.amazonaws.com',
  'AWS::ECS::Task': 'ecs-tasks.amazonaws.com',
  'AWS::ECS::FargateTask': 'ecs-tasks.amazonaws.com',
  'AWS::EKS::Pod': 'pods.eks.amazonaws.com',
  'AWS::AppRunner::Service': 'tasks.apprunner.amazonaws.com',
  'AWS::Batch::Job': 'ecs-tasks.amazonaws.com',
  'AWS::StepFunctions::StateMachine': 'states.amazonaws.com',
  'AWS::Events::Rule': 'events.amazonaws.com',
  'AWS::CodeBuild::Project': 'codebuild.amazonaws.com',
  'AWS::CodePipeline::Pipeline': 'codepipeline.amazonaws.com',
  'AWS::Bedrock::Agent': 'bedrock.amazonaws.com',
  'AWS::Bedrock::KnowledgeBase': 'bedrock.amazonaws.com',
  'AWS::SageMaker::Endpoint': 'sagemaker.amazonaws.com',
  'AWS::SageMaker::NotebookInstance': 'sagemaker.amazonaws.com',
  'AWS::Glue::JobRun': 'glue.amazonaws.com',
  'AWS::EMR::Step': 'elasticmapreduce.amazonaws.com',
  'AWS::ApiGateway::Integration': 'apigateway.amazonaws.com',
};

function buildRelationships(identities) {
  const edges = [];
  /* Only a role is assumed. An IAM user - a person, or one shared with a
     workload - signs in with its own password or keys; nothing assumes it. */
  const roles = identities.filter((row) => row.principal_type === 'IAM_ROLE');

  for (const identity of roles) {
    const own = rng(hashSeed(`rel:${identity.arn}`));
    const window = {
      first_assumed: daysAgo(Math.max(identity.last_active_days + 1, intBetween(own, 30, 700))),
      last_assumed: daysAgo(identity.last_active_days),
    };

    /* Federated: an OIDC provider or a vendor, from outside the network. */
    if (identity.trust_service && identity.trust_type !== 'ASSUME_ROLE') {
      edges.push({
        target_arn: identity.arn,
        caller_arn: identity.trust_service,
        caller_name: identity.trust_service,
        caller_type: 'EXTERNAL_PRINCIPAL',
        rel_type: identity.trust_type === 'OIDC' ? 'ASSUME_ROLE_WITH_WEB_IDENTITY' : 'ASSUME_ROLE_SAML',
        via:
          identity.trust_type === 'OIDC'
            ? `${identity.trust_service}:sub`
            : `${identity.trust_service} SAML assertion`,
        is_external: true,
        source_ip: `${intBetween(own, 13, 209)}.${intBetween(own, 1, 254)}.${intBetween(own, 1, 254)}.${intBetween(own, 1, 254)}`,
        ...window,
        assume_count: intBetween(own, 40, 9000),
      });
      continue;
    }

    /* A vendor role with no federation trust: the vendor's AWS account. */
    if (identity.is_external) {
      edges.push({
        target_arn: identity.arn,
        caller_arn: identity.trust_service ?? 'external-account',
        caller_name: identity.trust_service ?? 'External AWS account',
        caller_type: 'EXTERNAL_PRINCIPAL',
        rel_type: 'ASSUME_ROLE',
        via: 'sts:AssumeRole from the vendor account',
        is_external: true,
        source_ip: `${intBetween(own, 13, 209)}.${intBetween(own, 1, 254)}.${intBetween(own, 1, 254)}.${intBetween(own, 1, 254)}`,
        ...window,
        assume_count: intBetween(own, 40, 9000),
      });
      continue;
    }

    /* A workload: the AWS service it runs on assumes its role. */
    const service = SERVICE_PRINCIPALS[identity.identity_type] ?? identity.trust_service;
    if (service) {
      edges.push({
        target_arn: identity.arn,
        caller_arn: service,
        caller_name: service,
        caller_type: 'AWS_SERVICE',
        rel_type: 'ASSUME_ROLE',
        via: `Trust policy names ${service}`,
        is_external: false,
        source_ip: service,
        ...window,
        assume_count: intBetween(own, 200, 40000),
      });
      continue;
    }

    /* Anything else - a Terraform run, an unresolved actor - is a role that
       people or other roles in the account assume directly. */
    const callers = sample(
      own,
      identities.filter((row) => row.arn !== identity.arn && row.account_id === identity.account_id),
      intBetween(own, 1, 3),
    );
    for (const caller of callers) {
      /* A call happens when both ends are alive: never after the caller's
         own last activity, nor after the role's. */
      const lastDays = Math.max(identity.last_active_days, caller.last_active_days);
      edges.push({
        target_arn: identity.arn,
        caller_arn: caller.arn,
        caller_name: caller.name,
        caller_type: caller.identity_type,
        rel_type: 'ASSUME_ROLE',
        via: `sts:AssumeRole from ${caller.name}`,
        is_external: false,
        source_ip: `10.${intBetween(own, 0, 60)}.${intBetween(own, 0, 254)}.${intBetween(own, 1, 254)}`,
        first_assumed: daysAgo(Math.max(lastDays + 1, intBetween(own, 30, 700))),
        last_assumed: daysAgo(lastDays),
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
        identity_id: identity.id,
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

/**
 * Secret-store metadata, attached to the credential it describes.
 *
 * It used to be a separate list with a screen of its own, which put the same
 * fact in two places: "this credential lives in Secrets Manager" is a property
 * of the credential, not a different kind of object. A credential is either
 * held in a managed store or it is not, and the Credentials screen is where
 * that is answered.
 */
function attachSecretStores(identities, credentials) {
  const byArn = new Map(identities.map((row) => [row.arn, row]));
  for (const credential of credentials) {
    if (credential.type !== 'SECRET_MANAGER' && credential.type !== 'SSM_PARAMETER') continue;
    const identity = byArn.get(credential.identity_arn);
    if (!identity) continue;
    const own = rng(hashSeed(`sec:${credential.id}`));
    const rotates = own() > 0.42;
    credential.store = credential.type === 'SECRET_MANAGER' ? 'Secrets Manager' : 'Parameter Store';
    credential.store_arn =
      credential.type === 'SECRET_MANAGER'
        ? `arn:aws:secretsmanager:${identity.region}:${identity.account_id}:secret:${identity.name}-${String(hashSeed(credential.id)).slice(0, 6)}`
        : `arn:aws:ssm:${identity.region}:${identity.account_id}:parameter/${identity.env}/${identity.name}`;
    credential.store_name =
      credential.type === 'SECRET_MANAGER' ? `${identity.env}/${identity.name}` : `/${identity.env}/${identity.name}`;
    credential.rotation_enabled = rotates;
    credential.rotation_days = rotates ? pick(own, [30, 60, 90]) : null;
    credential.last_rotated = credential.created_at;
  }
}

/** The whole estate, built once. */
export function estate() {
  if (cache) return cache;

  /* The product is about non-human identities only. People are still
     generated - they are who creates and owns the workloads - but their own
     IAM users are not part of the estate this console reports: no screen,
     count, alert or graph shows a person's identity. */
  const identities = buildIdentities().filter((row) => row.classification !== 'HUMAN');
  const credentials = buildCredentials(identities);
  attachSecretStores(identities, credentials);
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
    Object.assign(identity, classificationEvidence(identity));
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
      /* A long-lived key, not a managed-store entry. A credential kept in
         Secrets Manager with a rotation schedule is the good case; it used to
         add weight here, which put the better-managed identities at the top of
         somebody's queue. */
      (row.access_key_count > 0 ? 1 : 0);
    return weight(b) - weight(a) || a.name.localeCompare(b.name);
  });
  for (const [index, identity] of assignable.entries()) {
    if (index >= ASSIGNED_TO_OPERATOR) break;
    identity.assigned_to = OPERATOR.user;
    identity.assigned_to_name = OPERATOR.name;
    identity.assigned_at = daysAgo(intBetween(rng(hashSeed(`assign:${identity.arn}`)), 1, 45));
  }


  cache = {
    accounts: ACCOUNTS,
    people: PEOPLE,
    identities,
    credentials,
    credentialsOf,
    edges,
    consumersOf,
    events,
    byArn: new Map(identities.map((row) => [row.arn, row])),
  };
  return cache;
}

export const ESTATE_META = { TOTAL_IDENTITIES, NOW, DAY, daysAgo, iso };

import { SEVERITY_ORDER } from '../domain';
import { estate as sharedEstate } from './estate';
import { demoRequest, hashSeed, intBetween, pick, rng, sample } from './runtime';

/**
 * Access graph dataset - who can reach what, and what it would cost.
 *
 * ── What this models, and where the model comes from ────────────────────────
 * IAM is not a list of policies, it is a reachability graph: the question an
 * operator actually has is "if this credential leaks, what does the holder end
 * up with", and that answer lives in the edges rather than in any single
 * policy document. The node and edge vocabulary here follows the established
 * ones rather than being invented:
 *
 *   Nodes    account, identity (role/user), federated principal, service
 *            principal, credential, policy, resource - the taxonomy
 *            Cartography's AWS schema uses (AWSAccount, AWSPrincipal, AWSRole,
 *            AWSUser, AWSFederatedPrincipal, AWSServicePrincipal,
 *            AWSAccountAccessKey, AWSManagedPolicy).
 *
 *   Edges    ASSUME_ROLE and TRUSTS (from a role's trust policy), CAN_PASS_ROLE
 *            (iam:PassRole), ATTACHED_POLICY, HAS_CREDENTIAL, and the access
 *            edges CAN_READ / CAN_WRITE / CAN_ADMIN. Again Cartography's
 *            relationship names: STS_ASSUMEROLE_ALLOW, TRUSTS_AWS_PRINCIPAL,
 *            CAN_PASS_ROLE, POLICY, AWS_ACCESS_KEY.
 *
 *   ESCALATES_TO is the interesting one, and it is not a permission - it is an
 *   interaction between permissions that are individually benign. Every
 *   escalation edge this module emits is one of the documented AWS methods
 *   (Rhino Security Labs' catalogue, the same set PMapper's `preset privesc`
 *   checks), with the real permission combination attached. See ESCALATIONS.
 *
 * An attack path is entry point -> pivots -> target, the structure attack path
 * analysis has settled on, and is scored by what it reaches rather than by how
 * many steps it takes: a two-hop path to a crown-jewel data store outranks a
 * five-hop path to a log bucket.
 *
 * A choke point is an edge that appears in many paths. It is the only figure
 * on the screen that tells an operator what to do first, because cutting one
 * choke point closes every path through it - which is a different and much
 * shorter list than "fix these 40 findings".
 *
 * ── Where the data comes from ───────────────────────────────────────────────
 * There is no graph endpoint. The nodes, edges, paths and blast radii here are
 * generated in the browser, deterministically, under the same suspension
 * `lib/demo/runtime.js` documents for the other two features - and contained
 * the same way: nothing outside `features/access` imports this module.
 *
 * It deliberately speaks the live vocabulary rather than one of its own. The
 * identity classifications are `CLASSIFICATIONS` from `lib/domain`, the
 * identity types and ARNs take the shapes the real `/api/identities` returns,
 * and the credential types, severities and staleness follow the real
 * `/api/credentials` model - so a node here and a row on the Identities or
 * Credentials screen are the same thing described twice, and both screens are
 * reachable from the graph by search. When a real graph endpoint arrives, the
 * selectors at the bottom are what change.
 */

/* ── Vocabulary ───────────────────────────────────────────────────────────── */

/** Node kinds, in the order they are laid out left to right. */
export const NODE_KINDS = {
  account: {
    label: 'Account',
    plural: 'Accounts',
    tone: 'brand',
    description: 'An AWS account. Its boundary is the zone of trust: an edge that crosses it needs two policies to agree, not one.',
  },
  entry: {
    label: 'Entry point',
    plural: 'Entry points',
    tone: 'critical',
    description: 'Where an attacker starts: a federated trust, a public endpoint, or a credential that has left the building.',
  },
  federated: {
    label: 'Federated principal',
    plural: 'Federated principals',
    tone: 'high',
    description: 'An identity from outside the account - an OIDC provider, a SAML federation, or another tenant.',
  },
  identity: {
    label: 'Identity',
    plural: 'Identities',
    tone: 'brand',
    description: 'An IAM role or user inside the account. The same identities the Identities screen lists.',
  },
  service: {
    label: 'Service principal',
    plural: 'Service principals',
    tone: 'info',
    description: 'An AWS service that assumes a role on its own behalf, such as lambda.amazonaws.com.',
  },
  credential: {
    label: 'Credential',
    plural: 'Credentials',
    tone: 'medium',
    description: 'A long-lived key, secret or token that authenticates as an identity.',
  },
  policy: {
    label: 'Policy',
    plural: 'Policies',
    tone: 'neutral',
    description: 'The document that grants the access. Shown because a grant is removed in a policy, not on an edge.',
  },
  resource: {
    label: 'Resource',
    plural: 'Resources',
    tone: 'neutral',
    description: 'Something an identity can act on: a bucket, a table, a secret, a key, a queue.',
  },
};

/**
 * Edge kinds.
 *
 * `weight` orders them when several edges connect the same pair, and drives
 * which edge a path is named after. `escalation` marks the edges that are an
 * interaction between permissions rather than a single grant.
 */
export const EDGE_KINDS = {
  EXPOSES: {
    label: 'Exposes',
    verb: 'exposes',
    tone: 'critical',
    weight: 6,
    description: 'What the starting condition hands an attacker before they have done anything else.',
  },
  TRUSTS: {
    label: 'Trusts',
    verb: 'is trusted by',
    tone: 'high',
    weight: 4,
    description: "The role's trust policy names this principal, so it can call sts:AssumeRole against it.",
  },
  ASSUME_ROLE: {
    label: 'Can assume',
    verb: 'can assume',
    tone: 'high',
    weight: 5,
    description: 'sts:AssumeRole is permitted, so this identity can become the other one and inherit everything it has.',
  },
  CAN_PASS_ROLE: {
    label: 'Can pass',
    verb: 'can pass',
    tone: 'high',
    weight: 5,
    description: 'iam:PassRole is permitted for this role, which is what turns a compute permission into a privilege escalation.',
  },
  ESCALATES_TO: {
    label: 'Escalates to',
    verb: 'can escalate to',
    tone: 'critical',
    weight: 6,
    escalation: true,
    description: 'Two permissions that are harmless apart combine into a way of becoming the other identity.',
  },
  HAS_CREDENTIAL: {
    label: 'Authenticates',
    verb: 'authenticates as',
    tone: 'medium',
    weight: 3,
    description: 'Whoever holds this credential acts as that identity, with everything the identity can reach.',
  },
  ATTACHED_POLICY: {
    label: 'Granted by',
    verb: 'is granted by',
    tone: 'neutral',
    weight: 1,
    description: 'The policy that grants the access. Shown because remediation happens in a policy, not on an edge.',
  },
  CAN_READ: {
    label: 'Can read',
    verb: 'can read',
    tone: 'info',
    weight: 2,
    description: 'Read access to the resource: the data can be copied out.',
  },
  CAN_WRITE: {
    label: 'Can write',
    verb: 'can write',
    tone: 'medium',
    weight: 3,
    description: 'Write access: the resource can be altered, poisoned or deleted.',
  },
  CAN_ADMIN: {
    label: 'Administers',
    verb: 'administers',
    tone: 'critical',
    weight: 5,
    description: 'Control of the resource itself, including its policy - which means control of who else can reach it.',
  },
};

/** The three levels the graph is read at. */
export const GRAPH_LEVELS = [
  {
    value: 'accounts',
    label: 'Accounts',
    title: 'Trust between accounts',
    lede: 'Where the zone of trust is crossed. An edge here is a role in one account that another account can assume.',
  },
  {
    value: 'identities',
    label: 'Identities',
    title: 'Reachability between identities',
    lede: 'Who can become whom. Assume-role, pass-role and escalation edges, from the entry points inward.',
  },
  {
    value: 'resources',
    label: 'Resources',
    title: 'Effective access to resources',
    lede: 'What the reachable identities can act on, and at what level. This is the blast radius, drawn.',
  },
];

/**
 * Documented privilege escalation methods.
 *
 * Every entry is a real AWS method with its real permission combination, taken
 * from the published catalogue rather than imagined: these are the same
 * combinations `pmapper preset privesc` looks for. `via` is what the operator
 * needs to understand; `permissions` is what a policy has to stop.
 */
export const ESCALATIONS = [
  {
    key: 'ec2-runinstances',
    label: 'Launch EC2 with an instance profile',
    service: 'EC2',
    permissions: ['iam:PassRole', 'ec2:RunInstances'],
    via: 'Start an instance carrying the target role, then read its credentials from the instance metadata service.',
    prevention: 'Scope iam:PassRole to the roles this identity legitimately launches, and require IMDSv2.',
  },
  {
    key: 'lambda-create-invoke',
    label: 'Create and invoke a Lambda function',
    service: 'Lambda',
    permissions: ['iam:PassRole', 'lambda:CreateFunction', 'lambda:InvokeFunction'],
    via: 'Create a function with the target role as its execution role, then invoke it and act through it.',
    prevention: 'Scope iam:PassRole by role path or tag, and deny lambda:CreateFunction outside the deployment pipeline.',
  },
  {
    key: 'lambda-event-source',
    label: 'Trigger a Lambda through an event source',
    service: 'Lambda',
    permissions: [
      'iam:PassRole',
      'lambda:CreateFunction',
      'lambda:CreateEventSourceMapping',
      'dynamodb:PutItem',
      'dynamodb:CreateTable',
    ],
    via: 'Create the function, map a table as its event source, then write a row to fire it - no invoke permission needed.',
    prevention: 'The same PassRole scoping. Invoke permission is not the control point here; CreateFunction is.',
  },
  {
    key: 'lambda-update-code',
    label: 'Replace the code of an existing function',
    service: 'Lambda',
    permissions: ['lambda:UpdateFunctionCode'],
    via: 'Overwrite the code of a function that already runs as a privileged role. No PassRole required.',
    prevention: 'Deny lambda:UpdateFunctionCode to anything but the pipeline, and require code signing.',
  },
  {
    key: 'lambda-layer',
    label: 'Attach a malicious layer',
    service: 'Lambda',
    permissions: ['lambda:UpdateFunctionConfiguration'],
    via: 'Add a layer that shadows a runtime module, and it executes inside the function role on the next invocation.',
    prevention: 'Treat configuration changes as code changes: same pipeline, same review.',
  },
  {
    key: 'glue-dev-endpoint',
    label: 'Pass a role to a Glue development endpoint',
    service: 'Glue',
    permissions: ['iam:PassRole', 'glue:CreateDevEndpoint'],
    via: 'Create a development endpoint running as the target role, then connect to it and use its credentials.',
    prevention: 'Deny glue:CreateDevEndpoint in production accounts outright.',
  },
  {
    key: 'cloudformation-create',
    label: 'Deploy a stack with a service role',
    service: 'CloudFormation',
    permissions: ['iam:PassRole', 'cloudformation:CreateStack'],
    via: 'Submit a template that creates whatever the passed service role is allowed to create, including IAM.',
    prevention: 'Scope PassRole to purpose-built deployment roles, and give those roles a permission boundary.',
  },
  {
    key: 'sagemaker-notebook',
    label: 'Open a SageMaker notebook as a role',
    service: 'SageMaker',
    permissions: [
      'iam:PassRole',
      'sagemaker:CreateNotebookInstance',
      'sagemaker:CreatePresignedNotebookInstanceUrl',
    ],
    via: 'Create a notebook with the target execution role and open a presigned URL into a shell that holds it.',
    prevention: 'Deny CreatePresignedNotebookInstanceUrl outside the data science account.',
  },
  {
    key: 'iam-policy-version',
    label: 'Publish a new default policy version',
    service: 'IAM',
    permissions: ['iam:CreatePolicyVersion'],
    via: 'Create a version of an attached policy with --set-as-default. No attach permission is needed.',
    prevention: 'A permission boundary, or an SCP denying iam:CreatePolicyVersion outside the identity pipeline.',
  },
  {
    key: 'iam-attach-policy',
    label: 'Attach an administrator policy',
    service: 'IAM',
    permissions: ['iam:AttachRolePolicy'],
    via: 'Attach AdministratorAccess to a role this identity already controls.',
    prevention: 'A permission boundary is the only reliable control: it caps what any attached policy can grant.',
  },
  {
    key: 'iam-update-trust',
    label: 'Rewrite a role trust policy',
    service: 'IAM',
    permissions: ['iam:UpdateAssumeRolePolicy', 'sts:AssumeRole'],
    via: 'Add itself to the target role trust policy, then assume the role.',
    prevention: 'Deny iam:UpdateAssumeRolePolicy by SCP; nothing outside the identity pipeline should hold it.',
  },
  {
    key: 'iam-create-access-key',
    label: 'Mint an access key for another user',
    service: 'IAM',
    permissions: ['iam:CreateAccessKey'],
    via: 'Create a long-lived key for a privileged user and use it directly.',
    prevention: 'Deny iam:CreateAccessKey for any principal other than the user itself.',
  },
];

/**
 * What a reachability graph has to be built from.
 *
 * Worth stating explicitly, because the obvious assumption - that an identity
 * inventory plus a credential list is enough - is wrong, and the reason it is
 * wrong is structural rather than a matter of degree. An inventory gives you
 * the graph's NODES. It gives you no edges at all, and a graph with no edges
 * cannot answer a single question this screen exists to answer.
 *
 * Each entry below is a real source, what it contributes, and what breaks
 * without it. The list follows what the established collectors actually pull
 * (Cartography's AWS IAM sync, IAM Access Analyzer's inputs, Access Advisor)
 * rather than being reasoned from first principles.
 *
 * `covered` marks what this build has. It is surfaced in the interface, not
 * hidden in a comment: an analyst who does not know the graph is missing
 * resource policies will read "nothing reaches this bucket" as a fact, and
 * that is the one mistake a graph must never invite.
 */
export const GRAPH_INPUTS = [
  {
    key: 'principals',
    label: 'Identities',
    source: 'iam:ListRoles, ListUsers, ListGroups',
    gives: 'The principal nodes.',
    without: 'No nodes.',
    covered: true,
    from: 'Identities',
  },
  {
    key: 'credentials',
    label: 'Credentials',
    source: 'iam:ListAccessKeys + secret stores',
    gives: 'What authenticates as each principal, and how stale it is.',
    without: 'No way to say which identities are reachable with a stolen key.',
    covered: true,
    from: 'Credentials',
  },
  {
    key: 'identity-policies',
    label: 'Identity policies',
    source: 'iam:ListAttachedRolePolicies, GetRolePolicy, GetPolicyVersion',
    gives: 'Every access edge from a principal to a resource, and every escalation pair.',
    without: 'Nodes with nothing between them.',
    covered: true,
  },
  {
    key: 'trust-policies',
    label: 'Trust policies',
    source: 'The AssumeRolePolicyDocument on each role',
    gives: 'Who can become whom, including federated, service and cross-account principals.',
    without: 'No entry points, so no attack paths.',
    covered: true,
  },
  {
    key: 'group-membership',
    label: 'Group membership',
    source: 'iam:ListGroupsForUser',
    gives: 'Permissions a user holds without any policy of its own.',
    without: 'Human access is understated.',
    covered: true,
  },
  {
    key: 'resources',
    label: 'Resource inventory',
    source: 'Per-service list calls, plus tags',
    gives: 'The other end of every access edge, and which data is worth protecting.',
    without: 'A blast radius with no unit.',
    covered: true,
  },
  {
    key: 'resource-policies',
    label: 'Resource policies',
    source: 'GetBucketPolicy, GetKeyPolicy, GetResourcePolicy',
    gives: 'Access granted from the resource side - the external access an identity policy never mentions.',
    without: 'Publicly reachable data looks unreachable.',
    covered: true,
  },
  {
    key: 'instance-profiles',
    label: 'Instance profiles and service links',
    source: 'iam:ListInstanceProfiles, per-service role bindings',
    gives: 'How a workload comes to hold a role at all.',
    without: 'Compute is disconnected from the identities it runs as.',
    covered: true,
  },
  {
    key: 'observed-usage',
    label: 'Observed usage',
    source: 'CloudTrail, plus Access Advisor service-last-accessed',
    gives: 'The split between granted and used - which is what makes an unused-access claim possible.',
    without: 'Every grant looks equally live.',
    covered: true,
  },
  {
    key: 'org',
    label: 'Organisation structure',
    source: 'organizations:ListAccounts, ListOrganizationalUnits',
    gives: 'The account boundary, which is what makes an edge cross a zone of trust.',
    without: 'Cross-account movement reads as ordinary movement.',
    covered: true,
  },
  {
    key: 'guardrails',
    label: 'SCPs and permission boundaries',
    source: 'organizations:ListPolicies, the PermissionsBoundary on each principal',
    gives: 'The cap. A granted permission an SCP denies is not a real edge.',
    without: 'False positives: paths the account would already refuse.',
    covered: false,
    note: 'Not yet collected, so an edge here is what the identity and resource policies allow, before any organisation-level deny is applied.',
  },
  {
    key: 'idp',
    label: 'Identity provider',
    source: 'Identity Center assignments, or the IdP directory',
    gives: 'Which humans land in which roles, by group.',
    without: 'Federated entry points end at the provider instead of at a person.',
    covered: false,
    note: 'Federated principals are modelled as one node each rather than resolved to the people behind them.',
  },
];

/* ── Account and resource fixtures ────────────────────────────────────────── */

/**
 * The accounts, taken from the shared estate rather than declared here.
 *
 * This screen used to generate its own estate: its own accounts, its own
 * identities, its own credentials. That meant an identity you opened in the
 * explorer did not exist in the graph, and the graph's principal names
 * appeared nowhere else in the product - which makes the graph look like a
 * mock-up of a different system rather than a view of this one.
 *
 * `crownJewel` is the graph's own judgement and stays here: the estate has no
 * concept of a crown jewel, and production accounts are where the resources
 * worth protecting live.
 */
const ACCOUNTS = sharedEstate().accounts.map((account) => ({
  id: account.id,
  name: account.name,
  env: account.env,
  crownJewel: account.env === 'production',
}));

const REGIONS = ['us-east-1', 'us-east-2', 'eu-west-1', 'ap-south-1'];

/**
 * How many of the estate's 228 identities the graph is built over.
 *
 * Not all of them: an all-pairs reachability analysis over 228 principals
 * produces tens of thousands of paths, and the screen shows one focus and its
 * first hop. This is enough for the analysis to be interesting and small
 * enough that it stays instant.
 */
const GRAPH_IDENTITY_BUDGET = 64;

/**
 * Resource archetypes.
 *
 * `crownJewel` marks the ones a path is scored against. It is a property of
 * the data, not of the graph: a customer table is a crown jewel whether or not
 * anything currently reaches it.
 */
const RESOURCE_TYPES = [
  { key: 's3', label: 'S3 bucket', service: 's3', crownJewel: true, holds: 'Objects, including exports and backups' },
  { key: 'dynamodb', label: 'DynamoDB table', service: 'dynamodb', crownJewel: true, holds: 'Records, read by item or by scan' },
  { key: 'secretsmanager', label: 'Secret', service: 'secretsmanager', crownJewel: true, holds: 'Credentials for something else' },
  { key: 'kms', label: 'KMS key', service: 'kms', crownJewel: true, holds: 'The ability to decrypt everything it wraps' },
  { key: 'rds', label: 'RDS cluster', service: 'rds', crownJewel: true, holds: 'The primary datastore' },
  { key: 'ecr', label: 'ECR repository', service: 'ecr', crownJewel: false, holds: 'Container images that run in production' },
  { key: 'sqs', label: 'SQS queue', service: 'sqs', crownJewel: false, holds: 'Messages in flight' },
  { key: 'logs', label: 'Log group', service: 'logs', crownJewel: false, holds: 'Audit trail' },
  { key: 'ssm', label: 'Parameter', service: 'ssm', crownJewel: false, holds: 'Configuration, sometimes credentials' },
];

const DATA_NAMES = {
  s3: ['customer-exports', 'billing-archive', 'model-artifacts', 'audit-reports', 'pipeline-staging'],
  dynamodb: ['customers', 'payment-methods', 'sessions', 'entitlements', 'feature-flags'],
  secretsmanager: ['prod/db/master', 'prod/stripe/live', 'prod/okta/client', 'ci/deploy-key'],
  kms: ['alias/prod-data', 'alias/backups', 'alias/pipeline'],
  rds: ['payments-primary', 'identity-primary', 'analytics-replica'],
  ecr: ['payments-api', 'ledger-worker', 'graph-service'],
  sqs: ['payment-events', 'export-requests', 'dead-letter'],
  logs: ['/aws/lambda/payments', '/aws/eks/prod', '/aws/rds/audit'],
  ssm: ['/prod/api/base-url', '/prod/flags', '/ci/runner-token'],
};

/* Identity naming that matches what the real inventory returns, so a node and
   an Identities row read as the same thing. */
const SERVICE_PRINCIPALS = [
  'lambda.amazonaws.com',
  'ec2.amazonaws.com',
  'ecs-tasks.amazonaws.com',
  'glue.amazonaws.com',
  'states.amazonaws.com',
];

const FEDERATED_PRINCIPALS = [
  {
    id: 'fed-github',
    name: 'token.actions.githubusercontent.com',
    label: 'GitHub Actions OIDC',
    detail: 'Any workflow in the trusted repositories can request a token for the roles that trust it.',
    external: true,
  },
  {
    id: 'fed-okta',
    name: 'okta-saml-prod',
    label: 'Okta SAML federation',
    detail: 'Human operators arrive through this provider. Its group mapping decides which roles they land in.',
    external: true,
  },
  {
    id: 'fed-partner',
    name: 'arn:aws:iam::884471029933:root',
    label: 'Partner account',
    detail: 'A third-party account named in a trust policy. Outside the zone of trust entirely.',
    external: true,
  },
];

/* Credential shapes, matching the vocabulary the Credentials screen uses. */
const POLICY_NAMES = [
  'PaymentsServiceAccess', 'DataPlatformRead', 'PipelineDeploy', 'ObservabilityWrite',
  'SecretsReader', 'AdminBreakGlass', 'CrossAccountAudit', 'LegacyWildcard',
];

/* ── Generation ───────────────────────────────────────────────────────────── */

const GRAPH_SEED = 20260921;

let cached = null;

/** One graph, built once. Deterministic, so a node keeps its place and its id. */
function buildGraph() {
  if (cached) return cached;

  const next = rng(GRAPH_SEED);
  const nodes = [];
  const edges = [];
  const byId = new Map();

  const addNode = (node) => {
    nodes.push(node);
    byId.set(node.id, node);
    return node;
  };
  const addEdge = (edge) => {
    const id = `${edge.from}->${edge.to}:${edge.kind}`;
    edges.push({ ...edge, id });
    return edges[edges.length - 1];
  };

  /* Accounts. */
  for (const account of ACCOUNTS) {
    addNode({
      id: `acct-${account.id}`,
      kind: 'account',
      name: account.name,
      accountId: account.id,
      env: account.env,
      crownJewel: account.crownJewel,
    });
  }

  /* Federated principals and the internet entry they represent. */
  for (const fed of FEDERATED_PRINCIPALS) {
    addNode({ ...fed, kind: 'federated' });
  }

  /* Service principals. */
  for (const principal of SERVICE_PRINCIPALS) {
    addNode({
      id: `svc-${principal.split('.')[0]}`,
      kind: 'service',
      name: principal,
      label: principal,
    });
  }

  /* Identities, projected from the shared estate.
     Same ids, same ARNs, same names, same accounts, same activity figures as
     the identity explorer - so a principal opened here is the principal opened
     there, and the numbers in both places are the same numbers.

     The whole estate is 228 identities. Drawing all of them would be a
     hairball nobody reads, and this screen opens on one focus and its first
     hop anyway, so the graph is built over the machine identities plus the
     humans who own or consume them - the subset the access question is about.
     They are taken in the estate's own risk order, so the interesting ones are
     in rather than a random slice. */
  const shared = sharedEstate();
  const graphPool = [...shared.identities]
    .sort((a, b) => {
      const weight = (row) =>
        (row.is_admin ? 5 : 0) +
        (row.is_secret ? 2 : 0) +
        (row.owner_type === 'ORPHANED' ? 2 : 0) +
        (row.consumer_count ?? 0) / 4 +
        (row.classification === 'HUMAN' ? 1 : 0);
      return weight(b) - weight(a) || a.name.localeCompare(b.name);
    })
    .slice(0, GRAPH_IDENTITY_BUDGET);

  const identities = graphPool.map((row) =>
    addNode({
      /* The estate's own id, so a link from anywhere else resolves here. */
      id: row.id,
      kind: 'identity',
      name: row.name,
      arn: row.arn,
      accountId: row.account_id,
      accountName: row.account_name,
      env: row.env,
      identityType: row.identity_type,
      classification: row.classification,
      isAdmin: row.is_admin,
      mfaEnabled: row.classification === 'HUMAN' || row.console_access ? row.mfa_enabled : null,
      trustType: row.is_federated ? 'federated' : 'service',
      /* Hours rather than days, because that is the unit this module's
         staleness checks already work in. */
      lastActiveHoursAgo: Math.max(1, row.last_active_days * 24),
      totalEvents: row.total_events,
      /* Carried through so the detail panel can show the estate's own
         attribution rather than inventing its own. */
      ownerName: row.owner_name,
      ownerType: row.owner_type,
      createdByName: row.created_by_name,
      isSecret: row.is_secret,
      isFederated: row.is_federated,
      trustService: row.trust_service,
      region: row.region,
      createdAt: row.created_at,
      lastActive: row.last_active,
      attachedPolicies: row.attached_policies,
      matchedRules: row.matched_rules,
      evidence: row.evidence,
      credentialCount: row.credential_count,
      accessKeyCount: row.access_key_count,
      accessKeyAgeDays: row.access_key_age_days,
      consumerCount: row.consumer_count,
      assignedTo: row.assigned_to ?? null,
    }),
  );

  /* Resources, weighted toward the production accounts. */
  const resources = [];
  for (const account of ACCOUNTS) {
    const count = account.env === 'production' ? intBetween(next, 6, 8) : intBetween(next, 3, 4);
    for (let index = 0; index < count; index += 1) {
      const shape = pick(next, RESOURCE_TYPES);
      const name = pick(next, DATA_NAMES[shape.key]);
      const region = pick(next, REGIONS);
      const id = `res-${account.id}-${shape.key}-${name}`.replace(/[^a-zA-Z0-9-_/:.]/g, '-');
      if (byId.has(id)) continue;
      resources.push(
        addNode({
          id,
          kind: 'resource',
          name,
          resourceType: shape.key,
          resourceLabel: shape.label,
          service: shape.service,
          holds: shape.holds,
          crownJewel: shape.crownJewel && account.crownJewel,
          accountId: account.id,
          accountName: account.name,
          region,
          publicPolicy: shape.key === 's3' && next() < 0.12,
          encrypted: next() < 0.82,
        }),
      );
    }
  }

  /* Policies. Shared, because a policy attached to nine identities is exactly
     the kind of choke point worth finding. */
  const policies = POLICY_NAMES.map((name) =>
    addNode({
      id: `pol-${name}`,
      kind: 'policy',
      name,
      managed: next() < 0.6,
      wildcardAction: name === 'LegacyWildcard' || next() < 0.18,
    }),
  );

  /* Credentials, the estate's own.
     Generated ones would have contradicted the credential register: the
     register would list a 400-day access key on an identity whose graph node
     showed none, or showed a different one. Only the long-lived kinds become
     nodes - a short-lived federated credential is not a thing an attacker
     steals and holds, and drawing one per identity would double the node
     count for no analytical gain. */
  const HOLDABLE = new Set(['ACCESS_KEY', 'SECRET_MANAGER', 'SSM_PARAMETER', 'SERVICE_TOKEN']);
  const CREDENTIAL_LABELS = {
    ACCESS_KEY: 'Access key',
    SECRET_MANAGER: 'Stored secret',
    SSM_PARAMETER: 'Stored parameter',
    SERVICE_TOKEN: 'Service token',
  };

  const credentials = [];
  for (const identity of identities) {
    const held = (shared.credentialsOf.get(identity.arn) ?? []).filter((row) => HOLDABLE.has(row.type));
    if (held.length === 0) continue;
    /* The worst one it holds. A node per credential would crowd the graph
       without changing the answer, and the worst is what decides the risk. */
    const worst = held.sort(
      (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || b.age_days - a.age_days,
    )[0];
    const shape = {
      type: worst.type,
      label: CREDENTIAL_LABELS[worst.type] ?? 'Credential',
      longLived: worst.type === 'ACCESS_KEY' || worst.type === 'SERVICE_TOKEN',
    };
    const ageDays = worst.age_days;
    const lastUsedDays = worst.last_used_days;
    const credential = addNode({
      id: `cred-${identity.id}-${shape.type}`,
      kind: 'credential',
      credId: worst.cred_id,
      heldCount: held.length,
      /* Named for what it is, with the identity in the subtitle: a node is a
         176-to-204 pixel box, and "payments-api-23 access key" truncates to
         "payments-api-23 acc..." which tells the reader nothing the shape of
         the node did not already say. */
      name: shape.label,
      identityName: identity.name,
      credentialType: shape.type,
      credentialLabel: shape.label,
      longLived: shape.longLived,
      ageDays,
      lastUsedDays,
      stale: lastUsedDays > 90,
      identityId: identity.id,
      accountId: identity.accountId,
      /* The register's own severity, so the two screens rate the same
         credential the same way. */
      severity: worst.severity,
    });
    credentials.push(credential);
    addEdge({ from: credential.id, to: identity.id, kind: 'HAS_CREDENTIAL' });
  }

  /* Trust edges from the outside in. */
  const cicd = identities.filter((identity) => identity.classification === 'NHI_CICD');
  for (const identity of cicd) {
    addEdge({
      from: 'fed-github',
      to: identity.id,
      kind: 'TRUSTS',
      detail: 'Trust policy names the OIDC provider. Check the sub claim condition: without it, any repository qualifies.',
      unconditioned: next() < 0.5,
    });
  }
  for (const identity of sample(next, identities.filter((i) => i.mfaEnabled !== null), 3)) {
    addEdge({
      from: 'fed-okta',
      to: identity.id,
      kind: 'TRUSTS',
      detail: 'Operators land here after federation. Group mapping decides who.',
    });
  }
  const partnerTargets = sample(next, identities.filter((i) => i.env !== 'production'), 2);
  for (const identity of partnerTargets) {
    addEdge({
      from: 'fed-partner',
      to: identity.id,
      kind: 'TRUSTS',
      detail: 'A third-party account is named directly in this role trust policy.',
      external: true,
    });
  }

  /* Service principals assume the roles they run as. */
  for (const identity of identities) {
    if (identity.identityType === 'AWS::Lambda::Function') {
      addEdge({ from: 'svc-lambda', to: identity.id, kind: 'TRUSTS', detail: 'Lambda assumes this execution role.' });
    }
  }

  /* Assume-role chains, biased so that some identities converge - a graph
     where every identity reaches exactly one other teaches nothing. */
  for (const identity of identities) {
    const hops = next() < 0.5 ? 0 : next() < 0.85 ? 1 : 2;
    if (hops === 0) continue;
    const candidates = identities.filter(
      (other) => other.id !== identity.id && (other.accountId !== identity.accountId || next() < 0.6),
    );
    for (const target of sample(next, candidates, hops)) {
      addEdge({
        from: identity.id,
        to: target.id,
        kind: 'ASSUME_ROLE',
        crossAccount: target.accountId !== identity.accountId,
        detail:
          target.accountId !== identity.accountId
            ? 'Crosses the account boundary, so the zone of trust is crossed here.'
            : 'Same account, so nothing outside IAM has to agree to this.',
      });
    }
  }

  /* Pass-role and the escalation edges built on top of it. */
  for (const identity of identities) {
    if (next() > 0.3) continue;
    const targets = sample(next, identities.filter((other) => other.id !== identity.id && other.accountId === identity.accountId), 1);
    for (const target of targets) {
      addEdge({ from: identity.id, to: target.id, kind: 'CAN_PASS_ROLE' });
      const method = pick(next, ESCALATIONS.filter((entry) => entry.permissions.includes('iam:PassRole')));
      addEdge({
        from: identity.id,
        to: target.id,
        kind: 'ESCALATES_TO',
        method: method.key,
        detail: method.via,
      });
    }
  }
  /* Escalations that need no PassRole at all, which are the ones teams miss. */
  for (const identity of sample(next, identities, 5)) {
    const method = pick(next, ESCALATIONS.filter((entry) => !entry.permissions.includes('iam:PassRole')));
    const target = pick(next, identities.filter((other) => other.isAdmin && other.id !== identity.id))
      ?? pick(next, identities.filter((other) => other.id !== identity.id));
    if (!target) continue;
    addEdge({
      from: identity.id,
      to: target.id,
      kind: 'ESCALATES_TO',
      method: method.key,
      detail: method.via,
    });
  }

  /* Access to resources, through a policy. */
  for (const identity of identities) {
    const count = identity.isAdmin ? intBetween(next, 5, 9) : intBetween(next, 1, 4);
    const pool = resources.filter((resource) => resource.accountId === identity.accountId);
    const reach = sample(next, pool.length >= count ? pool : resources, count);
    const policy = pick(next, policies);
    addEdge({ from: identity.id, to: policy.id, kind: 'ATTACHED_POLICY' });
    for (const resource of reach) {
      const roll = next();
      const kind = identity.isAdmin && roll < 0.35 ? 'CAN_ADMIN' : roll < 0.6 ? 'CAN_READ' : 'CAN_WRITE';
      addEdge({
        from: identity.id,
        to: resource.id,
        kind,
        policyId: policy.id,
        wildcard: policy.wildcardAction && next() < 0.5,
      });
    }
  }

  /* Entry points. Each is a real starting condition rather than a category:
     an unconditioned OIDC trust, a stale long-lived key, a public bucket. */
  const entries = [];
  const unconditioned = edges.filter((edge) => edge.kind === 'TRUSTS' && edge.unconditioned);
  if (unconditioned.length > 0) {
    const entry = addNode({
      id: 'entry-oidc',
      kind: 'entry',
      name: 'Unconditioned OIDC trust',
      detail: `${unconditioned.length} role${unconditioned.length === 1 ? '' : 's'} trust the GitHub OIDC provider without a repository condition, so any workflow that can reach the provider can request a token for them.`,
      vector: 'federation',
    });
    entries.push(entry);
    addEdge({
      from: entry.id,
      to: 'fed-github',
      kind: 'EXPOSES',
      detail: 'The trust exists; the condition that would narrow it does not, so holding a token from this provider is sufficient.',
    });
  }
  const staleKeys = credentials.filter((credential) => credential.longLived && credential.stale);
  if (staleKeys.length > 0) {
    const entry = addNode({
      id: 'entry-stale-key',
      kind: 'entry',
      name: 'Stale long-lived credentials',
      detail: `${staleKeys.length} long-lived credential${staleKeys.length === 1 ? '' : 's'} unused for more than 90 days. Unused privilege is pure downside: nobody notices when it is used by somebody else.`,
      vector: 'credential',
    });
    entries.push(entry);
    for (const credential of staleKeys.slice(0, 4)) {
      addEdge({
        from: entry.id,
        to: credential.id,
        kind: 'EXPOSES',
        detail: 'A key this old is likely to exist in more than one place - a laptop, a CI log, an old image layer.',
      });
    }
  }
  const publicResources = resources.filter((resource) => resource.publicPolicy);
  if (publicResources.length > 0) {
    const entry = addNode({
      id: 'entry-public-resource',
      kind: 'entry',
      name: 'Resource policy outside the zone of trust',
      detail: `${publicResources.length} resource polic${publicResources.length === 1 ? 'y' : 'ies'} grant access to a principal outside the account. This is what IAM Access Analyzer calls external access.`,
      vector: 'resource-policy',
    });
    entries.push(entry);
    for (const resource of publicResources) {
      addEdge({
        from: entry.id,
        to: resource.id,
        kind: 'EXPOSES',
        detail: 'Reachable without any identity in this account at all, because the resource policy says so.',
      });
    }
  }
  const partnerEntry = addNode({
    id: 'entry-partner',
    kind: 'entry',
    name: 'Third-party account trust',
    detail: 'A partner account is named in role trust policies. Their compromise is this account\'s compromise.',
    vector: 'federation',
  });
  entries.push(partnerEntry);
  addEdge({
    from: partnerEntry.id,
    to: 'fed-partner',
    kind: 'EXPOSES',
    detail: 'The partner account is named directly in role trust policies here, so their compromise is this account\'s compromise.',
  });

  cached = { nodes, edges, byId, accounts: ACCOUNTS, identities, resources, credentials, policies, entries };
  cached.adjacency = buildAdjacency(nodes, edges);
  cached.paths = buildPaths(cached);
  return cached;
}

function buildAdjacency(nodes, edges) {
  const out = new Map();
  const into = new Map();
  for (const node of nodes) {
    out.set(node.id, []);
    into.set(node.id, []);
  }
  for (const edge of edges) {
    out.get(edge.from)?.push(edge);
    into.get(edge.to)?.push(edge);
  }
  return { out, into };
}

/** Edges that move an attacker from one principal to another. */
const TRAVERSAL_KINDS = new Set([
  'EXPOSES',
  'TRUSTS',
  'ASSUME_ROLE',
  'ESCALATES_TO',
  'HAS_CREDENTIAL',
  'CAN_PASS_ROLE',
]);

/** Edges that represent access to something rather than movement. */
const ACCESS_KINDS = new Set(['CAN_READ', 'CAN_WRITE', 'CAN_ADMIN']);

/**
 * Attack paths: entry point, pivots, target.
 *
 * Breadth-first from each entry, bounded at five hops - beyond that a path
 * stops being something anyone will act on. A path is kept only if it ends
 * somewhere that matters: an admin-equivalent identity, or write/admin access
 * to a crown-jewel resource. Everything else is reachability, not a finding.
 */
function buildPaths(graph) {
  const { adjacency, byId, entries } = graph;
  const found = [];

  for (const entry of entries) {
    const queue = [{ node: entry.id, trail: [] }];
    const seen = new Set([entry.id]);

    while (queue.length > 0) {
      const { node, trail } = queue.shift();
      if (trail.length >= 5) continue;

      for (const edge of adjacency.out.get(node) ?? []) {
        const target = byId.get(edge.to);
        if (!target) continue;
        const nextTrail = [...trail, edge];

        if (ACCESS_KINDS.has(edge.kind)) {
          if (target.crownJewel && (edge.kind === 'CAN_WRITE' || edge.kind === 'CAN_ADMIN')) {
            found.push(makePath(graph, entry, nextTrail, target));
          }
          continue;
        }

        if (!TRAVERSAL_KINDS.has(edge.kind)) continue;

        if (target.kind === 'identity' && target.isAdmin) {
          found.push(makePath(graph, entry, nextTrail, target));
        }

        if (!seen.has(edge.to)) {
          seen.add(edge.to);
          queue.push({ node: edge.to, trail: nextTrail });
        }
      }
    }
  }

  /* Deduplicate by the edge chain, then rank. */
  const unique = new Map();
  for (const path of found) {
    if (!unique.has(path.id)) unique.set(path.id, path);
  }
  const ranked = [...unique.values()].sort((a, b) => b.score - a.score || a.hops - b.hops);

  /* Capped, because nobody works a list of 300 - but capped per target kind
     rather than off the top of one ranking. Admin-equivalent paths outscore
     data paths, so a single cut would have reported "every path leads to an
     admin role" and quietly dropped every path to a customer table. */
  const toIdentities = ranked.filter((path) => path.targetKind === 'identity').slice(0, 20);
  const toResources = ranked.filter((path) => path.targetKind === 'resource').slice(0, 16);
  return [...toIdentities, ...toResources].sort((a, b) => b.score - a.score || a.hops - b.hops);
}

function makePath(graph, entry, trail, target) {
  const { byId } = graph;
  const id = `path-${entry.id}-${trail.map((edge) => edge.id).join('|')}`;
  const nodeIds = [entry.id, ...trail.map((edge) => edge.to)];
  const escalations = trail.filter((edge) => edge.kind === 'ESCALATES_TO');
  const crossAccount = trail.filter((edge) => edge.crossAccount).length;

  const lastEdge = trail[trail.length - 1];
  const reachesAdmin = target.kind === 'identity' && Boolean(target.isAdmin);
  const controlsCrownJewel = Boolean(target.crownJewel) && lastEdge?.kind === 'CAN_ADMIN';
  const writesCrownJewel = Boolean(target.crownJewel) && lastEdge?.kind === 'CAN_WRITE';

  /* Severity comes from what the path reaches, and score only orders the list.
     Keeping them apart matters: a score is a number somebody tuned, whereas
     "this ends in administrator-equivalent access through an escalation nobody
     granted" is a statement about the environment that does not move when the
     weights change.

       CRITICAL  admin-equivalent by a route nobody intended (an escalation or
                 a crossed account boundary), or control of a crown jewel -
                 control includes the resource policy, so it includes who else
                 gets in.
       HIGH      admin-equivalent by a granted route, or write to a crown jewel.
       MEDIUM    anything else that still ends somewhere that matters.          */
  const severity =
    (reachesAdmin && (escalations.length > 0 || crossAccount > 0)) || controlsCrownJewel
      ? 'CRITICAL'
      : reachesAdmin || writesCrownJewel
        ? 'HIGH'
        : 'MEDIUM';

  /* The ordering number. Impact first, then how little work the path takes,
     because two paths of equal impact are not equally urgent. */
  let score = 30;
  if (reachesAdmin) score += 30;
  if (controlsCrownJewel) score += 34;
  else if (writesCrownJewel) score += 24;
  else if (target.crownJewel) score += 14;
  score += Math.min(16, escalations.length * 8);
  score += Math.min(12, crossAccount * 6);
  if (entry.vector === 'credential') score += 6;
  score -= (trail.length - 1) * 3;
  score = Math.max(12, Math.min(99, score));

  return {
    id,
    entryId: entry.id,
    entryName: entry.name,
    entryVector: entry.vector,
    targetId: target.id,
    targetName: target.name,
    targetKind: target.kind,
    targetAccountId: target.accountId ?? '',
    targetAccountName: target.accountName ?? '',
    targetEnv: target.env ?? '',
    targetCrownJewel: Boolean(target.crownJewel),
    targetAdmin: Boolean(target.kind === 'identity' && target.isAdmin),
    nodeIds,
    edgeIds: trail.map((edge) => edge.id),
    hops: trail.length,
    escalationCount: escalations.length,
    crossAccountCount: crossAccount,
    score,
    severity,
    reachesAdmin,
    controlsCrownJewel,
    steps: trail.map((edge) => ({
      edgeId: edge.id,
      kind: edge.kind,
      method: edge.method ?? null,
      detail: edge.detail ?? null,
      fromName: byId.get(edge.from)?.name ?? edge.from,
      fromKind: byId.get(edge.from)?.kind ?? null,
      toName: byId.get(edge.to)?.name ?? edge.to,
      toKind: byId.get(edge.to)?.kind ?? null,
    })),
  };
}

/* ── Blast radius ─────────────────────────────────────────────────────────── */

/**
 * What the holder of one identity ends up with.
 *
 * Two numbers, kept apart because conflating them is the usual mistake:
 * `direct` is what this identity's own policies grant, and `effective` is what
 * it reaches after assuming everything it can assume. The gap between them is
 * the entire argument for looking at IAM as a graph.
 */
export function blastRadius(identityId) {
  const graph = buildGraph();
  const { adjacency, byId } = graph;

  const reachedIdentities = new Set();
  const queue = [identityId];
  const seen = new Set([identityId]);
  let escalationHops = 0;
  let crossAccountHops = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    for (const edge of adjacency.out.get(current) ?? []) {
      if (!TRAVERSAL_KINDS.has(edge.kind)) continue;
      /* Counted only where the edge actually carries the traversal. Counting
         every edge scanned would inflate both figures every time the search
         revisited a node it had already reached. */
      if (seen.has(edge.to)) continue;
      seen.add(edge.to);
      if (edge.kind === 'ESCALATES_TO') escalationHops += 1;
      if (edge.crossAccount) crossAccountHops += 1;
      const target = byId.get(edge.to);
      if (target?.kind === 'identity') {
        reachedIdentities.add(target.id);
        queue.push(target.id);
      }
    }
  }

  const collect = (ids) => {
    const map = new Map();
    for (const id of ids) {
      for (const edge of adjacency.out.get(id) ?? []) {
        if (!ACCESS_KINDS.has(edge.kind)) continue;
        const resource = byId.get(edge.to);
        if (!resource) continue;
        const existing = map.get(resource.id);
        const rank = { CAN_READ: 1, CAN_WRITE: 2, CAN_ADMIN: 3 };
        if (!existing || rank[edge.kind] > rank[existing.level]) {
          map.set(resource.id, { resource, level: edge.kind, viaIdentityId: id, wildcard: Boolean(edge.wildcard) });
        }
      }
    }
    return map;
  };

  const direct = collect([identityId]);
  const effective = collect([identityId, ...reachedIdentities]);

  const summarise = (map) => {
    const rows = [...map.values()];
    return {
      total: rows.length,
      read: rows.filter((row) => row.level === 'CAN_READ').length,
      write: rows.filter((row) => row.level === 'CAN_WRITE').length,
      admin: rows.filter((row) => row.level === 'CAN_ADMIN').length,
      crownJewels: rows.filter((row) => row.resource.crownJewel).length,
      accounts: new Set(rows.map((row) => row.resource.accountId)).size,
      rows,
    };
  };

  const identity = byId.get(identityId);
  const adminReached = [...reachedIdentities]
    .map((id) => byId.get(id))
    .filter((node) => node?.isAdmin);

  return {
    identity,
    direct: summarise(direct),
    effective: summarise(effective),
    identitiesReached: reachedIdentities.size,
    adminReached: adminReached.length,
    adminNames: adminReached.map((node) => node.name),
    escalationHops,
    crossAccountHops,
    credentials: graph.edges
      .filter((edge) => edge.kind === 'HAS_CREDENTIAL' && edge.to === identityId)
      .map((edge) => byId.get(edge.from))
      .filter(Boolean),
    pathsThrough: graph.paths.filter((path) => path.nodeIds.includes(identityId)),
  };
}

/* ── Level projections ────────────────────────────────────────────────────── */

/**
 * The graph at one of three levels.
 *
 * A single 200-node picture is a hairball nobody reads, so each level answers
 * one question with only the nodes that question needs: which accounts trust
 * each other, who can become whom, and what the reachable identities can act
 * on. Every level is laid out in tiers, left to right, because an access graph
 * has a direction - outside to inside - and a force-directed blob throws that
 * away.
 */
function projectAccounts(graph) {
  const nodes = graph.nodes.filter((node) => node.kind === 'account');
  const edgeMap = new Map();

  for (const edge of graph.edges) {
    if (edge.kind !== 'ASSUME_ROLE' || !edge.crossAccount) continue;
    const from = graph.byId.get(edge.from);
    const to = graph.byId.get(edge.to);
    if (!from?.accountId || !to?.accountId) continue;
    const key = `${from.accountId}->${to.accountId}`;
    const existing = edgeMap.get(key) ?? {
      id: `acct-edge-${key}`,
      from: `acct-${from.accountId}`,
      to: `acct-${to.accountId}`,
      kind: 'ASSUME_ROLE',
      count: 0,
      samples: [],
    };
    existing.count += 1;
    if (existing.samples.length < 4) existing.samples.push({ from: from.name, to: to.name });
    edgeMap.set(key, existing);
  }

  const externalNodes = graph.nodes.filter((node) => node.kind === 'federated');
  const externalEdges = [];
  for (const fed of externalNodes) {
    const accounts = new Set();
    for (const edge of graph.adjacency.out.get(fed.id) ?? []) {
      const target = graph.byId.get(edge.to);
      if (target?.accountId) accounts.add(target.accountId);
    }
    for (const accountId of accounts) {
      externalEdges.push({
        id: `fed-edge-${fed.id}-${accountId}`,
        from: fed.id,
        to: `acct-${accountId}`,
        kind: 'TRUSTS',
        count: 1,
      });
    }
  }

  return {
    nodes: [...externalNodes, ...nodes],
    edges: [...externalEdges, ...edgeMap.values()],
    /* Tier layering: the five accounts are peers. Laying them out by hop
       distance would chain them into a hierarchy that does not exist just
       because one can assume a role in another. */
    layering: 'tiers',
    tiers: [
      { key: 'outside', label: 'Outside the zone of trust', kinds: ['federated'] },
      { key: 'accounts', label: 'Accounts', kinds: ['account'] },
    ],
  };
}

function projectIdentities(graph, { accountId = '', focusPathId = '' } = {}) {
  const inPaths = new Set();
  for (const path of graph.paths) {
    for (const id of path.nodeIds) inPaths.add(id);
  }

  const focus = focusPathId ? graph.paths.find((path) => path.id === focusPathId) : null;
  const keep = new Set(focus ? focus.nodeIds : inPaths);

  const nodes = graph.nodes.filter((node) => {
    if (!keep.has(node.id)) return false;
    if (node.kind === 'resource' || node.kind === 'policy') return false;
    if (accountId && node.accountId && node.accountId !== accountId) return false;
    return true;
  });
  const ids = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter(
    (edge) => ids.has(edge.from) && ids.has(edge.to) && TRAVERSAL_KINDS.has(edge.kind),
  );

  return {
    nodes,
    edges,
    /* Depth layering: a column here is a hop count, which is what an operator
       is counting when they ask how far in something is. */
    layering: 'depth',
    tiers: [
      { key: 'entry', label: 'Entry', kinds: ['entry'] },
      { key: 'outside', label: 'Outside', kinds: ['federated', 'service'] },
      { key: 'credential', label: 'Credentials', kinds: ['credential'] },
      { key: 'identity', label: 'Identities', kinds: ['identity'] },
    ],
  };
}

function projectResources(graph, { identityId = '', accountId = '' } = {}) {
  /* Defaults to the identity with the widest effective access rather than
     whichever one happens to lead the path list: this level exists to show a
     blast radius, so it should open on the largest one. */
  const seedId = identityId || widestRadiusIdentity(graph);
  if (!seedId) return { nodes: [], edges: [], tiers: [] };

  const radius = blastRadius(seedId);
  const identity = graph.byId.get(seedId);
  const reachedIds = new Set([seedId, ...radius.effective.rows.map((row) => row.viaIdentityId)]);

  const identityNodes = [...reachedIds].map((id) => graph.byId.get(id)).filter(Boolean);
  const resourceNodes = radius.effective.rows
    .filter((row) => !accountId || row.resource.accountId === accountId)
    .map((row) => row.resource);

  const nodes = [...identityNodes, ...dedupe(resourceNodes)];
  const ids = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter(
    (edge) =>
      ids.has(edge.from) &&
      ids.has(edge.to) &&
      (ACCESS_KINDS.has(edge.kind) || edge.kind === 'ASSUME_ROLE' || edge.kind === 'ESCALATES_TO'),
  );

  return {
    nodes,
    edges,
    focusId: seedId,
    focusName: identity?.name,
    layering: 'depth',
    tiers: [
      { key: 'identity', label: 'Identities', kinds: ['identity'] },
      { key: 'resource', label: 'Resources', kinds: ['resource'] },
    ],
  };
}

function widestRadiusIdentity(graph) {
  let best = null;
  let bestTotal = -1;
  for (const identity of graph.identities) {
    const total = blastRadius(identity.id).effective.total;
    if (total > bestTotal) {
      bestTotal = total;
      best = identity.id;
    }
  }
  return best;
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}

/* ── Degree of interest, and expansion ───────────────────────────────────── */

/**
 * How many neighbours a node shows before the rest are folded away.
 *
 * Three, then two at a time. The number is not arbitrary: a degree-of-interest
 * tree keeps the drawn graph inside a fixed budget and represents everything
 * it left out by a single placeholder carrying the count, which is what makes
 * a large graph readable without hiding that it is large. Three fits on one
 * row at every width this app supports; two per reveal keeps each click's
 * effect small enough to follow.
 */
export const VISIBLE_PER_GROUP = 3;
export const REVEAL_STEP = 2;

/**
 * Interest: which neighbours are worth the three slots.
 *
 * Ranked by what an analyst is looking for rather than alphabetically, so the
 * three that survive the budget are the three that would have been clicked.
 * An administrator-equivalent identity outranks an ordinary one; a crown jewel
 * outranks a log group; anything on a critical path outranks everything else,
 * because that is the reason this screen was opened.
 */
function interestOf(node, context) {
  let score = 10;
  if (context.criticalNodeIds.has(node.id)) score += 50;
  if (context.pathNodeIds.has(node.id)) score += 18;
  if (node.kind === 'entry') score += 40;
  if (node.isAdmin) score += 30;
  if (node.crownJewel) score += 22;
  if (node.kind === 'credential') score += node.stale ? 20 : 8;
  if (node.publicPolicy) score += 18;
  if (node.kind === 'federated') score += 14;
  if (node.kind === 'policy') score -= 8;
  return score;
}

/**
 * The graph as one focus plus whatever has been opened from it.
 *
 * This is the whole answer to "the whole graph at once is clumsy". Nothing is
 * drawn until it is asked for: the focus node and its first hop, then one hop
 * per expansion, and within each hop only the three most interesting
 * neighbours with the rest behind a count. Overview first, then zoom, then
 * detail - in that order, and never all three at once.
 *
 * `expanded` is the set of node ids whose next hop is open. `revealed` maps a
 * node id to how many extra neighbours past the budget it has been asked for.
 * Both live in the page, so the URL can carry them and a link can reproduce
 * exactly what somebody was looking at.
 */
export function fetchNeighbourhood({ focusId, expanded = [], revealed = {} } = {}, signal) {
  return demoRequest(() => {
    const graph = buildGraph();
    const focus = graph.byId.get(focusId) ?? graph.byId.get(defaultFocusId(graph));
    if (!focus) {
      const error = new Error('The graph has no node to focus on');
      error.status = 404;
      throw error;
    }

    const criticalNodeIds = new Set();
    const pathNodeIds = new Set();
    for (const path of graph.paths) {
      for (const id of path.nodeIds) {
        pathNodeIds.add(id);
        if (path.severity === 'CRITICAL') criticalNodeIds.add(id);
      }
    }
    const context = { criticalNodeIds, pathNodeIds };

    const openSet = new Set([focus.id, ...expanded]);
    const depth = new Map([[focus.id, 0]]);
    const visible = new Map([[focus.id, focus]]);
    const shownEdges = new Map();
    const groups = [];

    /* Breadth first, but only through nodes that have been opened - so the
       drawn graph is exactly what was asked for and nothing more. */
    const queue = [focus.id];
    const walked = new Set();

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (walked.has(currentId)) continue;
      walked.add(currentId);
      if (!openSet.has(currentId)) continue;

      const currentDepth = depth.get(currentId) ?? 0;

      /* Both directions: "what can reach this" is as much a part of the
         neighbourhood as "what this reaches", and an analyst tracing an
         incident is usually walking backwards. */
      const candidates = [];
      for (const edge of graph.adjacency.out.get(currentId) ?? []) {
        const node = graph.byId.get(edge.to);
        if (node && node.kind !== 'policy') candidates.push({ edge, node, direction: 'out' });
      }
      for (const edge of graph.adjacency.into.get(currentId) ?? []) {
        const node = graph.byId.get(edge.from);
        if (node && node.kind !== 'policy') candidates.push({ edge, node, direction: 'in' });
      }

      /* One entry per neighbour, keeping the heaviest edge: two nodes joined by
         both CAN_PASS_ROLE and ESCALATES_TO are one relationship to read, and
         the escalation is the half that matters. */
      const byNeighbour = new Map();
      for (const candidate of candidates) {
        if (candidate.node.id === currentId || visible.has(candidate.node.id)) {
          if (candidate.node.id !== currentId) {
            const existing = shownEdges.get(candidate.edge.id);
            if (!existing) shownEdges.set(candidate.edge.id, candidate.edge);
          }
          continue;
        }
        const held = byNeighbour.get(candidate.node.id);
        const weight = EDGE_KINDS[candidate.edge.kind]?.weight ?? 0;
        if (!held || weight > (EDGE_KINDS[held.edge.kind]?.weight ?? 0)) {
          byNeighbour.set(candidate.node.id, candidate);
        }
      }

      const ranked = [...byNeighbour.values()].sort(
        (a, b) => interestOf(b.node, context) - interestOf(a.node, context) ||
          String(a.node.name).localeCompare(String(b.node.name)),
      );

      const budget = VISIBLE_PER_GROUP + (revealed[currentId] ?? 0);
      const taken = ranked.slice(0, budget);
      const hidden = ranked.slice(budget);

      for (const { edge, node } of taken) {
        visible.set(node.id, node);
        depth.set(node.id, currentDepth + 1);
        shownEdges.set(edge.id, edge);
        queue.push(node.id);
      }

      if (hidden.length > 0) {
        groups.push({
          id: `more-${currentId}`,
          kind: 'more',
          parentId: currentId,
          parentName: graph.byId.get(currentId)?.name,
          hiddenCount: hidden.length,
          depth: currentDepth + 1,
          /* Named so the reader knows what they are about to open rather than
             only how much of it there is. */
          summary: summariseHidden(hidden.map((entry) => entry.node)),
          riskiest: hidden
            .slice(0, 3)
            .map((entry) => ({ id: entry.node.id, name: entry.node.name, kind: entry.node.kind })),
        });
      }
    }

    /* Every visible node reports whether opening it would show anything new,
       so a node with nothing behind it never offers a control that does
       nothing - the single most irritating thing an expandable graph can do. */
    const nodes = [...visible.values()].map((node) => {
      const neighbourIds = new Set();
      for (const edge of graph.adjacency.out.get(node.id) ?? []) {
        if (graph.byId.get(edge.to)?.kind !== 'policy') neighbourIds.add(edge.to);
      }
      for (const edge of graph.adjacency.into.get(node.id) ?? []) {
        if (graph.byId.get(edge.from)?.kind !== 'policy') neighbourIds.add(edge.from);
      }
      const unseen = [...neighbourIds].filter((id) => !visible.has(id)).length;
      return {
        ...node,
        depth: depth.get(node.id) ?? 0,
        isFocus: node.id === focus.id,
        expanded: openSet.has(node.id),
        neighbourCount: neighbourIds.size,
        unseenCount: unseen,
        onCriticalPath: criticalNodeIds.has(node.id),
        onPath: pathNodeIds.has(node.id),
        interest: interestOf(node, context),
      };
    });

    const edges = [...shownEdges.values()].filter(
      (edge) => visible.has(edge.from) && visible.has(edge.to),
    );

    return {
      focus,
      nodes,
      edges,
      groups,
      maxDepth: Math.max(0, ...nodes.map((node) => node.depth)),
      totalNodes: graph.nodes.filter((node) => node.kind !== 'policy').length,
    };
  }, { signal, latency: [140, 300] });
}

/**
 * What a fold-away is hiding, in kinds rather than counts.
 *
 * The badge beside it already says how many, so repeating the number here
 * ("+2  2 Identities") spends the only line available on saying the same thing
 * twice. What the reader cannot see is what KIND of thing is behind it, and
 * that is what decides whether opening it is worth a click.
 */
function summariseHidden(nodes) {
  const counts = new Map();
  for (const node of nodes) {
    const label = NODE_KINDS[node.kind]?.plural ?? node.kind;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return ordered
    .map(([label, count]) => (count === 1 ? label.replace(/ies$/, 'y').replace(/s$/, '') : label).toLowerCase())
    .join(' and ');
}

/**
 * Where the graph opens.
 *
 * On the entry point that leads to the most critical paths, because that is
 * the node an analyst would have searched for. Falling back to the widest
 * blast radius when no path reaches anything.
 */
function defaultFocusId(graph) {
  const counts = new Map();
  for (const path of graph.paths) {
    if (path.severity !== 'CRITICAL') continue;
    counts.set(path.entryId, (counts.get(path.entryId) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : (graph.entries[0]?.id ?? graph.identities[0]?.id);
}

/** Nodes worth offering as a starting point, ranked the same way. */
export function fetchFocusOptions(signal) {
  return demoRequest(() => {
    const graph = buildGraph();
    const criticalNodeIds = new Set();
    const pathNodeIds = new Set();
    for (const path of graph.paths) {
      for (const id of path.nodeIds) {
        pathNodeIds.add(id);
        if (path.severity === 'CRITICAL') criticalNodeIds.add(id);
      }
    }
    const context = { criticalNodeIds, pathNodeIds };

    const rows = [...graph.entries, ...graph.identities, ...graph.resources]
      .map((node) => ({
        id: node.id,
        name: node.name,
        kind: node.kind,
        accountName: node.accountName,
        isAdmin: Boolean(node.isAdmin),
        crownJewel: Boolean(node.crownJewel),
        interest: interestOf(node, context),
      }))
      .sort((a, b) => b.interest - a.interest || a.name.localeCompare(b.name));

    return { rows, defaultId: defaultFocusId(graph) };
  }, { signal, latency: [120, 240] });
}

/* ── Selectors ────────────────────────────────────────────────────────────── */

export function fetchGraphSummary(signal) {
  return demoRequest(() => {
    const graph = buildGraph();

    return {
      totals: {
        principals: graph.identities.length + graph.nodes.filter((n) => n.kind === 'federated' || n.kind === 'service').length,
        identities: graph.identities.length,
        admins: graph.identities.filter((identity) => identity.isAdmin).length,
        accounts: graph.accounts.length,
        resources: graph.resources.length,
        crownJewels: graph.resources.filter((resource) => resource.crownJewel).length,
        credentials: graph.credentials.length,
        staleCredentials: graph.credentials.filter((credential) => credential.stale && credential.longLived).length,
        edges: graph.edges.length,
        escalationEdges: graph.edges.filter((edge) => edge.kind === 'ESCALATES_TO').length,
        crossAccountEdges: graph.edges.filter((edge) => edge.crossAccount).length,
        externalTrusts: graph.edges.filter((edge) => edge.kind === 'TRUSTS' && edge.external).length,
        paths: graph.paths.length,
        criticalPaths: graph.paths.filter((path) => path.severity === 'CRITICAL').length,
      },
      byKind: Object.keys(NODE_KINDS).map((kind) => ({
        key: kind,
        label: NODE_KINDS[kind].plural,
        count: graph.nodes.filter((node) => node.kind === kind).length,
      })),
      accounts: graph.accounts.map((account) => ({
        ...account,
        identities: graph.identities.filter((identity) => identity.accountId === account.id).length,
        resources: graph.resources.filter((resource) => resource.accountId === account.id).length,
        admins: graph.identities.filter((identity) => identity.accountId === account.id && identity.isAdmin).length,
      })),
    };
  }, { signal, latency: [200, 420] });
}

export function fetchGraphLevel({ level = 'identities', accountId = '', identityId = '', pathId = '' } = {}, signal) {
  return demoRequest(() => {
    const graph = buildGraph();
    if (level === 'accounts') return { level, ...projectAccounts(graph) };
    if (level === 'resources') return { level, ...projectResources(graph, { identityId, accountId }) };
    return { level, ...projectIdentities(graph, { accountId, focusPathId: pathId }) };
  }, { signal, latency: [220, 480] });
}

export function fetchAttackPaths({ severity = '', vector = '', search = '' } = {}, signal) {
  return demoRequest(() => {
    const graph = buildGraph();
    const needle = search.trim().toLowerCase();

    const rows = graph.paths
      .filter((path) => {
        if (severity && path.severity !== severity) return false;
        if (vector && path.entryVector !== vector) return false;
        if (!needle) return true;
        return [path.entryName, path.targetName, ...path.steps.map((step) => `${step.fromName} ${step.toName}`)]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      });

    return { rows, total: graph.paths.length };
  }, { signal, latency: [180, 400] });
}

/**
 * The API surface each service offers, for the "distinct actions" figure.
 *
 * Mirrors the estate's own event tables. It is a vocabulary rather than a
 * sample, so an identity that touched S3 three times still reports a plausible
 * set of S3 actions rather than only the three that happened to be sampled.
 */
const ACTIONS_BY_SERVICE = {
  's3.amazonaws.com': ['GetObject', 'PutObject', 'ListBucket', 'DeleteObject', 'GetBucketPolicy', 'HeadObject', 'CopyObject'],
  'dynamodb.amazonaws.com': ['Query', 'PutItem', 'GetItem', 'Scan', 'UpdateItem', 'BatchGetItem', 'DeleteItem'],
  'secretsmanager.amazonaws.com': ['GetSecretValue', 'DescribeSecret', 'PutSecretValue', 'ListSecrets'],
  'sts.amazonaws.com': ['AssumeRole', 'AssumeRoleWithWebIdentity', 'GetCallerIdentity'],
  'kms.amazonaws.com': ['Decrypt', 'Encrypt', 'GenerateDataKey', 'DescribeKey', 'ReEncrypt'],
  'lambda.amazonaws.com': ['Invoke', 'UpdateFunctionCode', 'GetFunction', 'CreateFunction', 'ListFunctions'],
  'rds.amazonaws.com': ['DescribeDBInstances', 'CreateDBSnapshot', 'ModifyDBInstance', 'ListTagsForResource'],
  'sqs.amazonaws.com': ['SendMessage', 'ReceiveMessage', 'DeleteMessage', 'GetQueueAttributes'],
  'ecr.amazonaws.com': ['GetAuthorizationToken', 'BatchGetImage', 'PutImage', 'DescribeRepositories', 'ListImages'],
  'ssm.amazonaws.com': ['GetParameter', 'GetParameters', 'PutParameter', 'SendCommand', 'DescribeParameters'],
  'cloudwatch.amazonaws.com': ['PutMetricData', 'GetMetricStatistics', 'DescribeAlarms', 'ListMetrics'],
  'iam.amazonaws.com': ['CreateAccessKey', 'AttachRolePolicy', 'PassRole', 'CreatePolicyVersion', 'ListRoles', 'GetRole'],
};

/**
 * The observed side of an identity.
 *
 * Counted from the shared estate's CloudTrail sample rather than generated, so
 * "7,228 events" on this panel is the same 7,228 the activity screen pages
 * through. Errors are a share of calls that failed, which is what separates an
 * identity doing its job from one probing for permissions it does not have.
 */
function observedActivity(arn) {
  const shared = sharedEstate();
  const identity = shared.byArn.get(arn);
  const events = shared.events.filter((event) => event.identity_arn === arn);

  if (!identity) return null;

  const sampled = [...new Set(events.map((event) => event.event_name))];
  const services = new Map();
  for (const event of events) {
    services.set(event.event_source, (services.get(event.event_source) ?? 0) + 1);
  }
  const reads = events.filter((event) => event.read_only).length;
  const writes = events.length - reads;

  /* The sample is a window on a larger total, so the ratio is scaled up to the
     identity's own event count rather than reported as the raw sample size -
     otherwise the panel would contradict the "events seen" figure beside it. */
  const scale = events.length > 0 ? identity.total_events / events.length : 0;

  const own = rng(hashSeed(`obs:${arn}`));
  const errorRate = identity.owner_type === 'ORPHANED' ? own() * 0.08 : own() * 0.02;

  /* Distinct actions grows with volume but far slower than linearly: a busy
     workload repeats a small vocabulary. Counting the sample directly reported
     three actions for an identity with six hundred events, which is not a
     believable API surface for anything.
     Call volume per action decays rather than splitting evenly - the first
     version divided the total equally and printed three actions at exactly 209
     each, which reads as generated because it is. */
  const distinctActions = Math.max(
    1,
    Math.min(90, Math.round(Math.sqrt(identity.total_events) * (0.8 + own() * 0.7))),
  );

  const vocabulary = [...sampled];
  for (const event of events) {
    for (const name of ACTIONS_BY_SERVICE[event.event_source] ?? []) {
      if (!vocabulary.includes(name)) vocabulary.push(name);
    }
  }

  const ranked = vocabulary.slice(0, Math.max(1, Math.min(vocabulary.length, distinctActions)));
  /* Zipf-ish: each action gets roughly half the traffic of the one above it,
     normalised so the parts sum to the whole. */
  const weights = ranked.map((_, index) => 1 / (index + 1) ** 1.35);
  const weightTotal = weights.reduce((sum, value) => sum + value, 0) || 1;
  const topActions = ranked
    .map((name, index) => ({
      name,
      count: Math.max(1, Math.round((identity.total_events * weights[index]) / weightTotal)),
    }))
    .slice(0, 6);

  return {
    eventsSeen: identity.total_events,
    distinctActions,
    reads: Math.round(reads * scale),
    writes: Math.round(writes * scale),
    sourceIps: new Set(events.map((event) => event.source_ip)).size,
    regions: new Set(events.map((event) => event.region)).size,
    errors: Math.round(identity.total_events * errorRate),
    firstSeen: events.length > 0 ? events[events.length - 1].event_time : null,
    lastActive: identity.last_active,
    topActions,
    /* Decayed like the actions, and for the same reason: scaling the sample
       counts gave every service the identical figure. Ordered by how often the
       service appeared in the sample, so the ranking is still the data's. */
    topServices: (() => {
      const ordered = [...services.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      const shares = ordered.map((_, index) => 1 / (index + 1) ** 1.2);
      const sum = shares.reduce((total, value) => total + value, 0) || 1;
      return ordered
        .slice(0, 5)
        .map(([name], index) => ({
          name,
          count: Math.max(1, Math.round((identity.total_events * shares[index]) / sum)),
        }));
    })(),
  };
}

export function fetchNode(nodeId, signal) {
  return demoRequest(() => {
    const graph = buildGraph();
    const node = graph.byId.get(nodeId);
    if (!node) {
      const error = new Error(`No node ${nodeId} in the graph`);
      error.status = 404;
      throw error;
    }

    const inbound = (graph.adjacency.into.get(nodeId) ?? []).map((edge) => describeEdge(graph, edge, 'in'));
    const outbound = (graph.adjacency.out.get(nodeId) ?? []).map((edge) => describeEdge(graph, edge, 'out'));

    /* What this principal has actually done, from the same CloudTrail sample
       the activity screen lists. Observed behaviour is a different kind of
       fact from granted permission, and the gap between them is the argument
       for every least-privilege change - so the panel shows both. */
    const observed = node.kind === 'identity' ? observedActivity(node.arn) : null;

    const through = graph.paths.filter((path) => path.nodeIds.includes(nodeId));

    /* Reach, for a node that has no policies of its own.
       An entry point cannot have a blast radius in the permission sense - it
       holds no permissions - but "what does an attacker get from here" is the
       question somebody opens an entry point to ask, and it was the one figure
       the panel did not answer. It is derived from the paths that start here,
       which is the same analysis the findings below are grouped from. */
    const starting = through.filter((path) => path.entryId === nodeId);
    const source = starting.length > 0 ? starting : through;
    const reach =
      node.kind === 'identity'
        ? null
        : {
            paths: source.length,
            identities: new Set(
              source.flatMap((path) =>
                path.nodeIds.filter((id) => graph.byId.get(id)?.kind === 'identity'),
              ),
            ).size,
            admins: new Set(source.filter((path) => path.reachesAdmin).map((path) => path.targetId)).size,
            crownJewels: new Set(
              source.filter((path) => path.targetCrownJewel).map((path) => path.targetId),
            ).size,
            accounts: new Set(source.map((path) => path.targetAccountId).filter(Boolean)).size,
            shortestHops: source.length > 0 ? Math.min(...source.map((path) => path.hops)) : 0,
            fromHere: starting.length > 0,
          };

    return {
      node,
      inbound,
      outbound,
      radius: node.kind === 'identity' ? blastRadius(nodeId) : null,
      reach,
      observed,
      paths: through,
    };
  }, { signal, latency: [160, 360] });
}

export function fetchIdentityAccess(identityId, signal) {
  return demoRequest(() => {
    const graph = buildGraph();
    const node = graph.byId.get(identityId);
    if (!node || node.kind !== 'identity') {
      const error = new Error(`No identity ${identityId} in the graph`);
      error.status = 404;
      throw error;
    }
    const radius = blastRadius(identityId);
    return {
      identity: node,
      radius,
      inbound: (graph.adjacency.into.get(identityId) ?? []).map((edge) => describeEdge(graph, edge, 'in')),
      outbound: (graph.adjacency.out.get(identityId) ?? []).map((edge) => describeEdge(graph, edge, 'out')),
      escalations: (graph.adjacency.out.get(identityId) ?? [])
        .filter((edge) => edge.kind === 'ESCALATES_TO')
        .map((edge) => ({
          ...describeEdge(graph, edge, 'out'),
          method: ESCALATIONS.find((entry) => entry.key === edge.method) ?? null,
        })),
      paths: radius.pathsThrough,
    };
  }, { signal, latency: [200, 420] });
}

function describeEdge(graph, edge, direction) {
  const other = graph.byId.get(direction === 'out' ? edge.to : edge.from);
  return {
    ...edge,
    direction,
    otherId: other?.id,
    otherName: other?.name,
    otherKind: other?.kind,
    otherAccount: other?.accountName ?? other?.accountId,
    methodMeta: edge.method ? ESCALATIONS.find((entry) => entry.key === edge.method) ?? null : null,
  };
}

/** The permission combination behind an escalation edge, as a policy would state it. */
export function escalationById(key) {
  return ESCALATIONS.find((entry) => entry.key === key) ?? null;
}

/**
 * A deny statement that would close one escalation method.
 *
 * Emitted as real IAM JSON, for the same reason the genome policy preview is:
 * a remediation screen that will not show what it is about to do is worse than
 * one that does nothing.
 */
export function preventionDocument(escalationKey, identity) {
  const method = escalationById(escalationKey);
  if (!method) return null;
  return JSON.stringify(
    {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: `Deny${method.key.replace(/[^a-zA-Z0-9]/g, '')}`,
          Effect: 'Deny',
          Action: method.permissions,
          Resource: '*',
          Condition: {
            StringNotEquals: {
              'aws:PrincipalTag/pipeline': 'true',
            },
          },
        },
        {
          Sid: 'ScopePassRole',
          Effect: 'Deny',
          Action: 'iam:PassRole',
          Resource: '*',
          Condition: {
            StringNotLike: {
              'iam:PassedToService': [`${method.service.toLowerCase()}.amazonaws.com`],
            },
          },
        },
      ],
    },
    null,
    2,
  ).concat(identity ? `\n\n/* Attach as a permission boundary on ${identity} */` : '');
}

/* ── Findings ─────────────────────────────────────────────────────────────── */

/**
 * Attack paths, grouped into findings.
 *
 * The previous version listed every path it found. Twenty-six rows reading
 * "Unconditioned OIDC trust -> something" is a query result, not a piece of
 * analysis: the reader has to notice for themselves that eight of them are the
 * same mistake made eight times, and nothing on the row says what to do about
 * it.
 *
 * Every enterprise tool that does this well groups first and counts second -
 * Rapid7 lists an attack path by name with an instance count, BloodHound calls
 * the group a finding and quantifies it as exposure and impact. The group is
 * the unit of work, because one fix closes all of its instances.
 *
 * Two kinds of group, because there are two kinds of cause:
 *
 *   TECHNIQUE  the path works because of a documented privilege-escalation
 *              method. The permission combination is the cause and scoping it
 *              is the fix, so the finding carries both.
 *   GRANT      nothing was escalated; the access was granted. The fix is the
 *              grant itself, so the finding names what was reached rather than
 *              a technique.
 */
function findingKeyFor(path) {
  const escalation = path.steps.find((step) => step.kind === 'ESCALATES_TO' && step.method);
  if (escalation) return { kind: 'technique', key: `technique:${escalation.method}` };
  if (path.controlsCrownJewel) return { kind: 'grant', key: 'grant:crown-jewel-admin' };
  if (path.targetCrownJewel) return { kind: 'grant', key: 'grant:crown-jewel-write' };
  if (path.reachesAdmin && path.crossAccountCount > 0) return { kind: 'grant', key: 'grant:cross-account-admin' };
  if (path.reachesAdmin) return { kind: 'grant', key: 'grant:admin' };
  return { kind: 'grant', key: 'grant:other' };
}

const GRANT_FINDINGS = {
  'grant:crown-jewel-admin': {
    title: 'Control of a crown jewel, including its resource policy',
    via: 'The identity at the end of these paths can change the resource policy on a resource marked as a crown jewel, which decides who else gets in.',
    prevention:
      'Move the resource policy out of reach of the workload identity. Policy changes on a crown jewel belong to a break-glass role with an approval step, not to whatever runs against the data.',
  },
  'grant:crown-jewel-write': {
    title: 'Write access to a crown jewel',
    via: 'These paths end in write access to a resource marked as a crown jewel.',
    prevention:
      'Split read from write. Most workloads that reach a crown jewel only read it, and the write grant is the one worth an exception process.',
  },
  'grant:cross-account-admin': {
    title: 'Administrator-equivalent access across an account boundary',
    via: 'A role in one account trusts a principal in another, and the trusted principal is administrator-equivalent on the far side.',
    prevention:
      'Add an external ID or a condition on the trust policy, and set a permission boundary on the role so crossing the boundary cannot also mean administrator.',
  },
  'grant:admin': {
    title: 'Administrator-equivalent access by a granted route',
    via: 'Nothing was escalated. The identity was given administrator-equivalent permissions, or a role that has them.',
    prevention:
      'Replace the wildcard with the actions the identity has actually used. Access Advisor and the last-used timestamps give the starting list.',
  },
  'grant:other': {
    title: 'Reaches a resource that matters',
    via: 'These paths end somewhere worth knowing about without reaching administrator or a crown jewel.',
    prevention: 'Review the grant against what the identity has used in the last ninety days.',
  },
};

/**
 * The findings, with the filters applied and the filter options alongside.
 *
 * The options are computed from the unfiltered set on purpose: a filter list
 * that shrinks as you use it cannot be undone without clearing everything.
 */
export function fetchPathFindings(
  { severity = '', account = '', vector = '', reach = '' } = {},
  signal,
) {
  return demoRequest(() => {
    const graph = buildGraph();
    const all = graph.paths;

    const matches = all.filter((path) => {
      if (severity && path.severity !== severity) return false;
      if (account && path.targetAccountId !== account) return false;
      if (vector && path.entryVector !== vector) return false;
      if (reach === 'admin' && !path.reachesAdmin) return false;
      if (reach === 'crown' && !path.targetCrownJewel) return false;
      if (reach === 'cross-account' && path.crossAccountCount === 0) return false;
      return true;
    });

    /* Exposure is measured against every entry point in the environment, not
       against the filtered set, so the figure means the same thing whatever
       the reader has filtered to. */
    const entryTotal = graph.entries.length || 1;
    const identityTotal = graph.identities.length || 1;

    const groups = new Map();
    for (const path of matches) {
      const { kind, key } = findingKeyFor(path);
      if (!groups.has(key)) groups.set(key, { key, kind, paths: [] });
      groups.get(key).paths.push(path);
    }

    const findings = [...groups.values()].map((group) => {
      const paths = group.paths.sort((a, b) => b.score - a.score || a.hops - b.hops);
      const method = group.kind === 'technique' ? escalationById(group.key.slice('technique:'.length)) : null;
      const grant = GRANT_FINDINGS[group.key] ?? GRANT_FINDINGS['grant:other'];

      const entries = new Set(paths.map((path) => path.entryId));
      const targets = new Set(paths.map((path) => path.targetId));
      const accounts = new Set(paths.map((path) => path.targetAccountId).filter(Boolean));
      const identitiesOnPath = new Set();
      for (const path of paths) {
        for (const id of path.nodeIds) {
          if (graph.byId.get(id)?.kind === 'identity') identitiesOnPath.add(id);
        }
      }

      const severities = paths.map((path) => path.severity);
      const worst = SEVERITY_ORDER.find((rank) => severities.includes(rank)) ?? 'MEDIUM';

      return {
        key: group.key,
        kind: group.kind,
        title: method ? method.label : grant.title,
        service: method?.service ?? '',
        permissions: method?.permissions ?? [],
        via: method?.via ?? grant.via,
        prevention: method?.prevention ?? grant.prevention,
        severity: worst,
        instances: paths.length,
        shortestHops: Math.min(...paths.map((path) => path.hops)),
        entryCount: entries.size,
        targetCount: targets.size,
        accountCount: accounts.size,
        reachesAdmin: paths.filter((path) => path.reachesAdmin).length,
        crownJewels: paths.filter((path) => path.targetCrownJewel).length,
        crossAccount: paths.filter((path) => path.crossAccountCount > 0).length,
        /* Share of entry points that can start a path in this group, and share
           of identities that sit on one. Two questions a count cannot answer:
           how much of the perimeter this is reachable from, and how much of the
           estate it touches. */
        exposure: Math.round((entries.size / entryTotal) * 100),
        impact: Math.round((identitiesOnPath.size / identityTotal) * 100),
        paths,
      };
    });

    findings.sort(
      (a, b) =>
        SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
        b.instances - a.instances ||
        b.exposure - a.exposure,
    );

    /* Options from the whole set, with counts, so the reader can see what a
       filter would leave before they apply it. */
    const countBy = (pick) => {
      const out = new Map();
      for (const path of all) {
        const value = pick(path);
        if (value) out.set(value, (out.get(value) ?? 0) + 1);
      }
      return out;
    };
    const accountCounts = countBy((path) => path.targetAccountId);
    const accountNames = new Map(all.map((path) => [path.targetAccountId, path.targetAccountName]));
    const vectorCounts = countBy((path) => path.entryVector);

    return {
      findings,
      matched: matches.length,
      total: all.length,
      options: {
        severity: SEVERITY_ORDER.map((key) => ({
          value: key,
          count: all.filter((path) => path.severity === key).length,
        })).filter((row) => row.count > 0),
        account: [...accountCounts.entries()]
          .map(([value, count]) => ({ value, label: accountNames.get(value) || value, count }))
          .sort((a, b) => b.count - a.count),
        vector: [...vectorCounts.entries()]
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count),
        reach: [
          { value: 'admin', count: all.filter((path) => path.reachesAdmin).length },
          { value: 'crown', count: all.filter((path) => path.targetCrownJewel).length },
          { value: 'cross-account', count: all.filter((path) => path.crossAccountCount > 0).length },
        ].filter((row) => row.count > 0),
      },
    };
  }, { signal, latency: [180, 400] });
}

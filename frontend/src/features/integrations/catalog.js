import {
  Boxes,
  Cloud,
  Database,
  Eye,
  GitBranch,
  KeyRound,
  Network,
  ShieldCheck,
  Ticket,
  Users,
} from 'lucide-react';

/**
 * The integration catalogue.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * Every number in this console is collected from somewhere. An identity list
 * comes from `iam:ListRoles` and `ec2:DescribeInstances`; a behavioural
 * baseline comes from CloudTrail; a trust edge comes from a role's trust
 * policy. This screen is where an operator says where to collect from, and it
 * is the only screen in the app that changes what the other screens can know.
 *
 * ── Why AWS is not just one card among sixteen ──────────────────────────────
 * The product is an AWS non-human-identity console. Without the AWS connector
 * there is no inventory, no behaviour and no graph - every other platform here
 * enriches an estate that AWS defines. So AWS is documented in full and the
 * rest are documented honestly as "what this would add", rather than all
 * seventeen getting an identical card and an identical wizard.
 *
 * ── Where the guidance comes from ───────────────────────────────────────────
 * The AWS setup below is the pattern AWS itself publishes for a third party
 * reading a customer's account, not one invented here:
 *
 *   - A cross-account IAM role, never an access key. AWS Well-Architected
 *     SEC03-BP09 ("Share resources securely with a third party") is explicit
 *     that long-term credentials should not be used for external access.
 *   - A per-tenant `sts:ExternalId` condition on the trust policy. Naming our
 *     account alone is not specific enough - any principal in it could then
 *     assume the role - and that is the confused-deputy problem AWS documents
 *     under that name. The external id is unique per customer, so it cannot be
 *     replayed by another tenant of ours.
 *   - Read-only permissions, expressed either as the AWS managed `SecurityAudit`
 *     and `ViewOnlyAccess` policies or as the explicit action list below.
 *
 * The actor-discovery actions are the AWS NHI actor inventory: an identity in
 * this product is an ACTOR - the thing that acts - and its IAM role is the
 * credential that actor assumes. That is why the identity groups here list
 * `ec2:DescribeInstances` and `lambda:ListFunctions` beside `iam:ListRoles`:
 * the role alone tells you a credential exists, not who is using it.
 */

/* ── Platform identity ────────────────────────────────────────────────────── */

export const PLATFORM_CATEGORIES = {
  cloud: { label: 'Cloud accounts', icon: Cloud },
  scm: { label: 'Source control', icon: GitBranch },
  idp: { label: 'Identity providers', icon: Users },
  secrets: { label: 'Secret stores', icon: KeyRound },
  observability: { label: 'Observability', icon: Eye },
  workflow: { label: 'Workflow', icon: Ticket },
};

/**
 * Every platform this console can read from, connected or not.
 *
 * `provides` is the honest bit: it names the screens a platform feeds. A
 * connector whose contribution cannot be named is a connector nobody should
 * be asked to configure.
 */
export const PLATFORMS = [
  {
    key: 'aws',
    name: 'Amazon Web Services',
    short: 'AWS',
    category: 'cloud',
    primary: true,
    summary:
      'The estate itself. Every actor, credential, trust relationship and CloudTrail event this console reads comes from here.',
    provides: [
      { label: 'Identities', to: '/identities' },
      { label: 'Credentials', to: '/credentials' },
      { label: 'Access graph', to: '/access-graph' },
      { label: 'NHI Genome', to: '/genome' },
      { label: 'Activity', to: '/activity' },
    ],
  },
  {
    key: 'github',
    name: 'GitHub',
    short: 'GitHub',
    category: 'scm',
    summary:
      'Repository history for the credential-exposure scanner, and the OIDC subject claims that say which workflow may assume which role.',
    provides: [
      { label: 'Exposed credentials', to: '/exposure' },
      { label: 'Deep scan', to: '/exposure?deep-scan=open' },
    ],
  },
  {
    key: 'codecommit',
    name: 'AWS CodeCommit',
    short: 'CodeCommit',
    category: 'scm',
    summary:
      'The same scanner against repositories inside the AWS account. Onboarded by the credential scanner service, not from this screen.',
    provides: [{ label: 'Exposed credentials', to: '/exposure' }],
  },
  {
    key: 'gitlab',
    name: 'GitLab',
    short: 'GitLab',
    category: 'scm',
    summary: 'CI job identities and their OIDC issuer, so a pipeline that assumes a role is attributed to the pipeline rather than to the role.',
    provides: [{ label: 'Identities', to: '/identities' }],
  },
  {
    key: 'okta',
    name: 'Okta',
    short: 'Okta',
    category: 'idp',
    summary:
      'Who the humans are. Without an identity provider a federated role can be listed but the person arriving through it cannot be named.',
    provides: [
      { label: 'Identities', to: '/identities' },
      { label: 'Access graph', to: '/access-graph' },
    ],
  },
  {
    key: 'entra',
    name: 'Microsoft Entra ID',
    short: 'Entra ID',
    category: 'idp',
    summary: 'The same federation picture for estates that sign in through Entra rather than Okta.',
    provides: [{ label: 'Identities', to: '/identities' }],
  },
  /* AWS Secrets Manager is not listed here. It is inside AWS, and the AWS
     role already reads its metadata (the "Secret store metadata" group), so
     listing it as a separate platform to connect told people rotation data
     was not being collected when it was. */
  {
    key: 'vault',
    name: 'HashiCorp Vault',
    short: 'Vault',
    category: 'secrets',
    summary: 'Dynamic credentials issued outside IAM, so a short-lived database credential is not mistaken for an unmanaged one.',
    provides: [{ label: 'Credentials', to: '/credentials' }],
  },
  {
    key: 'datadog',
    name: 'Datadog',
    short: 'Datadog',
    category: 'observability',
    summary:
      'A vendor role in the account is itself an identity worth watching. Connecting Datadog names the role rather than leaving it as an unattributed external trust.',
    provides: [{ label: 'Identities', to: '/identities' }],
  },
  {
    key: 'splunk',
    name: 'Splunk',
    short: 'Splunk',
    category: 'observability',
    summary: 'CloudTrail forwarded to Splunk, for estates that hold their audit history there rather than in CloudTrail Lake.',
    provides: [{ label: 'Activity', to: '/activity' }],
  },
  {
    key: 'jira',
    name: 'Jira',
    short: 'Jira',
    category: 'workflow',
    summary: 'Raise a ticket from a finding, with the identity, the account and the evidence already filled in.',
    provides: [{ label: 'Reports', to: '/reports' }],
  },
  {
    key: 'servicenow',
    name: 'ServiceNow',
    short: 'ServiceNow',
    category: 'workflow',
    summary: 'The same, for estates whose change process lives in ServiceNow.',
    provides: [{ label: 'Reports', to: '/reports' }],
  },
];

export function platformByKey(key) {
  return PLATFORMS.find((platform) => platform.key === key) ?? null;
}

/* ── AWS: the permissions to grant ───────────────────────────────────────── */

/**
 * Permission groups, by what each one makes possible.
 *
 * Grouped by capability rather than by service, because the question an
 * operator is answering is not "does the scanner need EC2" - it is "what do I
 * lose if I do not grant this". So every group names the screen that stops
 * working without it, and the two that can be declined say so.
 *
 * `required` groups are the ones without which the product has nothing to
 * show. The rest are genuinely optional, and leaving one out degrades a named
 * feature instead of breaking the connector.
 */
export const AWS_PERMISSION_GROUPS = [
  {
    key: 'identity-inventory',
    label: 'Identity inventory',
    icon: Users,
    required: true,
    why: 'The credentials an actor can assume, and the policies attached to them.',
    without: 'No identities, and therefore no other screen in the console.',
    feeds: 'Identities, Credentials',
    actions: [
      'iam:GetAccountAuthorizationDetails',
      'iam:ListRoles',
      'iam:GetRole',
      'iam:ListUsers',
      'iam:GetUser',
      'iam:ListGroupsForUser',
      'iam:ListAttachedRolePolicies',
      'iam:ListRolePolicies',
      'iam:GetRolePolicy',
      'iam:GetPolicyVersion',
      'iam:ListSAMLProviders',
      'iam:ListOpenIDConnectProviders',
    ],
  },
  {
    key: 'actor-discovery',
    label: 'Actor discovery',
    icon: Boxes,
    required: true,
    why: 'Who is actually using each role. An IAM role is a credential; the EC2 instance, Lambda function, ECS task or Bedrock agent holding it is the identity.',
    without: 'Roles with nothing attached to them - a credential list presented as an identity list.',
    feeds: 'Identities, NHI Genome',
    /* Every List call here is paired with the Describe or Get call that
       actually carries the role. Several List responses do not: an EKS pod
       identity summary, a Step Functions list entry, a SageMaker notebook
       summary and an ECS task all have to be described before the role they
       hold is known. A list of List permissions alone would discover the
       actors and never learn what any of them can do. */
    actions: [
      'ec2:DescribeInstances',
      'iam:ListInstanceProfiles',
      'iam:GetInstanceProfile',
      'lambda:ListFunctions',
      'ecs:ListClusters',
      'ecs:ListTasks',
      'ecs:DescribeTasks',
      'ecs:ListServices',
      'ecs:DescribeServices',
      'ecs:DescribeTaskDefinition',
      'eks:ListClusters',
      'eks:ListNodegroups',
      'eks:DescribeNodegroup',
      'eks:ListPodIdentityAssociations',
      'eks:DescribePodIdentityAssociation',
      'apprunner:ListServices',
      'apprunner:DescribeService',
      'batch:ListJobs',
      'batch:DescribeJobs',
      'batch:DescribeJobDefinitions',
      'states:ListStateMachines',
      'states:DescribeStateMachine',
      'events:ListRules',
      'events:ListTargetsByRule',
      'codebuild:ListProjects',
      'codebuild:BatchGetProjects',
      'codepipeline:ListPipelines',
      'codepipeline:GetPipeline',
      'bedrock:ListAgents',
      'bedrock:GetAgent',
      'bedrock:ListKnowledgeBases',
      'bedrock:GetKnowledgeBase',
      'sagemaker:ListNotebookInstances',
      'sagemaker:DescribeNotebookInstance',
      'sagemaker:ListEndpoints',
      'sagemaker:DescribeEndpointConfig',
      'sagemaker:DescribeModel',
      'glue:GetJobs',
      'glue:GetCrawlers',
      'elasticmapreduce:ListClusters',
      'elasticmapreduce:DescribeCluster',
      'apigateway:GET',
      'iot:ListThings',
      'iot:ListThingPrincipals',
      'rolesanywhere:ListProfiles',
      'rolesanywhere:ListTrustAnchors',
    ],
  },
  {
    key: 'credential-state',
    label: 'Credential state',
    icon: KeyRound,
    required: true,
    why: 'Age, last use and rotation state of every long-lived credential in the account.',
    without: 'Credentials can be listed but not aged, so stale-key findings disappear.',
    feeds: 'Credentials, Posture',
    actions: [
      'iam:ListAccessKeys',
      'iam:GetAccessKeyLastUsed',
      'iam:ListMFADevices',
      'iam:ListSigningCertificates',
      'iam:ListServiceSpecificCredentials',
      'iam:GetAccountSummary',
      'iam:GenerateCredentialReport',
      'iam:GetCredentialReport',
    ],
  },
  {
    key: 'behaviour',
    label: 'Observed behaviour',
    icon: Eye,
    required: false,
    why: 'What each identity has actually called. CloudTrail keeps 90 days of management events in every region with no trail configured at all, so this works on day one; a trail is what extends it past 90 days.',
    without: 'No behavioural baselines and no drift detection. Entitlement is still read, so the graph stays correct - it just cannot say whether anything is used.',
    note: 'LookupEvents is read per region and rate-limited by AWS to two requests a second per account per region, which is why the first full read of a large estate takes minutes rather than seconds.',
    feeds: 'NHI Genome, Activity',
    actions: [
      'cloudtrail:LookupEvents',
      'cloudtrail:DescribeTrails',
      'cloudtrail:GetTrailStatus',
      'cloudtrail:ListTrails',
    ],
  },
  {
    key: 'guardrails',
    label: 'Organisation guardrails',
    icon: ShieldCheck,
    required: false,
    why: 'Service control policies and permission boundaries - the cap on what a granted permission can actually do.',
    without: 'Edges the organisation would already deny are drawn as real. The graph over-reports rather than under-reports, which is the safer direction but still wrong.',
    feeds: 'Access graph',
    /* DescribePolicy, not DescribeEffectivePolicy. The effective-policy call
       covers management policies only - backup, tag, AI opt-out, declarative -
       and does not return service control policies at all. SCP content is
       read policy by policy, and the targets say which accounts it applies to. */
    actions: [
      'organizations:DescribeOrganization',
      'organizations:ListAccounts',
      'organizations:ListRoots',
      'organizations:ListOrganizationalUnitsForParent',
      'organizations:ListPolicies',
      'organizations:DescribePolicy',
      'organizations:ListTargetsForPolicy',
      'organizations:ListPoliciesForTarget',
    ],
  },
  {
    key: 'secret-metadata',
    label: 'Secret store metadata',
    icon: Database,
    required: false,
    why: 'Which credentials are held in a managed store, and when each was last rotated.',
    without: 'A credential in Secrets Manager is indistinguishable from one pasted into an environment variable.',
    feeds: 'Credentials',
    note: 'Metadata only. `secretsmanager:GetSecretValue` is deliberately absent, and the rule below asks you to deny it outright.',
    actions: [
      'secretsmanager:ListSecrets',
      'secretsmanager:DescribeSecret',
      'ssm:DescribeParameters',
      'kms:ListAliases',
      'kms:DescribeKey',
    ],
  },
  {
    key: 'resource-reach',
    label: 'Resource reach',
    icon: Network,
    required: false,
    why: 'What the reachable identities can act on, so a blast radius has resources in it rather than only principals.',
    without: 'The access graph can show who can become whom, but not what they end up able to touch.',
    feeds: 'Access graph',
    actions: [
      's3:ListAllMyBuckets',
      's3:GetBucketPolicy',
      's3:GetBucketPolicyStatus',
      'dynamodb:ListTables',
      'dynamodb:DescribeTable',
      'rds:DescribeDBInstances',
      'kms:ListKeys',
      'kms:GetKeyPolicy',
      'sqs:ListQueues',
      'sqs:GetQueueAttributes',
      'sns:ListTopics',
      'sns:GetTopicAttributes',
      'access-analyzer:ListAnalyzers',
      'access-analyzer:ListFindings',
    ],
  },
];

/**
 * The two AWS managed policies that cover most of the above.
 *
 * Offered as the quick path because they are real policies with real names,
 * and an operator who trusts AWS's own read-only job-function policies more
 * than a list somebody pasted into a wizard is being sensible. The explicit
 * list is narrower; both are honest about what they include.
 */
export const AWS_MANAGED_POLICY_OPTION = {
  policies: [
    {
      arn: 'arn:aws:iam::aws:policy/SecurityAudit',
      label: 'SecurityAudit',
      covers: 'Read-only access to security configuration metadata across services, including IAM and CloudTrail.',
    },
    {
      arn: 'arn:aws:iam::aws:policy/ViewOnlyAccess',
      label: 'ViewOnlyAccess',
      covers: 'List, Describe, Get, View and Lookup on resources, which is what actor discovery needs.',
    },
  ],
  tradeoff:
    'Broader than this console uses, and AWS can widen a managed policy without asking you. The explicit list is narrower and changes only when you change it - but it needs updating when a new AWS service starts hosting workloads.',
};

/* ── AWS: the rules to apply ─────────────────────────────────────────────── */

/**
 * Guardrails on the role being granted.
 *
 * Three levels, because that is how the reasoning actually nests: a category
 * (how the role is trusted), a rule inside it, and the detail of what to
 * write. Severity is what happens if the rule is skipped, not how hard it is
 * to apply.
 */
export const AWS_RULE_CATEGORIES = [
  {
    key: 'trust',
    label: 'How the role is trusted',
    lede: 'Who may assume it, and under what condition. This is the part that gets skipped, and it is the part that matters most.',
    rules: [
      {
        key: 'external-id',
        label: 'Require an external id',
        severity: 'CRITICAL',
        detail:
          'Name this console\'s AWS account as the principal AND require the external id issued for your tenant. Naming the account alone means any principal inside it can assume your role - which is the confused-deputy problem AWS documents by that name. The external id is unique to your tenant, so it cannot be replayed by another customer of ours.',
        check: 'The trust policy has a StringEquals condition on sts:ExternalId.',
        source: 'AWS IAM User Guide, "The confused deputy problem"',
      },
      {
        key: 'no-keys',
        label: 'Never issue an access key for this',
        severity: 'CRITICAL',
        detail:
          'A cross-account role hands out credentials that expire in an hour. An access key does not expire at all, and a key shared with a third party is a key you cannot rotate without coordinating with them. AWS Well-Architected SEC03-BP09 says not to use long-term credentials for third-party access.',
        check: 'No IAM user exists for this integration.',
        source: 'AWS Well-Architected, SEC03-BP09',
      },
      {
        key: 'session-duration',
        label: 'Keep the maximum session short',
        severity: 'MEDIUM',
        detail:
          'One hour is enough for a discovery run. A twelve-hour maximum session means a credential issued for a scan is still valid long after the scan finished.',
        check: 'MaxSessionDuration is 3600.',
      },
    ],
  },
  {
    key: 'scope',
    label: 'How far the role reaches',
    lede: 'A read-only role is still a role that can read everything. Bound it.',
    rules: [
      {
        key: 'deny-secret-values',
        label: 'Deny reading secret values outright',
        severity: 'HIGH',
        detail:
          'This console reads which secrets exist and when they were rotated. It never needs a secret value, so an explicit Deny on every value-returning call - GetSecretValue, BatchGetSecretValue, the SSM GetParameter family and kms:Decrypt - costs you nothing and removes the worst thing the role could be used for. An explicit Deny cannot be overridden by a later Allow.',
        check: 'The role policy contains an explicit Deny on secret-value reads.',
      },
      {
        key: 'permission-boundary',
        label: 'Attach a permission boundary',
        severity: 'MEDIUM',
        detail:
          'A boundary caps the role at read-only regardless of what is attached to it later. It is the difference between "this role is read-only today" and "this role cannot be made writable".',
        check: 'A PermissionsBoundary is set on the role.',
      },
      {
        key: 'region-scope',
        label: 'Scope to the regions you actually use',
        severity: 'LOW',
        detail:
          'An aws:RequestedRegion condition listing your regions stops the role being usable in one you have never deployed to. Include us-east-1 even if you run nothing there: IAM, Organizations and other global services are called through us-east-1, so a region list without it blocks the identity inventory itself.',
        check: 'An aws:RequestedRegion condition is present and includes us-east-1.',
      },
    ],
  },
  {
    key: 'coverage',
    label: 'How much of the estate it sees',
    lede: 'A connector that reads one account in an organisation of nine reports a posture that is mostly missing.',
    rules: [
      {
        key: 'all-accounts',
        label: 'Deploy the role to every account',
        severity: 'HIGH',
        detail:
          'Use a service-managed CloudFormation StackSet with automatic deployment turned on, targeted at the organisation root, so the role reaches every member account including ones created later. Service-managed StackSets never deploy to the management account itself, so create the role there separately if you want it covered. An identity in an account nobody connected is an identity nobody is watching.',
        check: 'The role exists in every account the organisation lists.',
      },
      {
        key: 'org-trail',
        label: 'Turn on an organisation-wide CloudTrail trail',
        severity: 'MEDIUM',
        detail:
          'CloudTrail keeps 90 days of management events in every region without any trail, which is enough to start. It is not enough to judge a quarterly batch job, a yearly key rotation or anything dormant for longer than a season: past 90 days the event history is gone, and an identity idle for 100 days reads as never used. A multi-region organisation trail keeps the history for as long as you retain it.',
        check: 'A multi-region organisation trail is logging.',
      },
      {
        key: 'delegated-admin',
        label: 'Use a delegated administrator, not the management account',
        severity: 'MEDIUM',
        detail:
          'Reading organisation policies needs organisations:* read access. Granting that in a delegated admin account rather than the management account keeps the management account free of third-party roles.',
        check: 'The organisation read role is not in the management account.',
      },
    ],
  },
];

/* ── AWS: the health checks ──────────────────────────────────────────────── */

/**
 * What is verified after the role exists.
 *
 * In the order they can fail: nothing after the assume-role check can be
 * tested until that one passes, so a failure early on explains every failure
 * under it rather than presenting six unrelated problems.
 */
export const AWS_HEALTH_CHECKS = [
  {
    key: 'assume',
    scope: 'account',
    label: 'The role can be assumed',
    detail: 'sts:AssumeRole against the role ARN, with the external id.',
    fix: 'Check the role ARN and that the trust policy names this console\'s account id.',
  },
  {
    key: 'external-id',
    scope: 'account',
    label: 'The external id matches',
    detail: 'An assume-role that succeeds without the external id means the condition is missing.',
    fix: 'Add the StringEquals condition on sts:ExternalId to the trust policy.',
  },
  {
    key: 'iam-read',
    scope: 'account',
    label: 'IAM can be enumerated',
    detail: 'iam:GetAccountAuthorizationDetails returns without an AccessDenied.',
    fix: 'Attach the identity-inventory permissions, or the SecurityAudit managed policy.',
  },
  {
    key: 'cloudtrail',
    scope: 'organisation',
    label: 'CloudTrail is readable',
    detail: 'cloudtrail:LookupEvents returns events in every region in range, and whether an organisation trail extends history past 90 days.',
    fix: 'Turn on a multi-region organisation trail from the management account, writing to a bucket in log-archive. The console reads the extra history automatically.',
  },
  {
    key: 'organisation',
    scope: 'organisation',
    label: 'Organisation policies are readable',
    detail: 'organizations:ListPolicies returns, so denies can be applied before an edge is drawn.',
    fix: 'Organisation policies can only be read from the management account or a delegated administrator. Delegate read access with the policy below.',
  },
  {
    key: 'accounts',
    scope: 'organisation',
    label: 'Every account has the role',
    detail: 'The role resolves in each account the organisation lists.',
    fix: 'Connect the account from the Accounts tab, or add its OU to the StackSet targets.',
  },
];

/**
 * The trust policy, as JSON the operator can paste.
 *
 * Emitted rather than described for the same reason the remediation previews
 * elsewhere in this console are: a setup screen that will not show the policy
 * it is asking you to attach is asking for trust it has not earned.
 */
export function trustPolicyDocument({ consoleAccountId, externalId }) {
  return JSON.stringify(
    {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'AllowNhiConsoleToAssumeWithExternalId',
          Effect: 'Allow',
          Principal: { AWS: `arn:aws:iam::${consoleAccountId}:root` },
          Action: 'sts:AssumeRole',
          Condition: {
            StringEquals: { 'sts:ExternalId': externalId },
          },
        },
      ],
    },
    null,
    2,
  );
}

/**
 * The deny statement rule `deny-secret-values` asks for.
 *
 * Separate from the permission list because it is not a permission - it is the
 * one statement that makes the rest of the grant safe to make.
 */
export function denySecretValuesDocument() {
  return JSON.stringify(
    {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'DenyReadingSecretValues',
          Effect: 'Deny',
          /* Every call that returns a value rather than metadata, including
             the two that are easy to miss: BatchGetSecretValue reads many
             secrets in one call, and GetParameterHistory returns previous
             values of a parameter. */
          Action: [
            'secretsmanager:GetSecretValue',
            'secretsmanager:BatchGetSecretValue',
            'ssm:GetParameter',
            'ssm:GetParameters',
            'ssm:GetParametersByPath',
            'ssm:GetParameterHistory',
            'kms:Decrypt',
          ],
          Resource: '*',
        },
      ],
    },
    null,
    2,
  );
}

/** The read-only policy for the groups the operator has kept. */
export function permissionPolicyDocument(selectedKeys) {
  const actions = AWS_PERMISSION_GROUPS.filter((group) => selectedKeys.includes(group.key)).flatMap(
    (group) => group.actions,
  );
  return JSON.stringify(
    {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'NhiConsoleReadOnlyDiscovery',
          Effect: 'Allow',
          Action: [...new Set(actions)].sort(),
          Resource: '*',
        },
      ],
    },
    null,
    2,
  );
}

/* ── AWS: deployable artefacts ───────────────────────────────────────────── */

export const ROLE_NAME = 'DeepAlgorithmsNhiDiscovery';
const READ_POLICY_NAME = 'NhiConsoleReadOnlyDiscovery';
const DENY_POLICY_NAME = 'DenyReadingSecretValues';

function selectedActions(selectedKeys) {
  return [
    ...new Set(
      AWS_PERMISSION_GROUPS.filter((group) => selectedKeys.includes(group.key)).flatMap(
        (group) => group.actions,
      ),
    ),
  ].sort();
}

function trustStatement(consoleAccountId, externalId) {
  return {
    Sid: 'AllowNhiConsoleToAssumeWithExternalId',
    Effect: 'Allow',
    Principal: { AWS: `arn:aws:iam::${consoleAccountId}:root` },
    Action: 'sts:AssumeRole',
    Condition: { StringEquals: { 'sts:ExternalId': externalId } },
  };
}

function denyStatement() {
  return JSON.parse(denySecretValuesDocument()).Statement[0];
}

/**
 * A CloudFormation template, in JSON.
 *
 * JSON rather than YAML on purpose: CloudFormation accepts both, and a JSON
 * template is produced by `JSON.stringify` with no hand-written serialiser in
 * between that could emit an unquoted colon or a tab and break the stack on
 * deploy. The external id is a parameter with the tenant's value as its
 * default, so the same file works as a single stack or as a StackSet.
 */
export function cloudFormationTemplate({ consoleAccountId, externalId, selectedKeys }) {
  const template = {
    AWSTemplateFormatVersion: '2010-09-09',
    Description: 'Read-only cross-account discovery role for the NHI console. No access keys; secret values explicitly denied.',
    Parameters: {
      ExternalId: {
        Type: 'String',
        Default: externalId,
        Description: 'Issued per tenant by the NHI console. Required on every AssumeRole call.',
      },
    },
    Resources: {
      DiscoveryRole: {
        Type: 'AWS::IAM::Role',
        Properties: {
          RoleName: ROLE_NAME,
          MaxSessionDuration: 3600,
          AssumeRolePolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                ...trustStatement(consoleAccountId, externalId),
                Condition: { StringEquals: { 'sts:ExternalId': { Ref: 'ExternalId' } } },
              },
            ],
          },
          Policies: [
            {
              PolicyName: READ_POLICY_NAME,
              PolicyDocument: {
                Version: '2012-10-17',
                Statement: [
                  {
                    Sid: 'NhiConsoleReadOnlyDiscovery',
                    Effect: 'Allow',
                    Action: selectedActions(selectedKeys),
                    Resource: '*',
                  },
                ],
              },
            },
            {
              PolicyName: DENY_POLICY_NAME,
              PolicyDocument: { Version: '2012-10-17', Statement: [denyStatement()] },
            },
          ],
        },
      },
    },
    Outputs: {
      RoleArn: {
        Description: 'Give this ARN to the NHI console.',
        Value: { 'Fn::GetAtt': ['DiscoveryRole', 'Arn'] },
      },
    },
  };
  return JSON.stringify(template, null, 2);
}

/**
 * The same role as Terraform.
 *
 * Policies are passed as heredoc JSON rather than HCL maps, so the documents
 * are byte-for-byte the ones on the Permissions tab - there is no second
 * rendering of them that could drift.
 */
export function terraformModule({ consoleAccountId, externalId, selectedKeys }) {
  const trust = JSON.stringify(
    { Version: '2012-10-17', Statement: [trustStatement(consoleAccountId, externalId)] },
    null,
    2,
  );
  const read = permissionPolicyDocument(selectedKeys);
  const deny = denySecretValuesDocument();
  const indent = (text) =>
    text
      .split('\n')
      .map((line) => `    ${line}`)
      .join('\n');
  return `# Read-only cross-account discovery role for the NHI console.
# terraform init && terraform apply, then give the role_arn output to the console.

resource "aws_iam_role" "nhi_discovery" {
  name                 = "${ROLE_NAME}"
  max_session_duration = 3600

  assume_role_policy = <<-EOT
${indent(trust)}
  EOT
}

resource "aws_iam_role_policy" "read_only_discovery" {
  name = "${READ_POLICY_NAME}"
  role = aws_iam_role.nhi_discovery.id

  policy = <<-EOT
${indent(read)}
  EOT
}

resource "aws_iam_role_policy" "deny_secret_values" {
  name = "${DENY_POLICY_NAME}"
  role = aws_iam_role.nhi_discovery.id

  policy = <<-EOT
${indent(deny)}
  EOT
}

output "role_arn" {
  value = aws_iam_role.nhi_discovery.arn
}
`;
}

/** The same role with the AWS CLI, one account at a time. */
export function awsCliScript({ consoleAccountId, externalId, selectedKeys }) {
  const trust = JSON.stringify(
    { Version: '2012-10-17', Statement: [trustStatement(consoleAccountId, externalId)] },
    null,
    2,
  );
  return `#!/usr/bin/env sh
# Read-only cross-account discovery role for the NHI console.
# Run with credentials for the account you are connecting. IAM is global,
# so this runs once per account, not once per region.
set -e

cat > nhi-trust.json <<'EOF'
${trust}
EOF

cat > nhi-read-only.json <<'EOF'
${permissionPolicyDocument(selectedKeys)}
EOF

cat > nhi-deny-secret-values.json <<'EOF'
${denySecretValuesDocument()}
EOF

aws iam create-role \\
  --role-name ${ROLE_NAME} \\
  --max-session-duration 3600 \\
  --assume-role-policy-document file://nhi-trust.json

aws iam put-role-policy \\
  --role-name ${ROLE_NAME} \\
  --policy-name ${READ_POLICY_NAME} \\
  --policy-document file://nhi-read-only.json

aws iam put-role-policy \\
  --role-name ${ROLE_NAME} \\
  --policy-name ${DENY_POLICY_NAME} \\
  --policy-document file://nhi-deny-secret-values.json

# The ARN to give the console:
aws iam get-role --role-name ${ROLE_NAME} --query Role.Arn --output text
`;
}

/**
 * Rolling the CloudFormation template out to a whole organisation.
 *
 * Service-managed, with automatic deployment, so accounts created later get
 * the role without anybody remembering to add them. One region only: an IAM
 * role is global, and a second stack instance in another region would fail
 * on the duplicate role name.
 */
export function stackSetCommands() {
  return `# From the management account (or a CloudFormation delegated administrator).
# Download the CloudFormation template above as nhi-discovery-role.json first.

aws cloudformation create-stack-set \\
  --stack-set-name nhi-discovery-role \\
  --template-body file://nhi-discovery-role.json \\
  --permission-model SERVICE_MANAGED \\
  --auto-deployment Enabled=true,RetainStacksOnAccountRemoval=false \\
  --capabilities CAPABILITY_NAMED_IAM

# Target the organisation root to cover every account. One region only:
# the role is global, and a second region would collide on its name.
aws cloudformation create-stack-instances \\
  --stack-set-name nhi-discovery-role \\
  --deployment-targets OrganizationalUnitIds=<your-root-id> \\
  --regions us-east-1

# Service-managed StackSets never deploy to the management account itself.
# If it should be covered, deploy the template there as an ordinary stack.
`;
}

/* ── Deploy formats ─────────────────────────────────────────────────────── */

/** The discovery role in the three forms the Deploy tab and the Connect wizard offer. */
export const DEPLOY_FORMATS = [
  {
    value: 'cloudformation',
    label: 'CloudFormation',
    filename: 'nhi-discovery-role.json',
    type: 'application/json',
    how: 'Create a stack from this template in the account you are connecting: CloudFormation console, Create stack, Upload a template file. It needs the CAPABILITY_NAMED_IAM acknowledgement because it names the role.',
    build: (options) => cloudFormationTemplate(options),
  },
  {
    value: 'terraform',
    label: 'Terraform',
    filename: 'nhi-discovery-role.tf',
    type: 'text/plain',
    how: 'Add this file to a Terraform configuration whose AWS provider points at the account you are connecting, then terraform apply. The role_arn output is the value to give this console.',
    build: (options) => terraformModule(options),
  },
  {
    value: 'cli',
    label: 'AWS CLI',
    filename: 'nhi-discovery-role.sh',
    type: 'text/x-shellscript',
    how: 'Run with credentials for the account you are connecting. IAM is global, so it runs once per account, not once per region.',
    build: (options) => awsCliScript(options),
  },
];

/* ── Fixes for failing checks ────────────────────────────────────────────── */

/**
 * What to run when a check fails, as something to copy rather than a
 * sentence to interpret. Only the checks that fail at organisation level have
 * one: the account-level checks are fixed by redeploying the role, which the
 * Connect wizard and the StackSet section already cover.
 */
export const AWS_CHECK_FIXES = {
  organisation: {
    where: 'Run from the management account. Replace <delegated-admin-account-id> with the account the console reads the organisation from.',
    filename: 'org-read-delegation.json',
    /* AWS Organizations resource-based delegation policy (PutResourcePolicy):
       lets a delegated administrator account read the organisation's
       structure and policies without the management account's credentials. */
    code: `${JSON.stringify(
      {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'DelegateReadOnlyForNhiDiscovery',
            Effect: 'Allow',
            Principal: { AWS: 'arn:aws:iam::<delegated-admin-account-id>:root' },
            Action: [
              'organizations:DescribeOrganization',
              'organizations:DescribeOrganizationalUnit',
              'organizations:DescribeAccount',
              'organizations:DescribePolicy',
              'organizations:ListRoots',
              'organizations:ListAccounts',
              'organizations:ListAccountsForParent',
              'organizations:ListOrganizationalUnitsForParent',
              'organizations:ListParents',
              'organizations:ListChildren',
              'organizations:ListPolicies',
              'organizations:ListPoliciesForTarget',
              'organizations:ListTargetsForPolicy',
            ],
            Resource: '*',
          },
        ],
      },
      null,
      2,
    )}

# Then, from the management account:
# aws organizations put-resource-policy --content file://org-read-delegation.json`,
  },
  cloudtrail: {
    where: 'Run from the management account (or a CloudTrail delegated administrator). The bucket needs a policy that lets CloudTrail write organisation logs to it.',
    filename: 'org-trail.sh',
    code: `aws cloudtrail create-trail \\
  --name org-trail \\
  --s3-bucket-name <log-archive-bucket> \\
  --is-organization-trail \\
  --is-multi-region-trail

aws cloudtrail start-logging --name org-trail`,
  },
};

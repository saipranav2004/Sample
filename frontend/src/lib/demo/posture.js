/**
 * Identity security posture (ISPM), computed from the demo estate.
 *
 * Every identity is evaluated against a fixed set of checks, each belonging to
 * one of six pillars. A failed check costs points by severity; the score is
 * what is left of 100. Nothing here is generated for its own sake: every
 * check reads a field the other screens already show (policies, MFA, access
 * key age, expiry, owner, last activity, the access graph's escalation edges,
 * the genome's open anomalies), so a failing check on this screen is always
 * the same fact another screen shows.
 *
 * Where a check has a published equivalent it says so - the CIS AWS
 * Foundations Benchmark requirement and the AWS Security Hub control - so a
 * reader can hold it against the benchmark rather than take it on trust.
 *
 * History is derived, not invented. Each failed check carries the moment its
 * condition began (a key crossing 90 days, an identity going 45 days without
 * activity, an anomaly being detected), and each remediation carries the
 * moment it was applied. The score at any past moment is the score those
 * two lists give, so the trend line and the change log cannot disagree.
 *
 * Remediation is stored in the demo overlay. Applying one makes its check pass
 * at once - the way a policy change in IAM takes effect at once - and closes
 * the alerts and genome anomalies the same fix resolves, through the same
 * action path the Alerts screen uses, so the queue and this screen agree.
 */
import { isOpen } from '../alerts';
import { actorTypeMeta, classificationMeta, credentialKindMeta } from '../domain';
import { escalationsByIdentity, graphIdentityIds } from './accessGraph';
import { applyAlertAction, estateAlerts } from './alerts';
import { estate, ESTATE_META } from './estate';
import { genomeAnomalies, genomeFleet } from './genome';
import { demoRequest, hashSeed, OVERLAY_KEYS, readOverlay, rng, writeOverlay } from './runtime';
import { assertCan } from './users';
import { bandFor, BANDS, CHECK_WEIGHTS, gradeFor, PILLAR_ORDER, PILLARS } from '../posture';

const { NOW, DAY } = ESTATE_META;

/* ── Inputs shared by the checks ─────────────────────────────────────────── */

/* Service-wide managed policies: every action on the service, or every secret. */
const BROAD_POLICIES = ['AmazonDynamoDBFullAccess', 'AmazonSQSFullAccess', 'SecretsManagerReadWrite'];

/* What each managed policy is normally attached for, as the actions a scoped
   replacement keeps. Used when the genome has no observed actions to go on. */
const POLICY_ACTIONS = {
  AmazonS3ReadOnlyAccess: ['s3:GetObject', 's3:ListBucket'],
  AmazonDynamoDBFullAccess: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:Query', 'dynamodb:UpdateItem'],
  SecretsManagerReadWrite: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
  AWSLambdaBasicExecutionRole: ['logs:CreateLogStream', 'logs:PutLogEvents'],
  AmazonEC2ContainerRegistryPowerUser: ['ecr:GetAuthorizationToken', 'ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'],
  CloudWatchAgentServerPolicy: ['cloudwatch:PutMetricData', 'logs:PutLogEvents'],
  AmazonSQSFullAccess: ['sqs:SendMessage', 'sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
  AWSKeyManagementServicePowerUser: ['kms:Decrypt', 'kms:DescribeKey'],
};

const OPEN_ANOMALY = new Set(['open', 'acknowledged']);

let cachedContext = null;

/* The estate, graph and genome are deterministic, so what the checks read
   from them is built once. Anomaly status is not - it changes on the genome
   and alerts screens - so it is read fresh on every evaluation. */
function staticContext() {
  if (cachedContext) return cachedContext;
  const { identities, credentialsOf, people } = estate();
  cachedContext = {
    identities,
    credentialsOf,
    people,
    escalations: escalationsByIdentity(),
    inGraph: graphIdentityIds(),
    fleet: new Map(genomeFleet().map((row) => [row.id, row])),
  };
  return cachedContext;
}

function context() {
  const anomalies = new Map();
  for (const anomaly of genomeAnomalies()) {
    if (!OPEN_ANOMALY.has(anomaly.status)) continue;
    const list = anomalies.get(anomaly.identityId) ?? [];
    list.push(anomaly);
    anomalies.set(anomaly.identityId, list);
  }
  return { ...staticContext(), anomalies };
}

const isUser = (row) => row.arn.includes(':user/');
const principalKind = (row) => (isUser(row) ? 'user' : 'role');
const principalName = (row) => row.arn.split('/').pop();
const days = (count) => `${count} ${count === 1 ? 'day' : 'days'}`;
const plusDays = (iso, count) => new Date(Date.parse(iso) + count * DAY).toISOString();
const json = (value) => JSON.stringify(value, null, 2);

function credentialsOf(ctx, row) {
  return ctx.credentialsOf.get(row.arn) ?? [];
}

function activeKeys(ctx, row) {
  return credentialsOf(ctx, row).filter((cred) => cred.type === 'ACCESS_KEY' && cred.status !== 'EXPIRED');
}

/* Actions a scoped replacement policy keeps: what the genome saw the identity
   call, or else what its narrower policies are for. */
function observedActions(ctx, row) {
  const genome = ctx.fleet.get(row.id);
  if (genome?.typicalActions?.length) return [...new Set(genome.typicalActions.map((action) => action.api))].sort();
  const fromPolicies = (row.attached_policies ?? []).flatMap((policy) => POLICY_ACTIONS[policy] ?? []);
  return [...new Set(fromPolicies.length ? fromPolicies : ['sts:GetCallerIdentity'])].sort();
}

function scopedPolicy(actions, sid) {
  return json({ Version: '2012-10-17', Statement: [{ Sid: sid, Effect: 'Allow', Action: actions, Resource: '*' }] });
}

/* ── The checks ───────────────────────────────────────────────────────────── */

/**
 * Each check:
 *  - `applies(row, ctx)` - whether the check means anything for this identity;
 *  - `evaluate(row, ctx)` - null when it passes, or the failure: severity,
 *    detail, when the condition began, and anything the fix needs;
 *  - `fix(row, ctx, failure)` - the remediation: what it does and the exact
 *    policy or commands it applies;
 *  - `resolves(alert, failure)` - which open alerts the fix closes;
 *  - `supersededBy` - other fixes that also make this check pass.
 */
const CHECKS = [
  {
    key: 'admin-access',
    pillar: 'least_privilege',
    title: 'No administrator-equivalent policy',
    control: 'Security Hub IAM.1 · CIS 1.16 (v1.4.0)',
    applies: () => true,
    evaluate(row) {
      if (!row.is_admin) return null;
      return {
        severity: 'HIGH',
        detail: 'AdministratorAccess is attached - every action on every resource in the account.',
        since: row.created_at,
      };
    },
    fix(row, ctx) {
      const kind = principalKind(row);
      const name = principalName(row);
      const policy = `${name}-least-privilege`;
      const actions = observedActions(ctx, row);
      return {
        action: 'Replace AdministratorAccess with a scoped policy',
        summary: `Creates ${policy} allowing only the ${actions.length} actions this identity is observed to use, attaches it, then detaches AdministratorAccess.`,
        caution: 'Any call outside these actions is denied from then on. Resources can be narrowed further from the Access graph.',
        artifacts: [
          { label: `${policy}.json`, language: 'json', content: scopedPolicy(actions, 'ObservedActionsOnly') },
          {
            label: 'Apply',
            language: 'shell',
            content: [
              `aws iam create-policy --policy-name ${policy} --policy-document file://${policy}.json`,
              `aws iam attach-${kind}-policy --${kind}-name ${name} --policy-arn arn:aws:iam::${row.account_id}:policy/${policy}`,
              `aws iam detach-${kind}-policy --${kind}-name ${name} --policy-arn arn:aws:iam::aws:policy/AdministratorAccess`,
            ].join('\n'),
          },
        ],
      };
    },
    resolves: (alert) =>
      ['nhi-admin-orphaned', 'admin-stale'].includes(alert.rule) ||
      (alert.rule === 'credential-critical' && alert.credentialType === 'ASSUMED_ROLE'),
  },
  {
    key: 'broad-policy',
    pillar: 'least_privilege',
    title: 'No service-wide managed policy',
    control: null,
    applies: () => true,
    evaluate(row) {
      if (row.is_admin) return null;
      const broad = (row.attached_policies ?? []).filter((policy) => BROAD_POLICIES.includes(policy));
      if (broad.length === 0) return null;
      return {
        severity: 'MEDIUM',
        detail: `${broad.join(', ')} ${broad.length === 1 ? 'grants' : 'grant'} every action on the service, on every resource.`,
        since: row.created_at,
        broad,
      };
    },
    fix(row, ctx, failure) {
      const kind = principalKind(row);
      const name = principalName(row);
      const policy = `${name}-scoped-data`;
      const actions = [...new Set(failure.broad.flatMap((entry) => POLICY_ACTIONS[entry] ?? []))].sort();
      return {
        action: `Replace ${failure.broad.length === 1 ? failure.broad[0] : 'the service-wide policies'} with a scoped policy`,
        summary: `Creates ${policy} with the ${actions.length} data actions a workload needs, attaches it, and detaches ${failure.broad.join(', ')}.`,
        caution: 'Administrative actions on these services - deleting tables, queues or secrets, changing their policies - are no longer allowed.',
        artifacts: [
          { label: `${policy}.json`, language: 'json', content: scopedPolicy(actions, 'DataActionsOnly') },
          {
            label: 'Apply',
            language: 'shell',
            content: [
              `aws iam create-policy --policy-name ${policy} --policy-document file://${policy}.json`,
              `aws iam attach-${kind}-policy --${kind}-name ${name} --policy-arn arn:aws:iam::${row.account_id}:policy/${policy}`,
              ...failure.broad.map(
                (entry) => `aws iam detach-${kind}-policy --${kind}-name ${name} --policy-arn arn:aws:iam::aws:policy/${entry}`,
              ),
            ].join('\n'),
          },
        ],
      };
    },
    resolves: () => false,
    supersededBy: ['admin-access'],
  },
  {
    key: 'user-direct-policy',
    pillar: 'least_privilege',
    title: 'IAM user receives policies only through groups',
    control: 'Security Hub IAM.2 · CIS 1.15',
    applies: (row) => isUser(row),
    evaluate(row) {
      const policies = row.attached_policies ?? [];
      if (policies.length === 0) return null;
      return {
        severity: 'LOW',
        detail: `${policies.length} ${policies.length === 1 ? 'policy is' : 'policies are'} attached to the user directly.`,
        since: row.created_at,
        policies,
      };
    },
    fix(row, _ctx, failure) {
      const name = principalName(row);
      const group = `${name}-access`;
      return {
        action: 'Move the policies to a group',
        summary: `Creates the group ${group}, attaches the same ${failure.policies.length} policies to it, adds ${name} to it, then detaches them from the user.`,
        caution: 'Effective permissions are unchanged. Access is now granted, reviewed and removed at the group.',
        artifacts: [
          {
            label: 'Apply',
            language: 'shell',
            content: [
              `aws iam create-group --group-name ${group}`,
              ...failure.policies.map((policy) => `aws iam attach-group-policy --group-name ${group} --policy-arn arn:aws:iam::aws:policy/${policy}`),
              `aws iam add-user-to-group --group-name ${group} --user-name ${name}`,
              ...failure.policies.map((policy) => `aws iam detach-user-policy --user-name ${name} --policy-arn arn:aws:iam::aws:policy/${policy}`),
            ].join('\n'),
          },
        ],
      };
    },
    resolves: () => false,
  },
  {
    key: 'key-rotation',
    pillar: 'credential_hygiene',
    title: 'Access keys rotated within 90 days',
    control: 'Security Hub IAM.3 · CIS 1.14',
    applies: (row, ctx) => credentialsOf(ctx, row).some((cred) => cred.type === 'ACCESS_KEY'),
    evaluate(row, ctx) {
      const old = activeKeys(ctx, row).filter((cred) => cred.age_days > 90).sort((a, b) => b.age_days - a.age_days);
      if (old.length === 0) return null;
      return {
        severity: 'HIGH',
        detail: `${old[0].cred_id} is ${days(old[0].age_days)} old${old.length > 1 ? `, and ${old.length - 1} more over 90 days` : ''}.`,
        since: plusDays(old[0].created_at, 90),
        keys: old.map((cred) => cred.cred_id),
      };
    },
    fix(_row, _ctx, failure) {
      return {
        action: failure.keys.length === 1 ? 'Rotate the access key' : `Rotate ${failure.keys.length} access keys`,
        summary: 'Issues a new key, then deactivates and deletes the old one once the workload has the new value.',
        caution: 'Anything still using the old key fails after deactivation. The deactivate step is reversible; the delete is not.',
        artifacts: [
          {
            label: 'Apply',
            language: 'shell',
            content: failure.keys
              .map((key) =>
                [
                  `USER=$(aws iam get-access-key-last-used --access-key-id ${key} --query UserName --output text)`,
                  'aws iam create-access-key --user-name "$USER"',
                  '# Deploy the new key to the workload, then:',
                  `aws iam update-access-key --user-name "$USER" --access-key-id ${key} --status Inactive`,
                  `aws iam delete-access-key --user-name "$USER" --access-key-id ${key}`,
                ].join('\n'),
              )
              .join('\n\n'),
          },
        ],
      };
    },
    resolves: (alert, failure) => alert.rule === 'credential-critical' && failure.keys.includes(alert.entity?.name),
    supersededBy: ['workload-key', 'dual-identity'],
  },
  {
    key: 'expired-credential',
    pillar: 'credential_hygiene',
    title: 'No expired credential left attached',
    control: null,
    applies: (row, ctx) => credentialsOf(ctx, row).length > 0,
    evaluate(row, ctx) {
      const expired = credentialsOf(ctx, row)
        .filter((cred) => cred.status === 'EXPIRED' && cred.expires_at)
        .sort((a, b) => Date.parse(a.expires_at) - Date.parse(b.expires_at));
      if (expired.length === 0) return null;
      return {
        severity: 'HIGH',
        detail:
          expired.length === 1
            ? `${expired[0].cred_id} expired and is still attached.`
            : `${expired.length} expired credentials are still attached, the oldest ${expired[0].cred_id}.`,
        since: expired[0].expires_at,
        credentials: expired.map((cred) => ({ id: cred.cred_id, type: cred.type })),
      };
    },
    fix(_row, _ctx, failure) {
      const command = ({ id, type }) => {
        if (type === 'SECRET_MANAGER') return `aws secretsmanager delete-secret --secret-id ${id} --recovery-window-in-days 7`;
        if (type === 'SSM_PARAMETER') return `aws ssm delete-parameter --name ${id}`;
        if (type === 'ACCESS_KEY') {
          return `USER=$(aws iam get-access-key-last-used --access-key-id ${id} --query UserName --output text)\naws iam delete-access-key --user-name "$USER" --access-key-id ${id}`;
        }
        return `# ${id}: revoke it with the service that issued it, then remove the reference.`;
      };
      return {
        action: failure.credentials.length === 1 ? 'Remove the expired credential' : `Remove ${failure.credentials.length} expired credentials`,
        summary: 'Removes what can no longer authenticate, so nothing can quietly switch to an unrecorded replacement.',
        caution: 'Secrets are scheduled for deletion with a 7-day recovery window rather than deleted at once.',
        artifacts: [{ label: 'Apply', language: 'shell', content: failure.credentials.map(command).join('\n') }],
      };
    },
    resolves: (alert, failure) =>
      alert.rule === 'credential-expired' && failure.credentials.some((cred) => cred.id === alert.entity?.name),
  },
  {
    key: 'workload-key',
    pillar: 'credential_hygiene',
    title: 'Workload uses temporary credentials, not a long-lived key',
    control: null,
    applies: (row) => row.classification !== 'HUMAN',
    evaluate(row, ctx) {
      const keys = activeKeys(ctx, row);
      if (keys.length === 0) return null;
      const oldest = [...keys].sort((a, b) => b.age_days - a.age_days)[0];
      return {
        severity: 'MEDIUM',
        detail: `Holds ${keys.length === 1 ? 'a long-lived access key' : `${keys.length} long-lived access keys`}, the oldest ${days(oldest.age_days)} old.`,
        since: oldest.created_at,
        keys: keys.map((cred) => cred.cred_id),
      };
    },
    fix(row, _ctx, failure) {
      return {
        action: 'Deactivate the long-lived key',
        summary: `Deactivates ${failure.keys.join(', ')} once the workload authenticates with its own role through temporary credentials.`,
        caution: `Confirm ${principalName(row)} is using the role first: a workload still on the key stops working. Deactivation can be undone.`,
        artifacts: [
          {
            label: 'Apply',
            language: 'shell',
            content: failure.keys
              .map(
                (key) =>
                  `USER=$(aws iam get-access-key-last-used --access-key-id ${key} --query UserName --output text)\naws iam update-access-key --user-name "$USER" --access-key-id ${key} --status Inactive`,
              )
              .join('\n\n'),
          },
        ],
      };
    },
    resolves: (alert, failure) => alert.rule === 'credential-critical' && failure.keys.includes(alert.entity?.name),
    supersededBy: ['dual-identity'],
  },
  {
    key: 'mfa-console',
    pillar: 'trust_access',
    title: 'Console sign-in requires MFA',
    control: 'Security Hub IAM.5 · CIS 1.10',
    applies: (row) => Boolean(row.console_access),
    evaluate(row) {
      if (row.mfa_enabled) return null;
      return {
        severity: row.is_admin ? 'CRITICAL' : 'HIGH',
        detail: `Signs in to the console with a password alone${row.is_admin ? ', with administrator access' : ''}.`,
        since: row.created_at,
      };
    },
    fix(row) {
      const name = principalName(row);
      return {
        action: 'Enforce MFA for console sign-in',
        summary: `Attaches a policy to ${name} that denies everything except setting up MFA until the session was signed in with MFA.`,
        caution: 'The user can still sign in, but can do nothing else until they enrol a device. Tell them before applying.',
        artifacts: [
          {
            label: 'RequireMFA.json',
            language: 'json',
            content: json({
              Version: '2012-10-17',
              Statement: [
                {
                  Sid: 'DenyAllExceptMfaSetupWithoutMfa',
                  Effect: 'Deny',
                  NotAction: [
                    'iam:CreateVirtualMFADevice',
                    'iam:EnableMFADevice',
                    'iam:GetUser',
                    'iam:ListMFADevices',
                    'iam:ListVirtualMFADevices',
                    'iam:ResyncMFADevice',
                    'iam:ChangePassword',
                    'sts:GetSessionToken',
                  ],
                  Resource: '*',
                  Condition: { BoolIfExists: { 'aws:MultiFactorAuthPresent': 'false' } },
                },
              ],
            }),
          },
          {
            label: 'Apply',
            language: 'shell',
            content: `aws iam put-user-policy --user-name ${name} --policy-name RequireMFA --policy-document file://RequireMFA.json`,
          },
        ],
      };
    },
    resolves: (alert) => alert.rule === 'human-no-mfa',
  },
  {
    key: 'external-trust',
    pillar: 'trust_access',
    title: 'External trust requires an ExternalId',
    control: null,
    applies: (row) => !isUser(row),
    evaluate(row) {
      if (!row.is_external) return null;
      return {
        severity: 'MEDIUM',
        detail: `The trust policy lets ${row.trust_service ?? 'an account outside the organisation'} assume it with no sts:ExternalId condition.`,
        since: row.created_at,
      };
    },
    fix(row) {
      const name = principalName(row);
      const own = rng(hashSeed(`vendor:${row.trust_service ?? row.id}`));
      const vendorAccount = Array.from({ length: 12 }, () => Math.floor(own() * 10)).join('');
      const externalId = `${row.account_id}-${principalName(row)}`.slice(0, 64);
      return {
        action: 'Require an ExternalId in the trust policy',
        summary: `Rewrites the trust policy so ${row.trust_service ?? 'the vendor'} can assume ${name} only when it presents this ExternalId.`,
        caution: `Give the ExternalId to ${row.trust_service ?? 'the vendor'} before applying, or their calls fail until they set it.`,
        artifacts: [
          {
            label: 'trust-policy.json',
            language: 'json',
            content: json({
              Version: '2012-10-17',
              Statement: [
                {
                  Effect: 'Allow',
                  Principal: { AWS: `arn:aws:iam::${vendorAccount}:root` },
                  Action: 'sts:AssumeRole',
                  Condition: { StringEquals: { 'sts:ExternalId': externalId } },
                },
              ],
            }),
          },
          {
            label: 'Apply',
            language: 'shell',
            content: `aws iam update-assume-role-policy --role-name ${name} --policy-document file://trust-policy.json`,
          },
        ],
      };
    },
    resolves: () => false,
  },
  {
    key: 'escalation-path',
    pillar: 'escalation',
    title: 'No privilege-escalation path',
    control: null,
    /* Only where the access graph holds the identity. The graph is built
       over a budget, and a pass for an identity it never looked at would be
       a claim nobody checked. */
    applies: (row, ctx) => ctx.inGraph.has(row.id),
    evaluate(row, ctx) {
      const paths = ctx.escalations.get(row.id) ?? [];
      if (paths.length === 0) return null;
      const toAdmin = paths.filter((path) => path.targetIsAdmin);
      const first = toAdmin[0] ?? paths[0];
      return {
        severity: toAdmin.length > 0 ? 'CRITICAL' : 'HIGH',
        detail: `Can act as ${first.targetName}${first.targetIsAdmin ? ', an administrator,' : ''} through one method: ${
          first.method?.label.toLowerCase() ?? 'an escalation method'
        }.${paths.length > 1 ? ` ${paths.length - 1} more ${paths.length === 2 ? 'path' : 'paths'}.` : ''}`,
        since: row.created_at,
        permissions: [...new Set(paths.flatMap((path) => path.method?.permissions ?? []))].sort(),
        methods: paths.map((path) => path.method?.label).filter(Boolean),
      };
    },
    fix(row, _ctx, failure) {
      const kind = principalKind(row);
      const name = principalName(row);
      const policy = `${name}-escalation-boundary`;
      return {
        action: 'Attach a permission boundary',
        summary: `Sets ${policy} as the permission boundary of ${name}. It caps everything the identity's policies grant and denies ${failure.permissions.join(', ')} outside the deployment pipeline.`,
        caution: 'A boundary only limits; it grants nothing. Existing access other than these permissions is unchanged.',
        artifacts: [
          {
            label: `${policy}.json`,
            language: 'json',
            content: json({
              Version: '2012-10-17',
              Statement: [
                { Sid: 'AllowWithinBoundary', Effect: 'Allow', Action: '*', Resource: '*' },
                {
                  Sid: 'DenyEscalationOutsidePipeline',
                  Effect: 'Deny',
                  Action: failure.permissions,
                  Resource: '*',
                  Condition: { StringNotEquals: { 'aws:PrincipalTag/pipeline': 'true' } },
                },
              ],
            }),
          },
          {
            label: 'Apply',
            language: 'shell',
            content: [
              `aws iam create-policy --policy-name ${policy} --policy-document file://${policy}.json`,
              `aws iam put-${kind}-permissions-boundary --${kind}-name ${name} --permissions-boundary arn:aws:iam::${row.account_id}:policy/${policy}`,
            ].join('\n'),
          },
        ],
      };
    },
    resolves: () => false,
  },
  {
    key: 'escalation-anomaly',
    pillar: 'escalation',
    title: 'No open privilege-escalation anomaly',
    control: null,
    applies: (row, ctx) => ctx.fleet.has(row.id),
    evaluate(row, ctx) {
      const found = (ctx.anomalies.get(row.id) ?? []).filter((anomaly) => anomaly.type === 'PRIV_ESCALATION');
      if (found.length === 0) return null;
      return anomalyFailure(found, (anomaly) => `Called ${anomaly.api}, which it has never called before, ${relative(anomaly.detectedAt)}.`);
    },
    fix(row, _ctx, failure) {
      const name = principalName(row);
      const apis = [...new Set(failure.anomalies.map((anomaly) => anomaly.api))];
      return {
        action: `Deny ${apis.join(', ')}`,
        summary: `Adds an inline deny for ${apis.join(', ')} to ${name} and resolves the anomaly on NHI Genome.`,
        caution: 'If the call was a planned change, grant it deliberately through the pipeline instead.',
        artifacts: [
          {
            label: 'deny-escalation.json',
            language: 'json',
            content: json({
              Version: '2012-10-17',
              Statement: [{ Sid: 'DenyObservedEscalation', Effect: 'Deny', Action: apis, Resource: '*' }],
            }),
          },
          {
            label: 'Apply',
            language: 'shell',
            content: `aws iam put-${principalKind(row)}-policy --${principalKind(row)}-name ${name} --policy-name deny-escalation --policy-document file://deny-escalation.json`,
          },
        ],
      };
    },
    resolves: (alert, failure) => failure.anomalies.some((anomaly) => anomaly.id === alert.anomalyId),
  },
  {
    key: 'dual-identity',
    pillar: 'exposure',
    title: 'Credentials are not shared by a person and a workload',
    control: null,
    applies: (row) => isUser(row),
    evaluate(row) {
      if (row.classification !== 'DUAL_IDENTITY') return null;
      return {
        severity: 'MEDIUM',
        detail: 'An IAM user with console access whose credentials are also used by a workload.',
        since: row.created_at,
      };
    },
    fix(row, ctx) {
      const name = principalName(row);
      const keys = activeKeys(ctx, row).map((cred) => cred.cred_id);
      return {
        action: 'Move the workload to its own role',
        summary: `Creates the role ${name}-workload with the user's policies for the workload to assume${keys.length ? ', then deactivates the shared key' : ''}. The user is left to the person.`,
        caution: 'Point the workload at the new role before the key is deactivated.',
        artifacts: [
          {
            label: 'Apply',
            language: 'shell',
            content: [
              `aws iam create-role --role-name ${name}-workload --assume-role-policy-document file://workload-trust.json`,
              ...(row.attached_policies ?? []).map(
                (policy) => `aws iam attach-role-policy --role-name ${name}-workload --policy-arn arn:aws:iam::aws:policy/${policy}`,
              ),
              ...keys.map((key) => `aws iam update-access-key --user-name ${name} --access-key-id ${key} --status Inactive`),
            ].join('\n'),
          },
        ],
      };
    },
    resolves: (alert) => alert.rule === 'dual-identity',
  },
  {
    key: 'unusual-source',
    pillar: 'exposure',
    title: 'Credentials used only from their baseline',
    control: null,
    applies: (row, ctx) => ctx.fleet.has(row.id),
    evaluate(row, ctx) {
      const found = (ctx.anomalies.get(row.id) ?? []).filter((anomaly) => ['NEW_IP', 'NEW_REGION'].includes(anomaly.type));
      if (found.length === 0) return null;
      return anomalyFailure(found, (anomaly) =>
        anomaly.type === 'NEW_IP'
          ? `Used from ${anomaly.observed.headline}, outside every source range in its baseline.`
          : `Used in ${anomaly.observed.headline}, outside its baseline region.`,
      );
    },
    fix(row, _ctx, failure) {
      const name = principalName(row);
      const byIp = failure.anomalies.some((anomaly) => anomaly.type === 'NEW_IP');
      const byRegion = failure.anomalies.some((anomaly) => anomaly.type === 'NEW_REGION');
      const statements = [];
      if (byIp) {
        statements.push({
          Sid: 'DenyOutsideBaselineNetwork',
          Effect: 'Deny',
          Action: '*',
          Resource: '*',
          Condition: { NotIpAddress: { 'aws:SourceIp': ['10.0.0.0/8'] }, Bool: { 'aws:ViaAWSService': 'false' } },
        });
      }
      if (byRegion) {
        statements.push({
          Sid: 'DenyOutsideBaselineRegion',
          Effect: 'Deny',
          Action: '*',
          Resource: '*',
          Condition: { StringNotEquals: { 'aws:RequestedRegion': [row.region] } },
        });
      }
      return {
        action: byIp && byRegion ? 'Restrict it to its baseline network and region' : byIp ? 'Restrict it to its baseline network' : 'Restrict it to its baseline region',
        summary: `Adds an inline deny to ${name} for calls from outside its baseline, and resolves the anomaly on NHI Genome.`,
        caution: 'Rotate what the identity holds as well if the source was not yours: the deny stops use, it does not revoke what was taken.',
        artifacts: [
          { label: 'deny-outside-baseline.json', language: 'json', content: json({ Version: '2012-10-17', Statement: statements }) },
          {
            label: 'Apply',
            language: 'shell',
            content: `aws iam put-${principalKind(row)}-policy --${principalKind(row)}-name ${name} --policy-name deny-outside-baseline --policy-document file://deny-outside-baseline.json`,
          },
        ],
      };
    },
    resolves: (alert, failure) => failure.anomalies.some((anomaly) => anomaly.id === alert.anomalyId),
  },
  {
    key: 'unused-access',
    pillar: 'lifecycle',
    title: 'Used in the last 45 days',
    control: 'Security Hub IAM.22 · CIS 1.12',
    applies: () => true,
    evaluate(row) {
      if (row.last_active_days <= 45) return null;
      return {
        severity: row.is_admin ? 'HIGH' : 'MEDIUM',
        detail: `No recorded activity for ${days(row.last_active_days)}${row.is_admin ? ', with administrator access' : ''}.`,
        since: plusDays(row.last_active, 45),
      };
    },
    fix(row, ctx) {
      const name = principalName(row);
      if (isUser(row)) {
        const keys = activeKeys(ctx, row).map((cred) => cred.cred_id);
        return {
          action: 'Disable its unused sign-in',
          summary: `Removes the console password${keys.length ? ' and deactivates its access keys' : ''}. The user and its policies stay, so it can be restored.`,
          caution: 'Re-enabling needs a new password to be set by an administrator.',
          artifacts: [
            {
              label: 'Apply',
              language: 'shell',
              content: [
                ...(row.console_access ? [`aws iam delete-login-profile --user-name ${name}`] : []),
                ...keys.map((key) => `aws iam update-access-key --user-name ${name} --access-key-id ${key} --status Inactive`),
              ].join('\n') || `# ${name} has no password or active key left to disable.`,
            },
          ],
        };
      }
      return {
        action: 'Quarantine the unused role',
        summary: `Attaches the AWS managed policy AWSDenyAll to ${name}, so nothing can act through it while the owner confirms it can be deleted.`,
        caution: 'Detaching AWSDenyAll restores it exactly as it was.',
        artifacts: [
          {
            label: 'Apply',
            language: 'shell',
            content: `aws iam attach-role-policy --role-name ${name} --policy-arn arn:aws:iam::aws:policy/AWSDenyAll`,
          },
        ],
      };
    },
    resolves: (alert) => alert.rule === 'admin-stale',
  },
  {
    key: 'no-owner',
    pillar: 'lifecycle',
    title: 'Has an accountable owner',
    control: null,
    applies: (row) => row.classification !== 'HUMAN',
    evaluate(row) {
      if (row.owner_type !== 'ORPHANED') return null;
      return {
        severity: row.is_admin ? 'HIGH' : 'MEDIUM',
        detail: 'No owner, team or creator could be resolved from tags or CloudTrail.',
        since: row.created_at,
      };
    },
    fix(row, ctx) {
      const name = principalName(row);
      return {
        action: 'Record an owner',
        summary: `Tags ${name} with the person accountable for it, so reviews and alerts have someone to go to.`,
        caution: null,
        needsOwner: true,
        owners: ctx.people.map((person) => ({ value: person.user, label: `${person.name} · ${person.team}` })),
        artifacts: [
          {
            label: 'Apply',
            language: 'shell',
            content: `aws iam tag-${principalKind(row)} --${principalKind(row)}-name ${name} --tags Key=owner,Value={owner}`,
          },
        ],
      };
    },
    resolves: (alert) => alert.rule === 'nhi-admin-orphaned',
  },
];

const CHECKS_BY_KEY = new Map(CHECKS.map((check) => [check.key, check]));

function relative(iso) {
  const minutes = Math.max(1, Math.round((NOW - Date.parse(iso)) / 60_000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

const SEVERITY_RANK = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

function anomalyFailure(anomalies, describe) {
  const sorted = [...anomalies].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  const first = sorted[0];
  return {
    severity: first.severity,
    detail: `${describe(first)}${sorted.length > 1 ? ` ${sorted.length - 1} more open.` : ''}`,
    since: [...anomalies].sort((a, b) => Date.parse(a.detectedAt) - Date.parse(b.detectedAt))[0].detectedAt,
    anomalies: sorted.map((anomaly) => ({ id: anomaly.id, type: anomaly.type, api: anomaly.api })),
  };
}

/* ── Remediation store ───────────────────────────────────────────────────── */

function readRemediations() {
  const stored = readOverlay(OVERLAY_KEYS.posture, {});
  return stored && typeof stored === 'object' ? stored : {};
}

/* ── Evaluation ──────────────────────────────────────────────────────────── */

/**
 * One identity, every applicable check. A failed check that has been
 * remediated - or superseded by a fix that also clears it - passes, and keeps
 * the moment it was cleared for the history.
 */
function evaluateIdentity(row, ctx, remediations, extra = null) {
  const fixes = { ...(remediations[row.id] ?? {}), ...(extra ?? {}) };
  const results = [];
  for (const check of CHECKS) {
    if (!check.applies(row, ctx)) continue;
    const failure = check.evaluate(row, ctx);
    if (!failure) {
      results.push({ check, state: 'pass', failure: null, fixedAt: null, fix: null });
      continue;
    }
    const own = fixes[check.key] ?? null;
    const by = (check.supersededBy ?? []).map((key) => fixes[key]).filter(Boolean);
    const clearing = [own, ...by].filter(Boolean).sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0] ?? null;
    results.push({
      check,
      state: clearing ? 'remediated' : 'fail',
      failure,
      fixedAt: clearing?.at ?? null,
      fix: own,
      clearedBy: clearing && clearing !== own ? Object.keys(fixes).find((key) => fixes[key] === clearing) : null,
    });
  }
  return results;
}

function scoreOf(results) {
  const lost = results
    .filter((result) => result.state === 'fail')
    .reduce((sum, result) => sum + CHECK_WEIGHTS[result.failure.severity], 0);
  return Math.max(0, 100 - lost);
}

/** The score as it stood at `time`, from when each condition began and was cleared. */
function scoreAt(results, time) {
  const lost = results
    .filter((result) => result.failure)
    .filter((result) => Date.parse(result.failure.since) <= time)
    .filter((result) => !(result.fixedAt && Date.parse(result.fixedAt) <= time))
    .reduce((sum, result) => sum + CHECK_WEIGHTS[result.failure.severity], 0);
  return Math.max(0, 100 - lost);
}

function pillarsOf(results) {
  return PILLAR_ORDER.map((key) => {
    const inPillar = results.filter((result) => result.check.pillar === key);
    const failing = inPillar.filter((result) => result.state === 'fail');
    const lost = failing.reduce((sum, result) => sum + CHECK_WEIGHTS[result.failure.severity], 0);
    if (inPillar.length === 0) {
      return { key, label: PILLARS[key].label, summary: PILLARS[key].summary, score: null, status: 'na', checks: 0, failing: 0 };
    }
    const status =
      failing.some((result) => SEVERITY_RANK[result.failure.severity] >= SEVERITY_RANK.HIGH)
        ? 'fail'
        : failing.length > 0
          ? 'warn'
          : 'pass';
    return {
      key,
      label: PILLARS[key].label,
      summary: PILLARS[key].summary,
      /* Steeper than the overall score: a pillar is narrow, so one high-severity
         failure in it is most of what it measures. */
      score: Math.max(0, 100 - lost * 4),
      status,
      checks: inPillar.length,
      failing: failing.length,
    };
  });
}

function primaryCredential(ctx, row) {
  const creds = credentialsOf(ctx, row);
  const key = creds.filter((cred) => cred.type === 'ACCESS_KEY').sort((a, b) => b.age_days - a.age_days)[0];
  const chosen = key ?? creds[0] ?? null;
  if (!chosen) return isUser(row) && row.console_access ? { label: 'Console password', status: null, ageDays: row.password_age_days } : null;
  return { label: credentialKindMeta(chosen.type).label, status: chosen.status, ageDays: chosen.age_days };
}

function summaryRow(row, ctx, results) {
  const score = scoreOf(results);
  const pillars = pillarsOf(results);
  const failing = results.filter((result) => result.state === 'fail');
  const weakest = pillars.filter((pillar) => pillar.score !== null).sort((a, b) => a.score - b.score)[0];
  const monthAgo = scoreAt(results, NOW - 30 * DAY);
  return {
    id: row.id,
    name: row.name,
    arn: row.arn,
    classification: row.classification,
    category: classificationMeta(row.classification).label,
    type: actorTypeMeta(row.identity_type).label,
    account: row.account_name,
    accountId: row.account_id,
    env: row.env,
    isAdmin: Boolean(row.is_admin),
    score,
    grade: gradeFor(score),
    band: bandFor(score).key,
    weakestPillar: !weakest || weakest.status === 'pass' ? null : weakest.key,
    failed: failing.length,
    remediated: results.filter((result) => result.state === 'remediated').length,
    failedBySeverity: failing.reduce((acc, result) => ({ ...acc, [result.failure.severity]: (acc[result.failure.severity] ?? 0) + 1 }), {}),
    failingChecks: failing.map((result) => result.check.key),
    credential: primaryCredential(ctx, row),
    trend: row.created_at && Date.parse(row.created_at) <= NOW - 30 * DAY ? score - monthAgo : null,
  };
}

function evaluateAll() {
  const ctx = context();
  const remediations = readRemediations();
  return ctx.identities.map((row) => {
    const results = evaluateIdentity(row, ctx, remediations);
    return { row, results, summary: summaryRow(row, ctx, results) };
  });
}

const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
const round1 = (value) => Math.round(value * 10) / 10;

/** Fleet score at `time`: the mean over identities that existed then. */
function fleetScoreAt(evaluated, time) {
  const present = evaluated.filter(({ row }) => Date.parse(row.created_at) <= time);
  return mean(present.map(({ results }) => scoreAt(results, time)));
}

/* ── Fleet view ──────────────────────────────────────────────────────────── */

export const POSTURE_FLAGS = [
  { key: 'overPermissioned', label: 'Over-permissioned', checks: ['admin-access', 'broad-policy'] },
  { key: 'staleCredentials', label: 'Stale credentials', checks: ['key-rotation', 'expired-credential', 'workload-key'] },
  { key: 'escalation', label: 'Escalation paths', checks: ['escalation-path', 'escalation-anomaly'] },
  { key: 'exposed', label: 'Exposed', checks: ['dual-identity', 'unusual-source', 'mfa-console'] },
  { key: 'dormant', label: 'Dormant', checks: ['unused-access'] },
];

export function postureOverview({ window = 30 } = {}) {
  const evaluated = evaluateAll();
  const rows = evaluated.map((entry) => entry.summary);
  const score = Math.round(mean(rows.map((row) => row.score)));
  const span = window === 90 ? 90 : 30;
  const previous = Math.round(fleetScoreAt(evaluated, NOW - span * DAY));

  const trend = [];
  for (let day = span; day >= 0; day -= 1) {
    const time = NOW - day * DAY;
    trend.push({ at: new Date(time).toISOString(), score: round1(fleetScoreAt(evaluated, time)) });
  }
  /* Today's point is the live score, remediations applied a moment ago included. */
  trend[trend.length - 1].score = round1(mean(rows.map((row) => row.score)));

  const distribution = BANDS.map((band) => ({ ...band, count: rows.filter((row) => row.band === band.key).length }));
  const flags = POSTURE_FLAGS.map((flag) => ({
    key: flag.key,
    label: flag.label,
    checks: flag.checks,
    count: rows.filter((row) => row.failingChecks.some((key) => flag.checks.includes(key))).length,
  }));

  /* Quick wins: the fixes that would lift the fleet most, by check. The gain
     is exact - each affected identity is re-scored with that one fix applied,
     so a fix another fix supersedes is not counted twice. */
  const ctx = context();
  const remediations = readRemediations();
  const gains = new Map();
  for (const { row, summary } of evaluated) {
    for (const key of summary.failingChecks) {
      const after = scoreOf(evaluateIdentity(row, ctx, remediations, { [key]: { at: new Date(NOW).toISOString() } }));
      const entry = gains.get(key) ?? { key, identities: 0, points: 0 };
      entry.identities += 1;
      entry.points += after - summary.score;
      gains.set(key, entry);
    }
  }
  const quickWins = [...gains.values()]
    .map((entry) => {
      const check = CHECKS_BY_KEY.get(entry.key);
      return {
        key: entry.key,
        title: check.title,
        pillar: check.pillar,
        identities: entry.identities,
        fleetGain: round1(entry.points / rows.length),
      };
    })
    .sort((a, b) => b.fleetGain - a.fleetGain)
    .slice(0, 5);

  const pillars = PILLAR_ORDER.map((key) => {
    /* Identities the pillar could not evaluate are left out of its mean. */
    const perIdentity = evaluated
      .map(({ results }) => pillarsOf(results).find((pillar) => pillar.key === key))
      .filter((pillar) => pillar.status !== 'na');
    const value = Math.round(mean(perIdentity.map((pillar) => pillar.score)));
    return {
      key,
      label: PILLARS[key].label,
      summary: PILLARS[key].summary,
      score: value,
      failing: perIdentity.filter((pillar) => pillar.status !== 'pass').length,
      evaluated: perIdentity.length,
      status: value >= 80 ? 'pass' : value >= 60 ? 'warn' : 'fail',
    };
  });

  const groupBy = (keyOf) => {
    const map = new Map();
    for (const entry of evaluated) {
      const key = keyOf(entry.summary);
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    return [...map.entries()]
      .map(([key, list]) => {
        const now = mean(list.map((entry) => entry.summary.score));
        const before = fleetScoreAt(list, NOW - span * DAY);
        return { key, identities: list.length, score: Math.round(now), delta: Math.round(now - before) };
      })
      .sort((a, b) => a.score - b.score);
  };

  return {
    evaluatedAt: new Date(NOW).toISOString(),
    window: span,
    fleet: { score, grade: gradeFor(score), band: bandFor(score).key, previous, delta: score - previous, identities: rows.length },
    trend,
    distribution,
    flags,
    quickWins,
    pillars,
    byCategory: groupBy((row) => row.category),
    byAccount: groupBy((row) => row.account),
    rows,
    checks: CHECKS.map((check) => ({ key: check.key, title: check.title, pillar: check.pillar })),
  };
}

/* ── One identity ────────────────────────────────────────────────────────── */

function remediationPreview(result, row, ctx, remediations, currentScore, openAlerts) {
  const plan = result.check.fix(row, ctx, result.failure);
  const after = scoreOf(evaluateIdentity(row, ctx, remediations, { [result.check.key]: { at: new Date(NOW).toISOString() } }));
  return {
    ...plan,
    scoreBefore: currentScore,
    scoreAfter: after,
    gain: after - currentScore,
    alertsResolved: openAlerts.filter((alert) => result.check.resolves(alert, result.failure)).length,
  };
}

export function postureIdentity(id) {
  const ctx = context();
  const row = ctx.identities.find((identity) => identity.id === id);
  if (!row) {
    const error = new Error('No identity with that id.');
    error.status = 404;
    throw error;
  }
  const remediations = readRemediations();
  const results = evaluateIdentity(row, ctx, remediations);
  const summary = summaryRow(row, ctx, results);
  const openAlerts = estateAlerts().filter((alert) => alert.identityId === row.id && isOpen(alert));

  const checks = results
    .map((result) => ({
      key: result.check.key,
      title: result.check.title,
      pillar: result.check.pillar,
      control: result.check.control,
      state: result.state,
      severity: result.failure?.severity ?? null,
      weight: result.failure ? CHECK_WEIGHTS[result.failure.severity] : 0,
      detail: result.failure?.detail ?? null,
      since: result.failure?.since ?? null,
      fixedAt: result.fixedAt,
      fix: result.fix,
      clearedBy: result.clearedBy ? CHECKS_BY_KEY.get(result.clearedBy)?.title ?? null : null,
      remediation: result.state === 'fail' ? remediationPreview(result, row, ctx, remediations, summary.score, openAlerts) : null,
    }))
    .sort((a, b) => {
      const order = { fail: 0, remediated: 1, pass: 2 };
      return order[a.state] - order[b.state] || b.weight - a.weight;
    });

  const failing = checks.filter((check) => check.state === 'fail');
  const projected = scoreOf(
    evaluateIdentity(row, ctx, remediations, Object.fromEntries(failing.map((check) => [check.key, { at: new Date(NOW).toISOString() }]))),
  );

  /* Peers: same classification, across the estate. */
  const peers = ctx.identities
    .filter((other) => other.classification === row.classification)
    .map((other) => scoreOf(evaluateIdentity(other, ctx, remediations)));
  const below = peers.filter((value) => value < summary.score).length;

  /* Monthly points over six months, then today. */
  const history = [];
  for (let month = 6; month >= 1; month -= 1) {
    const time = NOW - month * 30 * DAY;
    if (Date.parse(row.created_at) > time) continue;
    history.push({ at: new Date(time).toISOString(), score: scoreAt(results, time) });
  }
  history.push({ at: new Date(NOW).toISOString(), score: summary.score });

  const events = [];
  for (const result of results) {
    if (!result.failure) continue;
    const weight = CHECK_WEIGHTS[result.failure.severity];
    events.push({
      at: result.failure.since,
      kind: 'failed',
      delta: -weight,
      title: `${result.check.title} - failed`,
      detail: result.failure.detail,
    });
    if (result.fixedAt) {
      events.push({
        at: result.fixedAt,
        kind: 'remediated',
        delta: weight,
        title: `${result.check.title} - remediated`,
        detail: result.fix
          ? `${result.fix.action}. Applied by ${result.fix.by}.`
          : `Cleared by: ${CHECKS_BY_KEY.get(result.clearedBy)?.title ?? 'another fix'}.`,
      });
    }
  }
  events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return {
    identity: {
      ...summary,
      owner: row.owner_type === 'ORPHANED' ? null : row.owner_name,
      ownerTag: remediations[row.id]?.['no-owner']?.owner ?? null,
      team: row.team ?? null,
      region: row.region,
      lastActiveDays: row.last_active_days,
      createdAt: row.created_at,
      policies: row.attached_policies ?? [],
      mfa: row.console_access ? Boolean(row.mfa_enabled) : null,
      inGenome: ctx.fleet.has(row.id),
      inGraph: ctx.inGraph.has(row.id),
    },
    pillars: pillarsOf(results),
    checks,
    projected,
    credentials: credentialsOf(ctx, row).map((cred) => ({
      id: cred.cred_id,
      type: cred.type,
      label: credentialKindMeta(cred.type).label,
      status: cred.status,
      severity: cred.severity,
      ageDays: cred.age_days,
      lastUsedDays: cred.last_used_days,
      expiresAt: cred.expires_at,
    })),
    peers: {
      group: classificationMeta(row.classification).label,
      count: peers.length,
      average: Math.round(mean(peers)),
      best: Math.max(...peers),
      percentile: peers.length > 1 ? Math.round((below / (peers.length - 1)) * 100) : null,
    },
    history,
    events,
    openAlerts: openAlerts.length,
  };
}

/* ── Remediating ─────────────────────────────────────────────────────────── */

/**
 * Apply one check's remediation to one identity. Refused for a role without
 * `posture.remediate`, and for a check that is not failing. Closes the open
 * alerts the fix resolves - genome alerts included, which resolves their
 * anomalies - through the Alerts action path, so every screen agrees.
 */
export function remediate({ identityId, checkKey, owner = null }) {
  const me = assertCan('posture.remediate');
  const ctx = context();
  const row = ctx.identities.find((identity) => identity.id === identityId);
  const check = CHECKS_BY_KEY.get(checkKey);
  if (!row || !check) throw new Error('That identity or check no longer exists.');
  const remediations = readRemediations();
  const results = evaluateIdentity(row, ctx, remediations);
  const result = results.find((entry) => entry.check.key === checkKey);
  if (!result || result.state !== 'fail') throw new Error('This check is already passing.');

  const plan = check.fix(row, ctx, result.failure);
  let ownerPerson = null;
  if (plan.needsOwner) {
    ownerPerson = ctx.people.find((person) => person.user === owner);
    if (!ownerPerson) throw new Error('Choose who owns this identity.');
  }

  const before = scoreOf(results);
  const at = new Date().toISOString();
  const entry = {
    at,
    by: me.name,
    byUser: me.user,
    action: plan.action,
    ...(ownerPerson ? { owner: ownerPerson.name } : {}),
  };
  const next = { ...remediations, [row.id]: { ...(remediations[row.id] ?? {}), [checkKey]: entry } };

  /* Alerts first, while the store still shows the check failing: if the
     alert write is refused the remediation is not recorded either. */
  const toResolve = estateAlerts().filter(
    (alert) => alert.identityId === row.id && isOpen(alert) && check.resolves(alert, result.failure),
  );
  if (toResolve.length > 0) {
    applyAlertAction({
      alerts: toResolve,
      action: 'resolve',
      note: `Remediated on Posture: ${plan.action}${ownerPerson ? ` (owner ${ownerPerson.name})` : ''}.`,
    });
  }

  writeOverlay(OVERLAY_KEYS.posture, next);
  const after = scoreOf(evaluateIdentity(row, ctx, next));
  return { before, after, resolvedAlerts: toResolve.length, action: plan.action };
}

/* ── Transport ───────────────────────────────────────────────────────────── */

export function fetchPostureOverview(query = {}, signal) {
  return demoRequest(() => postureOverview(query), { signal, latency: [320, 620] });
}

export function fetchPostureIdentity(id, signal) {
  return demoRequest(() => postureIdentity(id), { signal, latency: [260, 520] });
}

export function remediatePosture(input) {
  return demoRequest(() => remediate(input), { latency: [700, 1100] });
}

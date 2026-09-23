import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Info,
  MinusCircle,
  ShieldCheck,
} from 'lucide-react';
import { fetchIntegrationHealth, fetchSummary } from '../../lib/api/endpoints';
import { useQuery } from '../../lib/hooks';
import { severityMeta } from '../../lib/domain';
import { formatNumber, formatRelative } from '../../lib/format';
import { PageHeader } from '../../shell/PageHeader';
import { Button } from '../../ui/Button';
import { CopyButton, CopyableValue } from '../../ui/Copyable';
import { Panel, PanelHeader, SectionLabel } from '../../ui/Panel';
import { DetailSkeleton } from '../../ui/Skeleton';
import { EmptyState } from '../../ui/States';
import { Tabs } from '../../ui/Tabs';
import { Tag } from '../../ui/Tag';
import { cn } from '../../ui/cn';
import {
  AWS_HEALTH_CHECKS,
  AWS_MANAGED_POLICY_OPTION,
  AWS_PERMISSION_GROUPS,
  AWS_RULE_CATEGORIES,
  denySecretValuesDocument,
  permissionPolicyDocument,
  trustPolicyDocument,
} from './catalog';

const TABS = [
  { value: 'configured', label: 'What is configured' },
  { value: 'permissions', label: 'Permissions' },
  { value: 'rules', label: 'Rules' },
  { value: 'health', label: 'Health' },
];

/**
 * The AWS connector, configured.
 *
 * ── What an operator is actually asking here ────────────────────────────────
 * Not "which toggles exist" but "where did the 228 identities on the
 * Identities screen come from, and what did I grant to make that happen".
 * So the first tab is the answer to that: the role that exists, and a row per
 * screen naming the permission group behind it and the count it produced.
 * Everything else - the permissions themselves, the guardrails, the checks -
 * follows from that, in that order.
 *
 * ── Why the counts are live ─────────────────────────────────────────────────
 * The figures on the first tab come from the same summary the posture screen
 * reads, not from anything stored against the connector. A setup screen that
 * reports its own idea of how much it collected is a setup screen that can be
 * wrong about it - this one cannot disagree with the inventory, because it is
 * reading the inventory.
 */
export function AwsSetup({ data, onBack }) {
  const [tab, setTab] = useState('configured');
  /* The required groups are not togglable, because declining one leaves a
     connector that returns nothing - which is not a configuration, it is a
     disconnection with extra steps. */
  const [optional, setOptional] = useState(() =>
    AWS_PERMISSION_GROUPS.filter((group) => !group.required).map((group) => group.key),
  );

  const summary = useQuery((signal) => fetchSummary({}, signal), []);
  const health = useQuery((signal) => fetchIntegrationHealth('aws', signal), []);

  const selectedKeys = useMemo(
    () => [
      ...AWS_PERMISSION_GROUPS.filter((group) => group.required).map((group) => group.key),
      ...optional,
    ],
    [optional],
  );

  const trustPolicy = useMemo(
    () =>
      trustPolicyDocument({
        consoleAccountId: data.tenant.consoleAccountId,
        externalId: data.tenant.externalId,
      }),
    [data.tenant],
  );

  /* Left as a placeholder rather than filled in: the role lives in the
     customer's accounts, one per account, and there is no single id to print
     here. Printing ours would be exactly the confusion this screen exists to
     prevent. */
  const roleArn = 'arn:aws:iam::<your-account-id>:role/DeepAlgorithmsNhiDiscovery';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configure Amazon Web Services"
        lede="The role that is granted, what it is allowed to read, and what has been verified."
        actions={
          <Button variant="secondary" icon={ArrowLeft} onClick={onBack}>
            All integrations
          </Button>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="low" size="sm" icon={CheckCircle2}>
              Connected
            </Tag>
            <Tag tone="neutral" size="sm">
              {formatNumber(data.coverage.accountsConnected)} of{' '}
              {formatNumber(data.coverage.accountsTotal)} accounts
            </Tag>
            <Tag tone="neutral" size="sm">
              {data.tenant.regions.length} regions
            </Tag>
          </div>
        }
        tabs={<Tabs size="sm" value={tab} onChange={setTab} tabs={TABS} />}
      />

      {tab === 'configured' && (
        <ConfiguredTab
          data={data}
          summary={summary}
          trustPolicy={trustPolicy}
          roleArn={roleArn}
        />
      )}

      {tab === 'permissions' && (
        <PermissionsTab
          optional={optional}
          onToggle={(key) =>
            setOptional((current) =>
              current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key],
            )
          }
          selectedKeys={selectedKeys}
        />
      )}

      {tab === 'rules' && <RulesTab />}

      {tab === 'health' && <HealthTab health={health} />}
    </div>
  );
}

/* ── Tab 1: what is configured, and what it produced ─────────────────────── */

/**
 * Which permission group produced which screen.
 *
 * This is the table the whole setup exists to justify. `groups` names the
 * permission groups a screen depends on, and `count` reads the live summary -
 * so the row says "Identities: 228, from actor discovery and identity
 * inventory" rather than asserting that a connector is working.
 */
const DATA_FLOW = [
  {
    key: 'identities',
    label: 'Identities',
    to: '/identities',
    groups: ['actor-discovery', 'identity-inventory'],
    count: (s) => s?.total_identities,
    unit: 'actors',
    how: 'Each compute, serverless, CI, agent and data actor is discovered by its own List/Describe call, then resolved to the IAM role it assumes. The actor is the identity; the role is what it holds.',
  },
  {
    key: 'credentials',
    label: 'Credentials',
    to: '/credentials',
    groups: ['credential-state', 'identity-inventory'],
    count: (s) => s?.total_credentials,
    unit: 'credentials',
    how: 'Assumed roles, instance profiles, access keys, certificates and federation trusts, each with its age and last use from the credential report and iam:GetAccessKeyLastUsed.',
  },
  {
    key: 'graph',
    label: 'Access graph',
    to: '/access-graph',
    groups: ['identity-inventory', 'resource-reach', 'guardrails'],
    count: (s) => s?.total_accounts,
    unit: 'accounts',
    how: 'Trust policies give the edges between principals; resource policies give the edges to data. Organisation policies are what stop an edge being drawn that the estate would already deny.',
  },
  {
    key: 'genome',
    label: 'NHI Genome',
    to: '/genome',
    groups: ['behaviour'],
    count: (s) => s?.total_nhis,
    unit: 'machine identities baselined',
    how: 'CloudTrail management events, per principal, over the trail\'s retention. A baseline needs history - an identity the trail does not cover reads as unknown rather than as unused.',
  },
  {
    key: 'activity',
    label: 'Activity',
    to: '/activity',
    groups: ['behaviour'],
    count: (s) => s?.total_events,
    unit: 'events read',
    how: 'The same trail, unaggregated, so a finding can be traced back to the call that produced it.',
  },
];

function ConfiguredTab({ data, summary, trustPolicy, roleArn }) {
  const groupLabel = (key) =>
    AWS_PERMISSION_GROUPS.find((group) => group.key === key)?.label ?? key;

  return (
    <>
      {/* The two values a customer has to put into their own trust policy, and
          the one thing that must not be confused: the account id below is
          ours, not theirs. */}
      <Panel prominence="lead">
        <PanelHeader
          prominence="lead"
          title="The role this console assumes"
          subtitle="A cross-account role with a per-tenant external id. No access key exists for this integration, and none should be created."
        />
        <div className="mt-4 grid gap-3 @min-[52rem]:grid-cols-2">
          <dl className="flex flex-col gap-2.5">
            <SetupValue
              label="This console's AWS account id"
              value={data.tenant.consoleAccountId}
              note="Ours, not yours. This is the principal your trust policy names."
            />
            <SetupValue
              label="External id issued for your tenant"
              value={data.tenant.externalId}
              note="Unique to you. It is what stops another tenant of ours assuming your role, which is the confused-deputy problem AWS documents by that name."
            />
            <SetupValue
              label="Role to create in each of your accounts"
              value={roleArn}
              note="One role per account, deployed by StackSet from the management account so accounts created later get it too."
            />
          </dl>

          <div>
            <div className="flex items-center justify-between gap-2">
              <SectionLabel>The trust policy to attach</SectionLabel>
              <CopyButton value={trustPolicy} label="Copy the trust policy" />
            </div>
            <pre className="mt-1.5 max-h-72 overflow-auto rounded-[var(--radius-control)] border border-line bg-inset p-3 font-mono text-[11.5px] leading-relaxed text-ink-2">
              {trustPolicy}
            </pre>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-3">
              The condition is the load-bearing line. Without it, naming our account alone would
              let any principal inside our account assume your role.
            </p>
          </div>
        </div>
      </Panel>

      {/* The answer to "where did the numbers on the other screens come
          from". Counts read from the live summary, so this table cannot
          disagree with the screens it links to. */}
      <Panel>
        <PanelHeader
          title="How each screen gets its data"
          subtitle="One row per screen: what it shows, the permissions that produce it, and how those permissions become that."
        />
        {summary.isLoading && !summary.data ? (
          <div className="mt-4">
            <DetailSkeleton rows={5} />
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-2.5">
            {DATA_FLOW.map((row) => {
              const count = row.count(summary.data);
              return (
                <li
                  key={row.key}
                  className="rounded-[var(--radius-control)] border border-line bg-surface-2 p-3.5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <Link
                        to={row.to}
                        className="text-[13px] font-semibold text-ink hover:text-brand hover:underline"
                      >
                        {row.label}
                      </Link>
                      <span className="text-[12px] text-ink-3">
                        <strong className="font-semibold text-ink-2" data-numeric="">
                          {Number.isFinite(count) ? formatNumber(count) : '-'}
                        </strong>{' '}
                        {row.unit}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {row.groups.map((key) => (
                        <Tag key={key} tone="neutral" size="sm">
                          {groupLabel(key)}
                        </Tag>
                      ))}
                    </div>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-ink-2">{row.how}</p>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {data.coverage.unconnected.length > 0 && (
        <Panel prominence="quiet">
          <PanelHeader
            prominence="quiet"
            title="Accounts with no role yet"
            subtitle="An account without the role is absent from every figure above, rather than reported as empty."
          />
          <ul className="mt-3 flex flex-col gap-2">
            {data.coverage.unconnected.map((account) => (
              <li
                key={account.id}
                className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-medium/40 bg-medium-soft px-3 py-2"
              >
                <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0 text-medium" />
                <span className="text-[12.5px] font-medium text-ink">{account.name}</span>
                <span className="font-mono text-[11.5px] text-ink-3">{account.id}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}

function SetupValue({ label, value, note }) {
  return (
    <div className="rounded-[var(--radius-control)] border border-line bg-surface-2 px-3 py-2.5">
      <dt className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{label}</dt>
      <dd className="mt-1">
        <CopyableValue value={value} />
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">{note}</p>
      </dd>
    </div>
  );
}

/* ── Tab 2: permissions ──────────────────────────────────────────────────── */

/**
 * The permissions, grouped by what each one makes possible.
 *
 * A toggle per optional group, and next to each toggle the sentence that says
 * what stops working without it. The three required groups carry no toggle at
 * all: a switch that cannot be turned off is worse than no switch, because it
 * invites the reader to try.
 */
function PermissionsTab({ optional, onToggle, selectedKeys }) {
  const policy = useMemo(() => permissionPolicyDocument(selectedKeys), [selectedKeys]);
  const actionCount = useMemo(
    () =>
      new Set(
        AWS_PERMISSION_GROUPS.filter((group) => selectedKeys.includes(group.key)).flatMap(
          (group) => group.actions,
        ),
      ).size,
    [selectedKeys],
  );

  return (
    <>
      <Panel prominence="lead">
        <PanelHeader
          prominence="lead"
          title="What the role is allowed to read"
          subtitle="Every action below is a read. Grouped by capability rather than by service, because the question is not whether this needs EC2 - it is what you lose by declining it."
          actions={
            <Tag tone="neutral" size="sm">
              {formatNumber(actionCount)} actions
            </Tag>
          }
        />

        <ul className="mt-4 flex flex-col gap-3">
          {AWS_PERMISSION_GROUPS.map((group) => {
            const Icon = group.icon;
            const enabled = group.required || optional.includes(group.key);
            return (
              <li
                key={group.key}
                className={cn(
                  'rounded-[var(--radius-control)] border p-3.5 transition-colors',
                  enabled ? 'border-line bg-surface-2' : 'border-line bg-inset',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="flex min-w-0 gap-2.5">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[var(--radius-control)] border border-line bg-surface text-ink-2">
                      <Icon aria-hidden="true" className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] font-semibold text-ink">{group.label}</p>
                        {group.required ? (
                          <Tag tone="critical" size="sm">
                            Required
                          </Tag>
                        ) : (
                          <Tag tone="neutral" size="sm">
                            Optional
                          </Tag>
                        )}
                        <span className="text-[11px] text-ink-3">Feeds {group.feeds}</span>
                      </div>
                      <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{group.why}</p>
                      <p className="mt-1 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-3">
                        <MinusCircle aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                        <span>
                          <span className="font-medium">Without it:</span> {group.without}
                        </span>
                      </p>
                      {group.note && (
                        <p className="mt-1 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-3">
                          <Info aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                          <span>{group.note}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {group.required ? (
                    <span className="shrink-0 text-[11.5px] text-ink-3">Always granted</span>
                  ) : (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      onClick={() => onToggle(group.key)}
                      className={cn(
                        'relative h-6 w-11 shrink-0 rounded-full border transition-colors',
                        enabled ? 'border-brand bg-brand' : 'border-line-strong bg-surface-3',
                      )}
                    >
                      <span className="sr-only">
                        {enabled ? 'Decline' : 'Grant'} {group.label}
                      </span>
                      <span
                        aria-hidden="true"
                        className={cn(
                          'absolute top-0.5 size-4.5 rounded-full bg-surface shadow-sm transition-[left]',
                          enabled ? 'left-[22px]' : 'left-0.5',
                        )}
                      />
                    </button>
                  )}
                </div>

                <details className="mt-2.5">
                  <summary className="cursor-pointer text-[11.5px] font-medium text-ink-2">
                    {formatNumber(group.actions.length)} actions
                  </summary>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {group.actions.map((action) => (
                      <li
                        key={action}
                        className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink-2"
                      >
                        {action}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      </Panel>

      <div className="grid gap-4 @min-[60rem]:grid-cols-2">
        <Panel>
          <PanelHeader
            title="The policy to attach"
            subtitle="Generated from the groups you have kept, so it changes as you change them."
            actions={<CopyButton value={policy} label="Copy the policy" />}
          />
          <pre className="mt-3 max-h-80 overflow-auto rounded-[var(--radius-control)] border border-line bg-inset p-3 font-mono text-[11.5px] leading-relaxed text-ink-2">
            {policy}
          </pre>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel prominence="quiet">
            <PanelHeader
              prominence="quiet"
              title="Or use AWS's own read-only policies"
              subtitle="Two managed policies cover most of the above. Broader than this console uses, and AWS can widen a managed policy without asking you."
            />
            <ul className="mt-3 flex flex-col gap-2">
              {AWS_MANAGED_POLICY_OPTION.policies.map((entry) => (
                <li
                  key={entry.arn}
                  className="rounded-[var(--radius-control)] border border-line bg-surface-2 px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12.5px] font-semibold text-ink">{entry.label}</p>
                    <CopyButton value={entry.arn} label={`Copy the ${entry.label} ARN`} />
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] break-all text-ink-3">{entry.arn}</p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-ink-2">{entry.covers}</p>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-3">
              {AWS_MANAGED_POLICY_OPTION.tradeoff}
            </p>
          </Panel>

          <Panel prominence="quiet">
            <PanelHeader
              prominence="quiet"
              title="The one Deny worth adding"
              subtitle="This console reads which secrets exist and when they rotated, never a value. An explicit Deny costs nothing and removes the worst thing the role could be used for."
              actions={
                <CopyButton value={denySecretValuesDocument()} label="Copy the deny statement" />
              }
            />
            <pre className="mt-3 max-h-56 overflow-auto rounded-[var(--radius-control)] border border-line bg-inset p-3 font-mono text-[11.5px] leading-relaxed text-ink-2">
              {denySecretValuesDocument()}
            </pre>
          </Panel>
        </div>
      </div>
    </>
  );
}

/* ── Tab 3: rules ────────────────────────────────────────────────────────── */

/**
 * Guardrails on the role, three levels deep.
 *
 * Category, rule, then the detail of what to write - because that is how the
 * reasoning nests, and because a flat list of nine rules is a list nobody
 * finishes. Severity is what happens if the rule is skipped, not how hard it
 * is to apply: the two critical ones are each a single condition block.
 */
function RulesTab() {
  const [open, setOpen] = useState(() => AWS_RULE_CATEGORIES[0]?.rules[0]?.key ?? '');

  return (
    <>
      <Panel prominence="lead">
        <PanelHeader
          prominence="lead"
          title="Rules to apply to the role you are granting"
          subtitle="A read-only role is still a role that can read everything, in every account, forever. These are the nine constraints worth putting on it - the first two are not optional in any estate."
        />
      </Panel>

      {AWS_RULE_CATEGORIES.map((category) => (
        <Panel key={category.key} flush className="overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-[13.5px] font-semibold text-ink">{category.label}</h2>
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-3">{category.lede}</p>
          </div>
          <ul className="divide-y divide-line">
            {category.rules.map((rule) => {
              const meta = severityMeta(rule.severity);
              const expanded = open === rule.key;
              return (
                <li key={rule.key}>
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? '' : rule.key)}
                    aria-expanded={expanded}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                  >
                    <ChevronRight
                      aria-hidden="true"
                      className={cn(
                        'size-4 shrink-0 text-ink-3 transition-transform',
                        expanded && 'rotate-90',
                      )}
                    />
                    <span className="min-w-0 flex-1 text-[13px] font-medium text-ink">
                      {rule.label}
                    </span>
                    <Tag tone={meta.tone} size="sm" dot>
                      {meta.label}
                    </Tag>
                  </button>

                  {expanded && (
                    <div className="animate-fade px-4 pb-3.5 pl-11">
                      <p className="text-[12.5px] leading-relaxed text-ink-2">{rule.detail}</p>
                      <div className="mt-2.5 flex flex-col gap-1.5">
                        <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-3">
                          <ShieldCheck aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                          <span>
                            <span className="font-medium">Verified by:</span> {rule.check}
                          </span>
                        </p>
                        {rule.source && (
                          <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-3">
                            <Info aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                            <span>
                              <span className="font-medium">Source:</span> {rule.source}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
      ))}
    </>
  );
}

/* ── Tab 4: health ───────────────────────────────────────────────────────── */

const CHECK_STATE = {
  pass: { label: 'Passing', tone: 'low', icon: CheckCircle2 },
  warn: { label: 'Degraded', tone: 'medium', icon: AlertTriangle },
  fail: { label: 'Failing', tone: 'critical', icon: AlertTriangle },
  unknown: { label: 'Not run', tone: 'neutral', icon: CircleDashed },
};

/**
 * What has actually been verified.
 *
 * In the order the checks can fail, because nothing below the assume-role
 * check can be tested until that one passes - so a failure high up explains
 * every failure under it rather than presenting six unrelated problems. Each
 * failing row carries the fix, not just the fact.
 */
function HealthTab({ health }) {
  const results = health.data?.checks ?? {};
  const failing = AWS_HEALTH_CHECKS.filter(
    (check) => (results[check.key]?.state ?? 'unknown') !== 'pass',
  );

  if (health.isLoading && !health.data) {
    return (
      <Panel prominence="lead">
        <DetailSkeleton rows={6} />
      </Panel>
    );
  }

  if (health.data?.unverified) {
    return (
      <Panel prominence="lead">
        <EmptyState
          icon={CircleDashed}
          title="Nothing has been verified for this platform"
          description="This build only runs checks against the AWS connector. A row of green ticks for a connector nothing has tested would be worse than no rows at all."
        />
      </Panel>
    );
  }

  return (
    <>
      <Panel prominence="lead">
        <PanelHeader
          prominence="lead"
          title={
            failing.length === 0
              ? 'Every check is passing'
              : `${failing.length} of ${AWS_HEALTH_CHECKS.length} checks need attention`
          }
          subtitle={
            health.data?.verifiedAt
              ? `Last verified ${formatRelative(health.data.verifiedAt)}.`
              : undefined
          }
          actions={
            <Button
              variant="secondary"
              onClick={health.refetch}
              loading={health.isRefreshing}
            >
              Re-run checks
            </Button>
          }
        />

        <ul className="mt-4 flex flex-col gap-2.5">
          {AWS_HEALTH_CHECKS.map((check) => {
            const result = results[check.key];
            const state = CHECK_STATE[result?.state ?? 'unknown'];
            const StateIcon = state.icon;
            const ok = result?.state === 'pass';
            return (
              <li
                key={check.key}
                className={cn(
                  'rounded-[var(--radius-control)] border p-3.5',
                  ok ? 'border-line bg-surface-2' : 'border-line-strong bg-surface-2',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink">{check.label}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-ink-3">{check.detail}</p>
                  </div>
                  <Tag tone={state.tone} size="sm" icon={StateIcon}>
                    {state.label}
                  </Tag>
                </div>

                {result?.note && (
                  <p className="mt-2 text-[12px] leading-relaxed text-ink-2">{result.note}</p>
                )}

                {!ok && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-3">
                    <ArrowRight aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                    <span>
                      <span className="font-medium">To fix:</span> {check.fix}
                    </span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}

export default AwsSetup;

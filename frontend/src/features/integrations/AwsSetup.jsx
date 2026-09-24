import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Download,
  History,
  Info,
  MinusCircle,
  Play,
  Plug,
  Plus,
  RotateCw,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useAccess } from '../../app/useAccess';
import {
  fetchIntegrationHealth,
  fetchSummary,
  removeAwsAccount,
  runDiscoveryNow,
  runHealthChecks,
  setTemplateGroup,
} from '../../lib/api/endpoints';
import { downloadText } from '../../lib/csv';
import { useDemoQuery } from '../../lib/demo/useDemoQuery';
import { useQuery } from '../../lib/hooks';
import { severityMeta } from '../../lib/domain';
import { formatDateTime, formatNumber, formatRelative } from '../../lib/format';
import { PageHeader } from '../../shell/PageHeader';
import { Button } from '../../ui/Button';
import { CopyButton, CopyableValue } from '../../ui/Copyable';
import { Modal } from '../../ui/Overlay';
import { Panel, PanelHeader, SectionLabel } from '../../ui/Panel';
import { DetailSkeleton } from '../../ui/Skeleton';
import { EmptyState } from '../../ui/States';
import { SearchInput } from '../../ui/Field';
import { Tabs } from '../../ui/Tabs';
import { Tag } from '../../ui/Tag';
import { useToast } from '../../ui/Toast';
import { cn } from '../../ui/cn';
import {
  AWS_CHECK_FIXES,
  AWS_HEALTH_CHECKS,
  AWS_MANAGED_POLICY_OPTION,
  AWS_PERMISSION_GROUPS,
  AWS_RULE_CATEGORIES,
  DEPLOY_FORMATS,
  ROLE_NAME,
  denySecretValuesDocument,
  permissionPolicyDocument,
  stackSetCommands,
  trustPolicyDocument,
} from './catalog';
import { ConnectAccountDrawer } from './ConnectAccountDrawer';

/* Four tabs: the two that are about doing something - which accounts are
   covered, and what is failing - then what changed, then everything that is
   reference. The reference used to be four tabs of its own; it is one page
   with a section index now, so the tabs are the tasks. */
const TABS = [
  { value: 'accounts', label: 'Accounts' },
  { value: 'health', label: 'Health' },
  { value: 'activity', label: 'Activity' },
  { value: 'reference', label: 'Setup reference' },
];

/* Links written before the merge still land where they meant to. */
const LEGACY_TABS = {
  configured: 'ref-collection',
  deploy: 'ref-deploy',
  permissions: 'ref-permissions',
  rules: 'ref-rules',
};

const REFERENCE_SECTIONS = [
  { id: 'ref-deploy', label: 'Deploy across the organisation' },
  { id: 'ref-collection', label: 'How data is collected' },
  { id: 'ref-permissions', label: 'Permissions' },
  { id: 'ref-rules', label: 'Rules' },
];

/**
 * The AWS connector, configured.
 *
 * Opens on coverage - which accounts are read, how recently, and whether each
 * one's checks pass - because that is what anyone arriving here wants to
 * know first. Health says what is failing and hands over the fix to run.
 * Activity is the connector's change log. Everything that explains the setup
 * (the role, the trust policy, every permission, the guardrails) is one
 * reference page behind those.
 */
export function AwsSetup({ data, onBack, onChanged }) {
  const { lock } = useAccess();
  const { notify } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const legacySection = LEGACY_TABS[rawTab] ?? null;
  const tab = legacySection ? 'reference' : TABS.some((entry) => entry.value === rawTab) ? rawTab : 'accounts';
  const setTab = (value, section = null) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'accounts') next.delete('tab');
    else next.set('tab', value);
    if (section) next.set('section', section);
    else next.delete('section');
    setSearchParams(next, { replace: true });
  };
  const section = legacySection ?? searchParams.get('section');

  /* The wizard is mounted only while open; `preset` is the account it was
     opened for, or null for one typed in. */
  const [connecting, setConnecting] = useState(null);
  const [pendingGroup, setPendingGroup] = useState('');

  const summary = useQuery((signal) => fetchSummary({}, signal), []);
  const health = useDemoQuery((signal) => fetchIntegrationHealth('aws', signal), []);

  const declined = useMemo(() => new Set(data.template?.declined ?? []), [data.template]);
  const selectedKeys = useMemo(
    () => AWS_PERMISSION_GROUPS.filter((group) => group.required || !declined.has(group.key)).map((group) => group.key),
    [declined],
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
  const roleArn = `arn:aws:iam::<your-account-id>:role/${ROLE_NAME}`;

  const partial = data.coverage.accountsConnected < data.coverage.accountsTotal;
  const checks = health.data?.checks ?? {};
  const passing = AWS_HEALTH_CHECKS.filter((check) => checks[check.key]?.state === 'pass').length;

  const toggleGroup = async (group, keep) => {
    setPendingGroup(group.key);
    try {
      await setTemplateGroup({ key: group.key, declined: !keep, label: group.label.toLowerCase() });
      onChanged?.();
    } catch (error) {
      notify({ variant: 'error', title: 'Template not changed', description: error?.message });
    } finally {
      setPendingGroup('');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configure Amazon Web Services"
        lede="Which accounts are read, whether the checks pass, and the role that makes it possible."
        actions={
          <>
            <Button variant="secondary" icon={ArrowLeft} onClick={onBack}>
              All integrations
            </Button>
            <Button
              variant="primary"
              icon={Plus}
              locked={lock('integrations.manage')}
              onClick={() => setConnecting({ preset: null })}
            >
              Connect an account
            </Button>
          </>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            {/* The same words as the row on the integrations list, so the two
                screens never describe one connector two ways. */}
            {partial ? (
              <Tag tone="medium" size="sm" icon={AlertTriangle}>
                Partial coverage
              </Tag>
            ) : (
              <Tag tone="low" size="sm" icon={CheckCircle2}>
                Collecting
              </Tag>
            )}
            <Tag tone="neutral" size="sm">
              {formatNumber(data.coverage.accountsConnected)} of {formatNumber(data.coverage.accountsTotal)} accounts
            </Tag>
            <Tag tone="neutral" size="sm">
              {data.tenant.regions.length} regions
            </Tag>
          </div>
        }
        tabs={<Tabs size="sm" value={tab} onChange={(value) => setTab(value)} tabs={TABS} />}
      />

      <SetupProgress
        steps={[
          {
            key: 'deploy',
            label: 'Role deployed',
            value: `${formatNumber(data.coverage.accountsConnected)} of ${formatNumber(data.coverage.accountsTotal)} accounts`,
            state: partial ? 'warn' : 'pass',
            open: () => setTab('accounts'),
          },
          {
            key: 'permissions',
            label: 'Permissions in the template',
            value: `${formatNumber(selectedKeys.length)} of ${formatNumber(AWS_PERMISSION_GROUPS.length)} groups`,
            state: selectedKeys.length === AWS_PERMISSION_GROUPS.length ? 'pass' : 'warn',
            open: () => setTab('reference', 'ref-permissions'),
          },
          {
            key: 'verified',
            label: 'Verified',
            value: health.data ? `${formatNumber(passing)} of ${formatNumber(AWS_HEALTH_CHECKS.length)} checks passing` : 'Checking…',
            state: !health.data
              ? 'unknown'
              : AWS_HEALTH_CHECKS.some((check) => checks[check.key]?.state === 'fail')
                ? 'fail'
                : passing === AWS_HEALTH_CHECKS.length
                  ? 'pass'
                  : 'warn',
            open: () => setTab('health'),
          },
        ]}
      />

      {tab === 'accounts' && (
        <>
          <DiscoveryPanel discovery={data.discovery} onChanged={onChanged} />
          <AccountsTab data={data} onConnect={(account) => setConnecting({ preset: account })} onChanged={onChanged} />
        </>
      )}

      {tab === 'health' && (
        <HealthTab
          health={health}
          accounts={data.accounts ?? []}
          onConnect={(account) => setConnecting({ preset: account })}
          onRerun={() => {
            health.refetch();
            onChanged?.();
          }}
        />
      )}

      {tab === 'activity' && <ActivityTab history={data.history ?? []} />}

      {tab === 'reference' && (
        <ReferenceTab section={section}>
          <section id="ref-deploy" className="scroll-mt-24">
            <OrgDeploySection
              data={data}
              selectedKeys={selectedKeys}
              onConnectOne={() => setConnecting({ preset: null })}
            />
          </section>
          <section id="ref-collection" className="flex scroll-mt-24 flex-col gap-4">
            <CollectionSection data={data} summary={summary} trustPolicy={trustPolicy} roleArn={roleArn} />
          </section>
          <section id="ref-permissions" className="flex scroll-mt-24 flex-col gap-4">
            <PermissionsSection selectedKeys={selectedKeys} onToggle={toggleGroup} pendingKey={pendingGroup} />
          </section>
          <section id="ref-rules" className="flex scroll-mt-24 flex-col gap-4">
            <RulesSection />
          </section>
        </ReferenceTab>
      )}

      {connecting && (
        <ConnectAccountDrawer
          data={data}
          selectedKeys={selectedKeys}
          preset={connecting.preset}
          onClose={() => setConnecting(null)}
          onConnected={() => {
            onChanged?.();
            health.refetch();
            summary.refetch();
          }}
        />
      )}
    </div>
  );
}

/* ── Setup progress ──────────────────────────────────────────────────────── */

const STEP_STATE = {
  pass: { tone: 'low', icon: CheckCircle2, label: 'Done' },
  warn: { tone: 'medium', icon: AlertTriangle, label: 'Incomplete' },
  fail: { tone: 'critical', icon: AlertTriangle, label: 'Failing' },
  unknown: { tone: 'neutral', icon: CircleDashed, label: 'Checking' },
};

/**
 * Three steps, each one a button to the tab that fixes it.
 *
 * Setting up a cross-account role is deploy, grant, verify - in that order,
 * and each depends on the one before. Showing all three at the top answers
 * "is this finished" before the reader has picked a tab, and a step that is
 * not done takes them straight to where it gets done.
 */
function SetupProgress({ steps }) {
  return (
    <ol className="grid gap-2 @min-[48rem]:grid-cols-3">
      {steps.map((step, index) => {
        const meta = STEP_STATE[step.state] ?? STEP_STATE.unknown;
        const Icon = meta.icon;
        return (
          <li key={step.key}>
            <button
              type="button"
              onClick={step.open}
              className="flex w-full items-center gap-3 rounded-[var(--radius-panel)] border border-line bg-surface px-3.5 py-3 text-left transition-colors hover:border-line-strong"
            >
              <span
                aria-hidden="true"
                className="grid size-7 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-[12px] font-semibold text-ink-2"
                data-numeric=""
              >
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold text-ink">{step.label}</span>
                <span className="block truncate text-[11.5px] text-ink-3">{step.value}</span>
              </span>
              <Tag tone={meta.tone} size="sm" icon={Icon}>
                {meta.label}
              </Tag>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* ── Discovery ────────────────────────────────────────────────────────────── */

/**
 * When the estate was last read and when it will be next, with the one
 * control that matters when the answer is "too long ago": run it now.
 */
function DiscoveryPanel({ discovery, onChanged }) {
  const { lock } = useAccess();
  const { notify } = useToast();
  const [starting, setStarting] = useState(false);
  const running = discovery?.running;

  /* While a run is going, refresh on the second it should finish, rather than
     polling. The demo store also announces the finish, so this is a floor. */
  useEffect(() => {
    if (!running) return undefined;
    const remaining = Math.max(500, 6_300 - (Date.now() - Date.parse(running.startedAt)));
    const timer = setTimeout(() => onChanged?.(), remaining);
    return () => clearTimeout(timer);
  }, [running, onChanged]);

  if (!discovery) return null;

  return (
    <Panel prominence="quiet">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-2 @min-[46rem]:grid-cols-4">
          <div className="min-w-0">
            <dt className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Schedule</dt>
            <dd className="mt-0.5 text-[13px] font-medium text-ink">Every {discovery.intervalHours} hours</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Last run</dt>
            <dd className="mt-0.5 text-[13px] font-medium text-ink" title={formatDateTime(discovery.lastRunAt)}>
              {running ? (running.by === 'Schedule' ? 'Scheduled run in progress' : 'Running now') : formatRelative(discovery.lastRunAt)}
              {!running && (
                <span className="block text-[11.5px] font-normal text-ink-3">
                  {discovery.lastRunTrigger === 'manual' ? `Started by ${discovery.lastRunBy}` : 'Scheduled'}
                </span>
              )}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Next run</dt>
            <dd className="mt-0.5 text-[13px] font-medium text-ink" title={formatDateTime(discovery.nextRunAt)}>
              {formatRelative(discovery.nextRunAt)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Last result</dt>
            <dd className="mt-0.5 text-[13px] font-medium text-ink">
              {formatNumber(discovery.totals.identities)} identities
              <span className="block text-[11.5px] font-normal text-ink-3">
                {formatNumber(discovery.totals.credentials)} credentials, {formatNumber(discovery.totals.accounts)} accounts
              </span>
            </dd>
          </div>
        </dl>
        <Button
          variant="secondary"
          icon={Play}
          loading={starting || Boolean(running)}
          disabled={Boolean(running)}
          locked={running ? undefined : lock('integrations.operate')}
          onClick={async () => {
            setStarting(true);
            try {
              await runDiscoveryNow();
              notify({ variant: 'info', title: 'Discovery started', description: 'Every connected account is read again. This takes a few seconds here.' });
              onChanged?.();
            } catch (error) {
              notify({ variant: 'error', title: 'Discovery not started', description: error?.message });
            } finally {
              setStarting(false);
            }
          }}
        >
          {running ? 'Discovery running…' : 'Run discovery now'}
        </Button>
      </div>
    </Panel>
  );
}

/* ── Accounts ─────────────────────────────────────────────────────────────── */

const ACCOUNT_STATE = {
  collecting: { label: 'Collecting', tone: 'low', icon: CheckCircle2 },
  pending: { label: 'Awaiting first discovery', tone: 'info', icon: CircleDashed },
  missing: { label: 'No role deployed', tone: 'medium', icon: AlertTriangle },
};

const ACCOUNT_CHECK_KEYS = ['assume', 'external-id', 'iam-read', 'events'];

function accountHealth(account) {
  if (!account.checks) return null;
  const results = ACCOUNT_CHECK_KEYS.map((key) => account.checks[key]?.state ?? 'unknown');
  return {
    passing: results.filter((state) => state === 'pass').length,
    failing: results.filter((state) => state === 'fail').length,
    total: results.length,
  };
}

/**
 * Coverage, one account per row.
 *
 * Counts link to the Identities and Credentials screens searched by account
 * id, so every number can be checked in one click. An account with no role
 * says so and offers the fix instead of a zero. Only an account connected
 * from this console can be removed here: one with discovered data needs the
 * backend to delete its records, and pretending otherwise would leave its
 * identities on every other screen.
 */
function AccountsTab({ data, onConnect, onChanged }) {
  const { lock } = useAccess();
  const { notify } = useToast();
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const accounts = data.accounts ?? [];
  const order = { missing: 0, pending: 1, collecting: 2 };
  const rows = [...accounts].sort(
    (a, b) => order[a.state] - order[b.state] || b.identities - a.identities || a.name.localeCompare(b.name),
  );

  return (
    <Panel flush className="overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-[13.5px] font-semibold text-ink">Accounts in your organisation</h2>
        <p className="mt-0.5 text-[12px] leading-relaxed text-ink-3">
          {formatNumber(data.coverage.accountsConnected)} of {formatNumber(data.coverage.accountsTotal)} have the
          discovery role. An account without it is absent from every screen, not reported as empty.
        </p>
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[52rem] text-left">
          <caption className="sr-only">AWS accounts and what is collected from each</caption>
          <thead>
            <tr className="border-b border-line bg-surface-2 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
              <th scope="col" className="px-4 py-2.5">Account</th>
              <th scope="col" className="px-3 py-2.5">State</th>
              <th scope="col" className="px-3 py-2.5">Checks</th>
              <th scope="col" className="px-3 py-2.5 text-right">Identities</th>
              <th scope="col" className="px-3 py-2.5 text-right">Credentials</th>
              <th scope="col" className="px-3 py-2.5 text-right">Regions</th>
              <th scope="col" className="px-4 py-2.5 text-right">Last read</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((account) => {
              const meta = ACCOUNT_STATE[account.state] ?? ACCOUNT_STATE.missing;
              const collecting = account.state === 'collecting';
              const healthState = accountHealth(account);
              return (
                <tr key={account.id} className="align-middle">
                  <td className="px-4 py-3">
                    <span className="block text-[13px] font-semibold text-ink">{account.name}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-[11.5px] text-ink-3">
                      <span className="font-mono">{account.id}</span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{account.env}</span>
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <Tag tone={meta.tone} size="sm" icon={meta.icon}>
                      {meta.label}
                    </Tag>
                    {account.connectedAt && (
                      <span className="mt-1 block text-[11px] text-ink-3">
                        Connected {formatRelative(account.connectedAt)}
                        {account.connectedBy ? ` by ${account.connectedBy}` : ''}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-[12px]">
                    {!healthState ? (
                      <span className="text-ink-3">Cannot run</span>
                    ) : healthState.failing > 0 ? (
                      <Tag tone="critical" size="sm" icon={AlertTriangle}>
                        {healthState.failing} failing
                      </Tag>
                    ) : healthState.passing === healthState.total ? (
                      <Tag tone="low" size="sm" icon={CheckCircle2}>
                        {healthState.passing} of {healthState.total} passing
                      </Tag>
                    ) : (
                      <Tag tone="neutral" size="sm" icon={CircleDashed}>
                        {healthState.passing} of {healthState.total} run
                      </Tag>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-[13px]" data-numeric="">
                    {collecting && account.identities > 0 ? (
                      <Link
                        to={`/identities?search=${account.id}`}
                        className="font-semibold text-ink hover:text-brand hover:underline"
                        aria-label={`${formatNumber(account.identities)} identities in ${account.name}`}
                      >
                        {formatNumber(account.identities)}
                      </Link>
                    ) : collecting ? (
                      <span className="text-ink-2">0</span>
                    ) : (
                      <span className="text-ink-3">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-[13px]" data-numeric="">
                    {collecting && account.credentials > 0 ? (
                      <Link
                        to={`/credentials?search=${account.id}`}
                        className="font-semibold text-ink hover:text-brand hover:underline"
                        aria-label={`${formatNumber(account.credentials)} credentials in ${account.name}`}
                      >
                        {formatNumber(account.credentials)}
                      </Link>
                    ) : collecting ? (
                      <span className="text-ink-2">0</span>
                    ) : (
                      <span className="text-ink-3">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-[13px] text-ink-2" data-numeric="">
                    {collecting ? formatNumber(account.regions) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-[12px] text-ink-3">
                    <span className="inline-flex flex-wrap items-center justify-end gap-2">
                      {account.state === 'missing' ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Plus}
                          locked={lock('integrations.manage')}
                          onClick={() => onConnect(account)}
                        >
                          Connect
                        </Button>
                      ) : account.lastReadAt ? (
                        <span title={formatDateTime(account.lastReadAt)}>{formatRelative(account.lastReadAt)}</span>
                      ) : (
                        'Not yet'
                      )}
                      {account.removable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          aria-label={`Remove ${account.name}`}
                          title={`Remove ${account.name}`}
                          locked={lock('integrations.manage')}
                          onClick={() => setRemoving(account)}
                        >
                          Remove
                        </Button>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={Boolean(removing)}
        onClose={() => (busy ? null : setRemoving(null))}
        title={`Remove ${removing?.name ?? ''}?`}
        description={`The console stops reading ${removing?.id ?? 'this account'}. The ${ROLE_NAME} role stays in the account until you delete it there - do that to revoke access completely.`}
        icon={Trash2}
        tone="critical"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const row = await removeAwsAccount(removing.id);
                  notify({ variant: 'success', title: `${row.name} removed`, description: 'It is no longer read, and it is back in the uncovered list if it is part of your organisation.' });
                  setRemoving(null);
                  onChanged?.();
                } catch (error) {
                  notify({ variant: 'error', title: 'Not removed', description: error?.message });
                } finally {
                  setBusy(false);
                }
              }}
            >
              Remove account
            </Button>
          </>
        }
      />
    </Panel>
  );
}

/* ── Reference: deploy across the organisation ───────────────────────────── */

/**
 * The organisation-wide deployment. Connecting one account at a time is the
 * wizard's job; this is the StackSet path, which also covers accounts created
 * later. The template is the same one the wizard hands out.
 */
function OrgDeploySection({ data, selectedKeys, onConnectOne }) {
  const { lock } = useAccess();
  const cloudFormation = DEPLOY_FORMATS.find((entry) => entry.value === 'cloudformation');
  const template = useMemo(
    () =>
      cloudFormation.build({
        consoleAccountId: data.tenant.consoleAccountId,
        externalId: data.tenant.externalId,
        selectedKeys,
      }),
    [cloudFormation, data.tenant, selectedKeys],
  );
  const declined = AWS_PERMISSION_GROUPS.filter((group) => !selectedKeys.includes(group.key));

  return (
    <Panel prominence="lead">
      <PanelHeader
        prominence="lead"
        title="Deploy across the organisation"
        subtitle="A service-managed StackSet puts the role in every account under the OUs you target, and in accounts created there later. For one account, use Connect an account instead - it hands out the same template and verifies the result."
      />
      {/* A row of its own rather than header actions: two buttons beside the
          title pushed a phone-width page sideways. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={Download}
          onClick={() => downloadText(template, cloudFormation.filename, cloudFormation.type)}
        >
          {cloudFormation.filename}
        </Button>
        <Button variant="ghost" size="sm" icon={Plus} locked={lock('integrations.manage')} onClick={onConnectOne}>
          Connect one account
        </Button>
      </div>
      {declined.length > 0 && (
        <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-3">
          <Info aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          <span>
            The template leaves out {declined.map((group) => group.label.toLowerCase()).join(', ')}, switched off under
            Permissions below.
          </span>
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <SectionLabel>StackSet commands</SectionLabel>
        <CopyButton value={stackSetCommands()} label="Copy the StackSet commands" />
      </div>
      <pre className="mt-1.5 max-h-72 overflow-auto rounded-[var(--radius-control)] border border-line bg-inset p-3 font-mono text-[11.5px] leading-relaxed text-ink-2">
        {stackSetCommands()}
      </pre>
    </Panel>
  );
}

/* ── Reference: how data is collected ─────────────────────────────────── */

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
    how: 'CloudTrail management events, per principal: the 90 days of event history CloudTrail keeps in every region, or longer where an organisation trail is retained. Past that window an idle identity reads as unknown, not as unused.',
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

function CollectionSection({ data, summary, trustPolicy, roleArn }) {
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
        {/* `min-w-0` on both columns: a grid item's minimum width is its
            content by default, and an ARN or an external id is one unbreakable
            word - so on a phone the column grew to fit it and pushed the page
            170px wider than the screen. */}
        <div className="mt-4 grid gap-3 @min-[52rem]:grid-cols-2">
          <dl className="flex min-w-0 flex-col gap-2.5">
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

          <div className="min-w-0">
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
    <div className="min-w-0 rounded-[var(--radius-control)] border border-line bg-surface-2 px-3 py-2.5">
      <dt className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{label}</dt>
      <dd className="mt-1">
        <CopyableValue value={value} />
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">{note}</p>
      </dd>
    </div>
  );
}

/* ── Reference: permissions ──────────────────────────────────────────────── */

/**
 * The permissions, grouped by what each one makes possible.
 *
 * A toggle per optional group, and next to each toggle the sentence that says
 * what stops working without it. The three required groups carry no toggle at
 * all: a switch that cannot be turned off is worse than no switch, because it
 * invites the reader to try.
 */
function PermissionsSection({ onToggle, selectedKeys, pendingKey }) {
  const { can, lock } = useAccess();
  const manage = can('integrations.manage');
  /* Ninety-odd actions is a reference, not a read. The search answers the
     question people actually arrive with - "does this role get X" - across
     action names and the reasons given for them. */
  const [search, setSearch] = useState('');
  const needle = search.trim().toLowerCase();
  const visibleGroups = useMemo(
    () =>
      AWS_PERMISSION_GROUPS.map((group) => {
        if (!needle) return { group, actions: group.actions, groupMatch: true };
        const groupMatch = [group.label, group.why, group.without, group.feeds]
          .filter(Boolean)
          .some((text) => text.toLowerCase().includes(needle));
        const actions = group.actions.filter((action) => action.toLowerCase().includes(needle));
        return { group, actions: groupMatch ? group.actions : actions, groupMatch, actionMatches: actions.length };
      }).filter((entry) => entry.groupMatch || entry.actions.length > 0),
    [needle],
  );
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
          subtitle="Every action below is a read. Switching a group off changes the template and the policy generated below; the role already deployed keeps what it was granted until the template is deployed again."
          actions={
            <Tag tone="neutral" size="sm">
              {formatNumber(actionCount)} actions
            </Tag>
          }
        />

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search actions, e.g. GetSecretValue or cloudtrail"
            size="sm"
            className="w-full sm:w-80"
            aria-label="Search permissions"
          />
          {needle && (
            <span className="text-[12px] text-ink-3" role="status">
              {visibleGroups.length === 0
                ? 'No permission matches. The role is not granted it.'
                : `${formatNumber(visibleGroups.reduce((sum, entry) => sum + (entry.actionMatches ?? 0), 0))} matching actions in ${formatNumber(visibleGroups.length)} group${visibleGroups.length === 1 ? '' : 's'}`}
            </span>
          )}
          {!manage && (
            <span className="text-[12px] text-ink-3">Read-only for your role. {lock('integrations.manage')}</span>
          )}
        </div>

        {needle && visibleGroups.length === 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-[var(--radius-control)] border border-line bg-surface-2 px-3.5 py-3">
            <Search aria-hidden="true" className="mt-px size-4 shrink-0 text-ink-3" />
            <p className="text-[12.5px] leading-relaxed text-ink-2">
              Nothing in the role mentions <span className="font-mono">{search.trim()}</span>. If it
              is a write or a secret read, that is by design: the role only reads metadata, and the
              Deny below blocks secret values outright.
            </p>
          </div>
        )}

        <ul className="mt-4 flex flex-col gap-3">
          {visibleGroups.map(({ group, actions, actionMatches }) => {
            const Icon = group.icon;
            const enabled = group.required || selectedKeys.includes(group.key);
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
                      aria-disabled={!manage || undefined}
                      title={manage ? undefined : lock('integrations.manage')}
                      disabled={pendingKey === group.key}
                      onClick={() => manage && onToggle(group, !enabled)}
                      className={cn(
                        'relative h-6 w-11 shrink-0 rounded-full border transition-colors',
                        enabled ? 'border-brand bg-brand' : 'border-line-strong bg-surface-3',
                        !manage && 'cursor-not-allowed opacity-55',
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

                {/* Keyed on the search so a search opens the list it matched in,
                    and clearing it folds them back. */}
                <details key={needle ? `open-${needle}` : 'closed'} className="mt-2.5" open={Boolean(needle && actionMatches)}>
                  <summary className="cursor-pointer text-[11.5px] font-medium text-ink-2">
                    {needle && actionMatches
                      ? `${formatNumber(actionMatches)} of ${formatNumber(group.actions.length)} actions match`
                      : `${formatNumber(group.actions.length)} actions`}
                  </summary>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {actions.map((action) => {
                      const hit = needle && action.toLowerCase().includes(needle);
                      return (
                        <li
                          key={action}
                          className={cn(
                            'rounded-md border px-1.5 py-0.5 font-mono text-[11px]',
                            hit ? 'border-brand/40 bg-info-soft text-ink' : 'border-line bg-surface text-ink-2',
                          )}
                        >
                          {action}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      </Panel>

      <div className="grid gap-4 @min-[60rem]:grid-cols-2">
        <Panel className="min-w-0">
          <PanelHeader
            title="The policy to attach"
            subtitle="Generated from the groups you have kept, so it changes as you change them."
            actions={<CopyButton value={policy} label="Copy the policy" />}
          />
          <pre className="mt-3 max-h-80 overflow-auto rounded-[var(--radius-control)] border border-line bg-inset p-3 font-mono text-[11.5px] leading-relaxed text-ink-2">
            {policy}
          </pre>
        </Panel>

        <div className="flex min-w-0 flex-col gap-4">
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

/* ── Reference: rules ────────────────────────────────────────────────────── */

/**
 * Guardrails on the role, three levels deep.
 *
 * Category, rule, then the detail of what to write - because that is how the
 * reasoning nests, and because a flat list of nine rules is a list nobody
 * finishes. Severity is what happens if the rule is skipped, not how hard it
 * is to apply: the two critical ones are each a single condition block.
 */
function RulesSection() {
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

/* ── Reference ────────────────────────────────────────────────────────────── */

/**
 * Everything that explains the setup, on one page with an index. Arriving
 * with a section (an old tab link, or a progress step) scrolls to it.
 */
function ReferenceTab({ section, children }) {
  useEffect(() => {
    if (!section) return undefined;
    const frame = requestAnimationFrame(() =>
      document.getElementById(section)?.scrollIntoView({ block: 'start' }),
    );
    return () => cancelAnimationFrame(frame);
  }, [section]);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Setup reference sections" className="flex flex-wrap gap-2">
        {REFERENCE_SECTIONS.map((entry, index) => (
          <a
            key={entry.id}
            href={`#${entry.id}`}
            onClick={(event) => {
              event.preventDefault();
              document.getElementById(entry.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="rounded-full border border-line bg-surface px-3 py-1 text-[12px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
          >
            {index + 1}. {entry.label}
          </a>
        ))}
      </nav>
      {children}
    </div>
  );
}

/* ── Activity ─────────────────────────────────────────────────────────────── */

const HISTORY_ICON = {
  deployed: Plug,
  connected: Plus,
  removed: Trash2,
  settings: Settings2,
  verified: ShieldCheck,
  discovery: RotateCw,
};

/** The connector's change log: who connected, removed, changed or re-checked what. */
function ActivityTab({ history }) {
  return (
    <Panel>
      <PanelHeader
        title="Connector activity"
        subtitle="Accounts connected and removed, template changes, check runs and manual discovery runs, newest first. Scheduled daily runs are not listed one by one."
      />
      {history.length === 0 ? (
        <EmptyState icon={History} title="No changes recorded" description="Connecting an account, changing the template or re-running checks is recorded here." />
      ) : (
        <ol className="mt-4 flex flex-col divide-y divide-line">
          {history.map((entry, index) => {
            const Icon = HISTORY_ICON[entry.kind] ?? History;
            return (
              <li key={`${entry.at}-${index}`} className="flex items-start gap-3 py-3">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-ink-2">
                  <Icon aria-hidden="true" className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] leading-relaxed text-ink-2">
                    <span className="font-medium text-ink">{entry.actor}</span> - {entry.text}
                  </span>
                  <span className="block text-[11.5px] text-ink-3" title={formatDateTime(entry.at)}>
                    {formatRelative(entry.at)}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

/* ── Health ───────────────────────────────────────────────────────────────── */

const CHECK_STATE = {
  pass: { label: 'Passing', tone: 'low', icon: CheckCircle2 },
  warn: { label: 'Degraded', tone: 'medium', icon: AlertTriangle },
  fail: { label: 'Failing', tone: 'critical', icon: AlertTriangle },
  unknown: { label: 'Not run', tone: 'neutral', icon: CircleDashed },
};

const ACCOUNT_CHECK_LABELS = {
  assume: 'Assume role',
  'external-id': 'External id',
  'iam-read': 'IAM read',
  events: 'CloudTrail events',
};

/**
 * What has been verified, and what to run when it has not.
 *
 * Organisation checks first, in the order they can fail, each failing one
 * with its fix to copy. Then the account checks, one row per account, so a
 * failure says which account it is in.
 */
function HealthTab({ health, accounts, onConnect, onRerun }) {
  const { lock } = useAccess();
  const { notify } = useToast();
  const [running, setRunning] = useState(false);
  const results = health.data?.checks ?? {};
  const failing = AWS_HEALTH_CHECKS.filter((check) => (results[check.key]?.state ?? 'unknown') !== 'pass');
  const missing = accounts.filter((account) => account.state === 'missing');
  const covered = accounts.filter((account) => account.state !== 'missing');

  if (health.isLoading && !health.data) {
    return (
      <Panel prominence="lead">
        <DetailSkeleton rows={6} />
      </Panel>
    );
  }

  const rerun = async () => {
    setRunning(true);
    try {
      const result = await runHealthChecks();
      const bad = Object.values(result.checks).filter((entry) => entry.state !== 'pass').length;
      notify({
        variant: bad === 0 ? 'success' : 'info',
        title: bad === 0 ? 'Every check is passing' : `${bad} check${bad === 1 ? '' : 's'} still need attention`,
        description: `Verified ${formatDateTime(result.verifiedAt)}.`,
      });
      onRerun?.();
    } catch (error) {
      notify({ variant: 'error', title: 'Checks did not run', description: error?.message });
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <Panel prominence="lead">
        <PanelHeader
          prominence="lead"
          title={failing.length === 0 ? 'Every check is passing' : `${failing.length} of ${AWS_HEALTH_CHECKS.length} checks need attention`}
          subtitle={health.data?.verifiedAt ? `Last verified ${formatRelative(health.data.verifiedAt)}.` : undefined}
          actions={
            <Button variant="secondary" icon={RotateCw} onClick={rerun} loading={running} locked={lock('integrations.operate')}>
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
            const fix = !ok ? AWS_CHECK_FIXES[check.key] : null;
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
                    <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink">
                      {check.label}
                      <span className="text-[11px] font-normal text-ink-3">
                        {check.scope === 'account' ? `Every account` : 'Organisation'}
                      </span>
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-ink-3">{check.detail}</p>
                  </div>
                  <Tag tone={state.tone} size="sm" icon={StateIcon}>
                    {state.label}
                  </Tag>
                </div>

                {result?.note && <p className="mt-2 text-[12px] leading-relaxed text-ink-2">{result.note}</p>}

                {!ok && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-3">
                    <ArrowRight aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                    <span>
                      <span className="font-medium">To fix:</span> {check.fix}
                    </span>
                  </p>
                )}

                {fix && (
                  <div className="mt-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11.5px] text-ink-3">{fix.where}</p>
                      <span className="flex items-center gap-1.5">
                        <CopyButton value={fix.code} label={`Copy the fix for ${check.label.toLowerCase()}`} />
                        <Button variant="ghost" size="sm" icon={Download} onClick={() => downloadText(fix.code, fix.filename)}>
                          {fix.filename}
                        </Button>
                      </span>
                    </div>
                    <pre className="mt-1.5 max-h-60 overflow-auto rounded-[var(--radius-control)] border border-line bg-inset p-3 font-mono text-[11px] leading-relaxed text-ink-2">
                      {fix.code}
                    </pre>
                  </div>
                )}

                {check.key === 'accounts' && !ok && missing.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {missing.map((account) => (
                      <Button
                        key={account.id}
                        variant="secondary"
                        size="sm"
                        icon={Plus}
                        locked={lock('integrations.manage')}
                        onClick={() => onConnect(account)}
                      >
                        Connect {account.name}
                      </Button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel flush className="overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-[13.5px] font-semibold text-ink">Per account</h2>
          <p className="mt-0.5 text-[12px] text-ink-3">
            The checks that run inside each account, so a failure names the account it is in.
          </p>
        </div>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left">
            <caption className="sr-only">Connector checks per account</caption>
            <thead>
              <tr className="border-b border-line bg-surface-2 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
                <th scope="col" className="px-4 py-2.5">Account</th>
                {Object.values(ACCOUNT_CHECK_LABELS).map((label) => (
                  <th key={label} scope="col" className="px-3 py-2.5">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...covered, ...missing].map((account) => (
                <tr key={account.id}>
                  <td className="px-4 py-2.5">
                    <span className="block text-[12.5px] font-semibold text-ink">{account.name}</span>
                    <span className="block font-mono text-[11px] text-ink-3">{account.id}</span>
                  </td>
                  {Object.keys(ACCOUNT_CHECK_LABELS).map((key) => {
                    const result = account.checks?.[key];
                    if (!result) {
                      return (
                        <td key={key} className="px-3 py-2.5 text-[12px] text-ink-3">
                          No role
                        </td>
                      );
                    }
                    const meta = CHECK_STATE[result.state] ?? CHECK_STATE.unknown;
                    return (
                      <td key={key} className="px-3 py-2.5" title={result.note}>
                        <Tag tone={meta.tone} size="sm" icon={meta.icon}>
                          {meta.label}
                        </Tag>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

export default AwsSetup;

import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowLeftRight,
  Info,
  KeyRound,
  Wrench,
} from 'lucide-react';
import { fetchEvents, fetchLineage } from '../../lib/api/endpoints';
import { useQuery } from '../../lib/hooks';
import { useScanContext } from '../../app/ScanContext';
import {
  actorTypeMeta,
  classificationMeta,
  credentialKindMeta,
  ownerTypeMeta,
  severityMeta,
} from '../../lib/domain';
import {
  formatDateTime,
  formatNumber,
  formatRelative,
  titleCaseEnum,
} from '../../lib/format';
import { TabPanel } from '../../ui/Tabs';
import { DetailList, DetailRow, SectionLabel } from '../../ui/Panel';
import { Code, Tag } from '../../ui/Tag';
import { CopyableValue } from '../../ui/Copyable';
import { DataGrid } from '../../ui/DataGrid';
import { DetailSkeleton, Skeleton } from '../../ui/Skeleton';
import { cn } from '../../ui/cn';
import { EmptyState, InlineError } from '../../ui/States';
import { ActivityFeed } from '../activity/ActivityFeed';
import { StatusBreakdown } from './status';

export const RECORD_TABS = [
  { value: 'overview', label: 'Overview', icon: Info },
  { value: 'credentials', label: 'Credentials', icon: KeyRound },
  { value: 'roles', label: 'Role use', icon: ArrowLeftRight },
  { value: 'activity', label: 'Activity', icon: Activity },
];

/** The record tabs with their counts, for whichever surface shows them. */
export function recordTabs(identity) {
  const credentials = Array.isArray(identity.owned_credentials) ? identity.owned_credentials : [];
  return RECORD_TABS.map((entry) => (entry.value === 'credentials' ? { ...entry, count: credentials.length } : entry));
}

const REL_LABELS = {
  ASSUME_ROLE: 'sts:AssumeRole',
  ASSUME_ROLE_WITH_WEB_IDENTITY: 'OIDC web identity',
  ASSUME_ROLE_SAML: 'SAML federation',
};

function callerTypeLabel(type) {
  if (type === 'AWS_SERVICE') return 'AWS service';
  if (type === 'EXTERNAL_PRINCIPAL') return 'Outside the organisation';
  return actorTypeMeta(type).label;
}

function TabIntro({ children }) {
  return <p className="mb-4 max-w-3xl text-[12.5px] leading-relaxed text-ink-3">{children}</p>;
}

function Fact({ label, children, wide = false }) {
  return (
    <div className={cn('min-w-0', wide && 'sm:col-span-2')}>
      <dt className="text-[10.5px] font-semibold tracking-[0.1em] text-ink-3 uppercase">{label}</dt>
      <dd className="mt-1 min-w-0 text-[13px] leading-snug text-ink">{children}</dd>
    </div>
  );
}

/**
 * The inventory record of one identity, shared by the Identities drawer and
 * the identity page so both say the same thing.
 *
 * Laid out on what a reviewer has to answer before approving an identity:
 * what it is and where, who owns it, what it acts as and with which
 * permissions, what it authenticates with, who uses it and when it was last
 * used. The first screen answers all of them in one block; the tabs are the
 * evidence behind each answer. Each tab fetches only when first shown.
 */
export function IdentityRecordPanels({ identity, tab, active = true }) {
  const { selectedScanId } = useScanContext();
  const arn = identity?.arn;

  const lineageQuery = useQuery(
    (signal) => fetchLineage({ arn, scanId: selectedScanId, page: 1, pageSize: 100 }, signal),
    [arn, selectedScanId],
    { enabled: Boolean(active && arn && (tab === 'roles' || tab === 'overview')) },
  );

  const eventsQuery = useQuery(
    (signal) =>
      fetchEvents({ identityArn: arn, scanId: selectedScanId, page: 1, pageSize: 25 }, signal),
    [arn, selectedScanId],
    { enabled: Boolean(active && arn && tab === 'activity') },
  );

  if (!identity) return null;

  const meta = classificationMeta(identity.classification);
  const actor = actorTypeMeta(identity.identity_type);
  const credentials = Array.isArray(identity.owned_credentials) ? identity.owned_credentials : [];
  const policies = Array.isArray(identity.attached_policies) ? identity.attached_policies : [];
  const keys = credentials.filter((credential) => credential.type === 'ACCESS_KEY');
  const isUser = identity.principal_type === 'IAM_USER';
  const principalName = String(identity.principal_arn || identity.arn).split('/').pop();
  const lineage = lineageQuery.data?.rows ?? [];
  const assumedBy = lineage.filter((row) => row.direction === 'INBOUND');
  const assumes = lineage.filter((row) => row.direction === 'OUTBOUND');
  const kinds = [...new Set(credentials.map((credential) => credentialKindMeta(credential.type).label))];
  const owner = identity.owner_type === 'ORPHANED' ? null : identity.owner_name || identity.primary_owner;

  return (
    <>
        <TabPanel tabValue="overview" value={tab} className="flex flex-col gap-6">
          <section aria-label="At a glance" className="rounded-[var(--radius-control)] border border-line bg-surface-2 p-4">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
              <Fact label="What it is">
                {actor.label}
                <span className="block text-[12px] text-ink-3">{meta.label}</span>
              </Fact>
              <Fact label="Where">
                {identity.account_name} <span className="font-mono text-[12px] text-ink-3">{identity.account_id}</span>
                <span className="block text-[12px] text-ink-3">
                  {identity.region}
                  {identity.env ? ` · ${identity.env}` : ''}
                </span>
              </Fact>
              <Fact label="Owner">
                {owner ? owner : <span className="font-semibold text-high">No owner</span>}
                <span className="block text-[12px] text-ink-3">{ownerTypeMeta(identity.owner_type).label}</span>
              </Fact>
              <Fact label={isUser ? 'Signs in as (IAM user)' : 'Acts as (IAM role)'} wide>
                <span className="font-mono text-[12.5px]">{principalName}</span>
                <span className="mt-0.5 block text-[11.5px] text-ink-3">
                  <CopyableValue value={identity.principal_arn || identity.arn} />
                </span>
                {!isUser && identity.bound_via && (
                  <span className="block text-[11.5px] text-ink-3">Linked by: {identity.bound_via}</span>
                )}
              </Fact>
              <Fact label="Permissions">
                {identity.is_admin ? (
                  <span className="font-semibold text-critical">Administrator access</span>
                ) : policies.length || identity.group_policies?.length ? (
                  `${policies.length + (identity.group_policies?.length ?? 0)} ${policies.length + (identity.group_policies?.length ?? 0) === 1 ? 'policy' : 'policies'}`
                ) : (
                  'No policies recorded'
                )}
                {identity.permissions_boundary && (
                  <span className="block text-[12px] text-ink-3">Capped by a permission boundary</span>
                )}
              </Fact>
              <Fact label="Authenticates with">
                {credentials.length === 0 ? 'Nothing on record' : kinds.join(', ')}
                {keys.length > 0 && (
                  <span className="block text-[12px] text-high">
                    {keys.length} long-lived {keys.length === 1 ? 'key' : 'keys'}, oldest {formatNumber(Math.max(...keys.map((key) => key.age_days)))} days
                  </span>
                )}
              </Fact>
              <Fact label="Used by">
                {isUser ? (
                  identity.classification === 'HUMAN' ? 'The person it belongs to' : 'A person and a workload, sharing it'
                ) : lineageQuery.isLoading && !lineageQuery.data ? (
                  <Skeleton className="h-4 w-32 rounded" />
                ) : assumedBy.length === 0 ? (
                  'Nothing seen assuming it'
                ) : (
                  <>
                    {assumedBy[0].target_name}
                    <span className="block text-[12px] text-ink-3">
                      {callerTypeLabel(assumedBy[0].target_type)}
                      {assumedBy.length > 1 ? ` and ${assumedBy.length - 1} more` : ''}
                    </span>
                  </>
                )}
              </Fact>
              <Fact label="Last used">
                {formatRelative(identity.last_active)}
                <span className="block text-[12px] text-ink-3">{formatDateTime(identity.last_active)}</span>
              </Fact>
            </dl>
          </section>

          <div>
            <SectionLabel>Permissions</SectionLabel>
            {identity.group_policies?.length > 0 && (
              <p className="mt-2 text-[12px] text-ink-3">
                Through the group {identity.groups?.[identity.groups.length - 1]}:{' '}
                <span className="font-mono text-ink-2">{identity.group_policies.join(', ')}</span>
              </p>
            )}
            {policies.length === 0 && !identity.group_policies?.length ? (
              <p className="mt-2 text-[12.5px] text-ink-3">No managed policies were recorded for this identity.</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {policies.map((policy) => (
                  <li key={policy}>
                    <Code title={policy}>{policy}</Code>
                  </li>
                ))}
              </ul>
            )}
            {identity.permissions_boundary && (
              <p className="mt-2 text-[12px] text-ink-3">
                Permission boundary: <span className="font-mono text-ink-2">{identity.permissions_boundary}</span>
              </p>
            )}
          </div>

          {isUser && (
            <div>
              <SectionLabel>Sign-in</SectionLabel>
              <DetailList className="mt-1">
                <DetailRow label="Console access">
                  {identity.console_access ? 'Yes' : 'No'}
                  {identity.console_access && (
                    <span className="ml-1.5 text-ink-3">
                      {identity.mfa_enabled
                        ? '(MFA enabled)'
                        : identity.mfa_enforced
                          ? '(MFA enforced by policy, device not yet enrolled)'
                          : '(no MFA)'}
                    </span>
                  )}
                </DetailRow>
                {identity.console_access && (
                  <DetailRow label="Last console sign-in">{formatDateTime(identity.console_last_signin)}</DetailRow>
                )}
                {identity.password_age_days !== null && identity.password_age_days !== undefined && (
                  <DetailRow label="Password age">{`${formatNumber(identity.password_age_days)} days`}</DetailRow>
                )}
                <DetailRow label="Access keys">
                  {keys.length === 0 ? (
                    'None'
                  ) : (
                    <span className="flex flex-col gap-1.5">
                      {keys.map((key) => (
                        <span key={key.cred_id} className="flex flex-col gap-0.5">
                          <CopyableValue value={key.cred_id} />
                          <span className="text-[11.5px] text-ink-3" data-numeric="">
                            {formatNumber(key.age_days)} days old · last used {formatRelative(key.last_used_date)}
                          </span>
                        </span>
                      ))}
                    </span>
                  )}
                </DetailRow>
                <DetailRow label="Groups">
                  {Array.isArray(identity.groups) && identity.groups.length > 0 ? identity.groups.join(', ') : 'None'}
                </DetailRow>
              </DetailList>
            </div>
          )}

          <div>
            <SectionLabel>Status checks</SectionLabel>
            <div className="mt-1">
              <StatusBreakdown identity={identity} />
            </div>
            {identity.id && (
              <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
                The scored evaluation, with fixes, is on the{' '}
                <Link to={`/identities/${encodeURIComponent(identity.id)}?tab=posture`} className="font-medium text-brand hover:underline">
                  Posture tab
                </Link>
                .
              </p>
            )}
          </div>

          {Array.isArray(identity.posture_fixes) && identity.posture_fixes.length > 0 && (
            <div>
              <SectionLabel>Fixed on Posture</SectionLabel>
              <ul className="mt-2 flex flex-col gap-2">
                {identity.posture_fixes.map((fix) => (
                  <li key={fix.checkKey} className="flex items-start gap-2 text-[12.5px] text-ink-2">
                    <Wrench aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-low" />
                    <span>
                      {fix.action}. <span className="text-ink-3">{fix.by}, {formatRelative(fix.at)}.</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <SectionLabel>How it was found</SectionLabel>
            <DetailList className="mt-1">
              {identity.actor_id && identity.actor_id !== identity.name && (
                <DetailRow label="Actor id" mono>
                  <CopyableValue value={identity.actor_id} />
                </DetailRow>
              )}
              {identity.discovery_api && (
                <DetailRow label="Discovered by" mono>
                  {identity.discovery_api}
                </DetailRow>
              )}
              <DetailRow label="Why this classification">
                {identity.evidence}
                {Array.isArray(identity.matched_rules) && (
                  <span className="mt-0.5 block font-mono text-[11.5px] text-ink-3">{identity.matched_rules.join(' · ')}</span>
                )}
              </DetailRow>
              <DetailRow label="Created">
                {formatDateTime(identity.created_at)}
                {identity.created_by_name && <span className="ml-1.5 text-ink-3">by {identity.created_by_name}</span>}
              </DetailRow>
              <DetailRow label="First discovered">{formatDateTime(identity.discovered_at)}</DetailRow>
            </DetailList>
          </div>
        </TabPanel>

        <TabPanel tabValue="credentials" value={tab}>
          <TabIntro>
            What this identity authenticates with: the IAM role it assumes, long-lived access keys, and the secrets or tokens it
            reads. A role gives short-lived credentials; a key does not expire until someone rotates it.
          </TabIntro>
          {credentials.length === 0 ? (
            <EmptyState
              compact
              icon={KeyRound}
              title="No credentials on this identity"
              description="This identity holds no credential on record - no role, access key, password or certificate."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {credentials.map((credential, index) => {
                const severity = severityMeta(credential.severity);
                return (
                  <li
                    key={`${credential.type}-${credential.id || index}`}
                    className="rounded-[var(--radius-control)] border border-line bg-surface-2 p-3.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-ink">
                        {credentialKindMeta(credential.type).label}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {credential.status && (
                          <Tag tone="neutral" size="sm">
                            {titleCaseEnum(credential.status)}
                          </Tag>
                        )}
                        {credential.severity && (
                          <Tag tone={severity.tone} size="sm" dot>
                            {severity.label}
                          </Tag>
                        )}
                      </div>
                    </div>

                    {credential.cred_id && (
                      <div className="mt-2">
                        <CopyableValue value={credential.cred_id} />
                      </div>
                    )}

                    <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                      <div>
                        <dt className="text-[10.5px] font-semibold tracking-[0.1em] text-ink-3 uppercase">
                          Created
                        </dt>
                        <dd className="mt-0.5 text-[12px] text-ink-2">
                          {formatDateTime(credential.created_at)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10.5px] font-semibold tracking-[0.1em] text-ink-3 uppercase">
                          Last used
                        </dt>
                        <dd className="mt-0.5 text-[12px] text-ink-2">
                          {formatRelative(credential.last_used_date)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10.5px] font-semibold tracking-[0.1em] text-ink-3 uppercase">
                          Last service
                        </dt>
                        <dd className="mt-0.5 truncate text-[12px] text-ink-2">
                          {credential.last_used_service || '-'}
                        </dd>
                      </div>
                    </dl>

                    {credential.description && (
                      <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-3">
                        {credential.description}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </TabPanel>


        <TabPanel tabValue="roles" value={tab} className="flex flex-col gap-6">
          <TabIntro>
            Who takes on this identity's role, and which roles it takes on in turn - each one is an sts:AssumeRole call
            recorded in CloudTrail.
          </TabIntro>
          {lineageQuery.isLoading && !lineageQuery.data ? (
            <DetailSkeleton rows={5} />
          ) : lineageQuery.isError ? (
            <InlineError error={lineageQuery.error} onRetry={lineageQuery.refetch} label="Role use unavailable" />
          ) : (
            <>
              <section>
                <SectionLabel>Assumed by</SectionLabel>
                {isUser ? (
                  <p className="mt-2 text-[12.5px] text-ink-3">
                    Nothing. An IAM user cannot be assumed - it signs in with its own password or access keys.
                  </p>
                ) : assumedBy.length === 0 ? (
                  <p className="mt-2 text-[12.5px] text-ink-3">Nothing was seen assuming this role in the events read so far.</p>
                ) : (
                  <DataGrid
                    className="mt-2"
                    caption="Who assumes this role"
                    rows={assumedBy}
                    rowKey={(row) => row.id}
                    columns={[
                      {
                        key: 'caller',
                        header: 'Caller',
                        primary: true,
                        cell: (row) => (
                          <span className="block min-w-0">
                            <span className="block truncate font-mono text-[12.5px] text-ink" title={row.target_arn}>
                              {row.target_name}
                            </span>
                            <span className="block truncate text-[11px] text-ink-3">{callerTypeLabel(row.target_type)}</span>
                          </span>
                        ),
                      },
                      {
                        key: 'how',
                        header: 'How',
                        cell: (row) => <span className="text-[12.5px] text-ink-2">{REL_LABELS[row.rel_type] ?? titleCaseEnum(row.rel_type)}</span>,
                      },
                      {
                        key: 'from',
                        header: 'From',
                        priority: 'wide',
                        cell: (row) => (
                          <span className="block min-w-0">
                            <span className="block truncate font-mono text-[12px] text-ink-2">{row.source_ip || '-'}</span>
                            {row.is_external && (
                              <Tag tone="high" size="sm" className="mt-0.5">
                                External
                              </Tag>
                            )}
                          </span>
                        ),
                      },
                      {
                        key: 'sessions',
                        header: 'Sessions',
                        align: 'right',
                        cell: (row) => (
                          <span data-numeric="" className="text-[13px] font-semibold text-ink">
                            {formatNumber(row.assume_count)}
                          </span>
                        ),
                      },
                      {
                        key: 'last',
                        header: 'Last assumed',
                        cell: (row) => (
                          <span className="block text-[12px] text-ink-2" title={formatDateTime(row.last_assumed)}>
                            {formatRelative(row.last_assumed)}
                          </span>
                        ),
                      },
                    ]}
                    emptyState={null}
                  />
                )}
              </section>

              <section>
                <SectionLabel>Roles it assumes</SectionLabel>
                {assumes.length === 0 ? (
                  <p className="mt-2 text-[12.5px] text-ink-3">It was not seen assuming any other role.</p>
                ) : (
                  <DataGrid
                    className="mt-2"
                    caption="Roles this identity assumes"
                    rows={assumes}
                    rowKey={(row) => row.id}
                    columns={[
                      {
                        key: 'role',
                        header: 'Role',
                        primary: true,
                        cell: (row) => (
                          <span className="block min-w-0">
                            <span className="block truncate font-mono text-[12.5px] text-ink" title={row.target_arn}>
                              {row.target_name}
                            </span>
                            <span className="block truncate text-[11px] text-ink-3">{actorTypeMeta(row.target_type).label}</span>
                          </span>
                        ),
                      },
                      {
                        key: 'sessions',
                        header: 'Sessions',
                        align: 'right',
                        cell: (row) => (
                          <span data-numeric="" className="text-[13px] font-semibold text-ink">
                            {formatNumber(row.assume_count)}
                          </span>
                        ),
                      },
                      {
                        key: 'last',
                        header: 'Last assumed',
                        cell: (row) => (
                          <span className="block text-[12px] text-ink-2" title={formatDateTime(row.last_assumed)}>
                            {formatRelative(row.last_assumed)}
                          </span>
                        ),
                      },
                    ]}
                    emptyState={null}
                  />
                )}
              </section>
            </>
          )}
        </TabPanel>

        <TabPanel tabValue="activity" value={tab}>
          <TabIntro>The API calls this identity made, as CloudTrail recorded them - newest first.</TabIntro>
          <ActivityFeed
            events={eventsQuery.data?.rows}
            loading={eventsQuery.isLoading && !eventsQuery.data}
            error={eventsQuery.error}
            onRetry={eventsQuery.refetch}
            emptyHint="No CloudTrail events were attributed to this identity in the events this console has read."
          />
        </TabPanel>
    </>
  );
}

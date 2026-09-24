import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowLeftRight,
  Info,
  KeyRound,
  Users,
  Wrench,
} from 'lucide-react';
import { fetchConsumers, fetchEvents, fetchLineage } from '../../lib/api/endpoints';
import { useQuery } from '../../lib/hooks';
import { useScanContext } from '../../app/ScanContext';
import {
  actorCategoryMeta,
  actorTypeMeta,
  classificationMeta,
  credentialKindMeta,
  lineageDirectionMeta,
  ownerTypeMeta,
  severityMeta,
} from '../../lib/domain';
import {
  arnAccount,
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
import { DetailSkeleton, ListSkeleton } from '../../ui/Skeleton';
import { EmptyState, InlineError } from '../../ui/States';
import { ActivityFeed } from '../activity/ActivityFeed';
import { StatusBreakdown } from './status';

export const RECORD_TABS = [
  { value: 'overview', label: 'Overview', icon: Info },
  { value: 'credentials', label: 'Credentials', icon: KeyRound },
  { value: 'access', label: 'Service access', icon: ArrowLeftRight },
  { value: 'consumers', label: 'Consumers', icon: Users },
  { value: 'activity', label: 'Activity', icon: Activity },
];

/** The record tabs with their counts, for whichever surface shows them. */
export function recordTabs(identity) {
  const credentials = Array.isArray(identity.owned_credentials) ? identity.owned_credentials : [];
  return RECORD_TABS.map((entry) => {
    if (entry.value === 'credentials') return { ...entry, count: credentials.length };
    if (entry.value === 'consumers') return { ...entry, count: identity.consumer_count ?? null };
    return entry;
  });
}

/**
 * The inventory record of one identity: what it is, who owns it, what it
 * holds, what it talks to and what it did. Shared by the Identities drawer
 * and the identity page, so both say exactly the same thing. Each tab fetches
 * only when it is first shown.
 */
export function IdentityRecordPanels({ identity, tab, active = true }) {
  const { selectedScanId } = useScanContext();
  const arn = identity?.arn;

  const lineageQuery = useQuery(
    (signal) => fetchLineage({ arn, scanId: selectedScanId, page: 1, pageSize: 100 }, signal),
    [arn, selectedScanId],
    { enabled: Boolean(active && arn && tab === 'access') },
  );

  const consumersQuery = useQuery(
    (signal) => fetchConsumers({ arn, scanId: selectedScanId, page: 1, pageSize: 50 }, signal),
    [arn, selectedScanId],
    { enabled: Boolean(active && arn && tab === 'consumers') },
  );

  const eventsQuery = useQuery(
    (signal) =>
      fetchEvents({ identityArn: arn, scanId: selectedScanId, page: 1, pageSize: 25 }, signal),
    [arn, selectedScanId],
    { enabled: Boolean(active && arn && tab === 'activity') },
  );

  if (!identity) return null;

  const meta = classificationMeta(identity.classification);
  const credentials = Array.isArray(identity.owned_credentials) ? identity.owned_credentials : [];
  const policies = Array.isArray(identity.attached_policies) ? identity.attached_policies : [];
  const keys = credentials.filter((credential) => credential.type === 'ACCESS_KEY');

  return (
    <>
        <TabPanel tabValue="overview" value={tab} className="flex flex-col gap-5">
          <div>
            <SectionLabel>Identity</SectionLabel>
            <DetailList className="mt-1">
              <DetailRow label="Name">{identity.name || '-'}</DetailRow>
              <DetailRow label="ARN" mono>
                <CopyableValue value={identity.arn} />
              </DetailRow>
              <DetailRow label="AWS account" mono>
                {arnAccount(identity.arn)}
              </DetailRow>
              {/* What this identity IS. The row used to read "Resource type:
                  IAM role", which named the credential rather than the actor -
                  and an IAM role is not a thing that acts, it is a set of
                  permissions that something else assumes. The four rows below
                  say what acts, which instance of it, how it was found, and
                  what it holds. */}
              <DetailRow label="Actor type">
                {actorTypeMeta(identity.identity_type).label}
              </DetailRow>
              {identity.actor_id && identity.actor_id !== identity.name && (
                <DetailRow label="Actor id" mono>
                  <CopyableValue value={identity.actor_id} />
                </DetailRow>
              )}
              <DetailRow label="Actor category">
                {actorCategoryMeta(identity.actor_category).label}
              </DetailRow>
              {identity.discovery_api && (
                <DetailRow label="Discovered by" mono>
                  {identity.discovery_api}
                </DetailRow>
              )}
              <DetailRow label="Holds">
                {identity.principal_type === 'IAM_USER'
                  ? 'An IAM user - this actor is both the thing that acts and the credential holder.'
                  : 'An IAM role, listed on the Credentials screen as the credential it assumes.'}
              </DetailRow>
              {identity.bound_via && identity.principal_type === 'IAM_ROLE' && (
                <DetailRow label="Role resolved from">{identity.bound_via}</DetailRow>
              )}
              <DetailRow label="Classification">{meta.label}</DetailRow>
              <DetailRow label="Created">{formatDateTime(identity.created_at)}</DetailRow>
              <DetailRow label="Discovered">{formatDateTime(identity.discovered_at)}</DetailRow>
            </DetailList>
          </div>

          <div>
            <SectionLabel>Ownership</SectionLabel>
            <DetailList className="mt-1">
              <DetailRow label="Owner">{identity.owner_name || '-'}</DetailRow>
              <DetailRow label="Owner type">{ownerTypeMeta(identity.owner_type).label}</DetailRow>
              <DetailRow label="Primary owner">{identity.primary_owner || '-'}</DetailRow>
              <DetailRow label="Created by">{identity.created_by_name || '-'}</DetailRow>
              <DetailRow label="Groups">
                {Array.isArray(identity.groups) && identity.groups.length > 0 ? identity.groups.join(', ') : '-'}
              </DetailRow>
            </DetailList>
          </div>

          <div>
            <SectionLabel>Status checks</SectionLabel>
            <div className="mt-1">
              <StatusBreakdown identity={identity} />
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
              The five checks behind this record's status.
              {identity.id && (
                <>
                  {' '}The scored evaluation, with fixes, is on the{' '}
                  <Link
                    to={`/identities/${encodeURIComponent(identity.id)}?tab=posture`}
                    className="font-medium text-brand hover:underline"
                  >
                    Posture tab of the full record
                  </Link>
                  .
                </>
              )}
            </p>
          </div>

          <div>
            <SectionLabel>Access detail</SectionLabel>
            <DetailList className="mt-1">
              <DetailRow label="Trust type">
                {identity.trust_type ? titleCaseEnum(identity.trust_type) : '-'}
              </DetailRow>
              <DetailRow label="Trust service" mono>
                {identity.trust_service || '-'}
              </DetailRow>
              <DetailRow label="Console access">
                {identity.console_access ? 'Yes' : 'No'}
                {identity.console_access && (
                  <span className="ml-1.5 text-ink-3">
                    {identity.mfa_enabled ? '(MFA enabled)' : identity.mfa_enforced ? '(MFA enforced by policy, device not yet enrolled)' : '(no MFA)'}
                  </span>
                )}
              </DetailRow>
              <DetailRow label="Last console sign-in">
                {formatDateTime(identity.console_last_signin)}
              </DetailRow>
              <DetailRow label="Password age">
                {identity.password_age_days === null || identity.password_age_days === undefined
                  ? '-'
                  : `${formatNumber(identity.password_age_days)} days`}
              </DetailRow>
              <DetailRow label="Access keys">
                {keys.length === 0 ? (
                  'None'
                ) : (
                  <span className="flex flex-col gap-1.5">
                    {keys.map((key) => (
                      <span key={key.cred_id} className="flex flex-col gap-0.5">
                        <CopyableValue value={key.cred_id} />
                        <span className="text-[11.5px] text-ink-3" data-numeric="">
                          IAM user {key.iam_user} · {formatNumber(key.age_days)} days old · last used{' '}
                          {formatRelative(key.last_used_date)}
                        </span>
                      </span>
                    ))}
                  </span>
                )}
              </DetailRow>
              {identity.permissions_boundary && (
                <DetailRow label="Permission boundary" mono>
                  {identity.permissions_boundary}
                </DetailRow>
              )}
              {identity.external_id_required && <DetailRow label="External trust">Requires an ExternalId</DetailRow>}
              {identity.workload_role && (
                <DetailRow label="Workload role" mono>
                  {identity.workload_role}
                </DetailRow>
              )}
              <DetailRow label="Last active">
                {formatRelative(identity.last_active)}
                <span className="ml-1.5 text-ink-3">({formatDateTime(identity.last_active)})</span>
              </DetailRow>
              <DetailRow label="Recorded events">
                <span data-numeric="">{formatNumber(identity.total_events)}</span>
              </DetailRow>
            </DetailList>
          </div>

          <div>
            <SectionLabel>Attached policies</SectionLabel>
            {Array.isArray(identity.group_policies) && identity.group_policies.length > 0 && (
              <p className="mt-2 text-[12px] text-ink-3">
                Granted through the group {identity.groups?.[identity.groups.length - 1]}:{' '}
                <span className="font-mono text-ink-2">{identity.group_policies.join(', ')}</span>
              </p>
            )}
            {policies.length === 0 ? (
              <p className="mt-2 text-[12.5px] text-ink-3">
                No managed policies were recorded for this identity in this scan.
              </p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {policies.map((policy) => (
                  <li key={policy}>
                    <Code title={policy}>{policy}</Code>
                  </li>
                ))}
              </ul>
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

          {(identity.evidence || identity.matched_rules) && (
            <div>
              <SectionLabel>Why it was classified this way</SectionLabel>
              <div className="mt-2 rounded-[var(--radius-control)] border border-line bg-surface-2 p-3.5">
                {identity.matched_rules && (
                  <p className="font-mono text-[12px] leading-relaxed text-ink-2">
                    {Array.isArray(identity.matched_rules) ? identity.matched_rules.join(' · ') : identity.matched_rules}
                  </p>
                )}
                {identity.evidence && (
                  <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2">{identity.evidence}</p>
                )}
              </div>
            </div>
          )}
        </TabPanel>

        <TabPanel tabValue="credentials" value={tab}>
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

        <TabPanel tabValue="access" value={tab}>
          {lineageQuery.isLoading && !lineageQuery.data ? (
            <DetailSkeleton rows={6} />
          ) : lineageQuery.isError ? (
            <InlineError
              error={lineageQuery.error}
              onRetry={lineageQuery.refetch}
              label="Service access unavailable"
            />
          ) : (lineageQuery.data?.rows?.length ?? 0) === 0 ? (
            <EmptyState
              compact
              icon={ArrowLeftRight}
              title="No access relationships recorded"
              description="Nothing was observed calling this identity, and it was not observed reaching another service in this scan."
            />
          ) : (
            <DataGrid
              caption="Service access lineage"
              rows={lineageQuery.data.rows}
              rowKey={(row, index) => `${row.target_name}-${row.rel_type}-${index}`}
              columns={[
                {
                  key: 'target',
                  header: 'Target',
                  primary: true,
                  cell: (row) => (
                    <span className="block min-w-0">
                      <span className="block truncate text-[13px] font-medium text-ink" title={row.target_name}>
                        {row.target_name || '-'}
                      </span>
                      <span className="block truncate text-[11px] text-ink-3">
                        {row.target_type ? actorTypeMeta(row.target_type).label : '-'}
                      </span>
                    </span>
                  ),
                },
                {
                  key: 'direction',
                  header: 'Direction',
                  cell: (row) => {
                    const direction = lineageDirectionMeta(row.direction);
                    return (
                      <Tag tone={direction.tone} size="sm">
                        {direction.label}
                      </Tag>
                    );
                  },
                },
                {
                  key: 'rel',
                  header: 'Relationship',
                  cell: (row) => (
                    <span className="text-[12.5px] text-ink-2">
                      {row.rel_type ? titleCaseEnum(row.rel_type) : '-'}
                    </span>
                  ),
                },
                {
                  key: 'via',
                  header: 'Via',
                  priority: 'wide',
                  cell: (row) =>
                    row.via ? <Code title={row.via}>{row.via}</Code> : <span className="text-ink-3">-</span>,
                },
                {
                  key: 'scope',
                  header: 'Scope',
                  priority: 'wide',
                  cell: (row) => (
                    <Tag tone={row.is_external ? 'high' : 'neutral'} size="sm">
                      {row.is_external ? 'External' : 'Internal'}
                    </Tag>
                  ),
                },
              ]}
              emptyState={null}
            />
          )}
        </TabPanel>

        <TabPanel tabValue="consumers" value={tab}>
          {consumersQuery.isLoading && !consumersQuery.data ? (
            <ListSkeleton rows={4} />
          ) : consumersQuery.isError ? (
            <InlineError
              error={consumersQuery.error}
              onRetry={consumersQuery.refetch}
              label="Consumers unavailable"
            />
          ) : (consumersQuery.data?.rows?.length ?? 0) === 0 ? (
            <EmptyState
              compact
              icon={Users}
              title="No role assumptions observed"
              description="Consumers are derived from AssumeRole calls in CloudTrail. Nothing has assumed the role this identity holds in the events this console has read."
            />
          ) : (
            <>
              <p className="mb-3 text-[12px] text-ink-3">
                Callers observed assuming the role this identity holds, grouped by caller, source address and region.
              </p>
              <DataGrid
                caption="Role consumers"
                rows={consumersQuery.data.rows}
                rowKey={(row, index) => `${row.caller_arn}-${row.source_ip}-${index}`}
                columns={[
                  {
                    key: 'caller',
                    header: 'Caller',
                    primary: true,
                    cell: (row) => (
                      <span className="block min-w-0">
                        <span
                          className="block truncate font-mono text-[12px] text-ink"
                          title={row.caller_arn}
                        >
                          {row.caller_arn || '-'}
                        </span>
                        <span className="block truncate text-[11px] text-ink-3">
                          {row.caller_type ? actorTypeMeta(row.caller_type).label : '-'}
                        </span>
                      </span>
                    ),
                  },
                  {
                    key: 'sessions',
                    header: 'Sessions',
                    align: 'right',
                    cell: (row) => (
                      <span data-numeric="" className="text-[13px] font-semibold text-ink">
                        {formatNumber(row.session_count)}
                      </span>
                    ),
                  },
                  {
                    key: 'source',
                    header: 'Source',
                    priority: 'wide',
                    cell: (row) => (
                      <span className="block min-w-0">
                        <span className="block truncate font-mono text-[12px] text-ink-2">
                          {row.source_ip || '-'}
                        </span>
                        <span className="block truncate text-[11px] text-ink-3">{row.region || '-'}</span>
                      </span>
                    ),
                  },
                  {
                    key: 'window',
                    header: 'Window',
                    cell: (row) => (
                      <span className="block min-w-0">
                        <span className="block text-[12px] text-ink-2">
                          {formatRelative(row.last_assumed)}
                        </span>
                        <span className="block text-[11px] text-ink-3">
                          first {formatDateTime(row.first_assumed)}
                        </span>
                      </span>
                    ),
                  },
                ]}
                emptyState={null}
              />
            </>
          )}
        </TabPanel>

        <TabPanel tabValue="activity" value={tab}>
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

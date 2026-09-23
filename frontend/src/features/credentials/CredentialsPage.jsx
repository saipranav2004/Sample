import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { KeyRound, SearchX } from 'lucide-react';
import { countCredentials, fetchCredentials, fetchSummary } from '../../lib/api/endpoints';
import { useDebouncedValue, useQuery } from '../../lib/hooks';
import { useScanContext } from '../../app/ScanContext';
import { actorTypeMeta, credentialKindMeta, SEVERITY_ORDER, severityMeta } from '../../lib/domain';
import {
  arnResource,
  daysSince,
  formatDateTime,
  formatNumber,
  formatRelative,
  percentValue,
  titleCaseEnum,
} from '../../lib/format';
import { exportRowsToCsv, timestampedName } from '../../lib/csv';
import { PageHeader } from '../../shell/PageHeader';
import { Button } from '../../ui/Button';
import { DetailList, DetailRow, Panel, PanelHeader, SectionLabel } from '../../ui/Panel';
import { SearchInput } from '../../ui/Field';
import { AppliedFilters, FacetRail, useFacetRail } from '../../ui/FacetRail';
import { RecordBar, ResultCount, ShowFiltersButton, WorkArea } from '../../ui/WorkArea';
import { OverflowMenu, RefreshButton, TableSettings, TableToolbar } from '../../ui/TableTools';
import { MetricTile } from '../../ui/Stat';
import { ProportionBar } from '../../ui/Meter';
import { StatStripSkeleton } from '../../ui/Skeleton';
import { useToast } from '../../ui/Toast';
import { CellStack, DataGrid } from '../../ui/DataGrid';
import { Pagination } from '../../ui/Pagination';
import { Drawer } from '../../ui/Overlay';
import { Tag } from '../../ui/Tag';
import { CopyableValue } from '../../ui/Copyable';
import { EmptyState, ErrorState } from '../../ui/States';

/**
 * Flattened credential register: one row per credential rather than per
 * identity, which is the shape an operator needs when the question is
 * "what needs rotating" rather than "who owns what".
 *
 * ── What is in here that did not used to be ─────────────────────────────────
 * The IAM roles. A role is not an actor - it is a set of permissions that an
 * actor assumes - so it belongs in the register of things identities hold,
 * beside the access keys and the store entries, rather than in the inventory
 * of things that act. Every non-human actor contributes one `ASSUMED_ROLE`
 * row here for the role it holds, and the Identities screen now lists the
 * EC2 instance, Lambda function or pipeline that assumes it.
 *
 * The consequence for this screen is that "age" means two different things
 * depending on the row, so the type is stated on every one: a key's age is
 * how overdue a rotation is, and a role's age is just how long it has
 * existed, because a role has nothing to rotate.
 */
const DENSITY_KEY = 'dna.grid.density';

export default function CredentialsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedScanId, activeScan } = useScanContext();
  const { notify } = useToast();
  const [selected, setSelected] = useState(null);
  const { railOpen, toggleRail } = useFacetRail();
  const [density, setDensity] = useState(() => {
    try {
      return localStorage.getItem(DENSITY_KEY) || 'comfortable';
    } catch {
      return 'comfortable';
    }
  });

  const setDensityPref = (value) => {
    setDensity(value);
    try {
      localStorage.setItem(DENSITY_KEY, value);
    } catch {
      /* per-viewer convenience only */
    }
  };
  const [searchDraft, setSearchDraft] = useState(() => searchParams.get('search') || '');
  const debouncedSearch = useDebouncedValue(searchDraft, 320);

  useEffect(() => {
    const current = searchParams.get('search') || '';
    if (debouncedSearch === current) return;
    const next = new URLSearchParams(searchParams);
    if (debouncedSearch) next.set('search', debouncedSearch);
    else next.delete('search');
    next.delete('page');
    setSearchParams(next, { replace: true });
  }, [debouncedSearch, searchParams, setSearchParams]);

  const filters = useMemo(
    () => ({
      search: searchParams.get('search') || '',
      type: searchParams.get('type') || '',
      severity: searchParams.get('severity') || '',
      page: Number(searchParams.get('page')) || 1,
      pageSize: Number(searchParams.get('page_size')) || 25,
    }),
    [searchParams],
  );

  const query = useQuery(
    (signal) => fetchCredentials({ ...filters, scanId: selectedScanId }, signal),
    [JSON.stringify(filters), selectedScanId],
  );

  /* Credential types are free-form strings in the data, so the options come
     from the scan's own breakdown instead of a hard-coded list. */
  const summaryQuery = useQuery((signal) => fetchSummary({ scanId: selectedScanId }, signal), [
    selectedScanId,
  ]);

  /* Severity totals are not on the summary endpoint, so they are counted
     exactly - one filtered request per tier, one row each (see
     docs/UX-DECISIONS.md §4). Never derived from the loaded page. */
  const severityCountQuery = useQuery(
    async (signal) => {
      const pairs = await Promise.all(
        SEVERITY_ORDER.map(async (severity) => [
          severity,
          await countCredentials({ severity, scanId: selectedScanId }, signal),
        ]),
      );
      return Object.fromEntries(pairs);
    },
    [selectedScanId],
  );
  const severityCounts = severityCountQuery.data ?? {};

  const typeOptions = useMemo(() => {
    const breakdown = summaryQuery.data?.credentials_breakdown || {};
    return Object.entries(breakdown)
      .filter(([, count]) => Number(count) > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({
        value: key,
        label: credentialKindMeta(key).label,
        count: Number(count),
        active: searchParams.get('type') === key,
      }));
  }, [summaryQuery.data, searchParams]);

  const setParam = useCallback(
    (key, value) => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.delete('page');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const chips = useMemo(() => {
    const list = [];
    if (filters.search) list.push({ key: 'search', label: 'Search', value: filters.search });
    if (filters.type) list.push({ key: 'type', label: 'Type', value: filters.type });
    if (filters.severity) list.push({ key: 'severity', label: 'Severity', value: filters.severity });
    return list;
  }, [filters]);

  const clearAll = () => {
    const next = new URLSearchParams(searchParams);
    ['search', 'type', 'severity', 'page'].forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
    setSearchDraft('');
  };

  const toggleParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (next.get(key) === value) next.delete(key);
    else next.set(key, value);
    next.delete('page');
    setSearchParams(next, { replace: true });
  };

  /* Type counts come from the scan summary; severity counts from the exact
     count queries above. Both are backend figures, never page-derived. */
  const facetGroups = [
    {
      key: 'type',
      label: 'Credential type',
      options: typeOptions,
      onToggle: (value) => toggleParam('type', value),
      note: 'An assumed role is a credential, not an identity: the actor that assumes it - a function, a task, a pipeline - is on the Identities screen.',
    },
    {
      key: 'severity',
      label: 'Severity',
      options: SEVERITY_ORDER.map((value) => ({
        value,
        label: severityMeta(value).label,
        count: Number.isFinite(severityCounts[value]) ? severityCounts[value] : undefined,
        active: searchParams.get('severity') === value,
      })),
      onToggle: (value) => toggleParam('severity', value),
    },
  ];

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;

  /* Age bars are scaled to the oldest credential in view - "how overdue is
     this one relative to its peers" is the rotation question. */
  const maxAge = useMemo(
    () => rows.reduce((max, row) => Math.max(max, daysSince(row.created_at) ?? 0), 0),
    [rows],
  );

  const onExport = () => {
    exportRowsToCsv({
      filename: timestampedName(`credentials-${activeScan?.target_name || 'scan'}`),
      columns: [
        { header: 'Credential type', value: (row) => credentialKindMeta(row.type).label },
        { header: 'Long-lived', value: (row) => (credentialKindMeta(row.type).longLived ? 'yes' : 'no') },
        { header: 'Credential id', value: (row) => row.cred_id },
        { header: 'Severity', value: (row) => row.severity },
        { header: 'Status', value: (row) => row.status },
        { header: 'Held by', value: (row) => row.identity_name },
        { header: 'Held by ARN', value: (row) => row.identity_arn },
        { header: 'Actor type', value: (row) => actorTypeMeta(row.identity_type).label },
        { header: 'Managed store', value: (row) => row.store || '' },
        { header: 'Store entry', value: (row) => row.store_name || '' },
        { header: 'Rotation', value: (row) => (row.store ? (row.rotation_enabled ? `every ${row.rotation_days} days` : 'not enabled') : '') },
        { header: 'Created', value: (row) => row.created_at },
        { header: 'Expires', value: (row) => row.expires_at },
        { header: 'Last used', value: (row) => row.last_used_date },
        { header: 'Last used service', value: (row) => row.last_used_service },
      ],
      rows,
    });
    notify({
      variant: 'success',
      title: 'Exported this page',
      description: `${formatNumber(rows.length)} rows written to CSV. The API has no bulk export, so only the loaded page is included.`,
    });
  };

  const columns = [
    {
      key: 'credential',
      header: 'Credential',
      primary: true,
      width: '24%',
      cell: (row) => (
        <CellStack
          icon={KeyRound}
          title={credentialKindMeta(row.type).label}
          meta={row.cred_id || '-'}
          mono
        />
      ),
    },
    {
      key: 'identity',
      header: 'Held by',
      width: '22%',
      cell: (row) => (
        <span className="block min-w-0">
          <span className="block truncate text-[12.5px] font-medium text-ink" title={row.identity_name}>
            {row.identity_name || arnResource(row.identity_arn)}
          </span>
          {/* The actor that holds it, not the ARN's resource part - which for
              an assumed role is the same string as the name directly above. */}
          <span className="block truncate text-[11px] text-ink-3" title={row.identity_arn}>
            {actorTypeMeta(row.identity_type).label}
          </span>
        </span>
      ),
    },
    {
      key: 'severity',
      header: 'Severity',
      width: '10%',
      cell: (row) => {
        const meta = severityMeta(row.severity);
        return (
          <Tag tone={meta.tone} size="sm" dot>
            {meta.label}
          </Tag>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: '10%',
      cell: (row) => (
        <span className="text-[12.5px] text-ink-2">{row.status ? titleCaseEnum(row.status) : '-'}</span>
      ),
    },
    {
      key: 'age',
      header: 'Age',
      width: '13%',
      cell: (row) => {
        const age = daysSince(row.created_at);
        if (age === null) return <span className="text-[12.5px] text-ink-3">-</span>;
        const share = maxAge > 0 ? Math.max(2, (age / maxAge) * 100) : 0;
        /* Only a long-lived credential's age is overdue-ness. A role that has
           existed for two years is not two years overdue for anything, so its
           bar stays neutral rather than turning red on the same threshold. */
        const longLived = credentialKindMeta(row.type).longLived;
        const tone = !longLived
          ? 'bg-brand'
          : age > 365
            ? 'bg-critical'
            : age > 180
              ? 'bg-high'
              : age > 90
                ? 'bg-medium'
                : 'bg-brand';
        return (
          <span className="block min-w-0" title={`Created ${formatDateTime(row.created_at)}`}>
            <span data-numeric="" className="block text-[12.5px] whitespace-nowrap text-ink-2">
              {formatNumber(age)} days
            </span>
            <span className="mt-1.5 block h-[3px] w-full overflow-hidden rounded-full bg-track">
              <span
                className={`block h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out-quint)] ${tone}`}
                style={{ width: `${share}%` }}
              />
            </span>
          </span>
        );
      },
    },
    {
      key: 'lastUsed',
      header: 'Last used',
      width: '13%',
      cell: (row) => (
        <span className="block min-w-0">
          <span className="block text-[12.5px] text-ink-2">{formatRelative(row.last_used_date)}</span>
          <span className="block truncate text-[11px] text-ink-3" title={row.last_used_service}>
            {row.last_used_service || '-'}
          </span>
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Credential register"
      />

      {severityCountQuery.isLoading && !severityCountQuery.data ? (
        <StatStripSkeleton count={4} />
      ) : (
        <div className="grid gap-3 @min-[30rem]:grid-cols-2 @min-[54rem]:grid-cols-4">
          <MetricTile
            label="Credentials in scope"
            value={summaryQuery.data?.total_credentials}
            tone="brand"
            caption="Assumed roles, keys, store entries and federation trusts"
            className="animate-rise"
          />
          <MetricTile
            as={Link}
            to="?severity=CRITICAL"
            label="Critical severity"
            value={severityCounts.CRITICAL}
            tone="critical"
            caption="Remediate these first"
            className="animate-rise"
          />
          <MetricTile
            as={Link}
            to="?severity=HIGH"
            label="High severity"
            value={severityCounts.HIGH}
            tone="high"
            caption="Next in line after critical"
            meter={percentValue(severityCounts.HIGH, summaryQuery.data?.total_credentials)}
            meterLabel="Share of all credentials"
            className="animate-rise"
          />
          <MetricTile
            label="Credential types"
            value={Object.keys(summaryQuery.data?.credentials_breakdown || {}).length}
            tone="info"
            caption={
              typeOptions[0] ? `Most common: ${typeOptions[0].label}` : 'No credential types recorded'
            }
            className="animate-rise"
          />
        </div>
      )}

      <Panel prominence="quiet" className="animate-rise">
        <PanelHeader prominence="quiet"
          title="Rotation queue by severity"
        />
        <ProportionBar
          className="mt-3.5"
          height={12}
          total={SEVERITY_ORDER.reduce((sum, tier) => sum + (severityCounts[tier] || 0), 0)}
          onSelect={(segment) => setParam('severity', segment.key)}
          segments={SEVERITY_ORDER.filter((tier) => (severityCounts[tier] || 0) > 0).map((tier) => ({
            key: tier,
            label: severityMeta(tier).label,
            value: severityCounts[tier] || 0,
            color: `var(--t-${severityMeta(tier).tone})`,
          }))}
          ariaLabel="Credential count by severity"
        />
        <dl className="mt-3 flex flex-wrap gap-x-7 gap-y-2">
          {SEVERITY_ORDER.filter((tier) => (severityCounts[tier] || 0) > 0).map((tier) => {
            const meta = severityMeta(tier);
            return (
              <div key={tier} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-[3px]"
                  style={{ background: `var(--t-${meta.tone})` }}
                />
                <dt className="text-[12px] text-ink-3">{meta.label}</dt>
                <dd data-numeric="" className="text-[12.5px] font-semibold text-ink">
                  {formatNumber(severityCounts[tier])}
                </dd>
              </div>
            );
          })}
          {SEVERITY_ORDER.every((tier) => !severityCounts[tier]) && (
            <p className="text-[12.5px] text-ink-3">
              No credential in this scan carries a severity rating.
            </p>
          )}
        </dl>
      </Panel>

      <WorkArea
        railOpen={railOpen}
        rail={
          <FacetRail
            groups={facetGroups}
            appliedCount={chips.length}
            onClearAll={clearAll}
            onClose={toggleRail}
            mobileTitle="Filter credentials"
          />
        }
      >
      <Panel prominence="lead" flush className="animate-rise overflow-hidden">
        <RecordBar
          trailing={
            <TableToolbar>
              {!railOpen && (
                <ShowFiltersButton onClick={toggleRail} appliedCount={chips.length} />
              )}
              <RefreshButton onRefresh={query.refetch} refreshing={query.isRefreshing} />
              <TableSettings density={density} onDensityChange={setDensityPref} />
              <OverflowMenu
                items={[
                  {
                    key: 'export',
                    label: 'Export this page',
                    hint: `CSV of the ${rows.length} rows shown`,
                    onSelect: onExport,
                    disabled: rows.length === 0,
                    disabledHint: 'Nothing to export - no rows match',
                  },
                ]}
              />
            </TableToolbar>
          }
        >
          <SearchInput
            size="sm"
            value={searchDraft}
            onChange={setSearchDraft}
            placeholder="Search identity name, ARN or credential id…"
            className="w-full min-w-0 sm:max-w-sm"
          />
          <ResultCount
            shown={formatNumber(rows.length)}
            total={formatNumber(total)}
            unit="credentials"
            filtered={chips.length > 0}
            loading={query.isLoading && !query.data}
          />
        </RecordBar>

        <AppliedFilters filters={chips} onRemove={(key) => setParam(key, '')} onClearAll={clearAll} />

        {query.isError && !query.data ? (
          <ErrorState error={query.error} onRetry={query.refetch} />
        ) : (
          <>
            <DataGrid
              caption="Credential register"
              columns={columns}
              rows={rows}
              rowKey={(row, index) => row.id ?? `${row.identity_arn}-${row.cred_id}-${index}`}
              loading={query.isLoading && !query.data}
              refreshing={query.isRefreshing}
              onRowClick={setSelected}
              density={density}
              skeletonRows={10}
              emptyState={
                chips.length > 0 ? (
                  <EmptyState
                    icon={SearchX}
                    title="No credentials match these filters"
                    description="Try a broader severity or credential type, or clear the search term."
                    action={
                      <Button variant="secondary" size="sm" onClick={clearAll}>
                        Clear filters
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={KeyRound}
                    title="No credentials in this scan"
                    description="No identity in this snapshot holds an access key, password or certificate."
                  />
                )
              }
            />

            {total > 0 && (
              <Pagination
                page={filters.page}
                pageSize={filters.pageSize}
                total={total}
                unit="credentials"
                onPageChange={(page) => setParam('page', String(page))}
                onPageSizeChange={(size) => {
                  const next = new URLSearchParams(searchParams);
                  next.set('page_size', String(size));
                  next.delete('page');
                  setSearchParams(next, { replace: true });
                }}
              />
            )}
          </>
        )}
      </Panel>
      </WorkArea>

      <CredentialDrawer credential={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function CredentialDrawer({ credential, onClose }) {
  if (!credential) return null;
  const meta = severityMeta(credential.severity);

  return (
    <Drawer
      open
      onClose={onClose}
      width="md"
      eyebrow={credentialKindMeta(credential.type).label}
      title={credential.cred_id || credential.identity_name || 'Credential'}
      subtitle={
        <span className="flex flex-wrap items-center gap-1.5">
          <Tag tone={meta.tone} size="sm" dot>
            {meta.label}
          </Tag>
          {credential.status && (
            <Tag tone="neutral" size="sm">
              {titleCaseEnum(credential.status)}
            </Tag>
          )}
        </span>
      }
    >
      <div className="flex flex-col gap-5 px-4 py-4 sm:px-5">
        <div>
          <SectionLabel>Credential</SectionLabel>
          <DetailList className="mt-1">
            <DetailRow label="Type">{credentialKindMeta(credential.type).label}</DetailRow>
            <DetailRow label="Identifier" mono>
              <CopyableValue value={credential.cred_id} />
            </DetailRow>
            <DetailRow label="Status">
              {credential.status ? titleCaseEnum(credential.status) : '-'}
            </DetailRow>
            <DetailRow label="Severity">{meta.label}</DetailRow>
            <DetailRow label="Created">{formatDateTime(credential.created_at)}</DetailRow>
            <DetailRow label="Expires">
              {credential.expires_at
                ? formatDateTime(credential.expires_at)
                : credentialKindMeta(credential.type).longLived
                  ? 'Never - this kind does not expire on its own'
                  : 'Not applicable - credentials are issued per session'}
            </DetailRow>
            <DetailRow label="Last used">
              {formatRelative(credential.last_used_date)}
              {credential.last_used_service && (
                <span className="ml-1.5 text-ink-3">via {credential.last_used_service}</span>
              )}
            </DetailRow>
          </DetailList>
        </div>

        <div>
          <SectionLabel>Held by</SectionLabel>
          <DetailList className="mt-1">
            <DetailRow label="Identity">{credential.identity_name || '-'}</DetailRow>
            <DetailRow label="ARN" mono>
              <CopyableValue value={credential.identity_arn} />
            </DetailRow>
            <DetailRow label="Actor type">
              {actorTypeMeta(credential.identity_type).label}
            </DetailRow>
          </DetailList>
        </div>

        {/* Where it is kept, for the two kinds that are kept anywhere. A
            credential in a managed store with a rotation schedule is a
            different proposition from the same credential in an environment
            variable, and this is the screen that can say which. */}
        {credential.store && (
          <div>
            <SectionLabel>Storage</SectionLabel>
            <DetailList className="mt-1">
              <DetailRow label="Store">{credential.store}</DetailRow>
              <DetailRow label="Entry" mono>
                <CopyableValue value={credential.store_name} />
              </DetailRow>
              <DetailRow label="Store ARN" mono>
                <CopyableValue value={credential.store_arn} />
              </DetailRow>
              <DetailRow label="Rotation">
                {credential.rotation_enabled
                  ? `Scheduled every ${credential.rotation_days} days`
                  : 'No rotation schedule attached'}
              </DetailRow>
            </DetailList>
          </div>
        )}

        <div>
          <SectionLabel>What this kind is</SectionLabel>
          <p className="mt-2 rounded-[var(--radius-control)] border border-line bg-surface-2 p-3.5 text-[12.5px] leading-relaxed text-ink-2">
            {credentialKindMeta(credential.type).what}
          </p>
        </div>

        {credential.description && (
          <div>
            <SectionLabel>Description</SectionLabel>
            <p className="mt-2 rounded-[var(--radius-control)] border border-line bg-surface-2 p-3.5 text-[12.5px] leading-relaxed text-ink-2">
              {credential.description}
            </p>
          </div>
        )}
      </div>
    </Drawer>
  );
}

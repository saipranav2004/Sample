import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { KeyRound, RotateCw, SearchX } from 'lucide-react';
import { fetchCredentials, fetchSummary } from '../../lib/api/endpoints';
import { useDebouncedValue, useQuery } from '../../lib/hooks';
import { useScanContext } from '../../app/ScanContext';
import { SEVERITY_ORDER, severityMeta } from '../../lib/domain';
import {
  arnResource,
  formatDateTime,
  formatNumber,
  formatRelative,
  titleCaseEnum,
} from '../../lib/format';
import { PageHeader } from '../../shell/PageHeader';
import { Button } from '../../ui/Button';
import { DetailList, DetailRow, Panel, SectionLabel } from '../../ui/Panel';
import { SearchInput, Select } from '../../ui/Field';
import { ActiveFilters, Toolbar } from '../../ui/Toolbar';
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
 */
export default function CredentialsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedScanId } = useScanContext();
  const [selected, setSelected] = useState(null);
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

  const typeOptions = useMemo(() => {
    const breakdown = summaryQuery.data?.credentials_breakdown || {};
    return Object.entries(breakdown)
      .filter(([, count]) => Number(count) > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ value: key, label: `${titleCaseEnum(key)} (${formatNumber(count)})` }));
  }, [summaryQuery.data]);

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

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;

  const columns = [
    {
      key: 'credential',
      header: 'Credential',
      primary: true,
      width: '26%',
      cell: (row) => (
        <CellStack
          icon={KeyRound}
          title={row.type ? titleCaseEnum(row.type) : 'Credential'}
          meta={row.cred_id || '—'}
          mono
        />
      ),
    },
    {
      key: 'identity',
      header: 'Held by',
      width: '24%',
      cell: (row) => (
        <span className="block min-w-0">
          <span className="block truncate text-[12.5px] font-medium text-ink" title={row.identity_name}>
            {row.identity_name || arnResource(row.identity_arn)}
          </span>
          <span className="block truncate font-mono text-[11px] text-ink-3" title={row.identity_arn}>
            {arnResource(row.identity_arn)}
          </span>
        </span>
      ),
    },
    {
      key: 'severity',
      header: 'Severity',
      width: '11%',
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
      width: '11%',
      cell: (row) => (
        <span className="text-[12.5px] text-ink-2">{row.status ? titleCaseEnum(row.status) : '—'}</span>
      ),
    },
    {
      key: 'lastUsed',
      header: 'Last used',
      width: '15%',
      cell: (row) => (
        <span className="block min-w-0">
          <span className="block text-[12.5px] text-ink-2">{formatRelative(row.last_used_date)}</span>
          <span className="block truncate text-[11px] text-ink-3" title={row.last_used_service}>
            {row.last_used_service || '—'}
          </span>
        </span>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      width: '13%',
      priority: 'wide',
      cell: (row) => <span className="text-[12.5px] text-ink-2">{formatDateTime(row.created_at)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Inventory"
        title="Credential register"
        lede="Every access key, password and certificate recorded against an identity in this scan, flattened so rotation candidates surface directly."
        actions={
          <Button variant="secondary" icon={RotateCw} onClick={query.refetch} loading={query.isRefreshing}>
            Refresh
          </Button>
        }
      />

      <Panel flush className="animate-rise overflow-hidden">
        <Toolbar
          trailing={
            <p className="hidden text-[12.5px] text-ink-3 sm:block" data-numeric="">
              {query.isLoading && !query.data ? '—' : formatNumber(total)} credentials
            </p>
          }
        >
          <SearchInput
            value={searchDraft}
            onChange={setSearchDraft}
            placeholder="Search identity name, ARN or credential id…"
            className="w-full min-w-0 sm:max-w-sm"
          />
          <Select
            value={filters.type}
            onChange={(event) => setParam('type', event.target.value)}
            options={typeOptions}
            placeholder="All credential types"
            aria-label="Filter by credential type"
            className="w-full sm:w-56"
          />
          <Select
            value={filters.severity}
            onChange={(event) => setParam('severity', event.target.value)}
            options={SEVERITY_ORDER.map((value) => ({ value, label: severityMeta(value).label }))}
            placeholder="Any severity"
            aria-label="Filter by severity"
            className="w-full sm:w-40"
          />
        </Toolbar>

        <ActiveFilters filters={chips} onRemove={(key) => setParam(key, '')} onClearAll={clearAll} />

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
      eyebrow={credential.type ? titleCaseEnum(credential.type) : 'Credential'}
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
            <DetailRow label="Type">{credential.type ? titleCaseEnum(credential.type) : '—'}</DetailRow>
            <DetailRow label="Identifier" mono>
              <CopyableValue value={credential.cred_id} />
            </DetailRow>
            <DetailRow label="Status">
              {credential.status ? titleCaseEnum(credential.status) : '—'}
            </DetailRow>
            <DetailRow label="Severity">{meta.label}</DetailRow>
            <DetailRow label="Created">{formatDateTime(credential.created_at)}</DetailRow>
            <DetailRow label="Expires">{formatDateTime(credential.expires_at)}</DetailRow>
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
            <DetailRow label="Identity">{credential.identity_name || '—'}</DetailRow>
            <DetailRow label="ARN" mono>
              <CopyableValue value={credential.identity_arn} />
            </DetailRow>
            <DetailRow label="Resource type">
              {credential.identity_type ? titleCaseEnum(credential.identity_type) : '—'}
            </DetailRow>
          </DetailList>
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

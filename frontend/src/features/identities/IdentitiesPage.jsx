import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Fingerprint, RotateCw, SearchX } from 'lucide-react';
import { fetchIdentities, fetchSummary } from '../../lib/api/endpoints';
import { useDebouncedValue, useQuery } from '../../lib/hooks';
import { useScanContext } from '../../app/ScanContext';
import { classificationMeta } from '../../lib/domain';
import { formatNumber, titleCaseEnum } from '../../lib/format';
import { PageHeader } from '../../shell/PageHeader';
import { Button } from '../../ui/Button';
import { Panel } from '../../ui/Panel';
import { SearchInput, Select } from '../../ui/Field';
import { ActiveFilters, Toolbar } from '../../ui/Toolbar';
import { DataGrid } from '../../ui/DataGrid';
import { Pagination } from '../../ui/Pagination';
import { EmptyState, ErrorState } from '../../ui/States';
import { cn, TONE_CLASSES } from '../../ui/cn';
import {
  ActivityCell,
  ClassificationCell,
  IdentityNameCell,
  OwnerCell,
  RiskMarkersCell,
  TrustCell,
} from './cells';
import { IdentityDrawer } from './IdentityDrawer';
import { describeFilters, FACETS, FILTER_PARAMS, OWNER_TYPE_OPTIONS, readFilters } from './filters';

/**
 * Identity explorer — the workbench every posture signal leads into.
 *
 * Filter state is held in the URL, so a drill-through from the dashboard, a
 * bookmark and a shared link all resolve to the same list, and the applied
 * filters are always visible as removable chips.
 */
export default function IdentitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedScanId } = useScanContext();
  const [selected, setSelected] = useState(null);
  const [searchDraft, setSearchDraft] = useState(() => searchParams.get('search') || '');
  const debouncedSearch = useDebouncedValue(searchDraft, 320);

  /* Keep the URL in step with the debounced search box, resetting paging. */
  useEffect(() => {
    const current = searchParams.get('search') || '';
    if (debouncedSearch === current) return;
    const next = new URLSearchParams(searchParams);
    if (debouncedSearch) next.set('search', debouncedSearch);
    else next.delete('search');
    next.delete('page');
    setSearchParams(next, { replace: true });
  }, [debouncedSearch, searchParams, setSearchParams]);

  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const chips = useMemo(() => describeFilters(searchParams), [searchParams]);

  const query = useQuery(
    (signal) => fetchIdentities({ ...filters, scanId: selectedScanId }, signal),
    [JSON.stringify(filters), selectedScanId],
  );

  /* Classification options come from the scan's own breakdown, so the filter
     can never offer a value this data set does not contain. */
  const summaryQuery = useQuery((signal) => fetchSummary({ scanId: selectedScanId }, signal), [
    selectedScanId,
  ]);

  const classificationOptions = useMemo(() => {
    const breakdown = summaryQuery.data?.classification_breakdown || {};
    return Object.entries(breakdown)
      .filter(([, count]) => Number(count) > 0)
      .map(([key, count]) => ({
        value: key,
        label: `${classificationMeta(key).label} (${formatNumber(count)})`,
      }));
  }, [summaryQuery.data]);

  /* The API exposes no endpoint enumerating resource types, so the options are
     derived from the values present in the loaded page plus any active
     selection — never a hard-coded guess at what AWS might return. */
  const typeOptions = useMemo(() => {
    const values = new Set(
      (query.data?.rows ?? []).map((row) => row.identity_type).filter(Boolean),
    );
    if (filters.identityType) values.add(filters.identityType);
    return [...values].sort().map((value) => ({ value, label: titleCaseEnum(value) }));
  }, [query.data, filters.identityType]);

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

  const toggleFacet = useCallback(
    (param) => {
      const next = new URLSearchParams(searchParams);
      if (next.get(param) === 'true') next.delete(param);
      else next.set(param, 'true');
      next.delete('page');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const clearAll = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    for (const param of FILTER_PARAMS) next.delete(param);
    next.delete('page');
    setSearchParams(next, { replace: true });
    setSearchDraft('');
  }, [searchParams, setSearchParams]);

  const removeChip = useCallback(
    (key) => {
      if (key === 'search') setSearchDraft('');
      setParam(key, '');
    },
    [setParam],
  );

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const filtered = chips.length > 0;

  const columns = [
    {
      key: 'identity',
      header: 'Identity',
      primary: true,
      width: '30%',
      cell: (row) => <IdentityNameCell identity={row} />,
    },
    {
      key: 'classification',
      header: 'Classification',
      width: '13%',
      cell: (row) => <ClassificationCell identity={row} />,
    },
    { key: 'owner', header: 'Owner', width: '17%', cell: (row) => <OwnerCell identity={row} /> },
    {
      key: 'trust',
      header: 'Trust',
      width: '14%',
      priority: 'wide',
      cell: (row) => <TrustCell identity={row} />,
    },
    { key: 'risk', header: 'Markers', width: '15%', cell: (row) => <RiskMarkersCell identity={row} /> },
    {
      key: 'activity',
      header: 'Last active',
      width: '11%',
      cell: (row) => <ActivityCell identity={row} />,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Inventory"
        title="Identity explorer"
        lede="Every principal the discovery engine found in this scan — filter by classification, ownership and posture, then open a record to see its credentials, reach and callers."
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
              {query.isLoading && !query.data ? '—' : formatNumber(total)} matching
            </p>
          }
        >
          <SearchInput
            value={searchDraft}
            onChange={setSearchDraft}
            placeholder="Search name, ARN or classification evidence…"
            className="w-full min-w-0 sm:max-w-sm"
          />
          <Select
            size="md"
            value={filters.classification}
            onChange={(event) => setParam('classification', event.target.value)}
            options={classificationOptions}
            placeholder="All classifications"
            aria-label="Filter by classification"
            className="w-full sm:w-52"
          />
          <Select
            size="md"
            value={filters.ownerType}
            onChange={(event) => setParam('owner_type', event.target.value)}
            options={OWNER_TYPE_OPTIONS}
            placeholder="Any ownership"
            aria-label="Filter by owner type"
            className="w-full sm:w-44"
          />
          {typeOptions.length > 1 && (
            <Select
              size="md"
              value={filters.identityType}
              onChange={(event) => setParam('identity_type', event.target.value)}
              options={typeOptions}
              placeholder="Any resource type"
              aria-label="Filter by resource type"
              className="w-full sm:w-44"
            />
          )}
        </Toolbar>

        <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-surface px-4 py-2.5">
          {FACETS.map((facet) => {
            const active = searchParams.get(facet.param) === 'true';
            return (
              <button
                key={facet.param}
                type="button"
                onClick={() => toggleFacet(facet.param)}
                aria-pressed={active}
                title={facet.hint}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors duration-150',
                  active
                    ? TONE_CLASSES[facet.tone]
                    : 'border-line text-ink-3 hover:border-line-strong hover:text-ink-2',
                )}
              >
                {facet.label}
              </button>
            );
          })}
        </div>

        <ActiveFilters filters={chips} onRemove={removeChip} onClearAll={clearAll} />

        {query.isError && !query.data ? (
          <ErrorState error={query.error} onRetry={query.refetch} />
        ) : (
          <>
            <DataGrid
              caption="Discovered identities"
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id ?? row.arn}
              loading={query.isLoading && !query.data}
              refreshing={query.isRefreshing}
              onRowClick={setSelected}
              skeletonRows={10}
              emptyState={
                filtered ? (
                  <EmptyState
                    icon={SearchX}
                    title="No identities match these filters"
                    description="The scan contains identities, but none satisfy every filter currently applied."
                    action={
                      <Button variant="secondary" size="sm" onClick={clearAll}>
                        Clear filters
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={Fingerprint}
                    title="No identities in this scan"
                    description="This discovery scan recorded no IAM principals. Pick another scan from the switcher, or run a new discovery."
                  />
                )
              }
            />

            {total > 0 && (
              <Pagination
                page={filters.page}
                pageSize={filters.pageSize}
                total={total}
                unit="identities"
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

      <IdentityDrawer
        identity={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

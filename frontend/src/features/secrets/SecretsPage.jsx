import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Copy, Lock, SearchX, ShieldCheck } from 'lucide-react';
import { countIdentities, fetchIdentities } from '../../lib/api/endpoints';
import { useDebouncedValue, useQuery } from '../../lib/hooks';
import { useScanContext } from '../../app/ScanContext';
import { classificationMeta } from '../../lib/domain';
import { arnResource, formatNumber, percentValue } from '../../lib/format';
import { exportRowsToCsv, timestampedName } from '../../lib/csv';
import { PageHeader } from '../../shell/PageHeader';
import { Button, IconButton } from '../../ui/Button';
import { Panel } from '../../ui/Panel';
import { SearchInput } from '../../ui/Field';
import { AppliedFilters, FacetRail, useFacetRail } from '../../ui/FacetRail';
import { RecordBar, ResultCount, ShowFiltersButton, WorkArea } from '../../ui/WorkArea';
import { OverflowMenu, RefreshButton, TableSettings, TableToolbar } from '../../ui/TableTools';
import { MetricTile } from '../../ui/Stat';
import { StatStripSkeleton } from '../../ui/Skeleton';
import { DataGrid } from '../../ui/DataGrid';
import { Pagination } from '../../ui/Pagination';
import { ClearState, EmptyState, ErrorState } from '../../ui/States';
import { useToast } from '../../ui/Toast';
import { ClassificationCell, OwnerCell } from '../identities/cells';
import { ActivityCell, StatusCell } from '../identities/status';
import { IdentityDrawer } from '../identities/IdentityDrawer';
import { FACETS, OWNER_TYPE_OPTIONS } from '../identities/filters';


/**
 * Secret-backed identities - the principals where a leaked secret grants
 * working access.
 *
 * `GET /api/secrets` accepts only a search term, which is too thin for the
 * question this screen answers. It reads `GET /api/identities` with
 * `is_secret=true` locked on instead: the same records, with the full facet
 * vocabulary available for refinement. The lock is rendered as a
 * non-removable chip so the scoping is never invisible.
 *
 * The headline figures are the *intersections* - secret-backed and admin,
 * and without MFA, and stale - because those are the actual risk, and the API
 * accepts every combination in a single request.
 */
const DENSITY_KEY = 'dna.grid.density';
const LOCKED = { isSecret: 'true' };

const CROSS_SECTIONS = [
  {
    key: 'admin',
    label: 'Also admin-level',
    query: { is_admin: 'true' },
    apiQuery: { isAdmin: 'true' },
    tone: 'critical',
    caption: 'A leak here grants administrator access',
  },
  {
    key: 'mfa',
    label: 'Also without MFA',
    query: { without_mfa: 'true' },
    apiQuery: { withoutMfa: 'true' },
    tone: 'critical',
    caption: 'Human identities with no second factor',
  },
  {
    key: 'stale',
    label: 'Also stale 90+ days',
    query: { is_stale: 'true' },
    apiQuery: { isStale: 'true' },
    tone: 'high',
    caption: 'Unused, but the secret still works',
  },
];

export default function SecretsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedScanId, activeScan } = useScanContext();
  const { notify } = useToast();
  const [selected, setSelected] = useState(null);
  const [searchDraft, setSearchDraft] = useState(() => searchParams.get('search') || '');
  const debouncedSearch = useDebouncedValue(searchDraft, 320);
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

  useEffect(() => {
    const current = searchParams.get('search') || '';
    if (debouncedSearch === current) return;
    const next = new URLSearchParams(searchParams);
    if (debouncedSearch) next.set('search', debouncedSearch);
    else next.delete('search');
    next.delete('page');
    setSearchParams(next, { replace: true });
  }, [debouncedSearch, searchParams, setSearchParams]);

  const refinements = useMemo(() => {
    const applied = {};
    for (const facet of FACETS) {
      if (facet.param === 'is_secret') continue;
      if (searchParams.get(facet.param) === 'true') {
        applied[facet.param.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = 'true';
      }
    }
    if (searchParams.get('classification')) applied.classification = searchParams.get('classification');
    if (searchParams.get('owner_type')) applied.ownerType = searchParams.get('owner_type');
    return applied;
  }, [searchParams]);

  const filters = useMemo(
    () => ({
      ...LOCKED,
      ...refinements,
      search: searchParams.get('search') || '',
      page: Number(searchParams.get('page')) || 1,
      pageSize: Number(searchParams.get('page_size')) || 25,
    }),
    [refinements, searchParams],
  );

  const query = useQuery(
    (signal) => fetchIdentities({ ...filters, scanId: selectedScanId }, signal),
    [JSON.stringify(filters), selectedScanId],
  );

  /* Exact intersection counts - one filtered request each, one row apiece. */
  const crossQuery = useQuery(
    async (signal) => {
      const pairs = await Promise.all([
        ['total', await countIdentities({ ...LOCKED, scanId: selectedScanId }, signal)],
        ['allIdentities', await countIdentities({ scanId: selectedScanId }, signal)],
        ...CROSS_SECTIONS.map(async (section) => [
          section.key,
          await countIdentities({ ...LOCKED, ...section.apiQuery, scanId: selectedScanId }, signal),
        ]),
      ]);
      return Object.fromEntries(pairs);
    },
    [selectedScanId],
  );
  const counts = crossQuery.data ?? {};

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

  const toggleParam = useCallback(
    (key, value) => {
      const next = new URLSearchParams(searchParams);
      if (next.get(key) === value) next.delete(key);
      else next.set(key, value);
      next.delete('page');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const refinementChips = useMemo(() => {
    const list = [{ key: '__locked', label: 'Scope', value: 'Secret-backed', locked: true }];
    if (searchParams.get('search')) {
      list.push({ key: 'search', label: 'Search', value: searchParams.get('search') });
    }
    if (searchParams.get('classification')) {
      list.push({
        key: 'classification',
        label: 'Class',
        value: classificationMeta(searchParams.get('classification')).label,
      });
    }
    if (searchParams.get('owner_type')) {
      const match = OWNER_TYPE_OPTIONS.find((o) => o.value === searchParams.get('owner_type'));
      list.push({ key: 'owner_type', label: 'Owner', value: match?.label || searchParams.get('owner_type') });
    }
    for (const facet of FACETS) {
      if (facet.param === 'is_secret') continue;
      if (searchParams.get(facet.param) === 'true') {
        list.push({ key: facet.param, label: 'Facet', value: facet.label });
      }
    }
    return list;
  }, [searchParams]);

  const clearRefinements = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    for (const facet of FACETS) next.delete(facet.param);
    next.delete('classification');
    next.delete('owner_type');
    next.delete('search');
    next.delete('page');
    setSearchParams(next, { replace: true });
    setSearchDraft('');
  }, [searchParams, setSearchParams]);

  const facetGroups = useMemo(
    () => [
      {
        key: 'posture',
        label: 'Posture',
        options: FACETS.filter((facet) => facet.param !== 'is_secret').map((facet) => ({
          value: facet.param,
          label: facet.label,
          active: searchParams.get(facet.param) === 'true',
        })),
        onToggle: (value) => toggleParam(value, 'true'),
        note: 'Refines within secret-backed identities only.',
      },
      {
        key: 'ownership',
        label: 'Ownership',
        options: OWNER_TYPE_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
          active: searchParams.get('owner_type') === option.value,
        })),
        onToggle: (value) => toggleParam('owner_type', value),
      },
    ],
    [searchParams, toggleParam],
  );

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const refined = refinementChips.length > 1;

  const maxEvents = useMemo(
    () => rows.reduce((max, row) => Math.max(max, Number(row.total_events) || 0), 0),
    [rows],
  );

  const onExport = () => {
    exportRowsToCsv({
      filename: timestampedName(`secret-backed-${activeScan?.target_name || 'scan'}`),
      columns: [
        { header: 'Name', value: (row) => row.name },
        { header: 'ARN', value: (row) => row.arn },
        { header: 'Classification', value: (row) => row.classification },
        { header: 'Owner', value: (row) => row.owner_name || row.primary_owner },
        { header: 'Owner type', value: (row) => row.owner_type },
        { header: 'Admin', value: (row) => (row.is_admin ? 'yes' : 'no') },
        { header: 'MFA enabled', value: (row) => (row.mfa_enabled ? 'yes' : 'no') },
        { header: 'Last active', value: (row) => row.last_active },
        { header: 'Events', value: (row) => row.total_events },
      ],
      rows,
    });
    notify({
      variant: 'success',
      title: 'Exported this page',
      description: `${formatNumber(rows.length)} rows written to CSV. The API has no bulk export, so only the loaded page is included.`,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Secret-backed identities"
        lede="Principals whose credentials sit in a secret store entry. A leaked secret grants working access to every identity on this list, so the intersections below are the queue that matters."
      />

      {crossQuery.isLoading && !crossQuery.data ? (
        <StatStripSkeleton count={4} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Secret-backed"
            value={counts.total}
            tone="medium"
            icon={Lock}
            caption={
              counts.allIdentities
                ? `${formatNumber(counts.allIdentities)} identities in this scan`
                : 'Identities with a secret store entry'
            }
            meter={percentValue(counts.total, counts.allIdentities)}
            meterLabel="Share of all identities"
            className="animate-rise"
          />
          {CROSS_SECTIONS.map((section, index) => (
            <MetricTile
              key={section.key}
              as={Link}
              to={`?${new URLSearchParams(section.query).toString()}`}
              label={section.label}
              value={counts[section.key]}
              tone={section.tone}
              caption={section.caption}
              meter={percentValue(counts[section.key], counts.total)}
              meterLabel="Share of secret-backed identities"
              className="animate-rise"
              data-stagger=""
              style={{ '--stagger': index + 1 }}
            />
          ))}
        </div>
      )}

      <WorkArea
        railOpen={railOpen}
        rail={
          <FacetRail
            groups={facetGroups}
            appliedCount={refined ? refinementChips.length - 1 : 0}
            onClearAll={clearRefinements}
            onClose={toggleRail}
            mobileTitle="Refine secret-backed"
          />
        }
      >
        <Panel flush className="animate-rise overflow-hidden">
          <RecordBar
            trailing={
              <TableToolbar>
                {!railOpen && (
                  <ShowFiltersButton
                    onClick={toggleRail}
                    appliedCount={refined ? refinementChips.length - 1 : 0}
                  />
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
              placeholder="Search name, ARN or classification evidence…"
              className="w-full min-w-0 sm:max-w-sm"
            />
            <ResultCount
              shown={formatNumber(rows.length)}
              total={formatNumber(total)}
              unit="identities"
              filtered={refined}
              loading={query.isLoading && !query.data}
            />
          </RecordBar>

          <AppliedFilters
            filters={refinementChips}
            onRemove={(key) => {
              if (key === '__locked') return;
              if (key === 'search') setSearchDraft('');
              setParam(key, '');
            }}
            onClearAll={clearRefinements}
          />

          {query.isError && !query.data ? (
            <ErrorState error={query.error} onRetry={query.refetch} />
          ) : (
            <>
              <DataGrid
                caption="Secret-backed identities"
                columns={[
                  {
                    key: 'identity',
                    header: 'Identity',
                    primary: true,
                    width: '30%',
                    cell: (row) => {
                      const meta = classificationMeta(row.classification);
                      return (
                        <span className="flex min-w-0 items-center gap-3">
                          <span
                            aria-hidden="true"
                            className="grid size-8 shrink-0 place-items-center rounded-[9px] border text-[10px] font-bold"
                            style={{
                              borderColor: `color-mix(in srgb, ${meta.color} 34%, transparent)`,
                              background: `color-mix(in srgb, ${meta.color} 10%, transparent)`,
                              color: meta.color,
                            }}
                          >
                            {meta.kind === 'human' ? 'HU' : 'NHI'}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-semibold text-ink">
                              {row.name || arnResource(row.arn)}
                            </span>
                            <span className="block truncate font-mono text-[11px] text-ink-3" title={row.arn}>
                              {arnResource(row.arn)}
                            </span>
                          </span>
                        </span>
                      );
                    },
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    width: '20%',
                    cell: (row) => <StatusCell identity={row} />,
                  },
                  {
                    key: 'classification',
                    header: 'Class',
                    width: '12%',
                    cell: (row) => <ClassificationCell identity={row} />,
                  },
                  { key: 'owner', header: 'Owner', width: '20%', cell: (row) => <OwnerCell identity={row} /> },
                  {
                    key: 'activity',
                    header: 'Activity',
                    width: '18%',
                    cell: (row) => <ActivityCell identity={row} maxEvents={maxEvents} />,
                  },
                ]}
                rows={rows}
                rowKey={(row) => row.id ?? row.arn}
                loading={query.isLoading && !query.data}
                refreshing={query.isRefreshing}
                onRowClick={setSelected}
                density={density}
                rowAccent={(row) => classificationMeta(row.classification).color}
                skeletonRows={8}
                rowActions={(row) => (
                  <IconButton
                    icon={Copy}
                    label={`Copy ARN for ${row.name || row.arn}`}
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      navigator.clipboard?.writeText(row.arn);
                      notify({ variant: 'success', title: 'ARN copied', duration: 2200 });
                    }}
                  />
                )}
                emptyState={
                  refined ? (
                    <EmptyState
                      icon={SearchX}
                      title="No secret-backed identity matches this refinement"
                      description="There are secret-backed identities in this scan, but none satisfy every filter applied on top of that scope."
                      action={
                        <Button variant="secondary" size="sm" onClick={clearRefinements}>
                          Clear refinements
                        </Button>
                      }
                    />
                  ) : (
                    <ClearState
                      icon={ShieldCheck}
                      title="No secret-backed identities"
                      description="No identity in this scan has credentials held in a secret store entry. That is the good outcome here."
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
      </WorkArea>

      <IdentityDrawer identity={selected} open={Boolean(selected)} onClose={() => setSelected(null)} />
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, Fingerprint, SearchX } from 'lucide-react';
import { fetchIdentities, fetchSummary } from '../../lib/api/endpoints';
import { useDebouncedValue, useQuery } from '../../lib/hooks';
import { useScanContext } from '../../app/ScanContext';
import { actorCategoryMeta, actorTypeMeta, classificationMeta, ownerTypeMeta } from '../../lib/domain';
import { arnResource, formatNumber, titleCaseEnum } from '../../lib/format';
import { exportRowsToCsv, timestampedName } from '../../lib/csv';
import { PageHeader } from '../../shell/PageHeader';
import { Button, IconButton } from '../../ui/Button';
import { Panel } from '../../ui/Panel';
import { SearchInput } from '../../ui/Field';
import { AppliedFilters, FacetRail, useFacetRail } from '../../ui/FacetRail';
import { RecordBar, ResultCount, ShowFiltersButton, WorkArea } from '../../ui/WorkArea';
import { Tabs } from '../../ui/Tabs';
import { OverflowMenu, RefreshButton, TableSettings, TableToolbar } from '../../ui/TableTools';
import { DataGrid } from '../../ui/DataGrid';
import { Pagination } from '../../ui/Pagination';
import { EmptyState, ErrorState } from '../../ui/States';
import { useToast } from '../../ui/Toast';
import { IdentityDrawer } from './IdentityDrawer';
import { ActivityCell, StatusCell } from './status';
import {
  ACTOR_CATEGORY_OPTIONS,
  FACETS,
  FILTER_PARAMS,
  OWNER_TYPE_OPTIONS,
  describeFilters,
  readFilters,
} from './filters';

/**
 * Identity explorer - the workbench every posture signal leads into.
 *
 * Filter state lives in the URL, so a dashboard drill-through, a bookmark and
 * a shared link all resolve to the same list. View tabs are single-parameter
 * presets that *replace* the current filters; the facet rail refines
 * additively. Both only ever emit parameters `GET /api/identities` accepts.
 */

/** Each preset must be expressible in one request - no client-side unions. */
const VIEW_PRESETS = [
  { key: 'all', label: 'All identities', params: {}, countField: 'total_identities' },
  { key: 'admin', label: 'Admin access', params: { is_admin: 'true' }, countField: 'total_admin' },
  { key: 'stale', label: 'Stale 90+', params: { is_stale: 'true' }, countField: 'total_stale_90plus' },
  { key: 'orphaned', label: 'Orphaned', params: { owner_type: 'ORPHANED' }, countField: 'total_orphaned' },
  /* There is no "secret-backed" preset here any more. Whether a credential is
     held in a managed store is a property of the credential, so it is a filter
     on the Credentials screen - listing identities by it put the same fact in
     two places and invited the reader to treat a storage decision as a kind of
     identity. */
];

const DENSITY_KEY = 'dna.grid.density';

/* A short mark per classification, so the column tells the kinds apart. */
const CLASS_BADGE = {
  NHI_SERVICE: 'SVC',
  NHI_AGENT: 'AI',
  NHI_CICD: 'CI',
  NHI_SAAS: 'SAAS',
  NHI_EPHEMERAL: 'EPH',
  DUAL_IDENTITY: 'DUAL',
  UNCLASSIFIED: '?',
};

export default function IdentitiesPage() {
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

  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const chips = useMemo(() => describeFilters(searchParams), [searchParams]);

  const query = useQuery(
    (signal) => fetchIdentities({ ...filters, scanId: selectedScanId }, signal),
    [JSON.stringify(filters), selectedScanId],
  );

  /* Facet counts and classification options come from the scan's own
     aggregates, so a filter never offers a value this snapshot lacks and the
     operator knows the size of a filter before applying it. */
  const summaryQuery = useQuery((signal) => fetchSummary({ scanId: selectedScanId }, signal), [
    selectedScanId,
  ]);
  const summary = summaryQuery.data;

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

  const clearAll = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    for (const param of FILTER_PARAMS) next.delete(param);
    next.delete('page');
    setSearchParams(next, { replace: true });
    setSearchDraft('');
  }, [searchParams, setSearchParams]);

  const applyPreset = useCallback(
    (key) => {
      const preset = VIEW_PRESETS.find((entry) => entry.key === key);
      if (!preset) return;
      const next = new URLSearchParams(searchParams);
      for (const param of FILTER_PARAMS) next.delete(param);
      for (const [param, value] of Object.entries(preset.params)) next.set(param, value);
      next.delete('page');
      setSearchParams(next, { replace: true });
      setSearchDraft('');
    },
    [searchParams, setSearchParams],
  );

  /* A preset is active only when the URL holds exactly its parameters. */
  const activePreset = useMemo(() => {
    const applied = FILTER_PARAMS.filter((param) => searchParams.get(param));
    const match = VIEW_PRESETS.find((preset) => {
      const keys = Object.keys(preset.params);
      return (
        keys.length === applied.length &&
        keys.every((key) => searchParams.get(key) === preset.params[key])
      );
    });
    return match?.key ?? null;
  }, [searchParams]);

  const classificationOptions = useMemo(() => {
    const breakdown = summary?.classification_breakdown || {};
    return Object.entries(breakdown)
      .filter(([, count]) => Number(count) > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({
        value: key,
        label: classificationMeta(key).label,
        count: Number(count),
        active: searchParams.get('classification') === key,
      }));
  }, [summary, searchParams]);

  /* Ordered by the canonical category order rather than by count, so the list
     does not reshuffle under the reader as a filter narrows it. */
  const actorCategoryOptions = useMemo(() => {
    const breakdown = summary?.actor_category_breakdown || {};
    return ACTOR_CATEGORY_OPTIONS.filter((option) => Number(breakdown[option.value]) > 0).map(
      (option) => ({
        value: option.value,
        label: option.label,
        count: Number(breakdown[option.value]),
        active: searchParams.get('actor_category') === option.value,
      }),
    );
  }, [summary, searchParams]);

  const facetGroups = useMemo(
    () => [
      {
        key: 'classification',
        label: 'Classification',
        options: classificationOptions,
        onToggle: (value) => toggleParam('classification', value),
      },
      {
        key: 'posture',
        label: 'Risk signals',
        options: FACETS.map((facet) => ({
          value: facet.param,
          label: facet.label,
          count: facet.summaryField ? Number(summary?.[facet.summaryField]) : undefined,
          active: searchParams.get(facet.param) === 'true',
        })),
        onToggle: (value) => toggleParam(value, 'true'),
      },
      {
        key: 'actor',
        label: 'Actor category',
        options: actorCategoryOptions,
        onToggle: (value) => toggleParam('actor_category', value),
        note: 'What the identity is: the compute, pipeline, agent or vendor platform that acts. The IAM role it assumes is a credential, and lives on the Credentials screen.',
      },
      {
        key: 'ownership',
        label: 'Ownership',
        options: OWNER_TYPE_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
          count: option.value === 'ORPHANED' ? Number(summary?.total_orphaned) : undefined,
          active: searchParams.get('owner_type') === option.value,
        })),
        onToggle: (value) => toggleParam('owner_type', value),
      },
    ],
    [classificationOptions, actorCategoryOptions, summary, searchParams, toggleParam],
  );

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const filtered = chips.length > 0;

  /* Event bars are relative to the busiest row on screen - a page-local scale,
     which is the comparison a reviewer is actually making. */
  const maxEvents = useMemo(
    () => rows.reduce((max, row) => Math.max(max, Number(row.total_events) || 0), 0),
    [rows],
  );

  const onExport = () => {
    exportRowsToCsv({
      filename: timestampedName(`identities-${activeScan?.target_name || 'scan'}`),
      columns: [
        { header: 'Name', value: (row) => row.name },
        { header: 'ARN', value: (row) => row.arn },
        { header: 'Actor type', value: (row) => actorTypeMeta(row.identity_type).label },
        { header: 'Actor id', value: (row) => row.actor_id },
        { header: 'Actor category', value: (row) => actorCategoryMeta(row.actor_category).label },
        { header: 'Discovered by', value: (row) => row.discovery_api },
        { header: 'Holds', value: (row) => (row.principal_type === 'IAM_USER' ? 'IAM user' : 'IAM role') },
        { header: 'Classification', value: (row) => row.classification },
        { header: 'Owner', value: (row) => row.owner_name || row.primary_owner },
        { header: 'Owner type', value: (row) => row.owner_type },
        { header: 'Trust type', value: (row) => row.trust_type },
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

  const columns = [
    {
      key: 'identity',
      header: 'Identity',
      primary: true,
      width: '24%',
      cell: (row) => {
        const meta = classificationMeta(row.classification);
        return (
          <span className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-[9px] border text-[10px] font-bold tracking-tight"
              style={{
                borderColor: `color-mix(in srgb, ${meta.color} 34%, transparent)`,
                background: `color-mix(in srgb, ${meta.color} 10%, transparent)`,
                /* Mixed toward the ink so the letters clear 4.5:1 on the tint
                   in both themes; the hue still says which class. */
                color: `color-mix(in srgb, ${meta.color} 62%, var(--t-ink))`,
              }}
            >
              {CLASS_BADGE[row.classification] ?? 'NHI'}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-ink" title={row.name || row.arn}>
                {row.name || arnResource(row.arn)}
              </span>
              {/* The actor, not a second printing of the name. The line used
                  to repeat the ARN's resource part, which for every row in
                  this estate is the name directly above it. What the reader
                  cannot see from the name is what kind of thing this is and
                  which instance of it. */}
              <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
                <span className="truncate text-[11px] text-ink-3" title={actorTypeMeta(row.identity_type).label}>
                  {actorTypeMeta(row.identity_type).label}
                </span>
                {row.actor_id && row.actor_id !== row.name && (
                  <>
                    <span aria-hidden="true" className="text-ink-3">
                      ·
                    </span>
                    <span className="truncate font-mono text-[11px] text-ink-3" title={row.actor_id}>
                      {row.actor_id}
                    </span>
                  </>
                )}
              </span>
            </span>
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: '19%',
      cell: (row) => <StatusCell identity={row} />,
    },
    {
      key: 'classification',
      header: 'Class',
      width: '11%',
      cell: (row) => {
        const meta = classificationMeta(row.classification);
        return (
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-[3px]"
              style={{ background: meta.color }}
            />
            <span className="truncate text-[12.5px] text-ink-2">{meta.label}</span>
          </span>
        );
      },
    },
    {
      key: 'owner',
      header: 'Owner',
      width: '19%',
      cell: (row) => {
        const meta = ownerTypeMeta(row.owner_type);
        const owner = row.owner_name || row.primary_owner || row.created_by_name;
        const orphaned = String(row.owner_type).toUpperCase() === 'ORPHANED';
        return (
          <span className="block min-w-0">
            <span
              className={cnOwner(orphaned)}
              title={owner || undefined}
            >
              {owner || 'Unassigned'}
            </span>
            <span className={`block truncate text-[11px] ${orphaned ? 'text-high' : 'text-ink-3'}`}>
              {meta.label}
            </span>
          </span>
        );
      },
    },
    {
      key: 'trust',
      header: 'Trust',
      width: '11%',
      priority: 'wide',
      cell: (row) => (
        <span className="block min-w-0">
          <span className="block truncate text-[12.5px] text-ink-2">
            {row.trust_type ? titleCaseEnum(row.trust_type) : '-'}
          </span>
          {/* What the actor holds. This line used to print the identity's
              "type", which was IAM_ROLE for every machine in the estate -
              a credential kind presented as a kind of identity. */}
          <span className="block truncate text-[11px] text-ink-3">
            Holds {row.principal_type === 'IAM_USER' ? 'an IAM user' : 'an IAM role'}
          </span>
        </span>
      ),
    },
    {
      key: 'activity',
      header: 'Activity',
      width: '16%',
      cell: (row) => <ActivityCell identity={row} maxEvents={maxEvents} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Identity explorer"
        tabs={
          <Tabs
            size="sm"
            value={activePreset ?? 'custom'}
            onChange={applyPreset}
            tabs={[
              ...VIEW_PRESETS.map((preset) => ({
                value: preset.key,
                label: preset.label,
                count: summary ? Number(summary[preset.countField]) : undefined,
              })),
              ...(activePreset === null ? [{ value: 'custom', label: 'Custom filter' }] : []),
            ]}
          />
        }
      />

      <WorkArea
        railOpen={railOpen}
        rail={
          <FacetRail
            groups={facetGroups}
            appliedCount={chips.length}
            onClearAll={clearAll}
            onClose={toggleRail}
            mobileTitle="Filter identities"
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
              placeholder="Search name, ARN or classification evidence…"
              className="w-full min-w-0 sm:max-w-sm"
            />
            <ResultCount
              shown={formatNumber(rows.length)}
              total={formatNumber(total)}
              unit="identities"
              filtered={filtered}
              loading={query.isLoading && !query.data}
            />
          </RecordBar>

          <AppliedFilters
            filters={chips}
            onRemove={(key) => {
              if (key === 'search') setSearchDraft('');
              setParam(key, '');
            }}
            onClearAll={clearAll}
          />

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
                density={density}
                rowAccent={(row) => classificationMeta(row.classification).color}
                skeletonRows={10}
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
                      title="No identities discovered"
                      description="Discovery found nothing to list. Check that the AWS connector is collecting on the Integrations screen."
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

function cnOwner(orphaned) {
  return orphaned
    ? 'block truncate text-[12.5px] text-ink-3 italic'
    : 'block truncate text-[12.5px] text-ink-2';
}

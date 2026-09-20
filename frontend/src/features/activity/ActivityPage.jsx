import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, CalendarClock, Eye, List, PenLine } from 'lucide-react';
import { fetchEvents } from '../../lib/api/endpoints';
import { useDebouncedValue, useQuery } from '../../lib/hooks';
import { useScanContext } from '../../app/ScanContext';
import {
  arnResource,
  formatDateTime,
  formatNumber,
  formatRelative,
  formatRelativeShort,
  percentValue,
} from '../../lib/format';
import { PageHeader } from '../../shell/PageHeader';
import { Button } from '../../ui/Button';
import { Panel, PanelHeader } from '../../ui/Panel';
import { AppliedFilters } from '../../ui/FacetRail';
import { RecordBar, ResultCount } from '../../ui/WorkArea';
import { RefreshButton, TableToolbar } from '../../ui/TableTools';
import { SegmentedControl } from '../../ui/Tabs';
import { CellStack, DataGrid } from '../../ui/DataGrid';
import { Pagination } from '../../ui/Pagination';
import { ProportionBar } from '../../ui/Meter';
import { MetricTile } from '../../ui/Stat';
import { Tag } from '../../ui/Tag';
import { CopyableValue } from '../../ui/Copyable';
import { EmptyState, ErrorState } from '../../ui/States';
import { ActivityFeed } from './ActivityFeed';
import { IdentityPicker } from './IdentityPicker';

/**
 * CloudTrail activity for the scan.
 *
 * Two honesty constraints shape this screen. The API filters events by an
 * exact `identity_arn` and by nothing else, so that is the only filter
 * offered - and because the match is exact, the ARN is chosen from the scan's
 * identities rather than typed (see `IdentityPicker`). A free-text box against
 * an exact match is unusable: every partial value returns nothing, which reads
 * as a broken filter. And no parameter separates mutating from read-only
 * calls, so that split is computed over the loaded window only and is
 * labelled with the window size everywhere it appears. Scan-level totals come
 * from the scan record itself.
 */
const VIEWS = [
  { value: 'table', label: 'Table', icon: List },
  { value: 'timeline', label: 'Timeline', icon: CalendarClock },
];

export default function ActivityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedScanId, activeScan } = useScanContext();
  const [arnDraft, setArnDraft] = useState(() => searchParams.get('identity_arn') || '');
  const debouncedArn = useDebouncedValue(arnDraft.trim(), 400);
  const [view, setView] = useState('table');

  useEffect(() => {
    const current = searchParams.get('identity_arn') || '';
    if (debouncedArn === current) return;
    const next = new URLSearchParams(searchParams);
    if (debouncedArn) next.set('identity_arn', debouncedArn);
    else next.delete('identity_arn');
    next.delete('page');
    setSearchParams(next, { replace: true });
  }, [debouncedArn, searchParams, setSearchParams]);

  const filters = useMemo(
    () => ({
      identityArn: searchParams.get('identity_arn') || '',
      page: Number(searchParams.get('page')) || 1,
      pageSize: Number(searchParams.get('page_size')) || 25,
    }),
    [searchParams],
  );

  const query = useQuery(
    (signal) => fetchEvents({ ...filters, scanId: selectedScanId }, signal),
    [JSON.stringify(filters), selectedScanId],
  );

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;

  /* Page-scoped shape. Labelled as such wherever it is shown, because no API
     parameter can produce these splits across the whole scan. */
  const shape = useMemo(() => {
    let mutating = 0;
    const sources = new Map();
    const regions = new Map();
    for (const event of rows) {
      if (String(event.read_only).toLowerCase() !== 'true') mutating += 1;
      if (event.event_source) sources.set(event.event_source, (sources.get(event.event_source) || 0) + 1);
      if (event.region) regions.set(event.region, (regions.get(event.region) || 0) + 1);
    }
    return {
      window: rows.length,
      mutating,
      readOnly: rows.length - mutating,
      sources: [...sources.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      regions: [...regions.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [rows]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const clearArn = () => {
    setArnDraft('');
    setParam('identity_arn', '');
  };

  const chips = filters.identityArn
    ? [{ key: 'identity_arn', label: 'Identity', value: arnResource(filters.identityArn) }]
    : [];

  const loading = query.isLoading && !query.data;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="API activity"
        lede="CloudTrail events captured by this scan, newest first. Mutating calls are marked separately from read-only ones, so privilege actually being used stands out from privilege merely existing."
      />

      <div className="grid gap-3 @min-[30rem]:grid-cols-2 @min-[54rem]:grid-cols-4">
        <MetricTile
          label="Events in this scan"
          value={activeScan?.total_events}
          tone="brand"
          icon={Activity}
          caption={
            activeScan
              ? `Ingested for ${activeScan.target_name || activeScan.account_id}`
              : 'No scan selected'
          }
          className="animate-rise"
        />
        <MetricTile
          label="Mutating in view"
          value={shape.mutating}
          tone={shape.mutating > 0 ? 'high' : 'low'}
          caption={`Of ${formatNumber(shape.window)} events on this page`}
          meter={percentValue(shape.mutating, shape.window)}
          meterLabel="Share of the loaded window"
          className="animate-rise"
          data-stagger=""
          style={{ '--stagger': 1 }}
        />
        <MetricTile
          label="Read-only in view"
          value={shape.readOnly}
          tone="info"
          caption={`Of ${formatNumber(shape.window)} events on this page`}
          className="animate-rise"
          data-stagger=""
          style={{ '--stagger': 2 }}
        />
        <MetricTile
          label="Regions in view"
          value={shape.regions.length}
          tone="neutral"
          caption={
            shape.regions[0] ? `Most active: ${shape.regions[0][0]}` : 'No regions recorded'
          }
          className="animate-rise"
          data-stagger=""
          style={{ '--stagger': 3 }}
        />
      </div>

      <Panel className="animate-rise">
        <PanelHeader
          title="Shape of the loaded window"
          subtitle={`Computed over the ${formatNumber(shape.window)} events currently on screen. The API offers no filter for read-only versus mutating, so this cannot be stated for the whole scan.`}
        />
        {shape.window === 0 ? (
          <p className="mt-3 text-[12.5px] text-ink-3">Nothing loaded to summarise.</p>
        ) : (
          <div className="mt-3.5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <ProportionBar
                height={12}
                total={shape.window}
                ariaLabel={`${shape.mutating} mutating and ${shape.readOnly} read-only events in view`}
                segments={[
                  { key: 'mutating', label: 'Mutating', value: shape.mutating, color: 'var(--t-high)' },
                  { key: 'read', label: 'Read-only', value: shape.readOnly, color: 'var(--t-info)' },
                ]}
              />
              <dl className="mt-3 flex flex-wrap gap-x-7 gap-y-2">
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-high" />
                  <dt className="text-[12px] text-ink-3">Mutating</dt>
                  <dd data-numeric="" className="text-[12.5px] font-semibold text-ink">
                    {formatNumber(shape.mutating)}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-info" />
                  <dt className="text-[12px] text-ink-3">Read-only</dt>
                  <dd data-numeric="" className="text-[12.5px] font-semibold text-ink">
                    {formatNumber(shape.readOnly)}
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <p className="text-[10.5px] font-semibold tracking-[0.11em] text-ink-3 uppercase">
                Busiest event sources in view
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {shape.sources.map(([source, count]) => (
                  <li key={source} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-2">
                      {source}
                    </span>
                    <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-3">
                      <span
                        className="block h-full rounded-full bg-[var(--t-ramp-4)] transition-[width] duration-700 ease-[var(--ease-out-quint)]"
                        style={{ width: `${percentValue(count, shape.sources[0][1])}%` }}
                      />
                    </span>
                    <span data-numeric="" className="w-8 shrink-0 text-right text-[12px] font-semibold text-ink">
                      {formatNumber(count)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Panel>

      <Panel flush className="animate-rise overflow-hidden">
        <RecordBar
          trailing={
            <TableToolbar>
              <SegmentedControl label="View mode" options={VIEWS} value={view} onChange={setView} />
              <RefreshButton onRefresh={query.refetch} refreshing={query.isRefreshing} label="Refresh events" />
            </TableToolbar>
          }
        >
          <IdentityPicker
            scanId={selectedScanId}
            value={arnDraft}
            onChange={(arn) => setArnDraft(arn)}
          />
          <ResultCount
            shown={formatNumber(rows.length)}
            total={formatNumber(total)}
            unit="events"
            filtered={chips.length > 0}
            loading={loading}
          />
          <span className="hidden text-[11.5px] text-ink-3 xl:inline">
            The events API matches one ARN exactly
          </span>
        </RecordBar>

        <AppliedFilters filters={chips} onRemove={clearArn} onClearAll={clearArn} />

        {query.isError && !query.data ? (
          <ErrorState error={query.error} onRetry={query.refetch} />
        ) : view === 'timeline' ? (
          <div className="p-4 sm:p-5">
            <ActivityFeed
              events={rows}
              loading={loading}
              error={query.error}
              onRetry={query.refetch}
              emptyHint="No CloudTrail events were captured for this scope."
            />
          </div>
        ) : (
          <DataGrid
            caption="CloudTrail events"
            columns={[
              {
                key: 'event',
                header: 'Event',
                primary: true,
                width: '24%',
                cell: (row) => {
                  const mutating = String(row.read_only).toLowerCase() !== 'true';
                  return (
                    <CellStack
                      icon={mutating ? PenLine : Eye}
                      tone={mutating ? 'border-high/30 bg-high-soft text-high' : undefined}
                      title={row.event_name || 'Unnamed event'}
                      meta={row.event_source || '-'}
                    />
                  );
                },
              },
              {
                key: 'identity',
                header: 'Identity',
                width: '24%',
                cell: (row) => (
                  <span className="block min-w-0">
                    <span className="block truncate text-[12.5px] text-ink-2" title={row.identity_name}>
                      {row.identity_name || '-'}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-ink-3" title={row.identity_arn}>
                      {arnResource(row.identity_arn)}
                    </span>
                  </span>
                ),
              },
              {
                key: 'mode',
                header: 'Mode',
                width: '11%',
                cell: (row) => {
                  const mutating = String(row.read_only).toLowerCase() !== 'true';
                  return (
                    <Tag tone={mutating ? 'high' : 'neutral'} size="sm">
                      {mutating ? 'Mutating' : 'Read-only'}
                    </Tag>
                  );
                },
              },
              {
                key: 'source',
                header: 'Source',
                width: '18%',
                priority: 'wide',
                cell: (row) => (
                  <span className="block min-w-0">
                    <span className="block truncate font-mono text-[12px] text-ink-2">
                      {row.source_ip || '-'}
                    </span>
                    <span className="block truncate text-[11px] text-ink-3" title={row.user_agent}>
                      {row.user_agent || '-'}
                    </span>
                  </span>
                ),
              },
              {
                key: 'region',
                header: 'Region',
                width: '11%',
                priority: 'wide',
                cell: (row) => <span className="text-[12.5px] text-ink-2">{row.region || '-'}</span>,
              },
              {
                key: 'time',
                header: 'When',
                width: '12%',
                cell: (row) => (
                  <span
                    className="block whitespace-nowrap text-[12.5px] text-ink-2"
                    title={formatDateTime(row.event_time)}
                  >
                    {formatRelativeShort(row.event_time)}
                  </span>
                ),
              },
            ]}
            rows={rows}
            rowKey={(row, index) => row.id ?? `${row.event_name}-${index}`}
            loading={loading}
            refreshing={query.isRefreshing}
            density="compact"
            skeletonRows={12}
            emptyState={
              filters.identityArn ? (
                <EmptyState
                  icon={Activity}
                  title="No events for that ARN"
                  description="Nothing in this scan was attributed to that identity. The filter matches the ARN exactly, so a partial value returns nothing."
                  action={
                    <Button variant="secondary" size="sm" onClick={clearArn}>
                      Clear filter
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={Activity}
                  title="No CloudTrail events in this scan"
                  description="This discovery run captured no API activity. Events appear once CloudTrail data is ingested for the account."
                />
              )
            }
          />
        )}

        {total > 0 && (
          <Pagination
            page={filters.page}
            pageSize={filters.pageSize}
            total={total}
            unit="events"
            onPageChange={(page) => setParam('page', String(page))}
            onPageSizeChange={(size) => {
              const next = new URLSearchParams(searchParams);
              next.set('page_size', String(size));
              next.delete('page');
              setSearchParams(next, { replace: true });
            }}
          />
        )}
      </Panel>

      {filters.identityArn && (
        <p className="flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
          Filtering on <CopyableValue value={filters.identityArn} />
          <span>· last activity {formatRelative(rows[0]?.event_time)}</span>
        </p>
      )}
    </div>
  );
}

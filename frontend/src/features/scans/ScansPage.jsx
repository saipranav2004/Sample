import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Check, History, Minus, Target, TrendingUp } from 'lucide-react';
import { useScanContext } from '../../app/ScanContext';
import { scanStatusMeta } from '../../lib/domain';
import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatRelative,
  formatRelativeShort,
} from '../../lib/format';
import { PageHeader } from '../../shell/PageHeader';
import { TrendChart } from '../../charts/TrendChart';
import { Button } from '../../ui/Button';
import { Panel, PanelHeader } from '../../ui/Panel';
import { RecordBar, ResultCount } from '../../ui/WorkArea';
import { RefreshButton, TableToolbar } from '../../ui/TableTools';
import { CellStack, DataGrid } from '../../ui/DataGrid';
import { Tag } from '../../ui/Tag';
import { CopyableValue } from '../../ui/Copyable';
import { EmptyState, ErrorState } from '../../ui/States';
import { MetricTile } from '../../ui/Stat';
import { StatStripSkeleton } from '../../ui/Skeleton';
import { cn, TONE_FG } from '../../ui/cn';

/**
 * Scan history, and the place to change which snapshot the product reports on.
 *
 * The most useful thing this endpoint can say is *what changed*, so every
 * completed scan carries its delta against the previous one - real arithmetic
 * on real records, no modelling. Selecting a scan here is the same action as
 * the context-row switcher: one source of truth for scope.
 */
export default function ScansPage() {
  const { scans, selectedScanId, setSelectedScanId, loading, error, refetch, activeScan } =
    useScanContext();

  /* Chronological order, so "previous" means the scan before it in time
     rather than the row above it in whatever order the API returned. */
  const chronological = useMemo(
    () =>
      [...scans]
        .filter((scan) => String(scan.status).toUpperCase() === 'COMPLETED')
        .sort((a, b) => new Date(a.scan_start) - new Date(b.scan_start)),
    [scans],
  );

  const deltas = useMemo(() => {
    const map = new Map();
    chronological.forEach((scan, index) => {
      const previous = index > 0 ? chronological[index - 1] : null;
      map.set(scan.scan_id, {
        previous,
        identities: previous ? scan.total_identities - previous.total_identities : null,
        events: previous ? scan.total_events - previous.total_events : null,
        secrets: previous ? scan.total_secrets - previous.total_secrets : null,
      });
    });
    return map;
  }, [chronological]);

  const latest = chronological[chronological.length - 1] ?? null;
  const latestDelta = latest ? deltas.get(latest.scan_id) : null;

  const trendData = useMemo(
    () =>
      chronological.map((scan) => ({
        label: formatDate(scan.scan_start),
        subtitle: scan.target_name || scan.account_id || scan.scan_id,
        identities: Number(scan.total_identities) || 0,
        events: Number(scan.total_events) || 0,
        secrets: Number(scan.total_secrets) || 0,
      })),
    [chronological],
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Discovery scans"
        lede="Each scan is an immutable snapshot of the account. Select one to scope every screen in the product to it, and read the delta to see what the last run actually changed."
      />

      {loading && scans.length === 0 ? (
        <StatStripSkeleton count={4} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Scans recorded"
            value={scans.length}
            icon={History}
            tone="brand"
            caption={`${formatNumber(chronological.length)} completed`}
            className="animate-rise"
          />
          <MetricTile
            label="Identities, latest scan"
            value={latest?.total_identities}
            sparkline={trendData.map((point) => point.identities)}
            tone="info"
            caption={deltaCaption(latestDelta?.identities, 'since the previous scan')}
            className="animate-rise"
            data-stagger=""
            style={{ '--stagger': 1 }}
          />
          <MetricTile
            label="Events, latest scan"
            value={latest?.total_events}
            sparkline={trendData.map((point) => point.events)}
            tone="medium"
            caption={deltaCaption(latestDelta?.events, 'since the previous scan')}
            className="animate-rise"
            data-stagger=""
            style={{ '--stagger': 2 }}
          />
          <MetricTile
            label="Secret-backed, latest scan"
            value={latest?.total_secrets}
            sparkline={trendData.map((point) => point.secrets)}
            tone="high"
            caption={deltaCaption(latestDelta?.secrets, 'since the previous scan')}
            className="animate-rise"
            data-stagger=""
            style={{ '--stagger': 3 }}
          />
        </div>
      )}

      <Panel className="animate-rise">
        <PanelHeader
          icon={TrendingUp}
          title="Across completed scans"
          subtitle="One chart per measure - the three differ by orders of magnitude, so a shared axis would flatten two of them."
        />
        <div className="mt-4">
          {trendData.length < 2 ? (
            <EmptyState
              compact
              title="Not enough scan history"
              description="A trend needs at least two completed scans. Run another discovery to start the series."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {[
                { key: 'identities', label: 'Identities', color: 'var(--t-series-1)' },
                { key: 'events', label: 'CloudTrail events', color: 'var(--t-series-5)' },
                { key: 'secrets', label: 'Secret-backed identities', color: 'var(--t-series-2)' },
              ].map((series, index, list) => (
                <div key={series.key}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[12px] font-semibold text-ink-2">{series.label}</p>
                    <p className="text-[11.5px] text-ink-3" data-numeric="">
                      latest {formatNumber(trendData[trendData.length - 1][series.key])}
                    </p>
                  </div>
                  <TrendChart
                    data={trendData}
                    dataKey={series.key}
                    label={series.label}
                    color={series.color}
                    height={index === list.length - 1 ? 124 : 104}
                    showXAxis={index === list.length - 1}
                    syncId="scan-history"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <Panel flush className="animate-rise overflow-hidden">
        <RecordBar
          trailing={
            <TableToolbar>
              <RefreshButton onRefresh={refetch} refreshing={loading} label="Refresh scan list" />
            </TableToolbar>
          }
        >
          <ResultCount
            shown={formatNumber(scans.length)}
            total={formatNumber(scans.length)}
            unit="scans recorded"
            loading={loading && scans.length === 0}
          />
        </RecordBar>

        {error && scans.length === 0 ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <DataGrid
            caption="Discovery scans"
            columns={[
              {
                key: 'scan',
                header: 'Scan',
                primary: true,
                width: '24%',
                cell: (row) => (
                  <CellStack
                    icon={Target}
                    title={row.target_name || row.account_id || row.scan_id}
                    meta={row.account_id || '-'}
                    mono
                  />
                ),
              },
              {
                key: 'status',
                header: 'Status',
                width: '10%',
                cell: (row) => {
                  const status = scanStatusMeta(row.status);
                  return (
                    <Tag tone={status.tone} size="sm" dot>
                      {status.label}
                    </Tag>
                  );
                },
              },
              {
                key: 'identities',
                header: 'Identities',
                align: 'right',
                width: '11%',
                cell: (row) => (
                  <span data-numeric="" className="text-[13px] font-semibold text-ink">
                    {formatNumber(row.total_identities)}
                  </span>
                ),
              },
              {
                key: 'delta',
                header: 'Change',
                width: '14%',
                cell: (row) => <DeltaCell delta={deltas.get(row.scan_id)} />,
              },
              {
                key: 'events',
                header: 'Events',
                align: 'right',
                width: '10%',
                priority: 'wide',
                cell: (row) => (
                  <span data-numeric="" className="text-[13px] text-ink-2">
                    {formatNumber(row.total_events)}
                  </span>
                ),
              },
              {
                key: 'secrets',
                header: 'Secrets',
                align: 'right',
                width: '9%',
                priority: 'wide',
                cell: (row) => (
                  <span data-numeric="" className="text-[13px] text-ink-2">
                    {formatNumber(row.total_secrets)}
                  </span>
                ),
              },
              {
                key: 'window',
                header: 'Window',
                width: '13%',
                cell: (row) => (
                  <span className="block min-w-0" title={formatDateTime(row.scan_start)}>
                    <span className="block whitespace-nowrap text-[12.5px] text-ink-2">
                      {formatRelativeShort(row.scan_start)}
                    </span>
                    <span className="block truncate text-[11px] text-ink-3">
                      {row.scan_end ? formatDuration(row.scan_start, row.scan_end) : 'running'}
                    </span>
                  </span>
                ),
              },
              {
                key: 'scope',
                header: 'Scope',
                width: '13%',
                cell: (row) => {
                  const active = selectedScanId === row.scan_id;
                  const implicit = !selectedScanId && activeScan?.scan_id === row.scan_id;
                  if (active || implicit) {
                    return (
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-brand">
                        <Check aria-hidden="true" className="size-3.5" />
                        {implicit ? 'Latest (in use)' : 'In use'}
                      </span>
                    );
                  }
                  return (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedScanId(row.scan_id)}>
                      Scope to this
                    </Button>
                  );
                },
              },
            ]}
            rows={scans}
            rowKey={(row) => row.scan_id}
            loading={loading && scans.length === 0}
            density="comfortable"
            skeletonRows={6}
            emptyState={
              <EmptyState
                icon={History}
                title="No scans recorded"
                description="Nothing has been discovered yet. Once a discovery scan completes it appears here and the rest of the product starts reporting on it."
              />
            }
          />
        )}
      </Panel>

      {activeScan && (
        <p className="flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
          Scoped to <CopyableValue value={activeScan.scan_id} />
          <span>
            · started {formatRelative(activeScan.scan_start)}
            {!selectedScanId && ' · tracking the latest completed scan'}
          </span>
        </p>
      )}
    </div>
  );
}

/** Delta against the previous completed scan, or a baseline marker. */
function DeltaCell({ delta }) {
  if (!delta || delta.identities === null) {
    return <span className="text-[11.5px] text-ink-3">Baseline</span>;
  }

  const value = delta.identities;
  const tone = value > 0 ? 'high' : value < 0 ? 'low' : 'neutral';
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;

  return (
    <span
      className="block min-w-0"
      title={`Against the previous completed scan: identities ${signed(delta.identities)}, events ${signed(delta.events)}, secret-backed ${signed(delta.secrets)}`}
    >
      <span className={cn('flex items-center gap-1 text-[12.5px] font-semibold', TONE_FG[tone])}>
        <Icon aria-hidden="true" className="size-3.5 shrink-0" />
        <span data-numeric="">{signed(value)} identities</span>
      </span>
      <span className="mt-0.5 block truncate text-[11px] text-ink-3" data-numeric="">
        {signed(delta.secrets)} secret-backed
      </span>
    </span>
  );
}

function signed(value) {
  if (!Number.isFinite(value)) return '-';
  if (value === 0) return 'no change';
  return `${value > 0 ? '+' : ''}${formatNumber(value)}`;
}

function deltaCaption(value, suffix) {
  if (!Number.isFinite(value)) return 'First completed scan on record';
  if (value === 0) return `No change ${suffix}`;
  return `${value > 0 ? '+' : ''}${formatNumber(value)} ${suffix}`;
}

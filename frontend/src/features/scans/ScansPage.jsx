import { useMemo } from 'react';
import { Check, History, RotateCw, Target } from 'lucide-react';
import { useScanContext } from '../../app/ScanContext';
import { scanStatusMeta } from '../../lib/domain';
import { formatDateTime, formatDuration, formatNumber, formatRelative } from '../../lib/format';
import { PageHeader } from '../../shell/PageHeader';
import { Button } from '../../ui/Button';
import { Panel } from '../../ui/Panel';
import { CellStack, DataGrid } from '../../ui/DataGrid';
import { Tag } from '../../ui/Tag';
import { CopyableValue } from '../../ui/Copyable';
import { EmptyState, ErrorState } from '../../ui/States';
import { MetricTile } from '../../ui/Stat';
import { StatStripSkeleton } from '../../ui/Skeleton';

/**
 * Scan history, and the place to change which snapshot the product is
 * reporting on. Selecting a scan here is the same action as the top-bar
 * switcher — one source of truth for scope.
 */
export default function ScansPage() {
  const { scans, selectedScanId, setSelectedScanId, loading, error, refetch, activeScan } =
    useScanContext();

  const completed = useMemo(
    () => scans.filter((scan) => String(scan.status).toUpperCase() === 'COMPLETED'),
    [scans],
  );

  const totals = useMemo(
    () => ({
      scans: scans.length,
      identities: activeScan?.total_identities ?? 0,
      events: activeScan?.total_events ?? 0,
      secrets: activeScan?.total_secrets ?? 0,
    }),
    [scans, activeScan],
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Operations"
        title="Discovery scans"
        lede="Each scan is an immutable snapshot of the account. Select one to scope every screen in the product to it."
        actions={
          <Button variant="secondary" icon={RotateCw} onClick={refetch} loading={loading}>
            Refresh
          </Button>
        }
      />

      {loading && scans.length === 0 ? (
        <StatStripSkeleton count={4} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Scans recorded"
            value={totals.scans}
            icon={History}
            tone="brand"
            caption={`${formatNumber(completed.length)} completed`}
          />
          <MetricTile
            label="Identities in scope"
            value={totals.identities}
            tone="info"
            caption={activeScan ? 'From the selected snapshot' : 'No snapshot selected'}
          />
          <MetricTile
            label="Events in scope"
            value={totals.events}
            tone="medium"
            caption="CloudTrail records ingested"
          />
          <MetricTile
            label="Secret-backed"
            value={totals.secrets}
            tone="high"
            caption="Identities with stored secrets"
          />
        </div>
      )}

      <Panel flush className="animate-rise overflow-hidden">
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
                width: '26%',
                cell: (row) => (
                  <CellStack
                    icon={Target}
                    title={row.target_name || row.account_id || row.scan_id}
                    meta={row.account_id || '—'}
                    mono
                  />
                ),
              },
              {
                key: 'status',
                header: 'Status',
                width: '11%',
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
                width: '10%',
                cell: (row) => (
                  <span data-numeric="" className="text-[13px] font-semibold text-ink">
                    {formatNumber(row.total_identities)}
                  </span>
                ),
              },
              {
                key: 'events',
                header: 'Events',
                align: 'right',
                width: '10%',
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
                width: '17%',
                cell: (row) => (
                  <span className="block min-w-0">
                    <span className="block text-[12.5px] text-ink-2">
                      {formatRelative(row.scan_start)}
                    </span>
                    <span className="block truncate text-[11px] text-ink-3">
                      {formatDateTime(row.scan_start)} ·{' '}
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
        <p className="text-[12px] text-ink-3">
          Currently scoped to <CopyableValue value={activeScan.scan_id} />
          {!selectedScanId && ' (tracking the latest completed scan)'}
        </p>
      )}
    </div>
  );
}

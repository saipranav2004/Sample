import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, UserCircle } from 'lucide-react';
import { fetchMyResources } from '../../lib/api/endpoints';
import { useQuery } from '../../lib/hooks';
import { useScanContext } from '../../app/ScanContext';
import { useAuth } from '../../app/AuthContext';
import { classificationMeta } from '../../lib/domain';
import { arnResource, formatNumber, percentValue } from '../../lib/format';
import { exportRowsToCsv, timestampedName } from '../../lib/csv';
import { PageHeader } from '../../shell/PageHeader';
import { IconButton } from '../../ui/Button';
import { Panel, PanelHeader } from '../../ui/Panel';
import { RecordBar, ResultCount } from '../../ui/WorkArea';
import { OverflowMenu, RefreshButton, TableToolbar } from '../../ui/TableTools';
import { DataGrid } from '../../ui/DataGrid';
import { Pagination } from '../../ui/Pagination';
import { ProportionBar } from '../../ui/Meter';
import { MetricTile } from '../../ui/Stat';
import { StatStripSkeleton } from '../../ui/Skeleton';
import { EmptyState, ErrorState } from '../../ui/States';
import { useToast } from '../../ui/Toast';
import { TrustCell } from '../identities/cells';
import { ActivityCell, StatusCell, evaluatePosture } from '../identities/status';
import { IdentityDrawer } from '../identities/IdentityDrawer';

/**
 * Owner-scoped inventory.
 *
 * The backend resolves ownership from the signed-in user's email against the
 * owner, primary-owner and creator fields - there is no separate assignment
 * model, and this screen says so rather than implying one exists.
 *
 * The endpoint takes no filters beyond the scan, so the composition figures
 * are computed from the loaded page and every one of them is labelled
 * "in view". The assigned total is the endpoint's own `total_count`.
 */
export default function MyResourcesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedScanId, activeScan } = useScanContext();
  const { user } = useAuth();
  const { notify } = useToast();
  const [selected, setSelected] = useState(null);

  const filters = useMemo(
    () => ({
      page: Number(searchParams.get('page')) || 1,
      pageSize: Number(searchParams.get('page_size')) || 25,
    }),
    [searchParams],
  );

  const query = useQuery(
    (signal) => fetchMyResources({ ...filters, scanId: selectedScanId }, signal),
    [JSON.stringify(filters), selectedScanId],
  );

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;

  const inView = useMemo(() => {
    let critical = 0;
    let attention = 0;
    const classes = new Map();
    for (const row of rows) {
      const posture = evaluatePosture(row);
      if (posture.state === 'critical') critical += 1;
      if (posture.state === 'attention') attention += 1;
      const key = String(row.classification || 'UNCLASSIFIED').toUpperCase();
      classes.set(key, (classes.get(key) || 0) + 1);
    }
    return {
      critical,
      attention,
      healthy: rows.length - critical - attention,
      classes: [...classes.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [rows]);

  const maxEvents = useMemo(
    () => rows.reduce((max, row) => Math.max(max, Number(row.total_events) || 0), 0),
    [rows],
  );

  const onExport = () => {
    exportRowsToCsv({
      filename: timestampedName(`my-resources-${activeScan?.target_name || 'scan'}`),
      columns: [
        { header: 'Name', value: (row) => row.name },
        { header: 'ARN', value: (row) => row.arn },
        { header: 'Classification', value: (row) => row.classification },
        { header: 'Owner type', value: (row) => row.owner_type },
        { header: 'Trust type', value: (row) => row.trust_type },
        { header: 'Admin', value: (row) => (row.is_admin ? 'yes' : 'no') },
        { header: 'Secret-backed', value: (row) => (row.is_secret ? 'yes' : 'no') },
        { header: 'Last active', value: (row) => row.last_active },
        { header: 'Events', value: (row) => row.total_events },
      ],
      rows,
    });
    notify({
      variant: 'success',
      title: 'Exported this page',
      description: `${formatNumber(rows.length)} rows written to CSV.`,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="My resources"
        lede={
          user?.email
            ? `Identities in this scan whose owner, primary owner or creator resolves to ${user.email}. Ownership comes from resource tags and CloudTrail, so tagging is what puts something on this list.`
            : 'Identities in this scan that resolve to your account.'
        }
      />

      {query.isLoading && !query.data ? (
        <StatStripSkeleton count={4} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Assigned to me"
            value={total}
            tone="brand"
            icon={UserCircle}
            caption="Resolved from tags and CloudTrail"
            className="animate-rise"
          />
          <MetricTile
            label="Critical, in view"
            value={inView.critical}
            tone={inView.critical > 0 ? 'critical' : 'low'}
            caption={`Of ${formatNumber(rows.length)} on this page`}
            meter={percentValue(inView.critical, rows.length)}
            meterLabel="Share of the loaded page"
            className="animate-rise"
            data-stagger=""
            style={{ '--stagger': 1 }}
          />
          <MetricTile
            label="Needs review, in view"
            value={inView.attention}
            tone={inView.attention > 0 ? 'medium' : 'low'}
            caption={`Of ${formatNumber(rows.length)} on this page`}
            className="animate-rise"
            data-stagger=""
            style={{ '--stagger': 2 }}
          />
          <MetricTile
            label="Healthy, in view"
            value={inView.healthy}
            tone="low"
            caption="No failing or pending check"
            className="animate-rise"
            data-stagger=""
            style={{ '--stagger': 3 }}
          />
        </div>
      )}

      {rows.length > 0 && (
        <Panel className="animate-rise">
          <PanelHeader
            title="What I own, in view"
            subtitle={`Composition of the ${formatNumber(rows.length)} records on this page. The endpoint accepts no filters beyond the scan, so this is a page-level summary, not a total.`}
          />
          <ProportionBar
            className="mt-3.5"
            height={12}
            total={rows.length}
            ariaLabel="Classification composition of the loaded page"
            segments={inView.classes.map(([key, value]) => ({
              key,
              label: classificationMeta(key).label,
              value,
              color: classificationMeta(key).color,
            }))}
          />
          <dl className="mt-3 flex flex-wrap gap-x-7 gap-y-2">
            {inView.classes.map(([key, value]) => {
              const meta = classificationMeta(key);
              return (
                <div key={key} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-[3px]"
                    style={{ background: meta.color }}
                  />
                  <dt className="text-[12px] text-ink-3">{meta.label}</dt>
                  <dd data-numeric="" className="text-[12.5px] font-semibold text-ink">
                    {formatNumber(value)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </Panel>
      )}

      <Panel flush className="animate-rise overflow-hidden">
        <RecordBar
          trailing={
            <TableToolbar>
              <RefreshButton onRefresh={query.refetch} refreshing={query.isRefreshing} />
              <OverflowMenu
                items={[
                  {
                    key: 'export',
                    label: 'Export this page',
                    hint: `CSV of the ${rows.length} rows shown`,
                    onSelect: onExport,
                    disabled: rows.length === 0,
                    disabledHint: 'Nothing to export - no rows on this page',
                  },
                ]}
              />
            </TableToolbar>
          }
        >
          <ResultCount
            shown={formatNumber(rows.length)}
            total={formatNumber(total)}
            unit="identities assigned to me"
            filtered={total !== rows.length}
            loading={query.isLoading && !query.data}
          />
        </RecordBar>

        {query.isError && !query.data ? (
          <ErrorState error={query.error} onRetry={query.refetch} />
        ) : (
          <>
            <DataGrid
              caption="Identities assigned to me"
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
                          <span
                            className="block truncate font-mono text-[11px] text-ink-3"
                            title={row.arn}
                          >
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
                  width: '22%',
                  cell: (row) => <StatusCell identity={row} />,
                },
                {
                  key: 'class',
                  header: 'Class',
                  width: '13%',
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
                  key: 'trust',
                  header: 'Trust',
                  width: '17%',
                  priority: 'wide',
                  cell: (row) => <TrustCell identity={row} />,
                },
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
              rowAccent={(row) => classificationMeta(row.classification).color}
              skeletonRows={6}
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
                <EmptyState
                  icon={UserCircle}
                  title="Nothing is attributed to you in this scan"
                  description="No identity in this snapshot lists your address as owner, primary owner or creator. Ownership is resolved from resource tags and CloudTrail, so tagging a resource is what makes it appear here - there is no assignment setting in this product."
                />
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

      <IdentityDrawer identity={selected} open={Boolean(selected)} onClose={() => setSelected(null)} />
    </div>
  );
}

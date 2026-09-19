import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RotateCw, UserCircle } from 'lucide-react';
import { fetchMyResources } from '../../lib/api/endpoints';
import { useQuery } from '../../lib/hooks';
import { useScanContext } from '../../app/ScanContext';
import { useAuth } from '../../app/AuthContext';
import { formatNumber } from '../../lib/format';
import { PageHeader } from '../../shell/PageHeader';
import { Button } from '../../ui/Button';
import { Panel } from '../../ui/Panel';
import { DataGrid } from '../../ui/DataGrid';
import { Pagination } from '../../ui/Pagination';
import { EmptyState, ErrorState } from '../../ui/States';
import {
  ActivityCell,
  ClassificationCell,
  IdentityNameCell,
  RiskMarkersCell,
  TrustCell,
} from '../identities/cells';
import { IdentityDrawer } from '../identities/IdentityDrawer';

/**
 * Owner-scoped inventory. The backend resolves ownership from the signed-in
 * user's email against the owner, primary-owner and creator fields — there is
 * no separate assignment model, and this screen says so rather than implying
 * one.
 */
export default function MyResourcesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedScanId } = useScanContext();
  const { user } = useAuth();
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

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Assigned to me"
        title="My resources"
        lede={
          user?.email
            ? `Identities in this scan whose owner, primary owner or creator resolves to ${user.email}.`
            : 'Identities in this scan that resolve to your account.'
        }
        actions={
          <Button variant="secondary" icon={RotateCw} onClick={query.refetch} loading={query.isRefreshing}>
            Refresh
          </Button>
        }
      />

      <Panel flush className="animate-rise overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2/70 px-4 py-3">
          <p className="text-[12.5px] text-ink-3">
            Ownership is resolved from tags and CloudTrail during discovery.
          </p>
          <p className="shrink-0 text-[12.5px] text-ink-3" data-numeric="">
            {query.isLoading && !query.data ? '—' : formatNumber(total)} assigned
          </p>
        </div>

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
                  width: '34%',
                  cell: (row) => <IdentityNameCell identity={row} />,
                },
                {
                  key: 'classification',
                  header: 'Classification',
                  width: '16%',
                  cell: (row) => <ClassificationCell identity={row} />,
                },
                {
                  key: 'trust',
                  header: 'Trust',
                  width: '17%',
                  priority: 'wide',
                  cell: (row) => <TrustCell identity={row} />,
                },
                {
                  key: 'risk',
                  header: 'Markers',
                  width: '18%',
                  cell: (row) => <RiskMarkersCell identity={row} />,
                },
                {
                  key: 'activity',
                  header: 'Last active',
                  width: '15%',
                  cell: (row) => <ActivityCell identity={row} />,
                },
              ]}
              rows={rows}
              rowKey={(row) => row.id ?? row.arn}
              loading={query.isLoading && !query.data}
              refreshing={query.isRefreshing}
              onRowClick={setSelected}
              skeletonRows={6}
              emptyState={
                <EmptyState
                  icon={UserCircle}
                  title="Nothing is attributed to you in this scan"
                  description="No identity in this snapshot lists your address as owner, primary owner or creator. Ownership comes from resource tags and CloudTrail, so tagging a resource is what makes it appear here."
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

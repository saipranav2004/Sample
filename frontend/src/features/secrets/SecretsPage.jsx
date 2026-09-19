import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RotateCw, SearchX } from 'lucide-react';
import { fetchSecrets } from '../../lib/api/endpoints';
import { useDebouncedValue, useQuery } from '../../lib/hooks';
import { useScanContext } from '../../app/ScanContext';
import { formatNumber } from '../../lib/format';
import { PageHeader } from '../../shell/PageHeader';
import { Button } from '../../ui/Button';
import { Panel } from '../../ui/Panel';
import { SearchInput } from '../../ui/Field';
import { Toolbar } from '../../ui/Toolbar';
import { DataGrid } from '../../ui/DataGrid';
import { Pagination } from '../../ui/Pagination';
import { ClearState, EmptyState, ErrorState } from '../../ui/States';
import {
  ActivityCell,
  ClassificationCell,
  IdentityNameCell,
  OwnerCell,
  RiskMarkersCell,
} from '../identities/cells';
import { IdentityDrawer } from '../identities/IdentityDrawer';

/**
 * Identities whose credentials live in a secret store entry.
 *
 * `GET /api/secrets` accepts only a search term and the scan scope, so this
 * screen exposes exactly those two controls — the posture facets on the
 * identity explorer are not available here and are not faked.
 */
export default function SecretsPage() {
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
      page: Number(searchParams.get('page')) || 1,
      pageSize: Number(searchParams.get('page_size')) || 25,
    }),
    [searchParams],
  );

  const query = useQuery(
    (signal) => fetchSecrets({ ...filters, scanId: selectedScanId }, signal),
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
        eyebrow="Inventory"
        title="Secret-backed identities"
        lede="Principals whose credentials are held in a secret store entry. These are the identities where a leaked secret grants working access, so they are worth reviewing first."
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
              {query.isLoading && !query.data ? '—' : formatNumber(total)} identities
            </p>
          }
        >
          <SearchInput
            value={searchDraft}
            onChange={setSearchDraft}
            placeholder="Search name, ARN or classification evidence…"
            className="w-full min-w-0 sm:max-w-sm"
          />
        </Toolbar>

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
                  width: '32%',
                  cell: (row) => <IdentityNameCell identity={row} />,
                },
                {
                  key: 'classification',
                  header: 'Classification',
                  width: '15%',
                  cell: (row) => <ClassificationCell identity={row} />,
                },
                { key: 'owner', header: 'Owner', width: '20%', cell: (row) => <OwnerCell identity={row} /> },
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
              skeletonRows={8}
              emptyState={
                filters.search ? (
                  <EmptyState
                    icon={SearchX}
                    title="No secret-backed identity matches that search"
                    description={`Nothing in this scan matches “${filters.search}”.`}
                    action={
                      <Button variant="secondary" size="sm" onClick={() => setSearchDraft('')}>
                        Clear search
                      </Button>
                    }
                  />
                ) : (
                  <ClearState
                    title="No secret-backed identities"
                    description="No identity in this scan has credentials held in a secret store entry."
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

      <IdentityDrawer identity={selected} open={Boolean(selected)} onClose={() => setSelected(null)} />
    </div>
  );
}

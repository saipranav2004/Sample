import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, Eye, PenLine, RotateCw } from 'lucide-react';
import { fetchEvents } from '../../lib/api/endpoints';
import { useDebouncedValue, useQuery } from '../../lib/hooks';
import { useScanContext } from '../../app/ScanContext';
import { arnResource, formatDateTime, formatNumber, formatRelative } from '../../lib/format';
import { PageHeader } from '../../shell/PageHeader';
import { Button } from '../../ui/Button';
import { Panel } from '../../ui/Panel';
import { Input } from '../../ui/Field';
import { ActiveFilters, Toolbar } from '../../ui/Toolbar';
import { CellStack, DataGrid } from '../../ui/DataGrid';
import { Pagination } from '../../ui/Pagination';
import { Tag } from '../../ui/Tag';
import { CopyableValue } from '../../ui/Copyable';
import { EmptyState, ErrorState } from '../../ui/States';

/**
 * CloudTrail activity for the scan.
 *
 * The API filters events by an exact `identity_arn`, not a fuzzy search, so
 * the control is presented as an exact-ARN filter — usually arrived at by
 * opening an identity's Activity tab rather than typed by hand.
 */
export default function ActivityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedScanId } = useScanContext();
  const [arnDraft, setArnDraft] = useState(() => searchParams.get('identity_arn') || '');
  const debouncedArn = useDebouncedValue(arnDraft.trim(), 400);

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

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;

  const chips = filters.identityArn
    ? [{ key: 'identity_arn', label: 'Identity', value: arnResource(filters.identityArn) }]
    : [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Operations"
        title="API activity"
        lede="CloudTrail events captured by this scan, newest first. Mutating calls are marked separately from read-only ones so privilege use stands out."
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
              {query.isLoading && !query.data ? '—' : formatNumber(total)} events
            </p>
          }
        >
          <Input
            value={arnDraft}
            onChange={(event) => setArnDraft(event.target.value)}
            placeholder="Filter by exact identity ARN (arn:aws:iam::…)"
            aria-label="Filter by exact identity ARN"
            className="w-full min-w-0 font-mono text-[12.5px] sm:max-w-lg"
          />
        </Toolbar>

        <ActiveFilters
          filters={chips}
          onRemove={() => {
            setArnDraft('');
            setParam('identity_arn', '');
          }}
          onClearAll={() => {
            setArnDraft('');
            setParam('identity_arn', '');
          }}
        />

        {query.isError && !query.data ? (
          <ErrorState error={query.error} onRetry={query.refetch} />
        ) : (
          <>
            <DataGrid
              caption="CloudTrail events"
              columns={[
                {
                  key: 'event',
                  header: 'Event',
                  primary: true,
                  width: '26%',
                  cell: (row) => {
                    const mutating = String(row.read_only).toLowerCase() !== 'true';
                    return (
                      <CellStack
                        icon={mutating ? PenLine : Eye}
                        tone={mutating ? 'border-high/30 bg-high-soft text-high' : undefined}
                        title={row.event_name || 'Unnamed event'}
                        meta={row.event_source || '—'}
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
                        {row.identity_name || '—'}
                      </span>
                      <span
                        className="block truncate font-mono text-[11px] text-ink-3"
                        title={row.identity_arn}
                      >
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
                  width: '16%',
                  priority: 'wide',
                  cell: (row) => (
                    <span className="block min-w-0">
                      <span className="block truncate font-mono text-[12px] text-ink-2">
                        {row.source_ip || '—'}
                      </span>
                      <span className="block truncate text-[11px] text-ink-3" title={row.user_agent}>
                        {row.user_agent || '—'}
                      </span>
                    </span>
                  ),
                },
                {
                  key: 'region',
                  header: 'Region',
                  width: '10%',
                  priority: 'wide',
                  cell: (row) => <span className="text-[12.5px] text-ink-2">{row.region || '—'}</span>,
                },
                {
                  key: 'time',
                  header: 'When',
                  width: '13%',
                  cell: (row) => (
                    <span className="block min-w-0">
                      <span className="block text-[12.5px] text-ink-2">
                        {formatRelative(row.event_time)}
                      </span>
                      <span className="block truncate text-[11px] text-ink-3">
                        {formatDateTime(row.event_time)}
                      </span>
                    </span>
                  ),
                },
              ]}
              rows={rows}
              rowKey={(row, index) => row.id ?? `${row.event_name}-${index}`}
              loading={query.isLoading && !query.data}
              refreshing={query.isRefreshing}
              skeletonRows={12}
              emptyState={
                filters.identityArn ? (
                  <EmptyState
                    icon={Activity}
                    title="No events for that ARN"
                    description="Nothing in this scan was attributed to that identity. The filter matches the ARN exactly — a partial value returns nothing."
                    action={
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setArnDraft('');
                          setParam('identity_arn', '');
                        }}
                      >
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
          </>
        )}
      </Panel>

      {filters.identityArn && (
        <p className="text-[12px] text-ink-3">
          Filtering on <CopyableValue value={filters.identityArn} />
        </p>
      )}
    </div>
  );
}

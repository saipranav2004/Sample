import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RotateCcw, RotateCw, SearchX, ShieldOff } from 'lucide-react';
import { fetchAllowlist, restoreFinding } from '../../lib/api/endpoints';
import { useMutation, useQuery } from '../../lib/hooks';
import { formatDateTime, formatNumber, formatRelative, humanizeToken } from '../../lib/format';
import { PageHeader } from '../../shell/PageHeader';
import { Button } from '../../ui/Button';
import { Panel } from '../../ui/Panel';
import { SearchInput } from '../../ui/Field';
import { Toolbar } from '../../ui/Toolbar';
import { CellStack, DataGrid } from '../../ui/DataGrid';
import { Modal } from '../../ui/Overlay';
import { DetailList, DetailRow } from '../../ui/Panel';
import { useToast } from '../../ui/Toast';
import { EmptyState, ErrorState } from '../../ui/States';
import { describeScannerError } from './scannerState';

/**
 * The scanner's allowlist: findings a human reviewed and accepted.
 *
 * Restoring an entry deletes it from the allowlist, at which point the finding
 * reappears in the live set — provided the scanner still holds the record.
 * That caveat is the service's, so the confirmation states it.
 */
export default function DismissedPage() {
  const { notify } = useToast();
  const query = useQuery((signal) => fetchAllowlist(signal), []);
  const restoration = useMutation((input) => restoreFinding(input));

  const [search, setSearch] = useState('');
  const [pendingRestore, setPendingRestore] = useState(null);
  const [restored, setRestored] = useState(() => new Set());

  const entryKey = (entry) =>
    [entry.client_id, entry.file_path, entry.detector, entry.redacted].join('|');

  const entries = useMemo(() => {
    const rows = (query.data ?? []).filter((entry) => !restored.has(entryKey(entry)));
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((entry) =>
      [entry.file_path, entry.detector, entry.reason, entry.dismissed_by, entry.client_id]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle)),
    );
  }, [query.data, search, restored]);

  const onRestore = useCallback(
    async (entry) => {
      const result = await restoration.mutate({
        clientId: entry.client_id,
        filePath: entry.file_path,
        detector: entry.detector,
        redacted: entry.redacted,
      });

      setPendingRestore(null);

      if (!result.ok) {
        notify({
          variant: 'error',
          title: 'Could not restore',
          description: result.error?.message || 'The scanner rejected the request.',
        });
        return;
      }

      /* The service answers `{ ok: false }` when nothing matched — that is not
         an error, it means the entry was already gone. */
      if (result.result?.ok === false) {
        notify({
          variant: 'info',
          title: 'Nothing to restore',
          description: 'That allowlist entry no longer exists on the scanner.',
        });
      } else {
        notify({
          variant: 'success',
          title: 'Removed from allowlist',
          description: `${entry.file_path} will appear in findings again if the scanner still holds the record.`,
        });
      }

      setRestored((current) => new Set(current).add(entryKey(entry)));
    },
    [restoration, notify],
  );

  if (query.isError && !query.data) {
    const detail = describeScannerError(query.error);
    return (
      <div className="flex flex-col gap-5">
        <PageHeader eyebrow="Code exposure" title="Dismissed findings" />
        <Panel>
          <ErrorState error={{ message: detail.message }} title={detail.title} onRetry={query.refetch} />
        </Panel>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Code exposure"
        title="Dismissed findings"
        lede="Secrets a reviewer accepted as safe — rotated credentials, test fixtures, known placeholders. Anything listed here is filtered out of the live findings automatically."
        actions={
          <>
            <Button as={Link} to="/exposure" variant="ghost" icon={ArrowLeft}>
              Back to findings
            </Button>
            <Button variant="secondary" icon={RotateCw} onClick={query.refetch} loading={query.isRefreshing}>
              Refresh
            </Button>
          </>
        }
      />

      <Panel flush className="animate-rise overflow-hidden">
        <Toolbar
          trailing={
            <p className="hidden text-[12.5px] text-ink-3 sm:block" data-numeric="">
              {query.isLoading && !query.data ? '—' : formatNumber(entries.length)} entries
            </p>
          }
        >
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search file, detector, reason or reviewer…"
            className="w-full min-w-0 sm:max-w-sm"
          />
        </Toolbar>

        <DataGrid
          caption="Allowlisted findings"
          columns={[
            {
              key: 'entry',
              header: 'Secret',
              primary: true,
              width: '30%',
              cell: (row) => (
                <CellStack
                  icon={ShieldOff}
                  title={humanizeToken(row.detector)}
                  meta={row.file_path}
                  mono
                />
              ),
            },
            {
              key: 'redacted',
              header: 'Masked value',
              width: '20%',
              cell: (row) => (
                <span className="block truncate font-mono text-[12px] text-ink-2" title={row.redacted}>
                  {row.redacted || '—'}
                </span>
              ),
            },
            {
              key: 'reason',
              header: 'Reason',
              width: '20%',
              cell: (row) => (
                <span className="block truncate text-[12.5px] text-ink-2" title={row.reason}>
                  {row.reason || <span className="text-ink-3">No reason recorded</span>}
                </span>
              ),
            },
            {
              key: 'by',
              header: 'Dismissed by',
              width: '16%',
              priority: 'wide',
              cell: (row) => (
                <span className="block min-w-0">
                  <span className="block truncate text-[12.5px] text-ink-2">
                    {row.dismissed_by || '—'}
                  </span>
                  <span className="block truncate text-[11px] text-ink-3">
                    {formatRelative(row.dismissed_at)}
                  </span>
                </span>
              ),
            },
            {
              key: 'restore',
              header: '',
              width: '14%',
              align: 'right',
              cell: (row) => (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={RotateCcw}
                  onClick={(event) => {
                    event.stopPropagation();
                    setPendingRestore(row);
                  }}
                >
                  Restore
                </Button>
              ),
            },
          ]}
          rows={entries}
          rowKey={(row, index) => `${entryKey(row)}-${index}`}
          loading={query.isLoading && !query.data}
          refreshing={query.isRefreshing}
          skeletonRows={6}
          emptyState={
            search.trim() ? (
              <EmptyState
                icon={SearchX}
                title="No dismissed entry matches that search"
                description={`Nothing in the allowlist matches “${search.trim()}”.`}
                action={
                  <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
                    Clear search
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={ShieldOff}
                title="Nothing has been dismissed"
                description="Findings you accept as safe from the triage view appear here, and can be restored at any time."
                action={
                  <Button as={Link} to="/exposure" variant="secondary" size="sm">
                    Go to findings
                  </Button>
                }
              />
            )
          }
        />
      </Panel>

      <Modal
        open={Boolean(pendingRestore)}
        onClose={() => setPendingRestore(null)}
        icon={RotateCcw}
        tone="medium"
        title="Restore this finding?"
        description="The allowlist entry is deleted. The finding reappears in the live set if the scanner still holds the underlying record."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingRestore(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={restoration.pending}
              onClick={() => onRestore(pendingRestore)}
            >
              Restore finding
            </Button>
          </>
        }
      >
        {pendingRestore && (
          <DetailList>
            <DetailRow label="File" mono>
              {pendingRestore.file_path}
            </DetailRow>
            <DetailRow label="Detector">{humanizeToken(pendingRestore.detector)}</DetailRow>
            <DetailRow label="Masked value" mono>
              {pendingRestore.redacted}
            </DetailRow>
            <DetailRow label="Dismissed">
              {formatDateTime(pendingRestore.dismissed_at)}
              {pendingRestore.dismissed_by ? ` by ${pendingRestore.dismissed_by}` : ''}
            </DetailRow>
          </DetailList>
        )}
      </Modal>
    </div>
  );
}

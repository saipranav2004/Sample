import { Database, ServerCog } from 'lucide-react';
import { useScanContext } from '../../app/ScanContext';
import { formatDateTime, formatDuration, formatNumber, formatRelative } from '../../lib/format';
import { scanStatusMeta } from '../../lib/domain';
import { Skeleton } from '../../ui/Skeleton';
import { Tag } from '../../ui/Tag';

/**
 * Every number on a data screen is "as of" a scan. This strip keeps that
 * provenance visible so a stale snapshot is never mistaken for live state.
 */
export function ScanContextStrip() {
  const { activeScan, isLatest, loading, error } = useScanContext();

  if (loading) {
    return (
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[var(--radius-panel)] border border-line bg-surface px-4 py-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-1.5">
            <Skeleton className="h-2.5 w-16 rounded" />
            <Skeleton className="h-3.5 w-24 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !activeScan) {
    return (
      <div className="flex items-center gap-2.5 rounded-[var(--radius-panel)] border border-line bg-surface px-4 py-3 text-[12.5px] text-ink-3">
        <Database aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
        {error
          ? 'Scan history could not be loaded, so figures below cannot be attributed to a snapshot.'
          : 'No completed discovery scan is available yet. Figures will appear once one finishes.'}
      </div>
    );
  }

  const status = scanStatusMeta(activeScan.status);

  const facts = [
    { label: 'Target', value: activeScan.target_name || '—' },
    { label: 'AWS account', value: activeScan.account_id || '—', mono: true },
    { label: 'Started', value: formatDateTime(activeScan.scan_start) },
    {
      label: 'Duration',
      value: activeScan.scan_end ? formatDuration(activeScan.scan_start, activeScan.scan_end) : 'In progress',
    },
    { label: 'Identities', value: formatNumber(activeScan.total_identities) },
    { label: 'Events', value: formatNumber(activeScan.total_events) },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-7 gap-y-3 rounded-[var(--radius-panel)] border border-line bg-surface px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-surface-2 text-brand">
          <ServerCog aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold tracking-[0.11em] text-ink-3 uppercase">Snapshot</p>
          <p className="text-[12.5px] font-semibold text-ink">
            {isLatest ? 'Latest completed' : 'Pinned scan'}{' '}
            <span className="font-normal text-ink-3">· {formatRelative(activeScan.scan_start)}</span>
          </p>
        </div>
      </div>

      <dl className="flex flex-wrap items-start gap-x-7 gap-y-3">
        {facts.map((fact) => (
          <div key={fact.label} className="min-w-0">
            <dt className="text-[10.5px] font-semibold tracking-[0.11em] text-ink-3 uppercase">
              {fact.label}
            </dt>
            <dd
              className={`mt-0.5 max-w-44 truncate text-[12.5px] font-medium text-ink ${fact.mono ? 'font-mono' : ''}`}
              data-numeric=""
              title={String(fact.value)}
            >
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>

      <Tag tone={status.tone} dot className="ml-auto">
        {status.label}
      </Tag>
    </div>
  );
}

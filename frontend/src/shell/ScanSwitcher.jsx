import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Database, RotateCw } from 'lucide-react';
import { useScanContext } from '../app/ScanContext';
import { formatDateTime, formatNumber, formatRelative } from '../lib/format';
import { scanStatusMeta } from '../lib/domain';
import { Skeleton } from '../ui/Skeleton';
import { Tag } from '../ui/Tag';
import { cn } from '../ui/cn';

/**
 * Global scan scope. Every figure in the product is "as of" one scan, so the
 * switcher sits in the top bar rather than being repeated per page - and it
 * shows which snapshot is in effect even when the default (latest) is used.
 */
export function ScanSwitcher() {
  const { scans, selectedScanId, setSelectedScanId, activeScan, isLatest, loading, error, refetch } =
    useScanContext();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface-2 px-2.5 py-1">
        <Skeleton className="size-3.5 rounded" />
        <Skeleton className="hidden h-2.5 w-28 rounded sm:block" />
      </div>
    );
  }

  if (error) {
    return (
      <button
        type="button"
        onClick={refetch}
        className="flex items-center gap-2 rounded-[var(--radius-control)] border border-critical/30 bg-critical-soft px-2.5 py-1 text-[12px] font-medium text-critical"
      >
        <RotateCw aria-hidden="true" className="size-3.5" />
        <span className="hidden sm:inline">Scan list unavailable - retry</span>
        <span className="sm:hidden">Retry</span>
      </button>
    );
  }

  const label = activeScan
    ? `${activeScan.target_name || activeScan.account_id || 'Scan'}`
    : 'No completed scan';
  const meta = activeScan ? formatRelative(activeScan.scan_start) : 'Nothing discovered yet';

  return (
    <div ref={wrapperRef} className="relative min-w-0 flex-1 sm:flex-none">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex h-7 min-w-0 items-center gap-2 rounded-[var(--radius-control)] border px-2 text-left text-[12px] transition-colors duration-150 sm:max-w-[19rem]',
          open
            ? 'border-brand/45 bg-info-soft'
            : 'border-line bg-surface-2 hover:border-line-strong hover:bg-surface-3',
        )}
      >
        <Database aria-hidden="true" className="size-3.5 shrink-0 text-brand" />
        <span className="hidden text-[10.5px] font-semibold tracking-[0.1em] text-ink-3 uppercase sm:inline">
          Scan
        </span>
        <span className="min-w-0 truncate font-semibold text-ink">{label}</span>
        <span className="hidden shrink-0 text-ink-3 sm:inline">
          {isLatest ? 'latest' : meta}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-3.5 shrink-0 text-ink-3 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Discovery scan"
          className="animate-pop absolute right-0 z-50 mt-1.5 w-[min(92vw,24rem)] overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface shadow-lg"
        >
          <p className="border-b border-line bg-surface-2 px-3 py-2 text-[10.5px] font-semibold tracking-[0.12em] text-ink-3 uppercase">
            Scope all views to
          </p>
          <div className="max-h-[22rem] overflow-y-auto p-1">
            <ScanOption
              selected={isLatest}
              title="Latest completed scan"
              subtitle="Follows the newest completed discovery automatically"
              onSelect={() => {
                setSelectedScanId('');
                setOpen(false);
              }}
            />
            {scans.length > 0 && <div aria-hidden="true" className="my-1 border-t border-line" />}
            {scans.map((scan) => {
              const status = scanStatusMeta(scan.status);
              return (
                <ScanOption
                  key={scan.scan_id}
                  selected={selectedScanId === scan.scan_id}
                  title={scan.target_name || scan.account_id || scan.scan_id}
                  subtitle={`${formatDateTime(scan.scan_start)} · ${formatNumber(scan.total_identities)} identities`}
                  trailing={<Tag tone={status.tone} size="sm">{status.label}</Tag>}
                  onSelect={() => {
                    setSelectedScanId(scan.scan_id);
                    setOpen(false);
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ScanOption({ selected, title, subtitle, trailing, onSelect }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors',
        selected ? 'bg-info-soft' : 'hover:bg-surface-2',
      )}
    >
      <Check
        aria-hidden="true"
        className={cn('size-4 shrink-0', selected ? 'text-brand' : 'text-transparent')}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink">{title}</span>
        <span className="block truncate text-[11.5px] text-ink-3">{subtitle}</span>
      </span>
      {trailing}
    </button>
  );
}

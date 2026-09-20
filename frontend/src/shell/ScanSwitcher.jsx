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
 * switcher sits in the top bar rather than being repeated per page — and it
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
      <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-topbar-line bg-white/[0.07] px-2.5 py-1.5">
        <Skeleton className="size-4 rounded bg-white/15" />
        <Skeleton className="hidden h-3 w-28 rounded bg-white/15 sm:block" />
      </div>
    );
  }

  if (error) {
    return (
      <button
        type="button"
        onClick={refetch}
        className="flex items-center gap-2 rounded-[var(--radius-control)] border border-critical/40 bg-critical/15 px-2.5 py-1.5 text-[12px] font-medium text-[#f2837a]"
      >
        <RotateCw aria-hidden="true" className="size-3.5" />
        <span className="hidden sm:inline">Scan list unavailable — retry</span>
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
          'flex min-w-0 items-center gap-2.5 rounded-[var(--radius-control)] border px-2.5 py-1.5 text-left transition-colors duration-150 sm:max-w-[15rem]',
          open
            ? 'border-white/25 bg-white/[0.13]'
            : 'border-topbar-line bg-white/[0.07] hover:border-white/20 hover:bg-white/[0.11]',
        )}
      >
        <Database aria-hidden="true" className="size-4 shrink-0 text-accent" />
        <span className="hidden min-w-0 sm:block">
          <span className="block text-[9.5px] leading-tight font-semibold tracking-[0.12em] text-topbar-muted uppercase">
            Scan scope
          </span>
          <span className="block truncate text-[12.5px] leading-tight font-semibold text-topbar-ink">
            {label}
            <span className="font-normal text-topbar-muted"> · {isLatest ? 'latest' : meta}</span>
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-3.5 shrink-0 text-topbar-muted transition-transform duration-200',
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

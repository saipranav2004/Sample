import { cn } from './cn';

/**
 * Two-column work area: persistent facet rail beside the record surface.
 * Below `lg` the rail collapses above the records (it handles that itself).
 */
export function WorkArea({ rail, children, className }) {
  return (
    <div className={cn('grid min-w-0 gap-3.5 lg:grid-cols-[232px_minmax(0,1fr)] lg:items-start', className)}>
      {rail}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * Header strip that sits on top of a record surface: result count on the left,
 * search and view controls on the right. Distinct from the page title strip —
 * this one describes the *result set*, not the screen.
 */
export function RecordBar({ children, trailing, className }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface-2/70 px-3 py-2.5',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">{children}</div>
      {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
    </div>
  );
}

/** Live "N of M" result readout — the count is the operator's feedback loop. */
export function ResultCount({ shown, total, unit, filtered, loading }) {
  if (loading) {
    return <span className="text-[12.5px] text-ink-3">Counting…</span>;
  }
  return (
    <span className="text-[12.5px] text-ink-3" data-numeric="" aria-live="polite">
      <span className="font-semibold text-ink">{shown}</span>
      {filtered && total !== shown ? <> of {total}</> : null} {unit}
    </span>
  );
}

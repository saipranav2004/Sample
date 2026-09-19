import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from './Button';
import { cn } from './cn';

/** Sticky filter bar above a grid: search on the left, refinements on the right. */
export function Toolbar({ children, trailing, className }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface-2/70 px-4 py-3',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">{children}</div>
      {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
    </div>
  );
}

/**
 * Applied filters, shown as removable chips so an operator is never looking
 * at a filtered list without knowing why it is filtered.
 */
export function ActiveFilters({ filters, onRemove, onClearAll, className }) {
  if (!filters || filters.length === 0) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2.5',
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ink-3">
        <SlidersHorizontal aria-hidden="true" className="size-3.5" />
        Filtered by
      </span>
      {filters.map((filter) => (
        <button
          key={filter.key}
          type="button"
          onClick={() => onRemove(filter.key)}
          className="group inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-info-soft px-2.5 py-1 text-[11.5px] font-medium text-brand transition-colors hover:border-brand/50"
        >
          <span className="text-brand/70">{filter.label}</span>
          <span className="truncate">{filter.value}</span>
          <X aria-hidden="true" className="size-3 opacity-60 group-hover:opacity-100" />
          <span className="sr-only">Remove filter</span>
        </button>
      ))}
      {filters.length > 1 && (
        <Button variant="link" size="sm" onClick={onClearAll} className="text-[11.5px]">
          Clear all
        </Button>
      )}
    </div>
  );
}

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';

/**
 * Collapsed-by-default summary section.
 *
 * Used where a breakdown is genuinely useful but is not what the operator came
 * for - it stays one click away instead of pushing the records below the fold.
 */
export function Disclosure({ title, subtitle, defaultOpen = false, children, className }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <section
      className={cn('overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface', className)}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold text-ink">{title}</span>
          {subtitle && <span className="mt-0.5 block text-[12px] text-ink-3">{subtitle}</span>}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0 text-ink-3 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div id={id} className="animate-fade border-t border-line px-4 py-4">
          {children}
        </div>
      )}
    </section>
  );
}

import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { usePopover } from '../lib/hooks';
import { cn } from './cn';

/**
 * Marks a screen whose figures are generated in the browser.
 *
 * Every other screen in this product refuses to show a number it cannot source
 * from a scan. These two features were specified before their API existed, so
 * they carry demonstration data - and the one thing that must never happen is
 * an operator reading these figures as a finding about their estate.
 *
 * So the badge is not decoration and not a tooltip. It is a labelled control
 * that states, on demand, exactly what is generated and what will replace it.
 */
export function DemoBadge({ detail }) {
  const [open, setOpen] = useState(false);
  const { wrapperRef, triggerRef, panelProps } = usePopover(open, () => setOpen(false));

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] uppercase transition-colors duration-150',
          open
            ? 'border-medium/55 bg-medium-soft text-medium'
            : 'border-medium/35 bg-medium-soft text-medium hover:border-medium/60',
        )}
      >
        <FlaskConical aria-hidden="true" className="size-3.5" />
        Demo data
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="About this screen's data"
          {...panelProps}
          className="animate-pop absolute left-0 z-40 w-[min(92vw,22rem)] rounded-[var(--radius-panel)] border border-line bg-surface shadow-lg"
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
            <p className="text-[12.5px] leading-relaxed text-ink-2">
              Every figure on this screen is generated in your browser. Nothing here came from a
              scan, and nothing here describes your estate.
            </p>
            {detail && <p className="mt-2.5 text-[12px] leading-relaxed text-ink-3">{detail}</p>}
            <p className="mt-2.5 text-[12px] leading-relaxed text-ink-3">
              The data is seeded, so it is identical on every reload, and the actions are real:
              what you change is stored locally and survives a refresh. When an endpoint exists,
              the data layer is swapped and these screens stay as they are.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

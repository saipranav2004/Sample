import { useId } from 'react';
import { cn } from './cn';

/**
 * Underlined tab set with a sliding indicator. Keyboard support follows the
 * WAI-ARIA tabs pattern (arrow keys move, and the panel is labelled by its tab).
 */
export function Tabs({ tabs, value, onChange, className, size = 'md' }) {
  const baseId = useId();

  const onKeyDown = (event) => {
    const currentIndex = tabs.findIndex((tab) => tab.value === value);
    if (currentIndex === -1) return;
    let nextIndex = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    onChange(tabs[nextIndex].value);
    document.getElementById(`${baseId}-tab-${tabs[nextIndex].value}`)?.focus();
  };

  return (
    <div
      role="tablist"
      onKeyDown={onKeyDown}
      className={cn(
        '-mb-px flex min-w-0 items-stretch gap-1 overflow-x-auto border-b border-line',
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            id={`${baseId}-tab-${tab.value}`}
            role="tab"
            type="button"
            aria-selected={active}
            aria-controls={`${baseId}-panel-${tab.value}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className={cn(
              'relative inline-flex shrink-0 items-center gap-2 border-b-2 px-3 font-medium transition-colors duration-150',
              size === 'sm' ? 'h-9 text-[12.5px]' : 'h-11 text-[13.5px]',
              active
                ? 'border-brand text-ink'
                : 'border-transparent text-ink-3 hover:border-line-strong hover:text-ink-2',
            )}
          >
            {tab.icon && <tab.icon aria-hidden="true" className="size-4" />}
            {tab.label}
            {tab.count !== undefined && tab.count !== null && (
              <span
                data-numeric=""
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                  active ? 'bg-info-soft text-brand' : 'bg-surface-3 text-ink-3',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, tabValue, value, children, className }) {
  if (tabValue !== value) return null;
  return (
    <div
      role="tabpanel"
      id={id}
      tabIndex={0}
      className={cn('animate-fade focus-visible:outline-none', className)}
    >
      {children}
    </div>
  );
}

/** Segmented control for mutually exclusive view modes. */
export function SegmentedControl({ options, value, onChange, label, className }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-[var(--radius-control)] border border-line bg-surface-2 p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            title={option.title || option.label}
            className={cn(
              'inline-flex h-7.5 items-center gap-1.5 rounded-[7px] px-2.5 text-[12.5px] font-medium transition-colors duration-150',
              active ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {option.icon && <option.icon aria-hidden="true" className="size-3.5" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

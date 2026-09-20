import { cn } from './cn';

/**
 * The single container primitive. Panels are hairline-bordered rather than
 * drop-shadowed so dense screens stay quiet; elevation is reserved for
 * overlays.
 */
export function Panel({ as: Tag = 'section', className, flush = false, children, ...rest }) {
  return (
    <Tag
      className={cn(
        /* min-w-0: a panel is usually a grid item, and grid items default to
           min-width:auto - without this a long line inside would widen the
           whole column past the viewport on small screens. */
        'min-w-0 rounded-[var(--radius-panel)] border border-line bg-surface',
        !flush && 'p-4 sm:p-5',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function PanelHeader({ title, subtitle, icon: Icon, actions, className, children, id }) {
  return (
    <header
      className={cn(
        'flex flex-wrap items-start justify-between gap-x-4 gap-y-2',
        className,
      )}
    >
      <div className="min-w-0">
        <h2
          id={id}
          className="flex items-center gap-2 text-[14.5px] leading-tight font-semibold text-ink"
        >
          {Icon && <Icon aria-hidden="true" className="size-4 shrink-0 text-brand" />}
          <span className="truncate">{title}</span>
        </h2>
        {subtitle && <p className="mt-1 max-w-prose text-[12.5px] text-ink-3">{subtitle}</p>}
        {children}
      </div>
      {actions && (
        /* The slot has to be able to shrink on a phone: a wide action - a count
           pill row, a long label - would otherwise push the panel past the
           viewport. It regains its natural width from `sm` up. */
        <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>
      )}
    </header>
  );
}

/** Small uppercase divider used to group fields and detail rows. */
export function SectionLabel({ children, className }) {
  return (
    <p
      className={cn(
        'text-[10.5px] font-semibold tracking-[0.13em] text-ink-3 uppercase',
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Label/value row used throughout detail views. */
export function DetailRow({ label, children, mono = false, className }) {
  return (
    <div className={cn('grid gap-0.5 py-2 sm:grid-cols-[minmax(0,150px)_minmax(0,1fr)] sm:gap-4', className)}>
      <dt className="text-[12.5px] text-ink-3">{label}</dt>
      <dd
        className={cn(
          'min-w-0 text-[13px] break-words text-ink',
          mono && 'font-mono text-[12.5px]',
        )}
      >
        {children}
      </dd>
    </div>
  );
}

export function DetailList({ className, children }) {
  return <dl className={cn('divide-y divide-line', className)}>{children}</dl>;
}

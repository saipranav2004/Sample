import { cn } from '../ui/cn';

/**
 * Screen header. The eyebrow names the section, the title names the object,
 * and the lede states the operator's job on this screen — so the page
 * explains itself without a tour.
 */
export function PageHeader({ eyebrow, title, lede, actions, meta, className }) {
  return (
    <header className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[10.5px] font-semibold tracking-[0.15em] text-brand uppercase">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1.5 text-[24px] leading-tight font-extrabold tracking-[-0.026em] text-ink sm:text-[27px]">
            {title}
          </h1>
          {lede && (
            <p className="mt-2 max-w-2xl text-balance text-[13px] leading-relaxed text-ink-2">{lede}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {meta}
    </header>
  );
}

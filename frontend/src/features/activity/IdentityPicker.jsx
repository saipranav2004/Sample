import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { fetchIdentities } from '../../lib/api/endpoints';
import { usePopover, useQuery } from '../../lib/hooks';
import { arnResource } from '../../lib/format';
import { Skeleton } from '../../ui/Skeleton';
import { cn } from '../../ui/cn';

/**
 * Identity picker for the activity filter.
 *
 * `GET /api/events` filters by `identity_arn` and by nothing else, and the
 * match is exact. A free-text box against that is honest but unusable: nobody
 * can type a full ARN from memory, so every attempt returned nothing and the
 * filter looked broken.
 *
 * So the ARN is chosen, not typed. The list comes from `/api/identities` -
 * already part of the API - and the search
 * runs over the loaded page client-side, on name and ARN. What leaves this
 * component is always an exact ARN, which is the only thing the events endpoint
 * accepts.
 *
 * No endpoint gained a parameter and no value is guessed. The trade-off is
 * stated in the footer: the picker offers the identities it has loaded, so for
 * a very large account the search box narrows a page rather than the estate.
 *
 * Placement comes from `usePopover`, so the list fits the space below the
 * trigger, or flips above it when that is roomier - it never runs off the
 * bottom of a short window.
 */
const PAGE_SIZE = 100;

export function IdentityPicker({ scanId, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef(null);
  const { wrapperRef, triggerRef, panelProps } = usePopover(open, () => setOpen(false));

  /* Only fetched once the picker is opened - the activity screen should not
     pay for a second list on load. */
  const query = useQuery(
    (signal) => fetchIdentities({ scanId, page: 1, pageSize: PAGE_SIZE }, signal),
    [scanId, open],
    { enabled: open },
  );

  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setSearch('');
  }, [open]);

  const identities = query.data?.rows ?? [];

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const withArn = identities.filter((identity) => identity.arn);
    if (!needle) return withArn;
    return withArn.filter(
      (identity) =>
        String(identity.name || '').toLowerCase().includes(needle) ||
        String(identity.arn).toLowerCase().includes(needle),
    );
  }, [identities, search]);

  const selected = identities.find((identity) => identity.arn === value);
  const label = value ? selected?.name || arnResource(value) : 'Any identity';

  return (
    <div ref={wrapperRef} className="relative min-w-0 basis-72">
      <div className="flex min-w-0 items-center gap-1">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            'flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-control)] border px-2.5 text-left text-[12.5px] transition-colors duration-150',
            open
              ? 'border-brand/55 bg-info-soft'
              : 'border-line-strong bg-surface hover:border-ink-3/50 hover:bg-surface-2',
          )}
        >
          <Search aria-hidden="true" className="size-3.5 shrink-0 text-ink-3" />
          <span className="min-w-0 flex-1 truncate" title={value || undefined}>
            <span className="text-ink-3">Identity </span>
            <span className={cn('font-medium', value ? 'text-ink' : 'text-ink-3')}>{label}</span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-3.5 shrink-0 text-ink-3 transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
        </button>

        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear identity filter"
            title="Clear identity filter"
            className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-control)] border border-line-strong bg-surface text-ink-3 transition-colors hover:border-ink-3/50 hover:text-ink"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div
          role="listbox"
          aria-label="Filter events by identity"
          {...panelProps}
          className="animate-pop absolute left-0 z-40 w-[min(92vw,26rem)] rounded-[var(--radius-panel)] border border-line bg-surface shadow-lg"
        >
          <div className="shrink-0 border-b border-line bg-surface-2 p-2">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or ARN…"
              aria-label="Search identities"
              className="h-8 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-2.5 text-[12.5px] text-ink placeholder:text-ink-3/85 focus:border-brand"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors',
                !value ? 'bg-info-soft' : 'hover:bg-surface-2',
              )}
            >
              <Check
                aria-hidden="true"
                className={cn('size-4 shrink-0', !value ? 'text-brand' : 'text-transparent')}
              />
              <span className="text-[13px] font-medium text-ink">Any identity</span>
            </button>

            {query.isLoading && !query.data && (
              <div className="flex flex-col gap-1 p-1.5" aria-hidden="true">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-8 rounded-md" />
                ))}
              </div>
            )}

            {query.isError && !query.data && (
              <p className="px-2.5 py-3 text-[12px] text-critical">
                The identity list could not be loaded. The ARN filter needs it to offer choices.
              </p>
            )}

            {!query.isLoading && matches.length === 0 && !query.isError && (
              <p className="px-2.5 py-3 text-[12px] text-ink-3">
                {search.trim()
                  ? 'No loaded identity matches that.'
                  : 'This scan discovered no identities with an ARN.'}
              </p>
            )}

            {matches.map((identity) => {
              const active = identity.arn === value;
              return (
                <button
                  key={identity.arn}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(identity.arn);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors',
                    active ? 'bg-info-soft' : 'hover:bg-surface-2',
                  )}
                >
                  <Check
                    aria-hidden="true"
                    className={cn('size-4 shrink-0', active ? 'text-brand' : 'text-transparent')}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">
                      {identity.name || arnResource(identity.arn)}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-ink-3" title={identity.arn}>
                      {identity.arn}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {query.data && (
            <p className="shrink-0 border-t border-line bg-surface-2 px-2.5 py-2 text-[11px] leading-snug text-ink-3">
              Offering the first {identities.length} identities in this scan. The events endpoint
              matches one ARN exactly, so the choice is made here rather than typed.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Fingerprint, Search } from 'lucide-react';
import { fetchIdentities } from '../lib/api/endpoints';
import { useDebouncedValue, useQuery, useScrollLock } from '../lib/hooks';
import { useScanContext } from '../app/ScanContext';
import { useAccess } from '../app/useAccess';
import { ALL_NAV_ITEMS } from './navigation';
import { arnResource } from '../lib/format';
import { classificationMeta } from '../lib/domain';
import { Skeleton } from '../ui/Skeleton';
import { cn } from '../ui/cn';

/**
 * Command palette. Two jobs only, both backed by real endpoints: jump to a
 * section, or find an identity by name/ARN/evidence (the same `search`
 * parameter the explorer uses).
 */
export function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const { selectedScanId } = useScanContext();
  const [term, setTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const debounced = useDebouncedValue(term.trim(), 260);

  useScrollLock(open);

  useEffect(() => {
    if (open) {
      setTerm('');
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const identityQuery = useQuery(
    (signal) =>
      fetchIdentities({ search: debounced, scanId: selectedScanId, page: 1, pageSize: 6 }, signal),
    [debounced, selectedScanId],
    { enabled: open && debounced.length >= 2 },
  );

  const { can } = useAccess();
  const navMatches = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const allowed = ALL_NAV_ITEMS.filter((item) => !item.permission || can(item.permission));
    if (!needle) return allowed;
    return allowed.filter(
      (item) =>
        item.label.toLowerCase().includes(needle) || item.group.toLowerCase().includes(needle),
    );
  }, [term, can]);

  const identityMatches = useMemo(() => identityQuery.data?.rows ?? [], [identityQuery.data]);

  const options = useMemo(
    () => [
      ...navMatches.map((item) => ({
        id: `nav:${item.to}`,
        kind: 'nav',
        label: item.label,
        hint: item.group,
        icon: item.icon,
        run: () => navigate(item.to),
      })),
      ...identityMatches.map((identity) => ({
        id: `identity:${identity.id}`,
        kind: 'identity',
        label: identity.name || arnResource(identity.arn),
        hint: classificationMeta(identity.classification).label,
        sub: identity.arn,
        icon: Fingerprint,
        run: () =>
          navigate(
            identity.id
              ? `/identities/${encodeURIComponent(identity.id)}`
              : `/identities?search=${encodeURIComponent(identity.name || identity.arn)}`,
          ),
      })),
    ],
    [navMatches, identityMatches, navigate],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [term, identityMatches.length]);

  if (!open) return null;

  const commit = (option) => {
    if (!option) return;
    option.run();
    onClose();
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(options.length - 1, index + 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(options[activeIndex]);
    }
  };

  const searching = identityQuery.isLoading && debounced.length >= 2;

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close command palette"
        onClick={onClose}
        className="animate-fade absolute inset-0 bg-[var(--t-overlay)] backdrop-blur-[3px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="animate-pop relative w-full max-w-xl overflow-hidden rounded-[16px] border border-line bg-surface shadow-lg"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
          <input
            ref={inputRef}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to a section, or search identities by name or ARN…"
            aria-label="Search sections and identities"
            aria-controls="command-results"
            className="h-13 min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3"
          />
          <kbd className="hidden shrink-0 rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-3 sm:block">
            Esc
          </kbd>
        </div>

        <div id="command-results" role="listbox" className="max-h-[52vh] overflow-y-auto p-1.5">
          {options.length === 0 && !searching && (
            <p className="px-3 py-8 text-center text-[12.5px] text-ink-3">
              Nothing matches “{term}”. Identity search needs at least two characters.
            </p>
          )}

          {options.map((option, index) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => commit(option)}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors',
                index === activeIndex ? 'bg-surface-3' : 'hover:bg-surface-2',
              )}
            >
              <option.icon aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{option.label}</span>
                {option.sub && (
                  <span className="block truncate font-mono text-[11px] text-ink-3">{option.sub}</span>
                )}
              </span>
              <span className="shrink-0 text-[11px] text-ink-3">{option.hint}</span>
              {index === activeIndex && (
                <CornerDownLeft aria-hidden="true" className="size-3.5 shrink-0 text-ink-3" />
              )}
            </button>
          ))}

          {searching && (
            <div className="flex flex-col gap-2 px-2.5 py-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Skeleton className="size-4 rounded" />
                  <Skeleton className="h-3 flex-1 rounded" />
                </div>
              ))}
            </div>
          )}

          {identityQuery.isError && debounced.length >= 2 && (
            <p className="px-3 py-3 text-[12px] text-critical">
              Identity search failed: {identityQuery.error?.message}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

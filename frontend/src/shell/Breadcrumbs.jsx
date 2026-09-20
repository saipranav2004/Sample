import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { BREADCRUMBS } from './navigation';

/**
 * Where am I. Rendered from a static map so labels match the navigation
 * exactly rather than being reconstructed from URL segments.
 */
export function Breadcrumbs() {
  const { pathname } = useLocation();
  const trail = BREADCRUMBS[pathname];
  if (!trail) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex h-9 items-center gap-1.5 border-b border-line bg-surface px-3 text-[12px] sm:px-5 lg:px-6"
    >
      <Link
        to="/posture"
        className="inline-flex items-center gap-1.5 text-ink-3 transition-colors hover:text-ink-2"
      >
        <Home aria-hidden="true" className="size-3.5" />
        <span className="sr-only sm:not-sr-only">Home</span>
      </Link>
      {trail.map((crumb, index) => {
        const last = index === trail.length - 1;
        return (
          <span key={crumb} className="inline-flex min-w-0 items-center gap-1.5">
            <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-ink-3/70" />
            <span
              aria-current={last ? 'page' : undefined}
              className={last ? 'truncate font-medium text-ink-2' : 'truncate text-ink-3'}
            >
              {crumb}
            </span>
          </span>
        );
      })}
    </nav>
  );
}

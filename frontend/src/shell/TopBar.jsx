import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, Moon, Search, Sun } from 'lucide-react';
import { useAuth } from '../app/AuthContext';
import { useThemeMode } from '../app/ThemeContext';
import { ScanSwitcher } from './ScanSwitcher';
import { BrandLockup } from './Brand';
import { initialsOf, titleCaseEnum } from '../lib/format';
import { cn } from '../ui/cn';

/**
 * Global top bar — full viewport width, above the sidebar.
 *
 * It carries the three things that are true everywhere: who we are (brand),
 * what we are looking at (scan scope), and who is looking (user). It stays
 * navy in both themes so the product keeps its identity when the canvas flips.
 *
 * There is no notification bell, activity icon or help centre: the API exposes
 * no such data, and a control that cannot be populated misrepresents the
 * product.
 */
export function TopBar({ onOpenNav, onOpenCommand }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useThemeMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const iconButton =
    'grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] text-topbar-muted transition-colors hover:bg-topbar-hover hover:text-topbar-ink';

  return (
    <header className="topbar-gradient fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b border-topbar-line px-3 sm:gap-3 sm:px-4">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className={cn(iconButton, 'lg:hidden')}
      >
        <Menu aria-hidden="true" className="size-4.5" />
      </button>

      <Link
        to="/posture"
        aria-label="NHI Console — go to posture overview"
        className="shrink-0 rounded px-1 py-1"
      >
        <BrandLockup variant="inverse" height={22} className="hidden sm:block" />
        <img
          src="/brand/mark.png"
          alt="Deep Algorithms"
          className="block size-6 object-contain sm:hidden"
          draggable="false"
        />
      </Link>

      {/* Logo owns the left corner; every control sits in the right corner. */}
      <div aria-hidden="true" className="flex-1" />

      <div className="flex min-w-0 items-center gap-2">
        {/* Global search — the command palette is the real surface, this is its handle. */}
        <button
          type="button"
          onClick={onOpenCommand}
          className="hidden min-w-0 items-center gap-2.5 rounded-[var(--radius-control)] border border-topbar-line bg-white/[0.07] px-3 py-2 text-left text-[12.5px] text-topbar-muted transition-[background-color,border-color,width] duration-200 hover:border-white/20 hover:bg-white/[0.11] lg:flex lg:w-64 xl:w-80"
        >
          <Search aria-hidden="true" className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">Search…</span>
          <kbd className="shrink-0 rounded border border-topbar-line bg-white/10 px-1.5 py-0.5 font-mono text-[10.5px]">
            ⌘K
          </kbd>
        </button>

        <button
          type="button"
          onClick={onOpenCommand}
          aria-label="Search"
          className={cn(iconButton, 'lg:hidden')}
        >
          <Search aria-hidden="true" className="size-4.5" />
        </button>

        <ScanSwitcher />

        <span aria-hidden="true" className="hidden h-6 w-px bg-topbar-line sm:block" />

        <button
          type="button"
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className={cn(iconButton, 'hidden sm:grid')}
        >
          {theme === 'dark' ? (
            <Sun aria-hidden="true" className="size-4.5" />
          ) : (
            <Moon aria-hidden="true" className="size-4.5" />
          )}
        </button>

        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={cn(
              'flex items-center gap-2.5 rounded-[var(--radius-control)] border py-1 pr-1.5 pl-1 transition-colors',
              menuOpen ? 'border-white/20 bg-white/10' : 'border-transparent hover:bg-topbar-hover',
            )}
          >
            <span
              aria-hidden="true"
              className="grid size-7.5 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,var(--t-brand)_0%,var(--t-accent)_100%)] text-[11.5px] font-bold text-white"
            >
              {initialsOf(user?.full_name || user?.email)}
            </span>
            <span className="hidden min-w-0 text-left lg:block">
              <span className="block max-w-36 truncate text-[12.5px] leading-tight font-semibold text-topbar-ink">
                {user?.full_name || user?.email || 'Signed in'}
              </span>
              <span className="block max-w-36 truncate text-[10.5px] leading-tight text-topbar-muted">
                {[user?.role ? titleCaseEnum(user.role) : null, user?.team].filter(Boolean).join(' · ') || '—'}
              </span>
            </span>
            <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-topbar-muted" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="animate-pop absolute right-0 z-50 mt-1.5 w-64 overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface shadow-lg"
            >
              <div className="border-b border-line bg-surface-2 px-3.5 py-3">
                <p className="truncate text-[13px] font-semibold text-ink">
                  {user?.full_name || 'Signed in'}
                </p>
                {user?.email && <p className="mt-0.5 truncate text-[12px] text-ink-3">{user.email}</p>}
                <dl className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
                  <div>
                    <dt className="text-[10px] font-semibold tracking-[0.1em] text-ink-3 uppercase">Role</dt>
                    <dd className="text-[12px] font-medium text-ink-2">
                      {user?.role ? titleCaseEnum(user.role) : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold tracking-[0.1em] text-ink-3 uppercase">Team</dt>
                    <dd className="text-[12px] font-medium text-ink-2">{user?.team || '—'}</dd>
                  </div>
                </dl>
              </div>
              <div className="p-1">
                <button
                  role="menuitem"
                  type="button"
                  onClick={toggle}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink sm:hidden"
                >
                  {theme === 'dark' ? (
                    <Sun aria-hidden="true" className="size-4" />
                  ) : (
                    <Moon aria-hidden="true" className="size-4" />
                  )}
                  {theme === 'dark' ? 'Light theme' : 'Dark theme'}
                </button>
                <button
                  role="menuitem"
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink"
                >
                  <LogOut aria-hidden="true" className="size-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

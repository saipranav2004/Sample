import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Menu, Monitor, Moon, Search, Sun } from 'lucide-react';
import { useAuth } from '../app/AuthContext';
import { useThemeMode } from '../app/ThemeContext';
import { BrandLockup } from './Brand';
import { ScanSwitcher } from './ScanSwitcher';
import { initialsOf, titleCaseEnum } from '../lib/format';
import { cn } from '../ui/cn';

const APPEARANCE = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/**
 * Global top bar - full viewport width, follows the theme.
 *
 * The brand sits in the left corner at a size that reads as a product mark
 * rather than a favicon; everything else sits in the right corner: scan scope,
 * search, then the account avatar. The bar is 64px so those controls can be
 * full-height targets instead of squeezed into a strip.
 *
 * Scan scope is here, not in the context row, because it is global state - it
 * rescopes every screen at once, and a console keeps global state in its global
 * chrome. Appearance lives in the account menu: a permanent slot in the chrome
 * is too expensive for a setting people change twice a year.
 */
export function TopBar({ onOpenNav, onOpenCommand }) {
  const { user, logout } = useAuth();
  const { preference, setPreference } = useThemeMode();
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
    'grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] text-topbar-muted transition-colors hover:bg-topbar-hover hover:text-topbar-ink';

  return (
    <header className="topbar-surface fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-2 border-b border-topbar-line px-3 sm:px-4 lg:px-5">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className={cn(iconButton, 'lg:hidden')}
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>

      <Link
        to="/posture"
        aria-label="Deep Algorithms - go to posture overview"
        className="shrink-0 rounded px-1"
      >
        <BrandLockup height={34} className="hidden sm:inline-flex" />
        <img
          src="/brand/mark.png"
          alt="Deep Algorithms"
          className="block size-8 object-contain sm:hidden"
          draggable="false"
        />
      </Link>

      <div aria-hidden="true" className="flex-1" />

      {/* Global scan scope. Marked shrinkable so a long target name yields to
          the controls beside it instead of widening the bar. */}
      <ScanSwitcher />

      {/* Search - a real control, not an afterthought. The palette behind it
          carries section jumps and identity lookup. */}
      <button
        type="button"
        onClick={onOpenCommand}
        className="hidden h-9 min-w-0 shrink-0 items-center gap-2.5 rounded-[var(--radius-control)] border border-topbar-line bg-topbar-field px-3 text-left text-[13px] text-topbar-muted transition-[background-color,border-color] duration-150 hover:border-ink-3/45 hover:text-topbar-ink lg:flex lg:w-56 xl:w-64"
      >
        <Search aria-hidden="true" className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">Search</span>
        <kbd className="shrink-0 rounded border border-topbar-line bg-topbar px-1.5 py-0.5 font-mono text-[10.5px]">
          ⌘K
        </kbd>
      </button>

      <button type="button" onClick={onOpenCommand} aria-label="Search" className={cn(iconButton, 'lg:hidden')}>
        <Search aria-hidden="true" className="size-5" />
      </button>

      {/* Account - the avatar only. Identity details belong in the menu. */}
      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Account menu for ${user?.full_name || user?.email || 'signed-in user'}`}
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-full transition-[box-shadow,transform] duration-150',
            menuOpen ? 'ring-2 ring-brand/45' : 'hover:ring-2 hover:ring-line-strong',
          )}
        >
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-full bg-[linear-gradient(135deg,var(--t-brand)_0%,var(--t-accent)_100%)] text-[13px] font-bold text-white"
          >
            {initialsOf(user?.full_name || user?.email)}
          </span>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="animate-pop absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface shadow-lg"
          >
            <div className="flex items-start gap-3 border-b border-line bg-surface-2 px-3.5 py-3.5">
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,var(--t-brand)_0%,var(--t-accent)_100%)] text-[13px] font-bold text-white"
              >
                {initialsOf(user?.full_name || user?.email)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold text-ink">
                  {user?.full_name || 'Signed in'}
                </span>
                {user?.email && (
                  <span className="mt-0.5 block truncate text-[12px] text-ink-3">{user.email}</span>
                )}
                <span className="mt-1.5 flex flex-wrap gap-1.5">
                  {user?.role && (
                    <span className="rounded-full border border-brand/25 bg-info-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-brand">
                      {titleCaseEnum(user.role)}
                    </span>
                  )}
                  {user?.team && (
                    <span className="rounded-full border border-line-strong bg-surface-3 px-1.5 py-0.5 text-[10.5px] font-medium text-ink-2">
                      {user.team}
                    </span>
                  )}
                </span>
              </span>
            </div>

            <div className="border-b border-line px-3.5 py-3">
              <p className="text-[10.5px] font-semibold tracking-[0.12em] text-ink-3 uppercase">
                Appearance
              </p>
              <div
                role="radiogroup"
                aria-label="Appearance"
                className="mt-2 grid grid-cols-3 gap-1 rounded-[var(--radius-control)] border border-line bg-surface-2 p-1"
              >
                {APPEARANCE.map((option) => {
                  const active = preference === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setPreference(option.value)}
                      className={cn(
                        'flex h-8 flex-col items-center justify-center gap-0.5 rounded-[7px] text-[11px] font-medium transition-colors duration-150',
                        active ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2',
                      )}
                    >
                      <option.icon aria-hidden="true" className="size-3.5" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-1">
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
    </header>
  );
}


import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Menu, Moon, Search, Sun } from 'lucide-react';
import { useAuth } from '../app/AuthContext';
import { useThemeMode } from '../app/ThemeContext';
import { ScanSwitcher } from './ScanSwitcher';
import { initialsOf, titleCaseEnum } from '../lib/format';
import { IconButton } from '../ui/Button';
import { cn } from '../ui/cn';

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

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-canvas/88 px-3 backdrop-blur-md sm:gap-3 sm:px-5">
      <IconButton
        icon={Menu}
        label="Open navigation"
        onClick={onOpenNav}
        className="shrink-0 lg:hidden"
      />

      <ScanSwitcher />

      <div className="hidden flex-1 sm:block" />

      <button
        type="button"
        onClick={onOpenCommand}
        className="hidden items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface py-1.5 pr-2 pl-3 text-[12.5px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink-2 md:flex"
      >
        <Search aria-hidden="true" className="size-3.5" />
        <span>Search</span>
        <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px]">
          ⌘K
        </kbd>
      </button>
      <IconButton
        icon={Search}
        label="Search"
        onClick={onOpenCommand}
        className="shrink-0 md:hidden"
      />

      <IconButton
        icon={theme === 'dark' ? Sun : Moon}
        label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        onClick={toggle}
        className="shrink-0"
      />

      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={cn(
            'flex items-center gap-2 rounded-[var(--radius-control)] border py-1 pr-1.5 pl-1 transition-colors',
            menuOpen ? 'border-line-strong bg-surface' : 'border-transparent hover:bg-surface-3',
          )}
        >
          <span
            aria-hidden="true"
            className="grid size-7.5 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,var(--t-brand)_0%,var(--t-accent)_100%)] text-[11.5px] font-bold text-white"
          >
            {initialsOf(user?.full_name || user?.email)}
          </span>
          <span className="hidden min-w-0 text-left sm:block">
            <span className="block max-w-32 truncate text-[12.5px] leading-tight font-semibold text-ink">
              {user?.full_name || user?.email || 'Signed in'}
            </span>
            <span className="block max-w-32 truncate text-[10.5px] leading-tight text-ink-3">
              {user?.role ? titleCaseEnum(user.role) : '—'}
            </span>
          </span>
          <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-ink-3" />
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

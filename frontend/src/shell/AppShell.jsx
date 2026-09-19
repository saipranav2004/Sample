import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SideRail } from './SideRail';
import { TopBar } from './TopBar';
import { CommandPalette } from './CommandPalette';
import { cn } from '../ui/cn';

const COLLAPSE_KEY = 'dna.rail.collapsed';

export function AppShell() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  const toggleCollapse = useCallback(() => {
    setCollapsed((value) => {
      const next = !value;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* non-fatal */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[90] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-[13px] focus:font-medium focus:text-ink focus:shadow-lg"
      >
        Skip to content
      </a>

      <SideRail
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div
        className={cn(
          'flex min-h-dvh flex-col transition-[padding] duration-250 ease-[var(--ease-out-quint)]',
          collapsed ? 'lg:pl-[68px]' : 'lg:pl-[236px]',
        )}
      >
        <TopBar onOpenNav={() => setMobileOpen(true)} onOpenCommand={() => setCommandOpen(true)} />
        <main id="main" className="flex-1 px-3 pt-5 pb-14 sm:px-5 lg:px-7">
          <div className="mx-auto w-full max-w-[1520px]">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  );
}

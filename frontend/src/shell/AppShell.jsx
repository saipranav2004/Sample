import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ContextBar } from './ContextBar';
import { CommandPalette } from './CommandPalette';
import { cn } from '../ui/cn';

const COLLAPSE_KEY = 'dna.sidebar.collapsed';

/**
 * Console shell: a fixed full-width top bar, a sidebar beneath it, and a
 * content column that owns its own breadcrumb, title and toolbars.
 */
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
        /* per-viewer convenience only - safe to lose */
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

      <TopBar onOpenNav={() => setMobileOpen(true)} onOpenCommand={() => setCommandOpen(true)} />

      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div
        className={cn(
          'flex min-h-dvh flex-col pt-14 transition-[padding] duration-250 ease-[var(--ease-out-quint)]',
          collapsed ? 'lg:pl-[60px]' : 'lg:pl-[232px]',
        )}
      >
        <ContextBar />
        <main id="main" className="flex-1 px-3 pt-4 pb-14 sm:px-5 lg:px-6">
          <div className="mx-auto w-full max-w-[1640px]">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  );
}

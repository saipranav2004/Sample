import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { BrandLockup, ProductWordmark } from './Brand';
import { NAV_GROUPS } from './navigation';
import { IconButton } from '../ui/Button';
import { cn } from '../ui/cn';

function RailLink({ item, collapsed, onNavigate }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-[var(--radius-control)] px-2.5 py-2 text-[13px] font-medium transition-colors duration-150',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-white/[0.07] text-white'
            : 'text-rail-ink/72 hover:bg-white/[0.045] hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden="true"
            className={cn(
              'absolute top-1/2 left-0 h-5 w-[2.5px] -translate-y-1/2 rounded-r-full transition-[opacity,height] duration-200',
              isActive ? 'bg-accent opacity-100' : 'h-2 opacity-0',
            )}
          />
          <item.icon aria-hidden="true" className="size-4.5 shrink-0" />
          {!collapsed && <span className="min-w-0 truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  );
}

/**
 * Persistent dark navigation rail. It stays dark in both themes: it is the
 * brand anchor, and it keeps the content canvas free of chrome.
 */
export function SideRail({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) {
  const content = (
    <>
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-rail-line bg-white/[0.035]',
          collapsed ? 'justify-center px-2' : 'justify-between px-4',
        )}
      >
        {collapsed ? <ProductWordmark className="[&>span:last-child]:hidden" /> : <BrandLockup height={22} />}
        {!collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse navigation"
            className="hidden size-7 place-items-center rounded-md text-rail-muted transition-colors hover:bg-white/[0.06] hover:text-white lg:grid"
          >
            <PanelLeftClose aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>

      <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.key} className="mb-4 last:mb-0">
            {group.label && !collapsed && (
              <p className="mb-1.5 px-2.5 text-[10px] font-semibold tracking-[0.14em] text-rail-muted/80 uppercase">
                {group.label}
              </p>
            )}
            {group.label && collapsed && <div aria-hidden="true" className="mx-3 mb-2 border-t border-rail-line" />}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <RailLink key={item.to} item={item} collapsed={collapsed} onNavigate={onCloseMobile} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {collapsed && (
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Expand navigation"
          className="mx-auto mb-2 hidden size-8 place-items-center rounded-md text-rail-muted transition-colors hover:bg-white/[0.06] hover:text-white lg:grid"
        >
          <PanelLeftOpen aria-hidden="true" className="size-4" />
        </button>
      )}
    </>
  );

  return (
    <>
      <aside
        className={cn(
          'rail-gradient fixed top-0 bottom-0 left-0 z-40 hidden shrink-0 flex-col transition-[width] duration-250 ease-[var(--ease-out-quint)] lg:flex',
          collapsed ? 'w-[68px]' : 'w-[236px]',
        )}
      >
        {content}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onCloseMobile}
            className="animate-fade absolute inset-0 bg-[var(--t-overlay)] backdrop-blur-[2px]"
          />
          <aside
            className="rail-gradient animate-fade relative flex w-[272px] flex-col shadow-lg"
            aria-label="Primary navigation"
          >
            <IconButton
              icon={X}
              label="Close navigation"
              onClick={onCloseMobile}
              className="absolute top-3 right-3 z-10 text-rail-muted hover:bg-white/10 hover:text-white"
            />
            {content}
          </aside>
        </div>
      )}
    </>
  );
}

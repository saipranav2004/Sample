import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { useAccess } from '../app/useAccess';
import { navGroupsFor } from './navigation';
import { IconButton } from '../ui/Button';
import { cn } from '../ui/cn';

/**
 * Navigation only - no brand, no user chrome, no search. Those belong to the
 * top bar, which spans the viewport above this. The sidebar is an application
 * surface that recedes behind the content it navigates to.
 */
function SidebarLink({ item, collapsed, onNavigate, badge }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2 text-[13px] transition-colors duration-150',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-info-soft font-semibold text-brand'
            : 'font-medium text-ink-2 hover:bg-surface-3 hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden="true"
            className={cn(
              'absolute top-1/2 left-0 w-[3px] -translate-y-1/2 rounded-r-full bg-brand transition-[height,opacity] duration-200',
              isActive ? 'h-5 opacity-100' : 'h-2 opacity-0',
            )}
          />
          <item.icon aria-hidden="true" className="size-4 shrink-0 opacity-80" />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {badge}
            </>
          )}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile, badges }) {
  const { can } = useAccess();
  const content = (
    <>
      {/* Module header. The collapse control belongs at the top, where an
          operator reaches for it - not buried at the bottom of the list. */}
      <div
        className={cn(
          'flex h-12 shrink-0 items-center',
          collapsed ? 'justify-center px-0' : 'gap-2 px-3.5',
        )}
      >
        {/* Collapsed, the rail shows icons only: an abbreviation of the module
            name would be one more thing to decode, and the expand control
            already says what the rail is. */}
        {!collapsed && (
          <span className="min-w-0 truncate font-display text-[12px] leading-tight font-extrabold tracking-[0.1em] text-ink uppercase">
            NHI Discovery
          </span>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          className={cn(
            'hidden size-7 shrink-0 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink lg:grid',
            !collapsed && 'ml-auto',
          )}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" className="size-4" />
          ) : (
            <PanelLeftClose aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>

      <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
        {navGroupsFor(can).map((group, groupIndex) => (
          <div key={group.key} className="mb-3.5 last:mb-0">
            {group.label && !collapsed && (
              <p className="mb-1.5 px-2.5 text-[10px] font-semibold tracking-[0.14em] text-ink-3 uppercase">
                {group.label}
              </p>
            )}
            {/* Collapsed, a rule stands in for the group label - but never
                above the first group, where it would read as a divider under
                the module name. */}
            {group.label && collapsed && groupIndex > 0 && (
              <div aria-hidden="true" className="mx-3 mb-2 border-t border-line" />
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <SidebarLink
                  key={item.to}
                  item={item}
                  collapsed={collapsed}
                  onNavigate={onCloseMobile}
                  badge={badges?.[item.to]}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

    </>
  );

  return (
    <>
      <aside
        className={cn(
          'fixed top-16 bottom-0 left-0 z-30 hidden shrink-0 flex-col border-r border-sidebar-line bg-sidebar transition-[width] duration-250 ease-[var(--ease-out-quint)] lg:flex',
          collapsed ? 'w-[60px]' : 'w-[232px]',
        )}
      >
        {content}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 top-16 z-50 flex lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onCloseMobile}
            className="animate-fade absolute inset-0 bg-[var(--t-overlay)] backdrop-blur-[2px]"
          />
          <aside
            className="animate-fade relative flex w-[268px] flex-col border-r border-sidebar-line bg-sidebar shadow-lg"
            aria-label="Primary navigation"
          >
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <span className="text-[10.5px] font-semibold tracking-[0.14em] text-ink-3 uppercase">
                Navigate
              </span>
              <IconButton icon={X} label="Close navigation" size="sm" onClick={onCloseMobile} />
            </div>
            {content}
          </aside>
        </div>
      )}
    </>
  );
}

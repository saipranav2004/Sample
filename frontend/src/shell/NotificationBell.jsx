import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpCircle, Bell, UserCheck } from 'lucide-react';
import { useAuth } from '../app/AuthContext';
import { severityMeta } from '../lib/domain';
import { formatDateTime, formatRelative } from '../lib/format';
import { usePopover } from '../lib/hooks';
import { lastSeenBy, markAllSeen, notificationsFor } from '../lib/demo/notifications';
import { subscribeOverlay } from '../lib/demo/runtime';
import { Tag } from '../ui/Tag';
import { cn } from '../ui/cn';

/**
 * The bell: alerts somebody assigned or escalated to you since you last
 * looked. Opening it marks them read; each one opens its alert.
 */
export function NotificationBell({ className }) {
  const { user } = useAuth();
  const me = user?.username ?? null;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  /* Bumped by every demo write, so the badge follows an assignment made in
     another part of the app without a reload. The reads below are cheap and
     happen on each render. */
  const [, setRevision] = useState(0);
  /* The read mark as it was when the panel opened, so the items that were
     new stay highlighted while the reader looks at them. */
  const [seenAtOpen, setSeenAtOpen] = useState(null);
  const { wrapperRef, triggerRef, panelProps } = usePopover(open, () => setOpen(false));

  useEffect(() => subscribeOverlay(() => setRevision((value) => value + 1)), []);

  const items = notificationsFor(me);
  const lastSeen = lastSeenBy(me);
  const unread = items.filter((item) => !lastSeen || Date.parse(item.at) > Date.parse(lastSeen)).length;

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setSeenAtOpen(lastSeen);
    setOpen(true);
    if (unread > 0) markAllSeen(me);
  };

  if (!me) return null;

  return (
    <div ref={wrapperRef} className={cn('relative shrink-0', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        title="Notifications"
        className="relative grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] text-topbar-muted transition-colors hover:bg-topbar-hover hover:text-topbar-ink"
      >
        <Bell aria-hidden="true" className="size-5" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-critical px-1 text-[10px] leading-4 font-bold text-white"
            data-numeric=""
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          {...panelProps}
          /* On a phone the bell is not at the edge of the bar - the theme
             toggle and the avatar sit to its right - so a panel anchored to it
             ran off the left of the screen. Below `sm` it is pinned to the
             viewport under the bar instead. */
          className="animate-pop fixed inset-x-3 top-[4.25rem] z-50 overflow-y-auto rounded-[var(--radius-panel)] border border-line bg-surface shadow-lg sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-1 sm:w-[22rem]"
        >
          <div className="border-b border-line bg-surface-2 px-3.5 py-2.5">
            <p className="text-[13px] font-semibold text-ink">Notifications</p>
            <p className="text-[11.5px] text-ink-3">Alerts assigned or escalated to you by someone else.</p>
          </div>
          {items.length === 0 ? (
            <p className="px-3.5 py-6 text-center text-[12.5px] text-ink-3">
              Nothing yet. When someone hands you an alert, it shows up here.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((item) => {
                const fresh = !seenAtOpen || Date.parse(item.at) > Date.parse(seenAtOpen);
                const Icon = item.kind === 'escalated' ? ArrowUpCircle : UserCheck;
                const severity = item.severity ? severityMeta(item.severity) : null;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        navigate(`/alerts?alert=${encodeURIComponent(item.alertId)}`);
                      }}
                      className={cn(
                        'flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-2',
                        fresh && 'bg-info-soft/60',
                      )}
                    >
                      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] leading-snug text-ink-2">
                          <span className="font-medium text-ink">{item.actor}</span>{' '}
                          {item.kind === 'escalated' ? 'escalated to you' : 'assigned you'}
                        </span>
                        <span className="mt-0.5 block truncate text-[12.5px] font-medium text-ink">{item.title}</span>
                        <span className="mt-1 flex items-center gap-2">
                          {severity && (
                            <Tag tone={severity.tone} size="sm" dot>
                              {severity.label}
                            </Tag>
                          )}
                          <span className="text-[11px] text-ink-3" title={formatDateTime(item.at)}>
                            {formatRelative(item.at)}
                          </span>
                        </span>
                      </span>
                      {fresh && <span className="sr-only">(new)</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

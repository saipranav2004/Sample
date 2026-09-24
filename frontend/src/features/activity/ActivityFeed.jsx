import { Link } from 'react-router-dom';
import { Eye, PenLine } from 'lucide-react';
import { arnResource, formatDateTime, formatRelative } from '../../lib/format';
import { ListSkeleton } from '../../ui/Skeleton';
import { EmptyState, InlineError } from '../../ui/States';
import { cn } from '../../ui/cn';

/**
 * CloudTrail events as a timeline. `read_only` is the one field that separates
 * a look from a change, so it drives the icon and the accent - everything else
 * is supporting detail.
 */
export function ActivityFeed({ events, loading, error, onRetry, limit, emptyHint }) {
  if (loading) return <ListSkeleton rows={limit || 5} />;
  if (error) return <InlineError error={error} onRetry={onRetry} label="Activity unavailable" />;

  if (!events || events.length === 0) {
    return (
      <EmptyState
        compact
        icon={Eye}
        title="No CloudTrail events recorded"
        description={
          emptyHint ||
          'This scan captured no API activity for the selected scope. Events appear once CloudTrail data is ingested.'
        }
      />
    );
  }

  const rows = limit ? events.slice(0, limit) : events;

  return (
    <ol className="flex flex-col">
      {rows.map((event, index) => {
        const mutating = String(event.read_only).toLowerCase() !== 'true';
        const Icon = mutating ? PenLine : Eye;

        return (
          <li key={`${event.id}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
            <span className="relative flex shrink-0 flex-col items-center">
              <span
                className={cn(
                  'grid size-7 place-items-center rounded-full border',
                  mutating
                    ? 'border-high/30 bg-high-soft text-high'
                    : 'border-line bg-surface-2 text-ink-3',
                )}
              >
                <Icon aria-hidden="true" className="size-3.5" />
              </span>
              {index < rows.length - 1 && (
                <span aria-hidden="true" className="mt-1 w-px flex-1 bg-line" />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="min-w-0 truncate text-[13px] font-semibold text-ink" title={event.event_name}>
                  {event.event_name || 'Unnamed event'}
                </p>
                <time
                  className="shrink-0 text-[11.5px] text-ink-3"
                  dateTime={event.event_time || undefined}
                  title={formatDateTime(event.event_time)}
                >
                  {formatRelative(event.event_time)}
                </time>
              </div>

              <p className="mt-0.5 truncate text-[12px] text-ink-2">
                {event.identity_name ? (
                  <Link
                    to={
                      event.identity_id
                        ? `/identities/${encodeURIComponent(event.identity_id)}`
                        : `/identities?search=${encodeURIComponent(event.identity_name)}`
                    }
                    className="font-medium text-brand hover:underline"
                  >
                    {event.identity_name}
                  </Link>
                ) : (
                  <span className="text-ink-3">{arnResource(event.identity_arn)}</span>
                )}
                {event.event_source && <span className="text-ink-3"> · {event.event_source}</span>}
              </p>

              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-3">
                {event.source_ip && <span className="font-mono">{event.source_ip}</span>}
                {event.region && <span>{event.region}</span>}
                <span className={mutating ? 'font-medium text-high' : ''}>
                  {mutating ? 'Mutating' : 'Read-only'}
                </span>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

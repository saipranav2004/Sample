import { Link } from 'react-router-dom';
import { formatNumber } from '../../lib/format';
import { cn } from '../../ui/cn';
import { ALERT_REFRESH_MS } from './AlertFeed';

/** Tells the reader the queue is live, and how live. */
export function LiveStatus({ refreshing }) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-[11.5px] font-medium text-ink-2">
      <span aria-hidden="true" className="relative flex size-2">
        {!refreshing && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-low opacity-60 motion-reduce:hidden" />
        )}
        <span className={cn('relative inline-flex size-2 rounded-full', refreshing ? 'bg-ink-3' : 'bg-low')} />
      </span>
      Live
      <span className="sr-only">
        : refreshes every {ALERT_REFRESH_MS / 1000} seconds, and as soon as an alert changes
      </span>
    </span>
  );
}

/**
 * An analyst's one-line status, in place of the tiles: how much is theirs,
 * and which parts of it need them first. Each figure opens its view.
 */
export function QueueSummary({ loading, open, counts }) {
  if (loading) return <div className="skeleton h-5 w-80 max-w-full rounded" aria-hidden="true" />;
  if (open.length === 0) {
    return <p className="text-[13px] text-ink-2">Nothing open is assigned to you right now.</p>;
  }
  const critical = open.filter((alert) => alert.severity === 'CRITICAL').length;
  const parts = [
    critical > 0 && { key: 'critical', text: `${formatNumber(critical)} critical`, to: '/alerts?severity=CRITICAL', tone: 'text-critical' },
    counts.unacked > 0 && { key: 'unacked', text: `${formatNumber(counts.unacked)} not acknowledged`, to: '/alerts?view=unacked', tone: 'text-high' },
    counts.overdue > 0 && { key: 'overdue', text: `${formatNumber(counts.overdue)} past a response target`, to: '/alerts?view=overdue', tone: 'text-critical' },
  ].filter(Boolean);
  return (
    <p className="text-[13px] leading-relaxed text-ink-2">
      <span className="font-semibold text-ink">
        {formatNumber(open.length)} open alert{open.length === 1 ? ' is' : 's are'} yours
      </span>
      {parts.length > 0 ? ': ' : '.'}
      {parts.map((part, index) => (
        <span key={part.key}>
          {index > 0 && (index === parts.length - 1 ? ' and ' : ', ')}
          <Link to={part.to} className={cn('font-medium underline-offset-4 hover:underline', part.tone)}>
            {part.text}
          </Link>
        </span>
      ))}
      {parts.length > 0 && '.'}
    </p>
  );
}


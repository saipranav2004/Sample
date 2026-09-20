import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { POSTURE_SIGNALS } from '../../lib/domain';
import { formatNumber, formatPercent, percentValue } from '../../lib/format';
import { Meter } from '../../ui/Meter';
import { Skeleton } from '../../ui/Skeleton';
import { cn, TONE_BG } from '../../ui/cn';

/**
 * Exposure signals, ranked by share of their own population.
 *
 * Each row is a link into the identity explorer carrying the exact filter the
 * API supports for that signal - so the number on the dashboard and the list
 * behind it can never disagree.
 */
export function SignalList({ summary, loading }) {
  if (loading) {
    return (
      <ul className="flex flex-col divide-y divide-line">
        {Array.from({ length: 5 }).map((_, index) => (
          <li key={index} className="flex items-center gap-4 py-3">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3 w-40 rounded" />
              <Skeleton className="mt-2.5 h-1.5 w-full rounded-full" />
            </div>
            <Skeleton className="h-6 w-12 rounded" />
          </li>
        ))}
      </ul>
    );
  }

  const rows = POSTURE_SIGNALS.map((signal) => {
    const count = Number(summary?.[signal.field]) || 0;
    const denominator = Number(summary?.[signal.denominator]) || 0;
    return { signal, count, denominator, share: percentValue(count, denominator) };
  }).sort((a, b) => b.share - a.share || b.count - a.count);

  return (
    <ul className="flex flex-col divide-y divide-line">
      {rows.map(({ signal, count, denominator, share }) => {
        const params = new URLSearchParams(signal.query).toString();
        const inert = count === 0;

        return (
          <li key={signal.key}>
            <Link
              to={`/identities?${params}`}
              className="group flex items-center gap-4 py-3 transition-opacity duration-150"
              aria-label={`${count} ${signal.label} - open in identity explorer`}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  {/* Colour appears in the mark, not the words: hue is a
                      secondary cue here, and a list of coloured labels reads
                      as decoration rather than as severity. */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      inert ? 'bg-line-strong' : TONE_BG[signal.tone],
                    )}
                  />
                  <span className="truncate text-[13px] font-semibold text-ink">
                    {signal.label}
                  </span>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </span>
                <span className="mt-1 block truncate pl-4 text-[11.5px] text-ink-3">
                  {signal.rationale}
                </span>
                <Meter
                  value={share}
                  tone={inert ? 'neutral' : signal.tone}
                  height={4}
                  className="mt-2 ml-4"
                  label={`${signal.label} share`}
                />
              </span>

              <span className="w-24 shrink-0 text-right">
                <span
                  data-numeric=""
                  className={cn(
                    'block font-display text-[19px] leading-none font-extrabold',
                    inert ? 'text-ink-3' : 'text-ink',
                  )}
                >
                  {formatNumber(count)}
                </span>
                <span className="mt-1 block text-[11px] text-ink-3" data-numeric="">
                  {denominator > 0 ? `${formatPercent(count, denominator, 1)} ${signal.denominatorLabel}` : '-'}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

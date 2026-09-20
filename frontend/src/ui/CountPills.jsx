import { Link } from 'react-router-dom';
import { formatNumber } from '../lib/format';
import { cn, TONE_BG, TONE_FG } from './cn';

/**
 * Count pills.
 *
 * The pattern enterprise consoles actually use above a record list - Microsoft
 * Defender's device inventory is the reference: a short row of counts at the
 * top of the table, most of them doubling as filters, with the table itself
 * getting the screen. A metric-tile strip on a list page spends a third of the
 * viewport restating numbers the operator came to filter, and NN/g's
 * complex-application guidance is blunt about the cost: removing superfluous
 * visual elements is what makes the remaining data salient.
 *
 * Tiles are therefore reserved for the posture dashboard and for the two
 * code-exposure figures that are themselves the work queue.
 *
 * `pills` entries: { key, label, value, tone?, to?, onSelect?, active?, title? }
 */
export function CountPills({ pills, loading = false, className, ariaLabel = 'Summary counts' }) {
  if (loading) {
    return (
      <div className={cn('flex flex-wrap items-center gap-1.5', className)} aria-hidden="true">
        {Array.from({ length: 3 }).map((_, index) => (
          <span key={index} className="skeleton h-6 w-28 rounded-full" />
        ))}
      </div>
    );
  }

  const visible = pills.filter(Boolean);
  if (visible.length === 0) return null;

  return (
    <ul aria-label={ariaLabel} className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {visible.map((pill) => {
        const tone = pill.tone || 'neutral';
        const interactive = Boolean(pill.to || pill.onSelect);

        const body = (
          <>
            {tone !== 'neutral' && (
              <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', TONE_BG[tone])} />
            )}
            <span className="truncate">{pill.label}</span>
            <span
              data-numeric=""
              className={cn(
                'shrink-0 font-semibold',
                pill.active ? 'text-brand' : tone === 'neutral' ? 'text-ink' : TONE_FG[tone],
              )}
            >
              {formatNumber(pill.value)}
            </span>
          </>
        );

        const shell = cn(
          'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] transition-colors duration-150',
          pill.active
            ? 'border-brand/45 bg-info-soft text-brand'
            : 'border-line bg-surface-2 text-ink-2',
          interactive && !pill.active && 'hover:border-line-strong hover:bg-surface-3 hover:text-ink',
        );

        return (
          <li key={pill.key} className="min-w-0">
            {pill.to ? (
              <Link to={pill.to} className={shell} title={pill.title} aria-current={pill.active ? 'true' : undefined}>
                {body}
              </Link>
            ) : pill.onSelect ? (
              <button
                type="button"
                onClick={pill.onSelect}
                aria-pressed={Boolean(pill.active)}
                className={shell}
                title={pill.title}
              >
                {body}
              </button>
            ) : (
              <span className={shell} title={pill.title}>
                {body}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
